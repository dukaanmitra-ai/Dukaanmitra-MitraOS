import { NextRequest, NextResponse } from 'next/server';
import { runSelfHealing } from '@/ai/flows/self-healing-flow';
import { verifySharedSecretHeader } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * Platform Self-Healing Cron
 * Protected via CRON_SECRET Bearer header using constant-time verification.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const providedSecret = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : request.headers.get('x-cron-secret');

  if (!verifySharedSecretHeader(providedSecret, process.env.CRON_SECRET)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSelfHealing();
    return NextResponse.json({ success: true, result });
  } catch {
    console.error('[Cron] Self-healing failed');
    return NextResponse.json(
      { success: false, error: 'Self-healing execution failed' },
      { status: 500 },
    );
  }
}
