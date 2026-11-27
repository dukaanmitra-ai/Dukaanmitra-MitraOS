import crypto from "crypto";
import Razorpay from "razorpay";
import { z } from "zod";
import type { ServerAuthContext } from "./authContext";
import { requireShopOwner } from "./authorization";
import { getFirebaseAdmin, ServerSecurityError } from "./firebaseAdmin";
import {
  recordSecurityAudit,
  verifyHmacSha256Hex,
  type AuditSink,
} from "./guards";

/**
 * Authoritative server-side subscription plan catalog (INR rupees).
 * Clients NEVER supply payment amounts.
 */
export const AUTHORITATIVE_PLAN_CATALOG = Object.freeze({
  basic: { plan: "basic" as const, amountInr: 1999, name: "Basic Plan" },
  pro: { plan: "pro" as const, amountInr: 4999, name: "Pro Plan" },
});

export type SubscriptionPlanId = keyof typeof AUTHORITATIVE_PLAN_CATALOG;

const CreateOrderBodySchema = z
  .object({
    shopId: z.string().trim().min(3).max(128),
    plan: z.enum(["basic", "pro"]),
  })
  .strict(); // Rejects client-supplied `amount`, `currency`, `status`, `userId`, `role`

export interface StoredOrderRecord {
  id: string;
  shopId: string;
  userId: string;
  plan: SubscriptionPlanId;
  amount: number;
  currency: "INR";
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  idempotencyKey: string;
  status: "created" | "paid";
  createdAt: Date;
  paidAt?: Date;
}

export interface PaymentGatewayClient {
  createOrder: (params: {
    amountPaise: number;
    currency: "INR";
    receipt: string;
    notes: Record<string, string>;
  }) => Promise<{ id: string; amount: number; currency: string; receipt?: string }>;
}

export interface PaymentPersistenceAdapter {
  getShopOwnerUid: (shopId: string) => Promise<string | null>;
  findOrderByIdempotencyKey: (
    userId: string,
    shopId: string,
    idempotencyKey: string,
  ) => Promise<StoredOrderRecord | null>;
  saveOrder: (order: StoredOrderRecord) => Promise<void>;
  markOrderPaidAndActivateShop: (params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    expectedShopId?: string;
    paidAmountPaise?: number;
  }) => Promise<{ alreadyPaid: boolean; shopId: string; plan: SubscriptionPlanId }>;
}

export function validateIdempotencyKey(raw: string | undefined): string {
  const key = raw?.trim() ?? "";
  if (!key || key.length < 8 || key.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(key)) {
    throw new ServerSecurityError(
      400,
      "MISSING_IDEMPOTENCY_KEY",
      "A valid Idempotency-Key header (8–128 alphanumeric/._:- characters) is required.",
    );
  }
  return key;
}

function createDefaultPaymentGateway(): PaymentGatewayClient {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new ServerSecurityError(
      503,
      "PAYMENT_GATEWAY_NOT_CONFIGURED",
      "Payment gateway is not configured on the server.",
    );
  }
  const instance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return {
    async createOrder({ amountPaise, currency, receipt, notes }) {
      const order = await instance.orders.create({
        amount: amountPaise,
        currency,
        receipt,
        notes,
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: String(order.currency),
        receipt: order.receipt,
      };
    },
  };
}

