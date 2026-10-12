import { describe, expect, it } from "vitest";
import { factLock, lockLine, type LockSource } from "@/lib/rules/fact-lock";

// Build pack section 6, the fact lock. Deterministic; runs after tailor_cv and before the user sees anything.

const siwes: LockSource = {
  id: "i1",
  text: "Opened about 15 customer accounts a day and checked each customer's documents.",
  sourceQuote: "I did account opening, around 15 a day, and I checked their documents",
  metrics: [{ value: 15, unit: "accounts a day", approximate: true }],
  ownership: "did",
  skills: ["customer onboarding"],
  role: { kind: "internship_siwes", organisation: "Northline Bank, Yaba Branch", title: "SIWES Intern", location: "Yaba, Lagos", start: "2023-01", end: "2023-06", grade: null },
};
const records: LockSource = {
  id: "i2",
  text: "Helped move 3 years of paper records into a shared Excel sheet with two other corps members.",
  sourceQuote: "I helped move old records into Excel, about 3 years of files",
  metrics: [{ value: 3, unit: "years of records", approximate: false }],
  ownership: "helped",
  skills: ["Excel"],
  role: { kind: "nysc_ppa", organisation: "Ministry of Works, Ogun State", title: "Finance Assistant", location: null, start: "2025-11", end: "2026-10", grade: null },
};
const dues: LockSource = {
  id: "i3",
  text: "Collected NGN 1000 in dues from each of 200 members.",
  sourceQuote: "collected 1k dues from 200 people",
  metrics: [{ value: 1000, unit: "naira", approximate: false }],
  ownership: "led",
  skills: [],
  role: { kind: "volunteer", organisation: "Accounting Students Association", title: "Treasurer", location: null, start: "2022-09", end: "2023-08", grade: null },
};
const vault = new Map([siwes, records, dues].map((s) => [s.id, s]));
const flagsOf = (text: string, ids: string[]) => lockLine(text, ids.map((id) => vault.get(id)!)).map((f) => `${f.type}:${f.token}`);

describe("rule 1: every bullet cites a confirmed item", () => {
  it("drops a bullet with no ids or unknown ids", () => {
    const r = factLock(
      [
        { id: "b1", text: "Handled customer onboarding.", source_item_ids: [] },
        { id: "b2", text: "Handled customer onboarding.", source_item_ids: ["nope"] },
        { id: "b3", text: "Opened about 15 customer accounts a day.", source_item_ids: ["i1"] },
      ],
      vault,
    );
    expect(r.dropped).toEqual(["b1", "b2"]);
    expect(r.kept.map((k) => k.id)).toEqual(["b3"]);
  });
});

describe("rules 2 and 3: locked tokens must appear in the cited items or their role", () => {
  it("a faithful reword passes", () => {
    expect(flagsOf("Opened about 15 customer accounts a day at a bank branch during SIWES and checked each customer's documents.", ["i1"])).toEqual([]);
  });
  it("flags an invented number", () => {
    expect(flagsOf("Reduced queue time at the account opening desk by 20%.", ["i1"])).toContain("number:20%");
  });
  it("matches ₦1,000, NGN 1000 and 1k", () => {
    expect(flagsOf("Collected ₦1,000 in dues from each of 200 members.", ["i3"])).toEqual([]);
    expect(flagsOf("Collected 1k in dues from each of 200 members.", ["i3"])).toEqual([]);
  });
  it("flags an employer or proper noun the items don't contain", () => {
    expect(flagsOf("Opened about 15 accounts a day for Zenith Bank customers.", ["i1"])).toEqual(expect.arrayContaining(["employer:Zenith"]));
  });
  it("accepts names from the cited item's role record", () => {
    expect(flagsOf("Opened about 15 accounts a day at Northline Bank in Yaba.", ["i1"])).toEqual([]);
  });
  it("flags a year that isn't in the item or its role dates; accepts role years", () => {
    expect(flagsOf("Opened about 15 accounts a day in 2021.", ["i1"])).toContain("date:2021");
    expect(flagsOf("Opened about 15 accounts a day in 2023.", ["i1"])).toEqual([]);
  });
  it("flags a qualification the vault doesn't support", () => {
    expect(flagsOf("Opened about 15 accounts a day as an ACCA trainee.", ["i1"])).toContain("qualification:ACCA");
  });
  it("ignores the capital at the start of a sentence and common terms like NYSC", () => {
    expect(flagsOf("Helped move 3 years of paper records into Excel during NYSC.", ["i2"])).toEqual([]);
  });
});

describe("rule 4: approximate numbers keep 'about' or 'around'", () => {
  it("flags a dropped 'about'", () => {
    expect(flagsOf("Opened 15 customer accounts a day.", ["i1"])).toContain("approximate:15");
  });
  it("accepts 'around' or a plus sign", () => {
    expect(flagsOf("Opened around 15 customer accounts a day.", ["i1"])).toEqual([]);
    expect(flagsOf("Opened 15+ customer accounts a day.", ["i1"])).toEqual([]);
  });
});

describe("rule 5: ownership verbs need an item marked led", () => {
  it("flags 'led' when the notes say helped", () => {
    expect(flagsOf("Led the move of 3 years of paper records into Excel.", ["i2"])).toContain("ownership:Led");
  });
  it("allows 'managed' when the item is marked led", () => {
    expect(flagsOf("Managed dues collection from 200 members.", ["i3"])).toEqual([]);
  });
});

describe("rule 6: banned phrases and em dashes", () => {
  it("flags them", () => {
    const f = flagsOf("Spearheaded account opening — about 15 a day.", ["i1"]);
    expect(f).toEqual(expect.arrayContaining(["phrase:spearheaded", "phrase:—"]));
  });
});

describe("factLock output", () => {
  it("keeps flagged lines (never blocks) and attaches every flag", () => {
    const r = factLock([{ id: "b4", text: "Reduced queue time by 20%.", source_item_ids: ["i1"] }], vault);
    expect(r.kept[0]?.flags).toEqual([expect.objectContaining({ type: "number", token: "20%" })]);
    expect(r.flagCount).toBe(1);
  });
  it("gives each flag the PRD message for its type", () => {
    const r = factLock([{ id: "b5", text: "Led the records move.", source_item_ids: ["i2"] }], vault);
    expect(r.kept[0]?.flags[0]?.message).toBe("This line says you led this. Your notes say you helped.");
    const n = factLock([{ id: "b6", text: "Opened 40 accounts a day.", source_item_ids: ["i1"] }], vault);
    expect(n.kept[0]?.flags[0]?.message).toBe("This line has a number you did not give us. Add the real figure or remove it before you download.");
  });
});
