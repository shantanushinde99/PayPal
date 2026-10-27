import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";
import { CookieBar, Footer, Header } from "@/components/chrome";

export const metadata: Metadata = {
  title: { default: "Northwind Travel · Small-group adventures", template: "%s · Northwind Travel" },
  description: "Small-group tours to Japan, Peru and Iceland with expert local guides.",
  icons: { icon: "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22%3E%3Ctext y=%22.9em%22 font-size=%2290%22%3E🧭%3C/text%3E%3C/svg%3E" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Header />
          <main>{children}</main>
          <Footer />
          <CookieBar />
        </Providers>
      </body>
    </html>
  );
}
