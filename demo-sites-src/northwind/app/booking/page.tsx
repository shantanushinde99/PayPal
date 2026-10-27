import { Suspense } from "react";
import { Crumbs } from "@/components/chrome";
import { BookingWizard } from "@/components/widgets";

export const metadata = { title: "Book a trip", description: "Book a Northwind tour in three steps." };

export default function Booking() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Book a trip"]]} />
      <section><div className="wrap" style={{ maxWidth: 760 }}><h1>Book your trip</h1>
        <Suspense fallback={<p>Loading…</p>}><BookingWizard /></Suspense></div></section>
    </>
  );
}
