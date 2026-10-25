export const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

const ZERO_DECIMAL = new Set(["JPY", "HUF", "TWD"]);
const FEE_BPS = 500;

const decimals = (currency: string) => (ZERO_DECIMAL.has(currency) ? 0 : 2);

export const toMinor = (amount: number, currency: string) => Math.round(amount * 10 ** decimals(currency));

export const toPayPalValue = (minor: number, currency: string) =>
  (minor / 10 ** decimals(currency)).toFixed(decimals(currency));

export const payoutMinor = (amountMinor: number) => amountMinor - Math.round((amountMinor * FEE_BPS) / 10000);

export const formatMoney = (minor: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 10 ** decimals(currency));
