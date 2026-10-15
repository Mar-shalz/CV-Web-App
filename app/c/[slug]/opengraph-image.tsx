import { ImageResponse } from "next/og";
import { getSharedCheck, DEMO_SHARE, isCalm } from "@/lib/share";
import { isPreviewMode } from "@/lib/env";
import { APP_NAME } from "@/lib/config";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Job check verdict";

const STATE = {
  verified: { bg: "#e8f7ef", fg: "#0f7a4a", text: "Looks genuine on the checks we could run" },
  unverified: { bg: "#fff4e5", fg: "#a3570a", text: "Couldn't be confirmed. Be careful." },
  red_flags: { bg: "#fdecea", fg: "#b42318", text: "Warning signs in this job post" },
  calm: { bg: "#eef3ff", fg: "#1e47d9", text: "No warning signs found" },
} as const;

/** The preview card WhatsApp and X show for a shared check (D-147). */
export default async function OgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = isPreviewMode() ? DEMO_SHARE : await getSharedCheck(slug);
  const st = STATE[s && isCalm(s) ? "calm" : (s?.state ?? "unverified")];
  const job = s?.title ?? "A job post";
  const employer = [s?.employer, s?.location].filter(Boolean).join(" · ");
  const passed = s?.checks.filter((c) => c.status === "pass").length ?? 0;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "linear-gradient(135deg, #0b1838 0%, #1e47d9 100%)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 30, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#fff", color: "#1e47d9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 800 }}>{APP_NAME.charAt(0)}</div>
          <div style={{ display: "flex" }}>{`${APP_NAME} job check`}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, lineHeight: 1.1, maxWidth: 1050 }}>{job.slice(0, 80)}</div>
          {employer ? <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>{employer.slice(0, 80)}</div> : null}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 18 }}>
          <div style={{ display: "flex", padding: "14px 26px", borderRadius: 999, background: st.bg, color: st.fg, fontSize: 32 }}>{st.text}</div>
          <div style={{ display: "flex", fontSize: 26, opacity: 0.85 }}>{`${passed} of ${s?.checks.length ?? 0} checks passed · Check your own job, free`}</div>
        </div>
      </div>
    ),
    size,
  );
}
