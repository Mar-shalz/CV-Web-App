import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/config";

/** The CV file someone sent with an application they logged: a short lived private link. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ ok: false }, { status: 401 });
  if (viewer.preview || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false }, { status: 404 });
  const supabase = await createClient();
  const { data } = await supabase.from("applications").select("*").eq("id", id).eq("user_id", viewer.id).maybeSingle();
  const row = data as { external_cv_path?: string | null; external_cv_name?: string | null } | null;
  if (!row?.external_cv_path) return NextResponse.json({ ok: false }, { status: 404 });
  const { data: signed } = await supabase.storage.from("cv-exports").createSignedUrl(row.external_cv_path, LIMITS.files.signed_url_seconds, { download: row.external_cv_name ?? true });
  if (!signed) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl);
}
