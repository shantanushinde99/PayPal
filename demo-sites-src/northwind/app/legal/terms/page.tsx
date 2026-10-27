import { Crumbs } from "@/components/chrome";

export const metadata = { title: "Booking terms", description: "Northwind Travel booking terms and conditions." };

export default function Terms() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Booking terms"]]} />
      <section><div className="wrap" style={{ maxWidth: 820 }}><h1>Booking terms</h1><p className="meta">Effective 1 January 2026</p>
        <h2>1. Deposit and balance</h2><p>A 20% deposit confirms your place. The balance is due 60 days before departure.</p>
        <h2>2. Cancellation by you</h2><ul><li>More than 60 days before departure: you lose the deposit.</li><li>30–60 days: 50% of the total.</li><li>Less than 30 days: 100% of the total.</li></ul>
        <h2>3. Changes by us</h2><p>If we cancel a departure you get a full refund or a free transfer to another date.</p>
        <h2>4. Financial protection</h2><p>All trips are protected under ATOL licence 11847.</p></div></section>
    </>
  );
}
