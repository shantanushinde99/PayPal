"use client";
import { Printer } from "lucide-react";
import { btn } from "@/components/ui";

export function PrintButton() {
  return <button onClick={() => window.print()} className={`${btn.secondary} print:hidden`}><Printer aria-hidden className="size-4" /> Print / save PDF</button>;
}
