"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/viewer";
import { ROLE_KINDS, OWNERSHIP } from "@/lib/vault/schema";
import { toDate } from "@/lib/vault/dates";
import { extractMetrics } from "@/lib/vault/metrics";
import { lintCopy } from "@/lib/copy-lint";

export type VaultActionState = { ok?: boolean; error?: string } | undefined;

const id = z.uuid();
const ym = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .or(z.literal(""))
  .transform((v) => v || null);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

async function ctx() {
  const viewer = await getViewer();
  if (!viewer) throw new Error("Not signed in");
  return { viewer, supabase: viewer.preview ? null : await createClient() };
}

function done(): VaultActionState {
  revalidatePath("/vault", "layout");
  revalidatePath("/home");
  return { ok: true };
}

/** Confirm one evidence item: from now on it can appear on a CV. */
export async function confirmItem(formData: FormData): Promise<void> {
  const { viewer, supabase } = await ctx();
  const itemId = id.safeParse(formData.get("item_id"));
  if (!supabase || !itemId.success) return;
  await supabase.from("vault_items").update({ confirmed_at: new Date().toISOString() }).eq("id", itemId.data).eq("user_id", viewer.id);
  done();
}

/** Confirm a role's facts (employer, title, dates, grade) and, optionally, all its items. */
export async function confirmRole(formData: FormData): Promise<void> {
  const { viewer, supabase } = await ctx();
  const roleId = id.safeParse(formData.get("role_id"));
  if (!supabase || !roleId.success) return;
  await supabase.from("vault_roles").update({ confirmed: true }).eq("id", roleId.data).eq("user_id", viewer.id);
  if (formData.get("with_items") === "1") {
    await supabase.from("vault_items").update({ confirmed_at: new Date().toISOString() }).eq("role_id", roleId.data).eq("user_id", viewer.id).is("confirmed_at", null);
  }
  done();
}

const roleSchema = z.object({
  kind: z.enum(ROLE_KINDS),
  organisation: text(160),
  title: text(160),
  location: text(120),
  start: ym,
  end: ym,
  is_current: z.boolean(),
  grade: text(80),
});

function readRole(formData: FormData) {
  return roleSchema.safeParse({
    kind: formData.get("kind"),
    organisation: formData.get("organisation") ?? "",
    title: formData.get("title") ?? "",
    location: formData.get("location") ?? "",
    start: formData.get("start") ?? "",
    end: formData.get("end") ?? "",
    is_current: formData.get("is_current") === "on",
    grade: formData.get("grade") ?? "",
  });
}

/** Saving the form counts as confirming: the user has looked at every field. */
export async function saveRole(_prev: VaultActionState, formData: FormData): Promise<VaultActionState> {
  const { viewer, supabase } = await ctx();
  const parsed = readRole(formData);
  if (!parsed.success) return { error: "Check the dates: use the month and year pickers." };
  const r = parsed.data;
  if (!r.title && !r.organisation) return { error: "Add at least a title or an organisation." };
  if (!supabase) return { ok: true };
  const row = {
    kind: r.kind,
    organisation: r.organisation,
    title: r.title,
    location: r.location,
    start_date: toDate(r.start),
    end_date: r.is_current ? null : toDate(r.end),
    is_current: r.is_current,
    grade: r.grade,
    confirmed: true,
  };
  const roleId = id.safeParse(formData.get("role_id"));
  const { error } = roleId.success
    ? await supabase.from("vault_roles").update(row).eq("id", roleId.data).eq("user_id", viewer.id)
    : await supabase.from("vault_roles").insert({ ...row, user_id: viewer.id, source: "text" });
  if (error) return { error: "We couldn't save that. Check your connection and try again." };
  return done();
}

const itemSchema = z.object({
  text: z.string().trim().min(8, "Write at least a short sentence.").max(400, "Keep it under 400 characters."),
  ownership: z.enum(OWNERSHIP),
});

/** Add or edit an item in the user's own words. Their words are the source, so it's confirmed. */
export async function saveItem(_prev: VaultActionState, formData: FormData): Promise<VaultActionState> {
  const { viewer, supabase } = await ctx();
  const parsed = itemSchema.safeParse({ text: formData.get("text"), ownership: formData.get("ownership") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const banned = lintCopy(parsed.data.text).filter((i) => i.kind === "phrase");
  if (banned.length) return { error: `Try plainer words than "${banned[0]?.match}". Say what you did and what changed.` };
  if (!supabase) return { ok: true };
  const row = {
    text: parsed.data.text,
    ownership: parsed.data.ownership,
    metrics: extractMetrics(parsed.data.text),
    confirmed_at: new Date().toISOString(),
  };
  const itemId = id.safeParse(formData.get("item_id"));
  if (itemId.success) {
    const { error } = await supabase.from("vault_items").update(row).eq("id", itemId.data).eq("user_id", viewer.id);
    if (error) return { error: "We couldn't save that. Try again." };
  } else {
    const roleId = id.safeParse(formData.get("role_id"));
    if (!roleId.success) return { error: "Pick the role this belongs to." };
    const { error } = await supabase
      .from("vault_items")
      .insert({ ...row, user_id: viewer.id, role_id: roleId.data, source_type: "text", source_quote: parsed.data.text, skills: [] });
    if (error) return { error: "We couldn't save that. Try again." };
  }
  return done();
}

export async function deleteItem(formData: FormData): Promise<void> {
  const { viewer, supabase } = await ctx();
  const itemId = id.safeParse(formData.get("item_id"));
  if (!supabase || !itemId.success) return;
  await supabase.from("vault_items").delete().eq("id", itemId.data).eq("user_id", viewer.id);
  done();
}

export async function deleteRole(formData: FormData): Promise<void> {
  const { viewer, supabase } = await ctx();
  const roleId = id.safeParse(formData.get("role_id"));
  if (!supabase || !roleId.success) return;
  await supabase.from("vault_roles").delete().eq("id", roleId.data).eq("user_id", viewer.id);
  done();
}
