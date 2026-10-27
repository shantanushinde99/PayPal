import { Suspense } from "react";
import { Crumbs } from "@/components/chrome";
import { ToursList } from "@/components/widgets";

export const metadata = { title: "All tours", description: "Browse and filter every Northwind tour." };

export default function Tours() {
  return (
    <>
      <Crumbs items={[["/", "Home"], [null, "Tours"]]} />
      <section><div className="wrap"><h1>All tours</h1>
        <Suspense fallback={<p className="lead">Loading tours…</p>}><ToursList /></Suspense>
      </div></section>
    </>
  );
}
