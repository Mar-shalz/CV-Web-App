import "server-only";
import { cookies } from "next/headers";

export type ToastTone = "ok" | "info" | "error";

/**
 * A short notice for the toast at the top of the screen, set from a server action
 * (D-121). It rides in a 30 second cookie that the page reads once and clears, so it
 * shows after a redirect or a refresh alike. Only our own fixed wording goes in it.
 */
export async function flash(message: string, tone: ToastTone = "ok"): Promise<void> {
  // Next encodes cookie values itself, so the JSON goes in as it is.
  (await cookies()).set("rcpt_toast", JSON.stringify({ m: message.slice(0, 160), t: tone }), { path: "/", maxAge: 30, sameSite: "lax", httpOnly: false });
}
