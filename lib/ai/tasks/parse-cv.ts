import { z } from "zod";
import { defineTask, trusted, untrusted, untrustedFile } from "../types";
import { draftRoleSchema } from "@/lib/vault/schema";

const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string().min(40).max(60_000), fileHash: z.string() }),
  /** textLayer: the PDF's own text, read by code (D-183); null for a scanned PDF. */
  z.object({ kind: z.literal("pdf"), base64: z.string().min(10), textLayer: z.string().max(60_000).nullable().default(null), fileHash: z.string() }),
  z.object({ kind: z.literal("image"), base64: z.string().min(10), mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), fileHash: z.string() }),
]);

const nullableText = (max: number) => z.string().max(max).nullable();

/** Sent with a PDF's text layer (D-183), here and in parse_job. */
export const TEXT_LAYER_NOTE =
  "The PDF's text layer follows: the exact characters in the attached file, read by code, page by page in reading order. On a two column page, the left column comes first, then the right. Three spaces mark a wide gap on one line, such as a role and its dates. Copy names, emails, phone numbers, links, dates and numbers from the text layer, character for character. Use the attached file to see the layout: headings, and which section or role each line belongs to.";

/**
 * parse_cv (Build pack section 6): roles and draft evidence items, each item with the exact
 * source quote. On the judgement class of model since D-183: once per CV, and the lighter
 * model dropped roles and misread layouts.
 */
export const parseCv = defineTask({
  name: "parse_cv",
  model: "claude-sonnet-5-5",
  promptVersion: "v5",
  input,
  output: z.object({
    is_cv: z.boolean(),
    person: z.object({
      full_name: nullableText(120),
      phone: nullableText(40),
      email: nullableText(160),
      city: nullableText(80),
      state: nullableText(80),
      linkedin_url: nullableText(200),
      portfolio_url: nullableText(200),
      website_url: nullableText(200),
    }),
    // Old Nigerian CVs often carry these. They are offered to the user to keep privately, never used by default.
    sensitive_found: z.object({
      date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      gender: nullableText(30),
      state_of_origin: nullableText(60),
      marital_status_present: z.boolean(),
      religion_present: z.boolean(),
    }),
    roles: z.array(draftRoleSchema).max(30),
    skills: z.array(z.string().max(60)).max(60),
    // Kept on My Experience (D-162): the person's own summary, and referees for formats that want them.
    summary: z.string().max(1500).nullable(),
    referees: z
      .array(z.object({ name: z.string().max(120), role: nullableText(120), organisation: nullableText(160), phone: nullableText(40), email: nullableText(160), relationship: nullableText(160) }))
      .max(4),
  }),
  maxTokens: 16_000,
  timeoutMs: 60_000,
  effort: "medium",
  render: (i) => [
    trusted("Read this CV and return its roles and evidence items."),
    ...(i.kind === "text"
      ? [untrusted("cv_text", i.text)]
      : i.kind === "pdf"
        ? [untrustedFile("cv_file", "application/pdf", i.base64), ...(i.textLayer ? [trusted(TEXT_LAYER_NOTE), untrusted("cv_text_layer", i.textLayer)] : [])]
        : [untrustedFile("cv_photo", i.mediaType, i.base64)]),
  ],
  cache: { key: (i) => i.fileHash, ttlSeconds: 30 * 24 * 3600 },
  manualStep: "add_roles_by_hand",
});
