// Scans UI copy for banned phrases and em dashes (CLAUDE.md, Copy lint).
// Checks string and JSX text in app/ and components/, plus config/ JSON values.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const banned = JSON.parse(readFileSync("config/lists/banned_phrases.json", "utf8"));
const roots = ["app", "components", "config"];
const exts = new Set([".ts", ".tsx", ".json", ".md"]);
const skip = new Set(["banned_phrases.json"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (exts.has(extname(p)) && !skip.has(name)) yield p;
  }
}

let problems = 0;
for (const root of roots) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
      // Import lines are module paths, not copy (next/dynamic is a file name).
      if (/^\s*import\s/.test(line)) return;
      const lower = line.toLowerCase();
      for (const ch of banned.characters) if (line.includes(ch)) report(file, i, `em dash`);
      for (const phrase of banned.phrases) {
        const re = new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`);
        if (re.test(lower)) report(file, i, `banned phrase "${phrase}"`);
      }
    });
  }
}

function report(file, i, what) {
  problems++;
  console.error(`${file}:${i + 1}: ${what}`);
}

if (problems) {
  console.error(`\nCopy lint: ${problems} problem(s).`);
  process.exit(1);
}
console.log("Copy lint: clean.");
