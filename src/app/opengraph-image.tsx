import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

export const alt = "Verifund · Pay for proof, not promises";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Shared-link preview (Devpost, Slack, X): logo, name, tagline on the brand's midnight background.
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 90, background: "linear-gradient(135deg, #050b1a 0%, #0b2447 55%, #0369a1 100%)", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={markDataUri(120)} width={120} height={120} alt="" />
          <span style={{ fontSize: 96, fontWeight: 700, letterSpacing: -3 }}>Verifund</span>
        </div>
        <div style={{ marginTop: 48, fontSize: 60, fontWeight: 700, letterSpacing: -1.5, display: "flex" }}>
          Pay for&nbsp;<span style={{ color: "#5eead4" }}>proof</span>, not promises.
        </div>
        <div style={{ marginTop: 22, fontSize: 30, color: "#bae6fd", display: "flex" }}>AI escrow on PayPal: payments are released only when an AI agent verifies the work.</div>
      </div>
    ),
    size,
  );
}
