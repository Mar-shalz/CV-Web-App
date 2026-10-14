import { NextResponse, type NextRequest } from "next/server";
import { extUser } from "@/lib/ext/auth";

/** Who the extension is signed in as, for its profile button (D-144). */
export async function GET(request: NextRequest) {
  const user = await extUser(request);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const name = user.name ?? user.email.split("@")[0] ?? "You";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return NextResponse.json({ ok: true, name, email: user.email, initials: initials || "R" }, { headers: { "cache-control": "no-store" } });
}
