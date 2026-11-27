import { NextRequest, NextResponse } from 'next/server';
import { executeAction } from '@/lib/services/action-engine';
import { NextAuthError, verifyNextRequestAuth } from '@/lib/server-auth';

type ExecuteActionBody = {
  action?: {
    type?: string;
    payload?: {
      shopId?: string;
      customerPhone?: string;
      transaction?: {
        customer_name?: string;
        amount?: number;
        items?: string;
        type?: 'credit' | 'payment';
      };
    };
  };
};

const MAX_STRING_LENGTH = 500;
const ALLOWED_ACTION_TYPES = new Set(['ADD_LEDGER_ENTRY', 'SEND_REMINDER']);
const DANGEROUS_INPUT_PATTERN = /(<script|<\/script>|javascript:|onerror\s*=|onload\s*=|--|;\s*drop\s+table)/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_STRING_LENGTH);
  if (!trimmed || DANGEROUS_INPUT_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function validateAndNormalizeBody(
  body: unknown,
): { valid: true; data: ExecuteActionBody } | { valid: false; message: string } {
  if (!isPlainObject(body)) {
    return { valid: false, message: 'Payload must be a JSON object.' };
  }

  const parsed = body as ExecuteActionBody;
  if (!isPlainObject(parsed.action)) {
    return { valid: false, message: 'Missing action object.' };
  }

  const actionType = sanitizeText(parsed.action.type);
  const payload = parsed.action.payload;

  if (!actionType || !ALLOWED_ACTION_TYPES.has(actionType) || !isPlainObject(payload)) {
    return { valid: false, message: 'Invalid or unsupported action type.' };
  }

  const payloadShopId = sanitizeText(payload.shopId);
  const customerPhone = sanitizeText(payload.customerPhone);
  const transaction = payload.transaction;
  const transactionType = sanitizeText(transaction?.type);
  const customerName = sanitizeText(transaction?.customer_name);
  const items = sanitizeText(transaction?.items);
  const amount = transaction?.amount;

  if (
    !payloadShopId ||
    !customerPhone ||
    !/^\+?[0-9]{10,15}$/.test(customerPhone) ||
    !transactionType ||
    (transactionType !== 'credit' && transactionType !== 'payment') ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    amount > 10_000_000
  ) {
    return { valid: false, message: 'Invalid action payload fields.' };
  }

  return {
    valid: true,
    data: {
      action: {
        type: actionType,
        payload: {
          shopId: payloadShopId,
          customerPhone,
          transaction: {
            customer_name: customerName ?? undefined,
            amount,
            items: items ?? undefined,
            type: transactionType as 'credit' | 'payment',
          },
        },
      },
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    // 1. Derive actor strictly from verified Firebase ID token + Firestore users/{uid}.
    //    NEVER trust request.body.actor or client-supplied role/shopId.
    const authCtx = await verifyNextRequestAuth(request);

    const body = await request.json().catch(() => null);
    const validated = validateAndNormalizeBody(body);
    if (!validated.valid) {
      return NextResponse.json(
        { success: false, message: validated.message },
        { status: 400 },
      );
    }

    const targetShopId = validated.data.action!.payload!.shopId!;

    // 2. Enforce strict tenant isolation & role check server-side
    if (authCtx.role === 'franchise_admin') {
      return NextResponse.json(
        { success: false, message: 'Franchise admins cannot execute shop mutations.' },
        { status: 403 },
      );
    }

    if (authCtx.role !== 'super_admin' && authCtx.shopId !== targetShopId) {
      return NextResponse.json(
        { success: false, message: 'Forbidden: cross-tenant action denied.' },
        { status: 403 },
      );
    }

    const verifiedActor = {
      id: authCtx.uid,
      role: authCtx.role,
      shopId: authCtx.shopId ?? undefined,
    };

    const result = await executeAction(validated.data.action, verifiedActor);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    if (error instanceof NextAuthError) {
      return NextResponse.json(
        { success: false, message: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('[API_ERROR] /api/execute-action failed');
    return NextResponse.json(
      { success: false, message: 'Failed to execute action.' },
      { status: 500 },
    );
  }
}
