"""
DukaanMitra MCP Tool Gateway & Agent Interface (Phase 3.7 Hardened)
Implements Model Context Protocol (MCP) typed tools with:
- Verified signed server identity context (never trusts client-supplied tenant_id or approver_role)
- Explicit tool permission registry (read/write classification & allowed roles)
- Human-approval enforcement for sensitive write tools
- Rate limiting, prompt-injection defense, and audit logging
"""
import base64
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from compliance_rules import (
    calculate_gst_breakdown,
    get_compliance_calendar,
    match_gstr2b,
    validate_gstin,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.getenv("DUKAANMITRA_DB", os.path.join(BASE_DIR, "dukaanmitra.db"))
MCP_GATEWAY_SECRET = os.getenv("MCP_GATEWAY_SECRET", "").strip()

FORBIDDEN_OVERRIDE_KEYS = frozenset({
    "tenant_id",
    "tenantId",
    "shopId",
    "shop_id",
    "actor",
    "actor_id",
    "actorId",
    "role",
    "actor_role",
    "approver_role",
    "approverRole",
})

PROMPT_INJECTION_PATTERNS = [
    re.compile(r"\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|system)\s+(instructions?|prompts?|rules?)\b", re.I),
    re.compile(r"\b(you\s+are\s+now|act\s+as|switch\s+to)\s+(a\s+)?(super_?admin|system|root|owner)\b", re.I),
    re.compile(r"\b(approver_role|actor_role|tenant_id)\s*[:=]\s*['\"]?(super_admin|owner|manager|admin)", re.I),
]

VALID_ROLES = frozenset({"owner", "manager", "staff", "franchise_admin", "super_admin"})

# Per-tenant sliding window rate limit buckets
_RATE_BUCKETS: Dict[str, List[float]] = {}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


class SecurityPolicyException(Exception):
    def __init__(self, message: str, status_code: int = 403):
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class VerifiedMcpContext:
    uid: str
    role: str
    tenant_id: str
    human_approved: bool = False


# ==============================================================================
# Explicit Tool Permission Registry
# ==============================================================================

TOOL_POLICIES: Dict[str, Dict[str, Any]] = {
    "get_inventory_summary": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "staff", "franchise_admin", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 30,
    },
    "detect_stockout_risk": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "staff", "franchise_admin", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 20,
    },
    "create_purchase_order_draft": {
        "access": "write",
        "allowed_roles": frozenset({"owner", "manager", "staff", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 10,
    },
    "approve_purchase_order": {
        "access": "write",
        "allowed_roles": frozenset({"owner", "manager", "super_admin"}),
        "requires_human_approval": True,
        "max_per_minute": 10,
    },
    "validate_gst_invoice": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "staff", "franchise_admin", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 30,
    },
    "reconcile_gstr2b": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 15,
    },
    "get_compliance_deadlines": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "staff", "franchise_admin", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 30,
    },
    "get_magic_insights": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "staff", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 15,
    },
    "record_voice_transaction": {
        "access": "write",
        "allowed_roles": frozenset({"owner", "manager", "staff", "super_admin"}),
        "requires_human_approval": True,
        "max_per_minute": 20,
    },
    "get_supplier_mandi_arbitrage": {
        "access": "read",
        "allowed_roles": frozenset({"owner", "manager", "super_admin"}),
        "requires_human_approval": False,
        "max_per_minute": 15,
    },
}


