import type { PaymentItem } from "@/lib/payment-history";

export type WalletTotals = { currency: string; received: number; paid: number; onHoldMine: number; incoming: number; released: number; count: number };

// Per-currency totals for the wallet header. Holds count only while still waiting (not Settled).
export function walletSummary(items: PaymentItem[]): WalletTotals[] {
  const by = new Map<string, WalletTotals>();
  for (const p of items) {
    const t = by.get(p.currency) ?? { currency: p.currency, received: 0, paid: 0, onHoldMine: 0, incoming: 0, released: 0, count: 0 };
    t.count++;
    if (p.kind === "paid" || p.kind === "payout" || p.kind === "captured") {
      if (p.view.sign === "+") t.received += p.amountMinor;
      else if (p.view.sign === "-") t.paid += p.amountMinor;
    } else if (p.kind === "hold" && p.view.status === "Held") {
      if (p.role === "client") t.onHoldMine += p.amountMinor;
      else t.incoming += p.amountMinor;
    } else if (p.kind === "void" && p.role === "client") {
      t.released += p.amountMinor;
    }
    by.set(p.currency, t);
  }
  return [...by.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}
