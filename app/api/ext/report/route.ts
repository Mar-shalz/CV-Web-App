import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { extUser } from "@/lib/ext/auth";
import { reportOps } from "@/lib/ops";

/** The extension tells our team when Gmail's page changed and the CV couldn't be attached (D-181). */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false, error: "signin" }, { status: 401 });
  const b = z.object({ reason: z.string().regex(/^[a-z_]{2,40}$/), method: z.string().regex(/^[a-z]{2,10}$/).nullable().optional() }).safeParse(await request.json().catch(() => null));
  if (!b.success) return NextResponse.json({ ok: false }, { status: 400 });
  await reportOps("gmail_attach_failed", { reason: b.data.reason, method: b.data.method ?? null, from: "extension" });
  return NextResponse.json({ ok: true });
}
