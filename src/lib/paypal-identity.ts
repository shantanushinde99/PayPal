export type PayPalProfile = {
  user_id: string;
  name?: string;
  verified_account?: string | boolean;
  emails?: { value: string; primary?: boolean; confirmed?: boolean }[];
};

// Users are keyed by email and payouts go to it, so only trust a confirmed primary email.
// verified_account is only returned with an extra scope; reject when PayPal explicitly says false.
export function verifiedEmail(p: Partial<PayPalProfile>): string | null {
  if (String(p.verified_account) === "false") return null;
  const e = p.emails?.find((x) => x.primary && x.confirmed);
  return e ? e.value.toLowerCase() : null;
}
