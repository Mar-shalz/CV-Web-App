import { ImageResponse } from "next/og";
import { APP, APP_NAME } from "@/lib/config";

// The share card for links to the site (WhatsApp, X, LinkedIn): the promise on the brand's
// night sky, with the three moments that matter (founder round 31).
export const alt = `${APP_NAME}: ${APP.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const chip = (label: string, value: string, color: string) => (
    <div style={{ display: "flex", flexDirection: "column", padding: "18px 22px", borderRadius: 22, background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.22)", minWidth: 230 }}>
      <div style={{ fontSize: 22, color: "rgba(255,255,255,0.75)" }}>{label}</div>
      <div style={{ fontSize: 34, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, color: "#fff", background: "radial-gradient(120% 90% at 30% 0%, #2f5ef0 0%, #10236b 45%, #050b24 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 18, background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{APP_NAME}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{APP.tagline}</div>
          <div style={{ fontSize: 32, marginTop: 22, color: "rgba(255,255,255,0.85)", maxWidth: 940, lineHeight: 1.3 }}>Check if a job is real, see your match, and send a CV built only from what you&apos;ve done.</div>
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {chip("Is this job real?", "5 of 6 checks", "#4ade80")}
          {chip("Your match", "78%", "#7dd3fc")}
          {chip("Mock interview", "Question 3 of 7", "#c4b5fd")}
        </div>
      </div>
    ),
    size,
  );
}
