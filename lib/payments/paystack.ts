import "server-only";

// Paystack server calls. The secret key never reaches the browser, and nothing here
// unlocks a pass: only the verified webhook does (app/api/payments/paystack/webhook).

const API = "https://api.paystack.co";

function key(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return k;
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; data?: T } | null;
  if (!res.ok || !body?.status || !body.data) throw new Error(`Paystack ${path.split("/")[2] ?? path} failed with ${res.status}`);
  return body.data;
}

/** Starts a one time charge. Card, bank transfer and USSD (Build pack decision 2). */
export async function initializeCharge(input: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, string> }): Promise<{ authorizationUrl: string }> {
  const data = await call<{ authorization_url: string }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ["card", "bank_transfer", "ussd", "bank"],
      metadata: input.metadata,
    }),
  });
  return { authorizationUrl: data.authorization_url };
}

export type VerifiedCharge = { status: string; amount: number; currency: string; channel: string | null; reference: string };

/** Asks Paystack directly. The webhook checks this too before it grants anything. */
export async function verifyCharge(reference: string): Promise<VerifiedCharge> {
  const d = await call<{ status: string; amount: number; currency: string; channel: string | null; reference: string }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  return { status: d.status, amount: d.amount, currency: d.currency, channel: d.channel, reference: d.reference };
}
