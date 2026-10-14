// Builds the browser extension (D-144): copies extension/ to extension-dist/ with the app's
// address filled in, and zips it into public/ for the app's download button.
//   npm run extension:build                        the live address
//   EXT_APP_URL=http://localhost:3001 npm run extension:build   for local testing (no zip)
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const LIVE = "https://cv-web-app-victor-ajibodu-s-projects.vercel.app";
const appUrl = (process.env.EXT_APP_URL || LIVE).replace(/\/+$/, "");
if (!/^https?:\/\/[a-z0-9.-]+(:\d+)?$/i.test(appUrl)) throw new Error(`EXT_APP_URL must be an origin like https://example.com, got ${appUrl}`);

const src = "extension";
const out = "extension-dist";
rmSync(out, { recursive: true, force: true });
cpSync(src, out, { recursive: true, filter: (p) => !p.endsWith("README.md") });
for (const f of readdirSync(out)) {
  if (!/\.(json|js|html)$/.test(f)) continue;
  const p = join(out, f);
  writeFileSync(p, readFileSync(p, "utf8").replaceAll("__APP_URL__", appUrl));
}
console.log(`Built ${out}/ for ${appUrl}`);

if (appUrl === LIVE || process.env.EXT_ZIP === "1") {
  const zip = join("public", "receipts-extension.zip");
  if (existsSync(zip)) rmSync(zip);
  execFileSync("zip", ["-qr", join("..", zip), "."], { cwd: out });
  console.log(`Zipped to ${zip}`);
}
