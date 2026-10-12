// Creates .env.local from .env.example and fills the secrets you generate yourself
// (encryption key, cron secret, analytics salt). Existing values are kept. Secrets are
// never printed: open .env.local to copy them into Vercel.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const example = readFileSync(".env.example", "utf8");
const current = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "";
const have = new Map(
  current
    .split("\n")
    .filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const generate = {
  SENSITIVE_DATA_KEY_V1: () => randomBytes(32).toString("base64"),
  CRON_SECRET: () => randomBytes(32).toString("hex"),
  ANALYTICS_SALT: () => randomBytes(16).toString("hex"),
};

const made = [];
const out = example
  .split("\n")
  .map((line) => {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) return line;
    const [, key] = m;
    if (have.get(key)) return `${key}=${have.get(key)}`;
    if (generate[key]) {
      made.push(key);
      return `${key}=${generate[key]()}`;
    }
    return line;
  })
  .join("\n");

writeFileSync(".env.local", out, { mode: 0o600 });
console.log(made.length ? `.env.local ready. New secrets made: ${made.join(", ")}.` : ".env.local ready. No new secrets needed.");
console.log("Open .env.local to fill in the keys from Supabase, Anthropic and Paystack. Never share or commit this file.");
