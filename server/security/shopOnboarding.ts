import crypto from "crypto";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import type { ServerAuthContext } from "./authContext";
import { requireAuthenticatedUser } from "./authorization";
import { getFirebaseAdmin, ServerSecurityError } from "./firebaseAdmin";
import { recordSecurityAudit, type AuditSink } from "./guards";

const OnboardingInputSchema = z
  .object({
    name: z.string().trim().min(2, "Shop name must be at least 2 characters.").max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/, "Enter a valid 10 to 15 digit phone number."),
    whatsapp: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{10,15}$/)
      .optional(),
    ownerName: z.string().trim().min(1).max(120).optional(),
    city: z.string().trim().max(80).optional(),
    state: z.string().trim().max(80).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^[0-9]{6}$/)
      .optional(),
    language: z.enum(["hi", "en", "hinglish"]).default("hinglish"),
  })
  .strict(); // Explicitly rejects unknown client-supplied fields like shopId, role, status, plan, owner_id

export type ValidatedOnboardingInput = z.infer<typeof OnboardingInputSchema>;

export interface ProvisionedShopResult {
  shopId: string;
  role: "owner" | "super_admin" | "franchise_admin" | "staff";
  alreadyProvisioned: boolean;
  shop: {
    id: string;
    name: string;
    phone: string;
    plan: string;
    status: string;
  };
}

export interface OnboardingStoreAdapter {
  runAtomicProvisioning: (params: {
    uid: string;
    email: string;
    input: ValidatedOnboardingInput;
    generateShopId: () => string;
  }) => Promise<ProvisionedShopResult>;
}