def verify_signed_mcp_context(
    encoded_context: Optional[str],
    signature_hex: Optional[str],
    secret: Optional[str] = None,
) -> VerifiedMcpContext:
    """
    Verifies HMAC-SHA256 signed server identity context forwarded by the
    authenticated Node/Next.js gateway. Fails closed if secret or signature is missing.
    """
    key = (secret if secret is not None else os.getenv("MCP_GATEWAY_SECRET", MCP_GATEWAY_SECRET)).strip()
    if not key:
        raise SecurityPolicyException("MCP gateway authentication is not configured.", status_code=503)
    if not encoded_context or not signature_hex:
        raise SecurityPolicyException("Authentication required for MCP tool execution.", status_code=401)

    expected = hmac.new(key.encode("utf-8"), encoded_context.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature_hex.strip()):
        raise SecurityPolicyException("Invalid MCP gateway signature.", status_code=401)

    try:
        padded = encoded_context + "=" * (-len(encoded_context) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
    except Exception:
        raise SecurityPolicyException("Malformed MCP identity context.", status_code=401)

    uid = str(payload.get("uid") or "").strip()
    role = str(payload.get("role") or "").strip()
    tenant_id = str(payload.get("tenant_id") or payload.get("shopId") or "").strip()
    exp = payload.get("exp")
    human_approved = bool(payload.get("human_approved", False))

    if not uid or role not in VALID_ROLES or not tenant_id:
        raise SecurityPolicyException("Incomplete or unauthorized MCP identity claims.", status_code=403)
    if not isinstance(exp, (int, float)) or exp <= time.time():
        raise SecurityPolicyException("MCP identity context expired.", status_code=401)

    return VerifiedMcpContext(
        uid=uid,
        role=role,
        tenant_id=tenant_id,
        human_approved=human_approved,
    )


def _check_rate_limit(key: str, max_per_minute: int) -> None:
    now = time.time()
    window_start = now - 60.0
    timestamps = [t for t in _RATE_BUCKETS.get(key, []) if t >= window_start]
    if len(timestamps) >= max_per_minute:
        raise SecurityPolicyException("Rate limit exceeded for MCP tool.", status_code=429)
    timestamps.append(now)
    _RATE_BUCKETS[key] = timestamps


def _scan_arguments_for_injection(value: Any) -> None:
    if isinstance(value, str):
        for pat in PROMPT_INJECTION_PATTERNS:
            if pat.search(value):
                raise SecurityPolicyException("Input blocked by AI safety policy.", status_code=400)
    elif isinstance(value, dict):
        for v in value.values():
            _scan_arguments_for_injection(v)
    elif isinstance(value, list):
        for item in value:
            _scan_arguments_for_injection(item)


def verify_tenant_access(conn: sqlite3.Connection, tenant_id: str, actor_role: Optional[str] = None):
    row = conn.execute("SELECT id FROM businesses WHERE id=?", (tenant_id,)).fetchone()
    if not row:
        raise SecurityPolicyException("Tenant isolation error: Business not found or access denied.", status_code=403)
    if actor_role and actor_role not in VALID_ROLES:
        raise SecurityPolicyException("Authorization error: Invalid actor role.", status_code=403)


def _write_mcp_audit(
    conn: sqlite3.Connection,
    tenant_id: str,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: Optional[str],
    details: Dict[str, Any],
) -> None:
    try:
        conn.execute(
            "INSERT INTO audit_log (id, business_id, actor_id, action, entity_type, entity_id, details_json, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"aud_{uuid.uuid4().hex[:16]}",
                tenant_id,
                actor_id,
                action,
                entity_type,
                entity_id,
                json.dumps(details, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
    except sqlite3.OperationalError:
        # Backward compatibility if table lacks actor_id column in older local sqlite file
        pass


# ==============================================================================
# MCP Tool Registry & Declarations (No tenant_id or approver_role inputs exposed)
# ==============================================================================

MCP_TOOL_DEFINITIONS = [
    {
        "name": "get_inventory_summary",
        "description": "Returns current inventory levels, items below reorder threshold, and total valuation for the authenticated tenant.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "low_stock_only": {"type": "boolean", "default": False}
            },
        },
    },
    {
        "name": "detect_stockout_risk",
        "description": "Calculates stockout risks based on current inventory and safety stock for the authenticated tenant.",
        "inputSchema": {"type": "object", "properties": {}},
    },
    {
        "name": "create_purchase_order_draft",
        "description": "Prepares a draft purchase order (Level 3 Prepare). Does NOT finalize or disburse funds.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "supplier_name": {"type": "string"},
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "product_id": {"type": "string"},
                            "quantity": {"type": "number"},
                            "unit_cost": {"type": "number"},
                        },
                        "required": ["product_id", "quantity", "unit_cost"],
                    },
                },
                "notes": {"type": "string"},
            },
            "required": ["supplier_name", "items"],
        },
    },
    {
        "name": "approve_purchase_order",
        "description": "Maker-checker approval: Authorizes or rejects a draft purchase order. Requires verified owner/manager identity and human approval.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "order_id": {"type": "string"},
                "action": {"type": "string", "enum": ["approve", "reject"]},
            },
            "required": ["order_id", "action"],
        },
    },
    {
        "name": "validate_gst_invoice",
        "description": "Validates GST invoice data, GSTIN format, and tax calculation (CGST/SGST vs IGST).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "supplier_gstin": {"type": "string"},
                "recipient_gstin": {"type": "string"},
                "taxable_value": {"type": "number"},
                "gst_rate": {"type": "number"},
            },
            "required": ["supplier_gstin", "recipient_gstin", "taxable_value", "gst_rate"],
        },
    },
    {
        "name": "reconcile_gstr2b",
        "description": "Performs automated reconciliation between purchase register and GSTR-2B ITC download.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "purchase_register": {"type": "array"},
                "gstr2b_records": {"type": "array"},
            },
            "required": ["purchase_register", "gstr2b_records"],
        },
    },
    {
        "name": "get_compliance_deadlines",
        "description": "Returns upcoming statutory deadlines for GST, Advance Tax, and Direct Taxes.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "financial_year": {"type": "string", "default": "2026-27"}
            },
        },
    },
]


