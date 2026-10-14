import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/** Save for later from the extension (D-144): it shows under Applications > Saved for later. */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const id = z.object({ jobId: z.string() }).safeParse(await request.json().catch(() => null));
  if (!id.success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (user.preview) return NextResponse.json({ ok: true });
  if (!z.uuid().safeParse(id.data.jobId).success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (!(await extAllow(user.id, "ext_save"))) return NextResponse.json({ ok: false, error: "Try again in a little while." }, { status: 429 });
  const { error } = await createAdminClient().from("jobs").update({ state: "saved" }).eq("id", id.data.jobId).eq("user_id", user.id).neq("state", "applied");
  if (error) return NextResponse.json({ ok: false, error: "We couldn't save it just now." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
