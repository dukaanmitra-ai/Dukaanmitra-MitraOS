import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { NextAuthError, verifyNextRequestAuth } from '@/lib/server-auth';
import Razorpay from 'razorpay';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const planDetails: Record<'basic' | 'pro', { amount: number; name: string }> = {
  basic: { amount: 1999, name: 'Basic Plan' },
  pro: { amount: 4999, name: 'Pro Plan' },
};

const requestBodySchema = z
  .object({
    shopId: z.string().trim().min(3).max(128),
    plan: z.enum(['basic', 'pro']),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return NextResponse.json(
        { message: 'Payment gateway not configured.' },
        { status: 503 },
      );
    }

    const authCtx = await verifyNextRequestAuth(request);

    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim() ?? '';
    if (
      !idempotencyKey ||
      idempotencyKey.length < 8 ||
      idempotencyKey.length > 128 ||
      !/^[a-zA-Z0-9._:-]+$/.test(idempotencyKey)
    ) {
      return NextResponse.json(
        { message: 'A valid Idempotency-Key header is required.' },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    const validation = requestBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ message: 'Invalid request' }, { status: 400 });
    }
    const { shopId, plan } = validation.data;

    // Enforce verified shop ownership
    if (authCtx.role !== 'super_admin' && (authCtx.role !== 'owner' || authCtx.shopId !== shopId)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const shopDoc = await adminDb.collection('shops').doc(shopId).get();
    if (!shopDoc.exists || (authCtx.role !== 'super_admin' && shopDoc.data()?.owner_id !== authCtx.uid)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    // Deterministic idempotency doc lookup prevents duplicate Razorpay orders on retry
    const orderDocId = `idem_${crypto
      .createHash('sha256')
      .update(`${authCtx.uid}:${shopId}:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 32)}`;

    const orderRef = adminDb.collection('orders').doc(orderDocId);
    const existingOrder = await orderRef.get();
    if (existingOrder.exists) {
      const data = existingOrder.data()!;
      if (data.plan !== plan) {
        return NextResponse.json(
          { message: 'Idempotency-Key reused with different plan.' },
          { status: 409 },
        );
      }
      return NextResponse.json(
        {
          id: data.razorpayOrderId,
          amount: Number(data.amount) * 100,
          currency: data.currency || 'INR',
          idempotentReplay: true,
        },
        { status: 200 },
      );
    }

    const amount = planDetails[plan].amount;
    const amountInPaise = amount * 100;

    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `dm_${orderDocId.slice(0, 24)}`,
      notes: { shopId, userId: authCtx.uid, plan },
    });

    await orderRef.create({
      id: orderDocId,
      shopId,
      userId: authCtx.uid,
      plan,
      amount,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      idempotencyKey,
      status: 'created',
      createdAt: new Date(),
    });

    return NextResponse.json(razorpayOrder, { status: 200 });
  } catch (error) {
    if (error instanceof NextAuthError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error('[/api/create-order] Error creating order');
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
