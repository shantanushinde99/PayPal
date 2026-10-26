"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Funding = "PAYPAL" | "PAYLATER" | "VENMO";
type Sdk = {
  FUNDING: Record<Funding, string>;
  Buttons: (o: object) => { isEligible: () => boolean; render: (el: HTMLElement) => Promise<void>; close?: () => void };
  Messages?: (o: object) => { render: (el: HTMLElement) => Promise<void> };
};

// One script per distinct src (currency/payee), each under its own namespace so they don't clash.
const loading = new Map<string, Promise<Sdk>>();
function loadSdk(src: string): Promise<Sdk> {
  if (!loading.has(src)) {
    const ns = "paypal_" + loading.size;
    loading.set(src, new Promise((resolve, reject) => {
      const s = Object.assign(document.createElement("script"), { src, async: true });
      s.dataset.namespace = ns;
      s.onload = () => resolve((window as unknown as Record<string, Sdk>)[ns]);
      s.onerror = () => { loading.delete(src); reject(new Error("PayPal didn't load")); };
      document.head.append(s);
    }));
  }
  return loading.get(src)!;
}

export function PayPalButtons({ src, amount, showMessage, createOrder, onApprove }: {
  src: string; // built on the server: client id, currency, intent=authorize, payee
  amount: string;
  showMessage: boolean; // Pay Later messaging (USD only)
  createOrder: () => Promise<{ orderId?: string; error?: string }>;
  onApprove: (orderId: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const message = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let stale = false;
    const buttons: ReturnType<Sdk["Buttons"]>[] = [];
    loadSdk(src).then(async (pp) => {
      if (stale || !box.current) return;
      box.current.replaceChildren();
      for (const f of ["PAYPAL", "PAYLATER", "VENMO"] as Funding[]) {
        const b = pp.Buttons({
          fundingSource: pp.FUNDING[f],
          style: { height: 44, shape: "pill" },
          createOrder: async () => {
            setError("");
            const r = await createOrder();
            if (!r.orderId) throw new Error(r.error ?? "PayPal couldn't start the payment.");
            return r.orderId;
          },
          onApprove: async (data: { orderID: string }) => {
            const r = await onApprove(data.orderID);
            if (r.error) setError(r.error);
            router.refresh();
          },
          onError: (e: Error) => setError(e?.message?.startsWith("PayPal") ? e.message : "PayPal couldn't finish the payment. Nothing was charged; please try again."),
        });
        if (!b.isEligible()) continue; // Venmo and Pay Later depend on the buyer's country and currency
        const slot = document.createElement("div");
        box.current.append(slot);
        buttons.push(b);
        await b.render(slot);
      }
      if (!stale) setStatus("ready");
      if (showMessage && message.current && pp.Messages) pp.Messages({ amount, placement: "payment" }).render(message.current).catch(() => {});
    }).catch(() => !stale && setStatus("failed"));
    return () => { stale = true; buttons.forEach((b) => b.close?.()); };
  }, [src, amount, showMessage, createOrder, onApprove, router]);

  return (
    <div className="w-full max-w-sm space-y-2">
      {status === "loading" && <p className="text-sm text-ink-soft">Loading PayPal…</p>}
      {status === "failed" && <p className="text-sm text-amber-800">PayPal&apos;s buttons didn&apos;t load. Use the link below.</p>}
      <div ref={box} className="space-y-2" />
      <div ref={message} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
