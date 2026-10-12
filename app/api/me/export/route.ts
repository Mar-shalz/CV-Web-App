import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { readSensitive } from "@/lib/sensitive";
import { allow, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";

// Everything we hold about the person, as one JSON file (NDPA right of access and
// portability). Sensitive details are decrypted only when they tick the box for
// this export.
const TABLES = [
  "profiles",
  "consents",
  "olevel_results",
  "vault_roles",
  "vault_items",
  "interview_sessions",
  "jobs",
  "eligibility_results",
  "verdicts",
  "survey_answers",
  "cv_versions",
  "application_packs",
  "applications",
  "outcome_events",
  "debriefs",
  "shortlist_sessions",
  "passes",
  "usage_counters",
] as const;

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false }, { status: 401 });
  if (viewer.preview) return NextResponse.json({ note: "Preview mode has no stored data." });
  if (!(await allow("export"))) return NextResponse.json({ ok: false, error: RATE_LIMITED_MESSAGE }, { status: 429 });

  const supabase = await createClient();
  const out: Record<string, unknown> = { exported_at: new Date().toISOString(), account: { email: viewer.email } };
  const { data: user } = await supabase.from("users").select("email, auth_provider, career_stage, target_markets, low_data_mode, created_at").eq("id", viewer.id).maybeSingle();
  out.user = user;
  for (const t of TABLES) {
    const { data } = await supabase.from(t).select("*").eq("user_id", viewer.id).limit(5000);
    out[t] = data ?? [];
  }
  if (request.nextUrl.searchParams.get("sensitive") === "1") {
    out.sensitive_details = await readSensitive(viewer.id, ["date_of_birth", "gender", "state_of_origin", "nysc_status", "nysc_start", "nysc_end"]);
  } else {
    out.sensitive_details = "Not included. Tick the box in Settings to include them in your export.";
  }

  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-data-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
