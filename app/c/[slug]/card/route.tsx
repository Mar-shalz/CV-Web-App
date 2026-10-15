import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getSharedCheck, DEMO_SHARE, type SharedCheck } from "@/lib/share";
import { isPreviewMode } from "@/lib/env";
import { APP_NAME } from "@/lib/config";

// The picture people send on WhatsApp (D-154): 1080 by 1350, the shape WhatsApp and
// Instagram show largest. One message per card: the verdict, big and coloured; the job;
// what was checked as a short list of marks; and where to check your own job.

const THEME = {
  verified: { top: "#0b5d3b", bottom: "#0f7a4a", chip: "#d9f5e6", ink: "#0b5d3b", word: "Looks genuine", sub: "on the checks we could run" },
  unverified: { top: "#7a3f06", bottom: "#a3570a", chip: "#ffecd2", ink: "#7a3f06", word: "Couldn't confirm it", sub: "be careful before you apply" },
  red_flags: { top: "#8f1d14", bottom: "#b42318", chip: "#fde2df", ink: "#8f1d14", word: "Warning signs", sub: "found in this job post" },
} as const;

function Mark({ status }: { status: "pass" | "fail" | "unknown" }) {
  const fill = status === "pass" ? "#0f7a4a" : status === "fail" ? "#b42318" : "#94a3b8";
  return (
    <svg width="44" height="44" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill={fill} />
      {status === "pass" ? <path d="m7 12.5 3.2 3.2L17.2 8.7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /> : status === "fail" ? <path d="m8.5 8.5 7 7m0-7-7 7" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /> : <path d="M7.5 12h9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

function Shield({ color }: { color: string }) {
  return (
    <svg width="120" height="120" viewBox="0 0 24 24">
      <path d="M10.5 2.2 5.5 4.1C4.3 4.5 3.4 5.8 3.4 7.1v7.4c0 1.2.8 2.7 1.7 3.4l4.3 3.2c1.4 1 3.7 1 5.1 0l4.3-3.2c1-.7 1.7-2.2 1.7-3.4V7.1c0-1.3-.9-2.6-2.1-3l-5-1.9c-.8-.3-2.1-.3-2.9 0Z" fill="#ffffff" />
      <path d="m8.6 12.2 2.3 2.3 4.6-4.6" stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s: SharedCheck | null = isPreviewMode() ? DEMO_SHARE : await getSharedCheck(slug);
  if (!s) return new Response("Not found", { status: 404 });
  const t = THEME[s.state];
  const host = request.nextUrl.host;
  const checks = s.checks.slice(0, 6);
  const meta = [s.employer, s.location].filter(Boolean).join(" · ");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: "#f3f5fa", fontFamily: "sans-serif" }}>
        {/* The verdict band */}
        <div style={{ display: "flex", flexDirection: "column", padding: "64px 72px 88px", background: `linear-gradient(160deg, ${t.top} 0%, ${t.bottom} 100%)`, color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 34 }}>
              <div style={{ display: "flex", width: 60, height: 60, borderRadius: 16, background: "#ffffff", color: t.ink, alignItems: "center", justifyContent: "center", fontSize: 34 }}>{APP_NAME.charAt(0)}</div>
              <div style={{ display: "flex" }}>{`${APP_NAME} · Job check`}</div>
            </div>
            <div style={{ display: "flex", padding: "10px 22px", borderRadius: 999, background: "rgba(255,255,255,0.16)", fontSize: 26 }}>Free to check</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 34, marginTop: 70 }}>
            <Shield color={t.ink} />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 76, lineHeight: 1.05 }}>{t.word}</div>
              <div style={{ display: "flex", fontSize: 36, opacity: 0.88, marginTop: 10 }}>{t.sub}</div>
            </div>
          </div>
        </div>

        {/* The job and what was checked, on a white card that overlaps the band */}
        <div style={{ display: "flex", flexDirection: "column", margin: "-48px 48px 0", padding: "48px 52px", borderRadius: 40, background: "#ffffff", boxShadow: "0 20px 60px rgba(15,23,42,0.12)" }}>
          <div style={{ display: "flex", fontSize: 50, color: "#0f172a", lineHeight: 1.15 }}>{(s.title ?? "A job post").slice(0, 70)}</div>
          {meta ? <div style={{ display: "flex", fontSize: 32, color: "#475569", marginTop: 12 }}>{meta.slice(0, 70)}</div> : null}
          {s.sourceHost ? <div style={{ display: "flex", alignSelf: "flex-start", marginTop: 18, padding: "8px 18px", borderRadius: 999, background: t.chip, color: t.ink, fontSize: 24 }}>{`Posted on ${s.sourceHost}`}</div> : null}
          <div style={{ display: "flex", height: 2, background: "#e2e8f0", margin: "34px 0 26px" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {checks.map((c) => (
              <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 22 }}>
                <Mark status={c.status} />
                <div style={{ display: "flex", fontSize: 31, color: "#1e293b" }}>{c.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Where to check your own */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "auto", padding: "0 72px 56px" }}>
          <div style={{ display: "flex", fontSize: 34, color: "#0f172a" }}>Check any job free before you apply</div>
          <div style={{ display: "flex", fontSize: 30, color: "#1e47d9", marginTop: 10 }}>{`${host}/c/${slug}`}</div>
          <div style={{ display: "flex", fontSize: 21, color: "#64748b", marginTop: 16 }}>About this one post, not the company named in it. Never pay to apply.</div>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { "Cache-Control": "public, max-age=600", "Content-Disposition": `inline; filename="job-check-${slug}.png"` } },
  );
}