function createFirestoreOnboardingStore(): OnboardingStoreAdapter {
  const { db } = getFirebaseAdmin();
  return {
    async runAtomicProvisioning({ uid, email, input, generateShopId }) {
      const userRef = db.collection("users").doc(uid);

      return db.runTransaction(async (tx) => {
        const userSnap = await tx.get(userRef);
        const existingUser = userSnap.exists ? userSnap.data() ?? {} : null;

        // Never reactivate a suspended or pending account
        if (existingUser && existingUser.status === "suspended") {
          throw new ServerSecurityError(
            403,
            "ACCOUNT_SUSPENDED",
            "Suspended accounts cannot provision a shop.",
          );
        }
        if (existingUser && existingUser.status === "pending") {
          throw new ServerSecurityError(
            403,
            "ACCOUNT_PENDING",
            "Pending accounts cannot provision a shop until activated.",
          );
        }

        // Idempotency: if user already has a linked shopId, preserve and return existing shop
        const existingShopId =
          typeof existingUser?.shopId === "string" && existingUser.shopId.trim()
            ? existingUser.shopId.trim()
            : null;

        if (existingShopId) {
          const existingShopSnap = await tx.get(
            db.collection("shops").doc(existingShopId),
          );
          if (existingShopSnap.exists) {
            const shopData = existingShopSnap.data() ?? {};
            const currentRole =
              existingUser?.role === "super_admin" ||
              existingUser?.role === "franchise_admin" ||
              existingUser?.role === "staff" ||
              existingUser?.role === "owner"
                ? existingUser.role
                : "owner";
            return {
              shopId: existingShopId,
              role: currentRole,
              alreadyProvisioned: true,
              shop: {
                id: existingShopId,
                name: String(shopData.name ?? input.name),
                phone: String(shopData.phone ?? input.phone),
                plan: String(shopData.plan ?? "free"),
                status: String(shopData.status ?? "trial"),
              },
            };
          }
        }

        // Server generates authoritative shopId — never supplied by client
        const shopId = generateShopId();
        const shopRef = db.collection("shops").doc(shopId);
        const now = new Date();
        const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        // Preserve existing approved role if already set, otherwise assign least-privilege shop owner
        const assignedRole =
          existingUser?.role === "super_admin" || existingUser?.role === "franchise_admin"
            ? existingUser.role
            : "owner";

        const shopDoc = {
          id: shopId,
          owner_id: uid,
          name: input.name,
          phone: input.phone,
          whatsapp: input.whatsapp ?? input.phone,
          owner_name: input.ownerName ?? existingUser?.displayName ?? "",
          city: input.city ?? "",
          state: input.state ?? "",
          pincode: input.pincode ?? "",
          plan: "free",
          status: "trial",
          trial_ends_at: trialEndsAt,
          impact_metrics: {
            total_entries: 0,
            total_recovery_inr: 0,
          },
          settings: {
            language: input.language,
            currency: "INR",
            timezone: "Asia/Kolkata",
            allow_credit: true,
            credit_limit_per_transaction: 5000,
          },
          created_at: FieldValue.serverTimestamp(),
          updated_at: FieldValue.serverTimestamp(),
        };

        tx.set(shopRef, shopDoc);

        if (!existingUser) {
          tx.set(userRef, {
            uid,
            email,
            role: "owner",
            status: "active",
            shopId,
            createdAt: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp(),
          });
        } else {
          tx.update(userRef, {
            shopId,
            role: assignedRole,
            updated_at: FieldValue.serverTimestamp(),
          });
        }

        const auditRef = db.collection("auditLogs").doc();
        tx.set(auditRef, {
          id: auditRef.id,
          actorId: uid,
          actorRole: assignedRole,
          action: "shop:onboard",
          targetType: "shop",
          targetId: shopId,
          shopId,
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          shopId,
          role: assignedRole,
          alreadyProvisioned: false,
          shop: {
            id: shopId,
            name: input.name,
            phone: input.phone,
            plan: "free",
            status: "trial",
          },
        };
      });
    },
  };
}

/**
 * Trusted server-side shop provisioning workflow (Phase 3.5).
 * - Rejects suspended/pending users
 * - Rejects arbitrary client-supplied shopId, role, status, or plan
 * - Idempotent on retries (returns existing linked shop)
 * - Writes atomic shop + user binding + audit log
 */
export async function provisionShopForUser(
  authContext: ServerAuthContext | undefined | null,
  rawBody: unknown,
  deps: {
    store?: OnboardingStoreAdapter;
    auditSink?: AuditSink;
    generateShopId?: () => string;
  } = {},
): Promise<ProvisionedShopResult> {
  const authed = requireAuthenticatedUser(authContext);

  if (authed.status === "suspended") {
    throw new ServerSecurityError(
      403,
      "ACCOUNT_SUSPENDED",
      "Suspended accounts cannot create or link a shop.",
    );
  }
  if (authed.status !== "active") {
    throw new ServerSecurityError(
      403,
      "ACCOUNT_INACTIVE",
      "Only active accounts can complete shop onboarding.",
    );
  }

  // Explicitly reject privilege or tenant injection attempts before parsing
  if (rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)) {
    const rec = rawBody as Record<string, unknown>;
    const forbiddenFields = ["shopId", "role", "status", "plan", "owner_id", "uid"];
    const attempted = forbiddenFields.filter((f) => f in rec);
    if (attempted.length > 0) {
      await recordSecurityAudit(
        {
          actorId: authed.uid,
          actorRole: authed.role,
          action: "shop:onboard",
          targetType: "shop",
          outcome: "DENY",
          metadata: { reason: "FORBIDDEN_CLIENT_FIELDS", attempted },
        },
        deps.auditSink,
      );
      throw new ServerSecurityError(
        400,
        "FORBIDDEN_FIELDS",
        `Client cannot supply restricted fields: ${attempted.join(", ")}.`,
      );
    }
  }

  const parsed = OnboardingInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new ServerSecurityError(
      400,
      "INVALID_ONBOARDING_INPUT",
      "Invalid shop onboarding details provided.",
    );
  }

  const store = deps.store ?? createFirestoreOnboardingStore();
  const generateShopId =
    deps.generateShopId ?? (() => `shop_${crypto.randomBytes(12).toString("hex")}`);

  const result = await store.runAtomicProvisioning({
    uid: authed.uid,
    email: authed.email,
    input: parsed.data,
    generateShopId,
  });

  await recordSecurityAudit(
    {
      actorId: authed.uid,
      actorRole: result.role,
      action: result.alreadyProvisioned ? "shop:onboard:idempotent" : "shop:onboard:created",
      targetType: "shop",
      targetId: result.shopId,
      shopId: result.shopId,
      outcome: "ALLOW",
    },
    deps.auditSink,
  );

  return result;
}
