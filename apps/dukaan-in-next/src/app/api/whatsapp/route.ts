import { NextRequest, NextResponse } from 'next/server';
import { handleWhatsAppMessage } from '@/lib/services/whatsapp';
import { timingSafeEqualText } from '@/lib/server-auth';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!verifyToken) {
    return new NextResponse('Webhook verification not configured', { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token') ?? '';
  const challenge = searchParams.get('hub.challenge') ?? '';

  if (mode === 'subscribe' && timingSafeEqualText(token, verifyToken)) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return new NextResponse('Webhook secret not configured', { status: 503 });
  }

  const signature = request.headers.get('x-hub-signature-256')?.trim() ?? '';
  const rawBody = await request.text();

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex')}`;

  if (!timingSafeEqualText(signature, expectedSignature)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const body = JSON.parse(rawBody);
    await handleWhatsAppMessage(body);
    return new NextResponse('OK', { status: 200 });
  } catch (error) {
    console.error('Error processing WhatsApp webhook');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
