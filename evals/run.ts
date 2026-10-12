// Eval runner (Build pack section 11). Placeholder until the golden sets exist.
//
// Run: npm run evals   (node evals/run.ts; Node 22.18 or later strips the types)
//
// Each golden set lives in evals/<set id>/ with consent and personal details removed.
// When a set's cases/ folder exists, its scorer runs and a gate below target exits 1,
// which blocks the merge in CI. Until then the set is listed as pending and the run
// passes, so CI stays green through Slice 0.
//
// Gates (targets from the Build pack, section 11):
//
//   G1 CVs, 30 real Nigerian CVs (PDF, DOCX, phone photos). Arrives in Slice 1.
//     - CV parse: employer, title, dates and grade correct, 95% or more.
//   G2 Job posts, 70 posts (WhatsApp flyers, job board text, graduate programmes,
//      UK and remote roles, known scams). Arrives in Slices 3 and 4.
//     - Job parse: apply channel, email address and subject format correct, 95% or more.
//     - Hard filters: found when present 95%, correct when found 90%.
//     - Destination: correct country where the post states a location, 95% or more.
//     - Scam check: known scams labelled Red or Couldn't verify 90% or more, none ever Verified.
//     - Scam check: legitimate posts wrongly labelled Red, 5% or less.
//   G3 Tailoring pairs, 40 vault and job pairs with expert labels. Arrives in Slices 4 and 5.
//     - Fit verdict: agreement with expert label 80% or more, Skip on every hard fail.
//     - Tailoring (Gate 2): zero invented facts, ownership inflation or banned phrases.
//     - CV quality: rubric average 4 out of 5 from a model judge checked against two humans.
//     - Flags: 2% or less of generated lines carry a flag.
//   G4 Voice clips, 30 answers in Nigerian accented English. Arrives in Slice 2.
//     - Speech to text: word error rate 15% or less [Hypothesis], numbers correct 95% or more.
//   G5 Outcome messages, 30 pasted emails and SMS. Arrives in Slice 7.
//     - Outcome messages: status correct 90% or more.
//
// Gates checked elsewhere: eligibility rule cases (100%, Vitest, Slice 4), first load
// size (scripts/check-first-load.mjs in CI), accessibility audit (Playwright, later).
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Gate = { metric: string; target: string };
type GoldenSet = { id: string; dir: string; name: string; slice: string; gates: Gate[] };

const SETS: GoldenSet[] = [
  {
    id: "G1",
    dir: "g1_cvs",
    name: "CVs",
    slice: "Slice 1",
    gates: [{ metric: "CV parse: employer, title, dates and grade correct", target: ">= 95%" }],
  },
  {
    id: "G2",
    dir: "g2_job_posts",
    name: "Job posts",
    slice: "Slices 3 and 4",
    gates: [
      { metric: "Job parse: apply channel, email and subject format correct", target: ">= 95%" },
      { metric: "Hard filters: found when present / correct when found", target: "95% / 90%" },
      { metric: "Destination: correct country when the post states a location", target: ">= 95%" },
      { metric: "Scam check: known scams labelled Red or Couldn't verify", target: ">= 90%, none Verified" },
      { metric: "Scam check: legitimate posts wrongly labelled Red", target: "<= 5%" },
    ],
  },
  {
    id: "G3",
    dir: "g3_tailoring_pairs",
    name: "Tailoring pairs",
    slice: "Slices 4 and 5",
    gates: [
      { metric: "Fit verdict: agreement with expert label", target: ">= 80%, Skip on every hard fail" },
      { metric: "Tailoring: invented facts, ownership inflation, banned phrases", target: "zero" },
      { metric: "CV quality: rubric average from the checked model judge", target: ">= 4 of 5" },
      { metric: "Flags: share of generated lines with a flag", target: "<= 2%" },
    ],
  },
  {
    id: "G4",
    dir: "g4_voice_clips",
    name: "Voice clips",
    slice: "Slice 2",
    gates: [{ metric: "Speech to text: word error rate / numbers correct", target: "<= 15% / >= 95%" }],
  },
  {
    id: "G5",
    dir: "g5_outcome_messages",
    name: "Outcome messages",
    slice: "Slice 7",
    gates: [{ metric: "Outcome messages: status correct", target: ">= 90%" }],
  },
];

const root = join(process.cwd(), "evals");
let failed = 0;

for (const set of SETS) {
  const cases = join(root, set.dir, "cases");
  const count = existsSync(cases) ? readdirSync(cases).length : 0;
  console.log(`\n${set.id} ${set.name} (evals/${set.dir})`);
  if (count === 0) {
    console.log(`  pending: golden set arrives with ${set.slice}`);
  } else {
    // A set with cases but no scorer is a mistake: fail rather than pass silently.
    console.log(`  ${count} case(s) found but no scorer is wired up yet`);
    failed++;
  }
  for (const gate of set.gates) console.log(`  - ${gate.metric}: ${gate.target}`);
}

if (failed) {
  console.error(`\nEvals: ${failed} set(s) have cases without a scorer.`);
  process.exit(1);
}
console.log("\nEvals: no golden sets yet. Nothing to score. Pass.");