function createFirestorePaymentPersistence(): PaymentPersistenceAdapter {
  const { db } = getFirebaseAdmin();
  return {
    async getShopOwnerUid(shopId) {
      const snap = await db.collection("shops").doc(shopId).get();
      if (!snap.exists) return null;
      const ownerId = snap.data()?.owner_id;
      return typeof ownerId === "string" ? ownerId : null;
    },
    async findOrderByIdempotencyKey(userId, shopId, idempotencyKey) {
      const deterministicId = `idem_${crypto
        .createHash("sha256")
        .update(`${userId}:${shopId}:${idempotencyKey}`)
        .digest("hex")
        .slice(0, 32)}`;
      const snap = await db.collection("orders").doc(deterministicId).get();
      if (!snap.exists) return null;
      return snap.data() as StoredOrderRecord;
    },
    async saveOrder(order) {
      await db.collection("orders").doc(order.id).create(order);
    },
    async markOrderPaidAndActivateShop({
      razorpayOrderId,
      razorpayPaymentId,
      expectedShopId,
      paidAmountPaise,
    }) {
      return db.runTransaction(async (tx) => {
        const q = await tx.get(
          db.collection("orders").where("razorpayOrderId", "==", razorpayOrderId).limit(1),
        );
        if (q.empty) {
          throw new ServerSecurityError(
            404,
            "ORDER_NOT_FOUND",
            "Matching subscription order not found.",
          );
        }
        const orderDoc = q.docs[0];
        const orderData = orderDoc.data() as StoredOrderRecord;

        if (expectedShopId && orderData.shopId !== expectedShopId) {
          throw new ServerSecurityError(
            400,
            "ORDER_SHOP_MISMATCH",
            "Payment metadata does not match order shop.",
          );
        }

        if (
          typeof paidAmountPaise === "number" &&
          paidAmountPaise !== orderData.amount * 100
        ) {
          throw new ServerSecurityError(
            400,
            "ORDER_AMOUNT_MISMATCH",
            "Paid amount does not match authoritative order amount.",
          );
        }

        if (orderData.status === "paid") {
          return {
            alreadyPaid: true,
            shopId: orderData.shopId,
            plan: orderData.plan,
          };
        }

        const shopRef = db.collection("shops").doc(orderData.shopId);
        const shopSnap = await tx.get(shopRef);
        if (!shopSnap.exists) {
          throw new ServerSecurityError(404, "SHOP_NOT_FOUND", "Target shop not found.");
        }

        const paidTill = new Date();
        paidTill.setMonth(paidTill.getMonth() + 1);

        tx.update(orderDoc.ref, {
          status: "paid",
          paidAt: new Date(),
          razorpayPaymentId,
        });

        tx.update(shopRef, {
          status: "active",
          plan: orderData.plan,
          paid_till: paidTill,
          updated_at: new Date(),
        });

        return {
          alreadyPaid: false,
          shopId: orderData.shopId,
          plan: orderData.plan,
        };
      });
    },
  };
}

/**
 * Authenticated, owner-authorized, idempotent subscription order creation.
 */
export async function createAuthenticatedOrder(params: {
  authContext: ServerAuthContext | undefined | null;
  rawBody: unknown;
  idempotencyKeyHeader: string | undefined;
  gateway?: PaymentGatewayClient;
  persistence?: PaymentPersistenceAdapter;
  auditSink?: AuditSink;
}): Promise<{
  order_id: string;
  id: string;
  amount: number;
  currency: "INR";
  plan: SubscriptionPlanId;
  idempotentReplay: boolean;
}> {
  const idempotencyKey = validateIdempotencyKey(params.idempotencyKeyHeader);

  const parsed = CreateOrderBodySchema.safeParse(params.rawBody);
  if (!parsed.success) {
    throw new ServerSecurityError(
      400,
      "INVALID_ORDER_REQUEST",
      "Invalid order payload. Only shopId and plan ('basic' | 'pro') are accepted.",
    );
  }

  const { shopId, plan } = parsed.data;
  const persistence = params.persistence ?? createFirestorePaymentPersistence();
  const shopOwnerUid = await persistence.getShopOwnerUid(shopId);
  if (!shopOwnerUid) {
    throw new ServerSecurityError(404, "SHOP_NOT_FOUND", "Shop not found.");
  }

  const owner = requireShopOwner(params.authContext, shopId, shopOwnerUid);

  // Check idempotency record first — prevents duplicate Razorpay orders on retries
  const existingOrder = await persistence.findOrderByIdempotencyKey(
    owner.uid,
    shopId,
    idempotencyKey,
  );
  if (existingOrder) {
    if (existingOrder.plan !== plan) {
      throw new ServerSecurityError(
        409,
        "IDEMPOTENCY_KEY_CONFLICT",
        "Idempotency-Key was already used with a different subscription plan.",
      );
    }
    return {
      order_id: existingOrder.razorpayOrderId,
      id: existingOrder.razorpayOrderId,
      amount: existingOrder.amount * 100,
      currency: existingOrder.currency,
      plan: existingOrder.plan,
      idempotentReplay: true,
    };
  }

  const planEntry = AUTHORITATIVE_PLAN_CATALOG[plan];
  const amountPaise = planEntry.amountInr * 100;
  const gateway = params.gateway ?? createDefaultPaymentGateway();

  const deterministicOrderDocId = `idem_${crypto
    .createHash("sha256")
    .update(`${owner.uid}:${shopId}:${idempotencyKey}`)
    .digest("hex")
    .slice(0, 32)}`;

  const razorpayOrder = await gateway.createOrder({
    amountPaise,
    currency: "INR",
    receipt: `dm_${deterministicOrderDocId.slice(0, 24)}`,
    notes: {
      shopId,
      userId: owner.uid,
      plan,
    },
  });

  await persistence.saveOrder({
    id: deterministicOrderDocId,
    shopId,
    userId: owner.uid,
    plan,
    amount: planEntry.amountInr,
    currency: "INR",
    razorpayOrderId: razorpayOrder.id,
    idempotencyKey,
    status: "created",
    createdAt: new Date(),
  });

  await recordSecurityAudit(
    {
      actorId: owner.uid,
      actorRole: owner.role,
      action: "payment:order:create",
      targetType: "order",
      targetId: deterministicOrderDocId,
      shopId,
      outcome: "ALLOW",
      metadata: { plan, amountInr: planEntry.amountInr },
    },
    params.auditSink,
  );

  return {
    order_id: razorpayOrder.id,
    id: razorpayOrder.id,
    amount: amountPaise,
    currency: "INR",
    plan,
    idempotentReplay: false,
  };
}

