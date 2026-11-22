"""
DukaanMitra Shared Database & Data Sync Infrastructure
Unified database schema for all ecosystem applications
"""

import sqlite3
import json
from datetime import datetime, timezone
from typing import Optional, Dict, List
import uuid

DB_PATH = "dukaanmitra_shared.db"

def get_shared_db():
    """Get shared database connection with WAL mode"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_shared_database():
    """Initialize shared database schema for entire ecosystem"""
    with get_shared_db() as conn:
        conn.executescript("""
        -- ============================================================================
        -- Core Business Entities (Shared across all apps)
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS businesses(
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          domain TEXT NOT NULL,  -- 'retail', 'services', 'manufacturing', etc.
          tier TEXT NOT NULL DEFAULT 'basic',  -- 'basic', 'pro', 'enterprise'
          currency TEXT NOT NULL DEFAULT 'INR',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          metadata_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS users(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          display_name TEXT NOT NULL,
          email TEXT UNIQUE,
          phone TEXT UNIQUE,
          role TEXT NOT NULL CHECK(role IN ('owner','manager','staff','viewer')),
          auth_provider TEXT NOT NULL DEFAULT 'local',  -- 'local', 'google', 'whatsapp'
          auth_provider_id TEXT,
          created_at TEXT NOT NULL,
          last_login_at TEXT,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_users_business ON users(business_id);
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

        -- ============================================================================
        -- Core Engine Integration (POS, Inventory, Barcode)
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS products(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sku TEXT,
          barcode TEXT,
          category TEXT,
          unit TEXT NOT NULL DEFAULT 'pcs',
          quantity REAL NOT NULL DEFAULT 0,
          reorder_level REAL NOT NULL DEFAULT 0,
          cost_price REAL,
          selling_price REAL,
          batch TEXT,
          expiry_date TEXT,
          attributes_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

        CREATE TABLE IF NOT EXISTS stock_movements(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          product_id TEXT NOT NULL,
          delta REAL NOT NULL,
          reason TEXT NOT NULL,
          actor_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);

        -- ============================================================================
        -- AI Studio & Creator Tools Module
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS marketing_campaigns(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          title TEXT NOT NULL,
          platform TEXT NOT NULL,  -- 'whatsapp', 'instagram', 'facebook'
          content TEXT NOT NULL,
          generated_by_ai BOOLEAN DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',  -- 'draft', 'scheduled', 'sent'
          scheduled_at TEXT,
          sent_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        -- ============================================================================
        -- Business Growth & CRM Module
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS customers(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          name TEXT NOT NULL,
          phone TEXT,
          email TEXT,
          address TEXT,
          total_spent REAL DEFAULT 0,
          last_purchase_at TEXT,
          last_contact_at TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_customers_business ON customers(business_id);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

        CREATE TABLE IF NOT EXISTS customer_interactions(
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          business_id TEXT NOT NULL,
          interaction_type TEXT NOT NULL,  -- 'purchase', 'whatsapp', 'call', 'visit'
          notes TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        -- ============================================================================
        -- QR & Feedback System Module
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS qr_codes(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          qr_type TEXT NOT NULL,  -- 'upi', 'feedback', 'inventory'
          data TEXT NOT NULL,
          label TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS feedback_reviews(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          customer_id TEXT,
          rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
          comment TEXT,
          source TEXT NOT NULL,  -- 'google', 'internal', 'whatsapp'
          is_public BOOLEAN DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
          FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
        );

        -- ============================================================================
        -- Vertical Modules (Salon, Pet Care, Construction)
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS vertical_services(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          vertical_type TEXT NOT NULL,  -- 'salon', 'pet_care', 'construction'
          name TEXT NOT NULL,
          duration_minutes INTEGER,
          base_price REAL,
          commission_rate REAL DEFAULT 0.3,
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS vertical_jobs(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          service_id TEXT,
          customer_id TEXT,
          vertical_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'in_progress', 'completed'
          total_amount REAL,
          notes TEXT,
          created_at TEXT NOT NULL,
          completed_at TEXT,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE,
          FOREIGN KEY(service_id) REFERENCES vertical_services(id) ON DELETE SET NULL,
          FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
        );

        -- ============================================================================
        -- Fraud Shield & CallGuard Module
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS safety_events(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          event_type TEXT NOT NULL,  -- 'suspicious_call', 'otp_theft_attempt', 'spam_report'
          phone_number TEXT,
          risk_level TEXT NOT NULL,  -- 'low', 'medium', 'high'
          details_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_safety_events_business ON safety_events(business_id);
        CREATE INDEX IF NOT EXISTS idx_safety_events_phone ON safety_events(phone_number);

        -- ============================================================================
        -- Data Sync & Audit Trail
        -- ============================================================================
        CREATE TABLE IF NOT EXISTS sync_events(
          id TEXT PRIMARY KEY,
          source_app TEXT NOT NULL,  -- 'core_engine', 'mitraos', 'dukaanin', 'ai_services'
          source_entity_type TEXT NOT NULL,
          source_entity_id TEXT NOT NULL,
          target_app TEXT NOT NULL,
          operation TEXT NOT NULL,  -- 'create', 'update', 'delete'
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'synced', 'failed'
          error_message TEXT,
          created_at TEXT NOT NULL,
          synced_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_sync_events_status ON sync_events(status);
        CREATE INDEX IF NOT EXISTS idx_sync_events_source ON sync_events(source_app, source_entity_id);

        CREATE TABLE IF NOT EXISTS audit_log(
          id TEXT PRIMARY KEY,
          business_id TEXT NOT NULL,
          actor_id TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id TEXT,
          details_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL,
          FOREIGN KEY(business_id) REFERENCES businesses(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_audit_log_business ON audit_log(business_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
        """)

        print("Shared database initialized successfully")

def create_business(name: str, domain: str = "retail", tier: str = "basic") -> str:
    """Create a new business in shared database"""
    business_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_shared_db() as conn:
        conn.execute(
            "INSERT INTO businesses VALUES(?,?,?,?,?,?,?,?)",
            (business_id, name, domain, tier, "INR", now, now, "{}")
        )
        conn.commit()

    return business_id

def create_user(business_id: str, display_name: str, role: str = "owner",
                email: Optional[str] = None, phone: Optional[str] = None,
                auth_provider: str = "local") -> str:
    """Create a new user in shared database"""
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_shared_db() as conn:
        conn.execute(
            "INSERT INTO users VALUES(?,?,?,?,?,?,?,?,?,?)",
            (user_id, business_id, display_name, email, phone, role,
             auth_provider, None, now, None)
        )
        conn.commit()

    return user_id

def record_sync_event(source_app: str, source_entity_type: str, source_entity_id: str,
                     target_app: str, operation: str, payload: dict) -> str:
    """Record a data sync event"""
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    with get_shared_db() as conn:
        conn.execute(
            "INSERT INTO sync_events VALUES(?,?,?,?,?,?,?,?,?,?,?)",
            (event_id, source_app, source_entity_type, source_entity_id,
             target_app, operation, json.dumps(payload), "pending", None, now, None)
        )
        conn.commit()

    return event_id

def mark_sync_synced(event_id: str):
    """Mark a sync event as successfully synced"""
    now = datetime.now(timezone.utc).isoformat()
    with get_shared_db() as conn:
        conn.execute(
            "UPDATE sync_events SET status='synced', synced_at=? WHERE id=?",
            (now, event_id)
        )
        conn.commit()

def mark_sync_failed(event_id: str, error_message: str):
    """Mark a sync event as failed"""
    with get_shared_db() as conn:
        conn.execute(
            "UPDATE sync_events SET status='failed', error_message=? WHERE id=?",
            (error_message, event_id)
        )
        conn.commit()

def get_pending_sync_events(limit: int = 100) -> List[dict]:
    """Get pending sync events"""
    with get_shared_db() as conn:
        rows = conn.execute(
            "SELECT * FROM sync_events WHERE status='pending' ORDER BY created_at LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(row) for row in rows]

if __name__ == "__main__":
    # Initialize shared database
    init_shared_database()

    # Test: Create a sample business
    test_business_id = create_business("Test Dukaan", "retail", "basic")
    print(f"Created test business: {test_business_id}")

    # Test: Create a sample user
    test_user_id = create_user(test_business_id, "Test Owner", "owner", "test@dukaanmitra.in")
    print(f"Created test user: {test_user_id}")

    # Test: Record a sync event
    sync_event_id = record_sync_event(
        "core_engine", "product", "prod_123",
        "dukaanin", "create", {"name": "Test Product", "price": 100}
    )
    print(f"Created sync event: {sync_event_id}")

    print("Shared database setup complete!")
