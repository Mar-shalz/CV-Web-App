import "server-only";
import { createClient } from "@/lib/supabase/server";
import { decryptField, encryptField } from "@/lib/crypto/sensitive";
import { LEGAL } from "@/lib/config";

// Sensitive details (Build pack section 4): their own table, encrypted per field,
// asked for only when a rule or format needs them. Read only the fields a caller asks for.

export type SensitiveField = "date_of_birth" | "gender" | "state_of_origin" | "nysc_status" | "nysc_start" | "nysc_end";
const COL: Record<SensitiveField, string> = {
  date_of_birth: "date_of_birth_enc",
  gender: "gender_enc",
  state_of_origin: "state_of_origin_enc",
  nysc_status: "nysc_status_enc",
  nysc_start: "nysc_start_enc",
  nysc_end: "nysc_end_enc",
};

const keyReady = () => Boolean(process.env.SENSITIVE_DATA_KEY_V1);

export async function readSensitive(userId: string, fields: SensitiveField[]): Promise<Partial<Record<SensitiveField, string>>> {
  if (!fields.length || !keyReady()) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("sensitive_details").select(fields.map((f) => COL[f]).join(", ")).eq("user_id", userId).maybeSingle();
  const out: Partial<Record<SensitiveField, string>> = {};
  if (!data) return out;
  for (const f of fields) {
    const enc = (data as unknown as Record<string, string | null>)[COL[f]];
    if (!enc) continue;
    try {
      out[f] = decryptField(enc, userId);
    } catch {
      // A key rotation without re-encryption, or tampering: treat as not given.
    }
  }
  return out;
}

/** Encrypts and saves the given fields, recording the sensitive details consent the first time. */
export async function writeSensitive(userId: string, values: Partial<Record<SensitiveField, string | null>>): Promise<boolean> {
  if (!keyReady()) return false;
  const supabase = await createClient();
  const row: Record<string, string | null> = { user_id: userId };
  for (const [f, v] of Object.entries(values) as [SensitiveField, string | null][]) row[COL[f]] = v ? encryptField(v, userId) : null;
  const { error } = await supabase.from("sensitive_details").upsert(row, { onConflict: "user_id" });
  if (error) return false;
  const { data: consent } = await supabase.from("consents").select("id").eq("user_id", userId).eq("type", "sensitive_details").not("granted_at", "is", null).is("withdrawn_at", null).limit(1).maybeSingle();
  if (!consent) {
    await supabase.from("consents").insert({ user_id: userId, type: "sensitive_details", version: LEGAL.consents.sensitive_details?.version ?? "sensitive-v0.1", granted_at: new Date().toISOString() });
  }
  return true;
}
