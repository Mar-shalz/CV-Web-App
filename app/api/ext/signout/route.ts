import { NextResponse, type NextRequest } from "next/server";
import { bearer, extUser, revokeExtensionTokens } from "@/lib/ext/auth";

/** Signs this browser's extension out: its key stops working at once. */
export async function POST(request: NextRequest) {
  const user = await extUser(request);
  const token = bearer(request);
  if (user && token && !user.preview) await revokeExtensionTokens(user.id, token);
  return NextResponse.json({ ok: true });
}
