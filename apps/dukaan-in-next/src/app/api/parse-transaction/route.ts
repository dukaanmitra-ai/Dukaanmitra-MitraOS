import { NextResponse } from 'next/server';
import { parseTransaction } from '@/ai/flows/transaction-parser-flow';
import { NextAuthError, verifyNextRequestAuth } from '@/lib/server-auth';

export const runtime = 'nodejs';

const INJECTION_PATTERN =
  /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|system)\s+(instructions?|prompts?)\b/i;

export async function POST(req: Request) {
  try {
    // Require verified active Firebase user
    await verifyNextRequestAuth(req);

    const body = (await req.json().catch(() => null)) as { query?: unknown } | null;
    const query = typeof body?.query === 'string' ? body.query.trim() : '';

    if (!query || query.length > 1000) {
      return NextResponse.json(
        { error: 'Query is required and must be under 1000 characters.' },
        { status: 400 },
      );
    }

    if (INJECTION_PATTERN.test(query)) {
      return NextResponse.json(
        { error: 'Input rejected by AI safety policy.' },
        { status: 400 },
      );
    }

    const result = await parseTransaction({ query });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('Parse transaction API error');
    return NextResponse.json(
      { error: 'Failed to parse transaction' },
      { status: 500 },
    );
  }
}
