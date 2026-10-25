// Builds the browser extension (D-144): copies extension/ to extension-dist/ with the app's
// address filled in, and zips it into public/ for the app's download button.
//   npm run extension:build                        the live address (config/app.json app_url)
//   EXT_APP_URL=http://localhost:3001 npm run extension:build   for local testing (no zip)
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// The app's one public address. It was the long Vercel project address until round 27, when
// the founder moved to applywithproof.vercel.app: an extension built for the old one sent
// people to sign in there, where Google refused the sign in (redirect_uri_mismatch).
const APP_CONFIG = JSON.parse(readFileSync("config/app.json", "utf8"));
const LIVE = APP_CONFIG.app_url.replace(/\/+$/, "");
// The product name comes from the same config, so a rename reaches the extension too (round 31).
const APP_NAME = String(APP_CONFIG.APP_NAME || "Receipts");
const appUrl = (process.env.EXT_APP_URL || LIVE).replace(/\/+$/, "");
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(appUrl)) throw new Error(`EXT_APP_URL must be an origin like https://example.com, got ${appUrl}`);

const src = "extension";
const out = "extension-dist";
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (p) => !p.endsWith("README.md") });
for (const f of readdirSync(out)) {
  if (!/\.(json|js|html)$/.test(f)) continue;
  const p = join(out, f);
  writeFileSync(p, readFileSync(p, "utf8").replaceAll("__APP_URL__", appUrl).replaceAll("__APP_NAME__", APP_NAME));
}
console.log(`Built ${out}/ for ${appUrl}`);

if (appUrl === LIVE || process.env.EXT_ZIP === "1") {
  const zip = join("public", "receipts-extension.zip");
  if (existsSync(zip)) rmSync(zip);
  execFileSync("zip", ["-qr", join("..", zip), "."], { cwd: out });
  console.log(`Zipped to ${zip}`);
}
