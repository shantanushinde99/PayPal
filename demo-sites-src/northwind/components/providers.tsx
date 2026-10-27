"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const RATES = { USD: [1, "$"], EUR: [0.92, "€"], GBP: [0.79, "£"] } as const;
export type Currency = keyof typeof RATES;

type Ctx = { currency: Currency; setCurrency: (c: Currency) => void; price: (usd: number) => string; toast: (msg: string) => void };
const AppContext = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppContext)!;

export function Providers({ children }: { children: ReactNode }) {
  const [currency, setCur] = useState<Currency>("USD");
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);

  // Remembered between visits; read after mount so the static HTML always starts in USD.
  useEffect(() => {
    try { const saved = localStorage.getItem("nw-currency") as Currency | null; if (saved && saved in RATES) setCur(saved); } catch {}
  }, []);
  const setCurrency = (c: Currency) => { setCur(c); try { localStorage.setItem("nw-currency", c); } catch {} };
  const price = (usd: number) => { const [r, s] = RATES[currency]; return s + Math.round(usd * r).toLocaleString("en-US"); };
  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <AppContext.Provider value={{ currency, setCurrency, price, toast }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{toasts.map((t) => <div key={t.id} className="toast">{t.msg}</div>)}</div>
    </AppContext.Provider>
  );
}

export function Price({ usd, className = "price" }: { usd: number; className?: string }) {
  return <span className={className}>{useApp().price(usd)}</span>;
}
