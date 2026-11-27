import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebase-admin';
import { timingSafeEqualText } from '@/lib/server-auth';
import { addMonths, format } from 'date-fns';
import { sendWhatsAppMessage } from '@/lib/services/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { message: 'Webhook verification not configured' },
      { status: 503 },
    );
  }

  const signature = request.headers.get('x-razorpay-signature')?.trim();
  if (!signature) {
    return NextResponse.json({ message: 'Signature missing' }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    if (!timingSafeEqualText(expectedSignature, signature)) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured') {
      const payment = event.payload?.payment?.entity;
      const razorpayOrderId = payment?.order_id;
      const paymentId = payment?.id;
      const notesShopId = payment?.notes?.shopId;

      if (!razorpayOrderId || !paymentId) {
        return NextResponse.json({ message: 'Invalid webhook payload' }, { status: 400 });
      }

      const firestore = adminDb;
      let shopOwnerPhone = '';
      let shopName = '';
      let shouldNotify = false;
      const newExpiryDate = addMonths(new Date(), 1);

      await firestore.runTransaction(async (transaction) => {
        const orderQuery = await transaction.get(
          firestore
            .collection('orders')
            .where('razorpayOrderId', '==', razorpayOrderId)
            .limit(1),
        );

        if (orderQuery.empty) {
          throw new Error('ORDER_NOT_FOUND');
        }

        const orderDoc = orderQuery.docs[0];
        const orderData = orderDoc.data();

        // Idempotent guard: already processed
        if (orderData.status === 'paid') {
          return;
        }

        // Cross-check payment metadata & amount against authoritative stored order
        if (notesShopId && orderData.shopId !== notesShopId) {
          throw new Error('ORDER_SHOP_MISMATCH');
        }
        if (
          typeof payment.amount === 'number' &&
          payment.amount !== Number(orderData.amount) * 100
        ) {
          throw new Error('ORDER_AMOUNT_MISMATCH');
        }

        const authoritativeShopId = String(orderData.shopId);
        const authoritativePlan = String(orderData.plan);

        const shopRef = firestore.collection('shops').doc(authoritativeShopId);
        const shopDoc = await transaction.get(shopRef);
        if (!shopDoc.exists) {
          throw new Error('SHOP_NOT_FOUND');
        }
        const shopData = shopDoc.data();
        shopOwnerPhone = shopData?.phone || '';
        shopName = shopData?.name || '';
        shouldNotify = true;

        transaction.update(orderDoc.ref, {
          status: 'paid',
          paidAt: new Date(),
          razorpayPaymentId: paymentId,
        });

        transaction.update(shopRef, {
          status: 'active',
          plan: authoritativePlan,
          paid_till: newExpiryDate,
          updated_at: new Date(),
        });
      });

      if (shouldNotify && shopOwnerPhone) {
        const formattedExpiry = format(newExpiryDate, 'dd MMMM yyyy');
        const confirmationMessage = `Namaste ${shopName || ''} 🎉\n\n₹${payment.amount / 100} payment received successfully.\nDukaanMitra active till ${formattedExpiry}.`;
        await sendWhatsAppMessage(shopOwnerPhone, confirmationMessage);
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'WEBHOOK_FAILED';
    if (code === 'ORDER_SHOP_MISMATCH' || code === 'ORDER_AMOUNT_MISMATCH') {
      return NextResponse.json({ message: 'Order verification mismatch' }, { status: 400 });
    }
    if (code === 'ORDER_NOT_FOUND' || code === 'SHOP_NOT_FOUND') {
      return NextResponse.json({ message: 'Order or shop not found' }, { status: 404 });
    }
    console.error('[/api/verify-payment] Webhook processing error');
    return NextResponse.json({ message: 'Webhook verification failed' }, { status: 500 });
  }
}