# ==============================================================================
# Hardened MCP Tool Execution Engine
# ==============================================================================

def execute_mcp_tool(
    tool_name: str,
    arguments: Dict[str, Any],
    context: Optional[VerifiedMcpContext] = None,
) -> Dict[str, Any]:
    if context is None:
        raise SecurityPolicyException(
            "Verified server identity context is required to execute MCP tools.",
            status_code=401,
        )

    policy = TOOL_POLICIES.get(tool_name)
    if not policy:
        raise SecurityPolicyException(f"Tool '{tool_name}' is not allowed.", status_code=403)

    # Reject any client attempt to inject privileged identity/tenant parameters
    forged = [k for k in (arguments or {}).keys() if k in FORBIDDEN_OVERRIDE_KEYS]
    if forged:
        raise SecurityPolicyException(
            f"Forbidden identity/tenant override parameters supplied: {', '.join(sorted(forged))}",
            status_code=403,
        )

    if context.role not in policy["allowed_roles"]:
        raise SecurityPolicyException(
            f"Role '{context.role}' is not permitted to invoke '{tool_name}'.",
            status_code=403,
        )

    _check_rate_limit(f"{context.tenant_id}:{context.uid}:{tool_name}", policy["max_per_minute"])
    _scan_arguments_for_injection(arguments)

    if policy["requires_human_approval"] and not context.human_approved:
        return {
            "status": "approval_required",
            "tool": tool_name,
            "tenant_id": context.tenant_id,
            "message": "Explicit human owner/manager approval is required before executing this sensitive operation.",
        }

    tenant_id = context.tenant_id

    with get_db() as conn:
        if tool_name != "get_compliance_deadlines":
            verify_tenant_access(conn, tenant_id, context.role)

        if tool_name == "get_inventory_summary":
            low_only = bool(arguments.get("low_stock_only", False))
            query = "SELECT * FROM products WHERE business_id=?"
            if low_only:
                query += " AND quantity <= reorder_level"
            rows = conn.execute(query, (tenant_id,)).fetchall()
            products = [dict(r) for r in rows]
            total_valuation = sum((p["quantity"] * (p["cost_price"] or 0)) for p in products)
            return {
                "tenant_id": tenant_id,
                "total_products": len(products),
                "total_valuation": round(total_valuation, 2),
                "products": products,
            }

        elif tool_name == "detect_stockout_risk":
            rows = conn.execute(
                "SELECT id, name, sku, quantity, reorder_level, cost_price, selling_price "
                "FROM products WHERE business_id=? AND quantity <= reorder_level",
                (tenant_id,),
            ).fetchall()
            risks = []
            for r in rows:
                p = dict(r)
                shortfall = max(0, p["reorder_level"] - p["quantity"])
                risks.append({
                    "product_id": p["id"],
                    "product_name": p["name"],
                    "sku": p["sku"],
                    "current_stock": p["quantity"],
                    "reorder_level": p["reorder_level"],
                    "shortfall": shortfall,
                    "recommended_reorder_qty": shortfall + (p["reorder_level"] * 2),
                })
            return {
                "tenant_id": tenant_id,
                "at_risk_count": len(risks),
                "items_at_risk": risks,
            }

        elif tool_name == "create_purchase_order_draft":
            supplier = str(arguments.get("supplier_name") or "").strip()
            items = arguments.get("items") or []
            if not supplier or not isinstance(items, list) or len(items) == 0:
                raise SecurityPolicyException("Invalid purchase order draft payload.", status_code=400)

            total_amount = 0.0
            for item in items:
                qty = float(item["quantity"])
                cost = float(item["unit_cost"])
                if qty <= 0 or cost < 0:
                    raise SecurityPolicyException("Item quantity must be > 0 and cost >= 0.", status_code=400)
                total_amount += qty * cost

            po_id = f"po_{uuid.uuid4().hex[:12]}"
            now_iso = datetime.now(timezone.utc).isoformat()
            conn.execute(
                "INSERT INTO purchase_orders (id, business_id, supplier_name, items_json, total_amount, status, created_at) "
                "VALUES (?, ?, ?, ?, ?, 'draft', ?)",
                (po_id, tenant_id, supplier, json.dumps(items), total_amount, now_iso),
            )
            _write_mcp_audit(conn, tenant_id, context.uid, "PO_DRAFT_CREATED", "purchase_order", po_id, {"total": total_amount})
            conn.commit()
            return {
                "order_id": po_id,
                "tenant_id": tenant_id,
                "status": "draft",
                "supplier_name": supplier,
                "total_amount": round(total_amount, 2),
                "items_count": len(items),
            }

        elif tool_name == "approve_purchase_order":
            order_id = str(arguments.get("order_id") or "").strip()
            action = str(arguments.get("action") or "").strip()
            if not order_id or action not in ("approve", "reject"):
                raise SecurityPolicyException("Invalid purchase order approval parameters.", status_code=400)

            row = conn.execute(
                "SELECT * FROM purchase_orders WHERE id=? AND business_id=?",
                (order_id, tenant_id),
            ).fetchone()
            if not row:
                raise SecurityPolicyException("Purchase order not found for authorized tenant.", status_code=404)

            new_status = "approved" if action == "approve" else "rejected"
            conn.execute(
                "UPDATE purchase_orders SET status=? WHERE id=? AND business_id=?",
                (new_status, order_id, tenant_id),
            )
            _write_mcp_audit(
                conn,
                tenant_id,
                context.uid,
                f"PO_{new_status.upper()}",
                "purchase_order",
                order_id,
                {"verified_role": context.role},
            )
            conn.commit()
            return {
                "success": True,
                "order_id": order_id,
                "status": new_status,
                "approved_by_uid": context.uid,
                "approved_by_role": context.role,
            }

        elif tool_name == "validate_gst_invoice":
            s_val = validate_gstin(arguments["supplier_gstin"])
            r_val = validate_gstin(arguments["recipient_gstin"])
            if not s_val["valid"]:
                return {"valid": False, "error": f"Supplier GSTIN error: {s_val['error']}"}
            if not r_val["valid"]:
                return {"valid": False, "error": f"Recipient GSTIN error: {r_val['error']}"}

            breakdown = calculate_gst_breakdown(
                supplier_state_code=s_val["state_code"],
                recipient_state_code=r_val["state_code"],
                taxable_value=arguments["taxable_value"],
                rate_percent=arguments["gst_rate"],
            )
            return {"valid": True, "supplier": s_val, "recipient": r_val, "tax_breakdown": breakdown}

        elif tool_name == "reconcile_gstr2b":
            return match_gstr2b(arguments.get("purchase_register", []), arguments.get("gstr2b_records", []))

        elif tool_name == "get_compliance_deadlines":
            fy = str(arguments.get("financial_year", "2026-27"))
            return {"financial_year": fy, "obligations": get_compliance_calendar(fy)}

        raise SecurityPolicyException(f"Unknown MCP tool: {tool_name}", status_code=403)


