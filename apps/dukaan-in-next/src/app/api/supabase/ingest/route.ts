import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { insertSupabaseRow } from '@/lib/supabase';
import { verifySharedSecretHeader } from '@/lib/server-auth';

const IngestionSchema = z
  .object({
    eventType: z.string().trim().min(1).max(120),
    shopId: z.string().trim().min(1).max(128).optional(),
    source: z.string().trim().min(1).max(64).default('vercel'),
    payload: z.record(z.unknown()).default({}),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get('x-ingest-secret');
  if (!verifySharedSecretHeader(providedSecret, process.env.INGEST_API_SECRET)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    const parsed = IngestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Invalid payload' },
        { status: 400 },
      );
    }

    const row = {
      event_type: parsed.data.eventType,
      shop_id: parsed.data.shopId ?? null,
      source: parsed.data.source,
      payload: parsed.data.payload,
      created_at: parsed.data.createdAt ?? new Date().toISOString(),
    };

    await insertSupabaseRow('ingestion_events', row);
    return NextResponse.json({ message: 'Data ingested successfully.' });
  } catch {
    console.error('[Ingest] Failed to write ingestion event');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
