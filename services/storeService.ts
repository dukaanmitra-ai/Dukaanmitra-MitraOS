import { createLedgerEntry } from "./adapters/ledgerAdapter";
import { AdapterError, type AuthSession } from "./adapters/types";
import type { ParsedTransaction } from "../types";

/**
 * Backward-compatible transaction logging facade.
 *
 * Delegates credit (`udhaar`) and payment (`payment`) entries to the verified
 * `mvp1-aafa3` ledger adapter (`shops/{shopId}/ledger` + atomic `shops/{shopId}/customers`).
 *
 * Cash POS sales (`type: 'sale'`) are strictly NOT written into the credit ledger
 * and must be routed through `coreEnginePosClient.recordCashSale()`.
 */
export const logTransaction = async (
  shopId: string,
  parsed: ParsedTransaction & { customerPhone?: string },
  session?: AuthSession | null,
) => {
  if (parsed.type === "sale") {
    throw new AdapterError(
      "CASH_SALE_REQUIRES_POS_API",
      'Cash sales ("sale") must be recorded through Core Engine POS API (coreEnginePosClient.recordCashSale), not Firestore credit ledger.',
    );
  }

  if (!parsed.customerPhone) {
    throw new AdapterError(
      "INVALID_INPUT",
      "customerPhone is required to record an mvp1-aafa3 ledger entry.",
    );
  }

  return createLedgerEntry(
    shopId,
    {
      customerPhone: parsed.customerPhone,
      customerName: parsed.customerName,
      amount: parsed.amount,
      item:
        ("items" in parsed && parsed.items) ||
        parsed.description ||
        "Saman",
      type: parsed.type,
      source: "app",
    },
    session,
  );
};