# ==============================================================================
# Model Context Protocol (MCP) Router (Authenticated Gateway Only)
# ==============================================================================

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

mcp_router = APIRouter(tags=["Model Context Protocol (MCP) & External AI Integration"])


class McpToolCallRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = {}


@mcp_router.get("/.well-known/ai-plugin.json")
def get_ai_plugin_manifest():
    """Manifest declares bearer authentication required (never auth: none)."""
    return {
        "schema_version": "v1",
        "name_for_human": "DukaanMitra AI Business OS",
        "name_for_model": "dukaanmitra_business_os",
        "description_for_human": "Manage retail store inventory, record Udhaar Khata, and run WhatsApp marketing using DukaanMitra.",
        "description_for_model": "Authenticated MCP toolset for MSME retail shops with strict tenant scoping and maker-checker approvals.",
        "auth": {"type": "service_http", "authorization_type": "bearer"},
        "api": {
            "type": "openapi",
            "url": "https://api.dukaanmitra.in/openapi.json",
        },
        "logo_url": "https://dukaanmitra.in/logo.svg",
        "contact_email": "support@dukaanmitra.in",
        "legal_info_url": "https://dukaanmitra.in/terms",
    }


@mcp_router.post("/api/v1/mcp/tools/list")
@mcp_router.get("/api/v1/mcp/tools/list")
def list_mcp_tools(
    x_mcp_context: Optional[str] = Header(default=None),
    x_mcp_signature: Optional[str] = Header(default=None),
):
    """Returns allowed MCP tools filtered by the caller's verified role."""
    try:
        ctx = verify_signed_mcp_context(x_mcp_context, x_mcp_signature)
    except SecurityPolicyException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))

    allowed_tools = [
        t for t in MCP_TOOL_DEFINITIONS
        if ctx.role in TOOL_POLICIES.get(t["name"], {}).get("allowed_roles", frozenset())
    ]
    return {
        "tools": allowed_tools,
        "protocolVersion": "2024-11-05",
        "serverInfo": {"name": "dukaanmitra-mcp-gateway", "version": "2.0.0"},
    }


@mcp_router.post("/api/v1/mcp/tools/call")
def call_mcp_tool(
    body: McpToolCallRequest,
    x_mcp_context: Optional[str] = Header(default=None),
    x_mcp_signature: Optional[str] = Header(default=None),
):
    """Executes an MCP tool strictly bound to the verified server identity context."""
    try:
        ctx = verify_signed_mcp_context(x_mcp_context, x_mcp_signature)
        res = execute_mcp_tool(body.tool_name, body.arguments, context=ctx)
        return {
            "content": [{
                "type": "text",
                "text": json.dumps(res, ensure_ascii=False),
            }]
        }
    except SecurityPolicyException as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="MCP tool execution failed.")
