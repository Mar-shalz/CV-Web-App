// First load budget (Build pack section 10: 300KB or less, compressed).
// Run after `npm run build`. For every App Router page it sums the gzipped size of
// the JS and CSS the browser fetches on first load, plus preloaded fonts (woff2 is
// already compressed, so it counts at its raw size). The HTML document is left out
// because most pages render per request.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = Number(process.env.FIRST_LOAD_BUDGET_KB ?? 300);
const next = ".next";

if (!existsSync(join(next, "build-manifest.json"))) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

const build = JSON.parse(readFileSync(join(next, "build-manifest.json"), "utf8"));
const fonts = JSON.parse(readFileSync(join(next, "server", "next-font-manifest.json"), "utf8")).app ?? {};

const sizeCache = new Map();
function compressedSize(file) {
  if (!sizeCache.has(file)) {
    const buf = readFileSync(join(next, file));
    sizeCache.set(file, file.endsWith(".woff2") ? buf.length : gzipSync(buf, { level: 9 }).length);
  }
  return sizeCache.get(file);
}

function* manifests(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* manifests(p);
    else if (name === "page_client-reference-manifest.js") yield p;
  }
}

const rows = [];
for (const file of manifests(join(next, "server", "app"))) {
  globalThis.__RSC_MANIFEST = {};
  // The manifest is a script that assigns to globalThis.__RSC_MANIFEST.
  new Function(readFileSync(file, "utf8"))();
  const [entry, manifest] = Object.entries(globalThis.__RSC_MANIFEST)[0];
  const route = "/" + relative(join(next, "server", "app"), file).split(sep).slice(0, -1).join("/");
  if (route.startsWith("/_global-error")) continue;

  const files = new Set(build.rootMainFiles);
  for (const list of Object.values(manifest.entryJSFiles ?? {})) for (const f of list) files.add(f);
  for (const list of Object.values(manifest.entryCSSFiles ?? {})) for (const f of list) if (!f.inlined) files.add(f.path);
  for (const f of fonts[`[project]/app${entry}`] ?? []) files.add(f);

  let total = 0;
  for (const f of files) total += compressedSize(f);
  rows.push({ route: route === "/" ? "/" : route, kb: total / 1024 });
}

rows.sort((a, b) => b.kb - a.kb);
let over = 0;
for (const { route, kb } of rows) {
  const flag = kb > BUDGET_KB ? "  OVER BUDGET" : "";
  if (flag) over++;
  console.log(`${kb.toFixed(1).padStart(7)} KB  ${route}${flag}`);
}
console.log(`\nFirst load budget: ${BUDGET_KB} KB. Largest page: ${rows[0].kb.toFixed(1)} KB.`);
if (over) {
  console.error(`${over} page(s) over the first load budget.`);
  process.exit(1);
}