/**
 * Verifies a Razorpay webhook signature using constant-time HMAC-SHA256 over the exact raw body,
 * never trusting client-supplied payment status, and applies transactional idempotent activation.
 */
export async function verifyRazorpayWebhookPayment(params: {
  rawBody: Buffer | string;
  signatureHeader: string | undefined;
  webhookSecret?: string;
  persistence?: PaymentPersistenceAdapter;
  auditSink?: AuditSink;
}): Promise<{ verified: boolean; alreadyPaid?: boolean; event: string }> {
  const secret = (params.webhookSecret ?? process.env.RAZORPAY_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    throw new ServerSecurityError(
      503,
      "WEBHOOK_SECRET_NOT_CONFIGURED",
      "Payment webhook verification is not configured.",
    );
  }

  const signature = params.signatureHeader?.trim() ?? "";
  if (!signature) {
    throw new ServerSecurityError(
      400,
      "MISSING_SIGNATURE",
      "Missing x-razorpay-signature header.",
    );
  }

  const valid = verifyHmacSha256Hex({
    secret,
    payload: params.rawBody,
    providedHex: signature,
  });

  if (!valid) {
    await recordSecurityAudit(
      {
        actorId: "razorpay_webhook",
        actorRole: "webhook",
        action: "payment:webhook:verify",
        targetType: "payment",
        outcome: "DENY",
        metadata: { reason: "INVALID_SIGNATURE" },
      },
      params.auditSink,
    );
    throw new ServerSecurityError(
      401,
      "INVALID_WEBHOOK_SIGNATURE",
      "Invalid payment webhook signature.",
    );
  }

  let parsedEvent: {
    event?: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          order_id?: string;
          amount?: number;
          notes?: { shopId?: string };
        };
      };
    };
  };

  try {
    parsedEvent = JSON.parse(
      typeof params.rawBody === "string"
        ? params.rawBody
        : params.rawBody.toString("utf8"),
    );
  } catch {
    throw new ServerSecurityError(400, "INVALID_JSON", "Malformed webhook payload.");
  }

  const eventName = typeof parsedEvent.event === "string" ? parsedEvent.event : "unknown";

  if (eventName === "payment.captured") {
    const entity = parsedEvent.payload?.payment?.entity;
    const razorpayOrderId = entity?.order_id?.trim();
    const razorpayPaymentId = entity?.id?.trim();
    const expectedShopId = entity?.notes?.shopId?.trim();
    const paidAmountPaise = typeof entity?.amount === "number" ? entity.amount : undefined;

    if (!razorpayOrderId || !razorpayPaymentId) {
      throw new ServerSecurityError(
        400,
        "INVALID_WEBHOOK_PAYLOAD",
        "Webhook payload missing order_id or payment id.",
      );
    }

    const persistence = params.persistence ?? createFirestorePaymentPersistence();
    const result = await persistence.markOrderPaidAndActivateShop({
      razorpayOrderId,
      razorpayPaymentId,
      expectedShopId,
      paidAmountPaise,
    });

    await recordSecurityAudit(
      {
        actorId: "razorpay_webhook",
        actorRole: "webhook",
        action: result.alreadyPaid
          ? "payment:webhook:duplicate"
          : "payment:webhook:captured",
        targetType: "order",
        targetId: razorpayOrderId,
        shopId: result.shopId,
        outcome: "ALLOW",
        metadata: { plan: result.plan, alreadyPaid: result.alreadyPaid },
      },
      params.auditSink,
    );

    return {
      verified: true,
      alreadyPaid: result.alreadyPaid,
      event: eventName,
    };
  }

  return { verified: true, event: eventName };
}
