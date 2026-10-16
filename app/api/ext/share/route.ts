import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extAllow, extUser } from "@/lib/ext/auth";
import { shareJobCheck, shareText } from "@/lib/share";

/** A share link for a job checked in the extension (D-147). */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const id = z.object({ jobId: z.string(), title: z.string().max(200).optional(), employer: z.string().max(160).optional(), state: z.enum(["verified", "unverified", "red_flags"]).optional(), calm: z.boolean().optional(), mostly: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  if (!id.success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  const origin = request.nextUrl.origin;
  if (user.preview) return NextResponse.json({ ok: true, url: `${origin}/c/demo000000`, text: shareText({ state: "verified", title: "Graduate Trainee, Finance", employer: "Northbridge Bank" }) });
  if (!z.uuid().safeParse(id.data.jobId).success) return NextResponse.json({ ok: false, error: "Send the job again." }, { status: 400 });
  if (!(await extAllow(user.id, "ext_check"))) return NextResponse.json({ ok: false, error: "Try again in a little while." }, { status: 429 });
  const res = await shareJobCheck(user.id, id.data.jobId);
  if (!res.ok) return NextResponse.json(res, { status: 400 });
  return NextResponse.json({ ok: true, url: `${origin}/c/${res.slug}`, text: shareText({ state: id.data.state ?? "unverified", calm: id.data.calm, mostly: id.data.mostly, title: id.data.title ?? null, employer: id.data.employer ?? null }) });
}
