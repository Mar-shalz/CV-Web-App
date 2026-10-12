import { describe, expect, it } from "vitest";
import { checkEligibility } from "@/lib/rules/eligibility";
import type { EligibilityProfile } from "@/lib/rules/eligibility/types";
import type { HardFilter } from "@/lib/jobs/schema";

// Build pack section 7: every rule has at least a pass, a fail and an unknown case.
// Rule test cases must be 100% correct (section 11).

const base: EligibilityProfile = {
  today: "2026-10-12",
  dateOfBirth: null,
  gender: null,
  nysc: { status: null, end: null },
  education: [],
  months: { jobs: 0, jobsAfterNysc: 0, internships: 0 },
  licences: [],
  location: null,
  olevel: null,
  rightToWork: {},
};
const p = (patch: Partial<EligibilityProfile>): EligibilityProfile => ({ ...base, ...patch });
const f = (type: HardFilter["type"], patch: Partial<HardFilter> = {}): HardFilter => ({ type, quote: `post words for ${type}`, number: null, number2: null, values: [], date: null, flag: null, ...patch });
const one = (filter: HardFilter, profile: EligibilityProfile, deadline: string | null = null) => {
  const r = checkEligibility({ filters: [filter], deadline, profile });
  return r.outcomes.find((o) => o.type === filter.type)!;
};

describe("max_age", () => {
  const rule = f("max_age", { number: 26, date: "2026-12-31", quote: "Not more than 26 years as at 31 December 2026" });
  it("passes up to the day before the 27th birthday", () => {
    expect(one(rule, p({ dateOfBirth: "2000-01-01" })).result).toBe("pass"); // turns 27 on 2027-01-01
  });
  it("fails on the 27th birthday", () => {
    expect(one(rule, p({ dateOfBirth: "1999-12-31" })).result).toBe("fail");
  });
  it("is unknown without a date of birth and asks for it", () => {
    expect(one(rule, base)).toMatchObject({ result: "unknown", needs: "date_of_birth" });
  });
  it("uses the deadline when the post gives no reference date", () => {
    const r = f("max_age", { number: 24 });
    expect(one(r, p({ dateOfBirth: "2001-11-01" }), "2026-10-31").result).toBe("pass");
    expect(one(r, p({ dateOfBirth: "2001-10-30" }), "2026-10-31").result).toBe("fail");
  });
  it("is unknown when the wording is ambiguous (no number)", () => {
    expect(one(f("max_age", { quote: "Young graduates" }), p({ dateOfBirth: "2001-01-01" })).result).toBe("unknown");
  });
  it("always quotes the post", () => {
    expect(one(rule, base).quote).toBe("Not more than 26 years as at 31 December 2026");
  });
});

describe("min_degree_class", () => {
  const rule = f("min_degree_class", { values: ["Second Class Upper"] });
  it("passes a 2:1", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: "Second Class Upper", graduationYear: 2024 }] })).result).toBe("pass");
  });
  it("passes a First", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: "First Class", graduationYear: 2024 }] })).result).toBe("pass");
  });
  it("fails a 2:2", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: "2:2", graduationYear: 2024 }] })).result).toBe("fail");
  });
  it("is unknown without a grade", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: null, graduationYear: 2024 }] }))).toMatchObject({ result: "unknown", needs: "degree_class" });
  });
  it("does not accept an HND unless the post says so", () => {
    expect(one(rule, p({ education: [{ title: "HND Banking and Finance", grade: "Upper Credit", graduationYear: 2023 }] })).result).toBe("fail");
  });
  it("accepts an Upper Credit HND when the post allows it", () => {
    const allow = f("min_degree_class", { values: ["Second Class Upper", "Upper Credit"], flag: true });
    expect(one(allow, p({ education: [{ title: "HND Banking and Finance", grade: "Upper Credit", graduationYear: 2023 }] })).result).toBe("pass");
  });
});

describe("cgpa", () => {
  const rule = f("cgpa", { number: 3.5, number2: 5 });
  it("passes on the same scale", () => {
    expect(one(rule, p({ education: [{ title: "BSc Economics", grade: "3.62/5.00", graduationYear: 2024 }] })).result).toBe("pass");
  });
  it("fails below the minimum", () => {
    expect(one(rule, p({ education: [{ title: "BSc Economics", grade: "3.20/5.00", graduationYear: 2024 }] })).result).toBe("fail");
  });
  it("is unknown when scales differ and never converts", () => {
    expect(one(rule, p({ education: [{ title: "BSc Economics", grade: "3.2/4.0", graduationYear: 2024 }] }))).toMatchObject({ result: "unknown", needs: "cgpa_scale" });
  });
  it("is unknown without a CGPA", () => {
    expect(one(rule, p({ education: [{ title: "BSc Economics", grade: "Second Class Upper", graduationYear: 2024 }] })).result).toBe("unknown");
  });
});

describe("degree_type", () => {
  const accepted = f("degree_type", { values: ["BSc", "HND"] });
  const excluded = f("degree_type", { values: ["HND"], flag: true, quote: "HND holders need not apply" });
  it("passes a listed qualification", () => {
    expect(one(accepted, p({ education: [{ title: "B.Sc Accounting", grade: null, graduationYear: 2024 }] })).result).toBe("pass");
  });
  it("fails when the only qualification is excluded", () => {
    expect(one(excluded, p({ education: [{ title: "HND Accountancy", grade: null, graduationYear: 2024 }] })).result).toBe("fail");
  });
  it("passes an excluded list for a degree holder", () => {
    expect(one(excluded, p({ education: [{ title: "BSc Accounting", grade: null, graduationYear: 2024 }] })).result).toBe("pass");
  });
  it("is unknown with no education in the vault", () => {
    expect(one(accepted, base)).toMatchObject({ result: "unknown", needs: "education" });
  });
});

describe("discipline", () => {
  const rule = f("discipline", { values: ["Accounting", "Economics"] });
  it("passes a matching course", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accountancy", grade: null, graduationYear: 2024 }] })).result).toBe("pass");
  });
  it("is care, never a fail, for another course when not strict", () => {
    expect(one(rule, p({ education: [{ title: "BSc Biochemistry", grade: null, graduationYear: 2024 }] })).result).toBe("care");
  });
  it("fails another course when the post says strictly", () => {
    expect(one(f("discipline", { values: ["Accounting"], flag: true }), p({ education: [{ title: "BSc Biochemistry", grade: null, graduationYear: 2024 }] })).result).toBe("fail");
  });
  it("is unknown with no education", () => {
    expect(one(rule, base).result).toBe("unknown");
  });
});

describe("nysc", () => {
  const completed = f("nysc", { values: ["completed"] });
  it("passes completed", () => {
    expect(one(completed, p({ nysc: { status: "completed", end: "2026-09-30" } })).result).toBe("pass");
  });
  it("fails serving when finishing before the deadline is not allowed", () => {
    expect(one(completed, p({ nysc: { status: "serving", end: "2026-10-20" } }), "2026-10-31").result).toBe("fail");
  });
  it("passes serving that ends before the deadline when the post allows it", () => {
    expect(one(f("nysc", { values: ["completed"], flag: true }), p({ nysc: { status: "serving", end: "2026-10-20" } }), "2026-10-31").result).toBe("pass");
  });
  it("accepts exemption only when the post does", () => {
    expect(one(completed, p({ nysc: { status: "exempted", end: null } })).result).toBe("fail");
    expect(one(f("nysc", { values: ["completed_or_exempted"] }), p({ nysc: { status: "exempted", end: null } })).result).toBe("pass");
  });
  it("is unknown without a status", () => {
    expect(one(completed, base)).toMatchObject({ result: "unknown", needs: "nysc_status" });
  });
  it("passes serving corps members only", () => {
    expect(one(f("nysc", { values: ["serving"] }), p({ nysc: { status: "serving", end: "2027-01-01" } })).result).toBe("pass");
  });
});

describe("years_experience", () => {
  const rule = f("years_experience", { number: 2 });
  it("passes with enough full time months", () => {
    expect(one(rule, p({ months: { jobs: 26, jobsAfterNysc: 26, internships: 0 } })).result).toBe("pass");
  });
  it("is partly met (care) within 6 months of the minimum", () => {
    expect(one(rule, p({ months: { jobs: 19, jobsAfterNysc: 19, internships: 0 } })).result).toBe("care");
  });
  it("fails well below the minimum", () => {
    expect(one(rule, p({ months: { jobs: 6, jobsAfterNysc: 6, internships: 0 } })).result).toBe("fail");
  });
  it("counts only post NYSC months when the post says so", () => {
    expect(one(f("years_experience", { number: 2, flag: true }), p({ months: { jobs: 30, jobsAfterNysc: 10, internships: 0 } })).result).toBe("fail");
  });
  it("counts internships only when the post says so", () => {
    expect(one(f("years_experience", { number: 1, values: ["internships_count"] }), p({ months: { jobs: 6, jobsAfterNysc: 6, internships: 6 } })).result).toBe("pass");
  });
  it("is unknown when the post gives no number", () => {
    expect(one(f("years_experience"), base).result).toBe("unknown");
  });
});

describe("licence", () => {
  const rule = f("licence", { values: ["ICAN", "ACCA"], flag: true });
  it("passes a qualified member", () => {
    expect(one(rule, p({ licences: [{ name: "ACCA", status: "qualified" }] })).result).toBe("pass");
  });
  it("fails in progress when qualified is required", () => {
    expect(one(rule, p({ licences: [{ name: "ICAN Skills level", status: "in_progress" }] })).result).toBe("fail");
  });
  it("is unknown when the vault doesn't say whether it's qualified", () => {
    expect(one(rule, p({ licences: [{ name: "ICAN", status: "unknown" }] }))).toMatchObject({ result: "unknown", needs: "licence" });
  });
  it("is unknown with no matching licence in the vault and asks", () => {
    expect(one(rule, base)).toMatchObject({ result: "unknown", needs: "licence" });
  });
});

describe("location", () => {
  const rule = f("location", { values: ["Lagos"] });
  it("passes a match", () => {
    expect(one(rule, p({ location: { city: "Yaba", state: "Lagos" } })).result).toBe("pass");
  });
  it("fails a different state when relocation isn't mentioned", () => {
    expect(one(rule, p({ location: { city: "Ibadan", state: "Oyo" } })).result).toBe("fail");
  });
  it("is care when willing to relocate is accepted", () => {
    expect(one(f("location", { values: ["Lagos"], flag: true }), p({ location: { city: "Ibadan", state: "Oyo" } })).result).toBe("care");
  });
  it("is unknown without a location", () => {
    expect(one(rule, base)).toMatchObject({ result: "unknown", needs: "location" });
  });
});

describe("olevel", () => {
  const rule = f("olevel", { number: 5, number2: 2, values: ["English", "Mathematics"] });
  const sitting = (subjects: [string, string][]) => ({ subjects: subjects.map(([name, grade]) => ({ name, grade })) });
  it("passes five credits including the named subjects in two sittings", () => {
    const olevel = { sittings: [sitting([["English", "C4"], ["Mathematics", "B3"], ["Economics", "C5"]]), sitting([["Government", "C6"], ["Commerce", "B2"]])] };
    expect(one(rule, p({ olevel })).result).toBe("pass");
  });
  it("fails without a credit in Mathematics", () => {
    const olevel = { sittings: [sitting([["English", "C4"], ["Mathematics", "D7"], ["Economics", "C5"], ["Government", "C6"], ["Commerce", "B2"]])] };
    expect(one(rule, p({ olevel })).result).toBe("fail");
  });
  it("fails when credits need more sittings than allowed", () => {
    const olevel = { sittings: [sitting([["English", "C4"], ["Mathematics", "C4"]]), sitting([["Economics", "C5"]]), sitting([["Government", "C6"], ["Commerce", "B2"]])] };
    expect(one(rule, p({ olevel })).result).toBe("fail");
  });
  it("is unknown without results", () => {
    expect(one(rule, base)).toMatchObject({ result: "unknown", needs: "olevel" });
  });
});

describe("graduation_window", () => {
  const rule = f("graduation_window", { number: 2022, number2: 2025 });
  it("passes inside the range, inclusive", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: null, graduationYear: 2025 }] })).result).toBe("pass");
  });
  it("fails outside the range", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: null, graduationYear: 2020 }] })).result).toBe("fail");
  });
  it("is unknown without a graduation year", () => {
    expect(one(rule, p({ education: [{ title: "BSc Accounting", grade: null, graduationYear: null }] })).result).toBe("unknown");
  });
});

describe("gender", () => {
  const rule = f("gender", { values: ["Female"], quote: "Female candidates only" });
  it("passes a match", () => {
    expect(one(rule, p({ gender: "female" })).result).toBe("pass");
  });
  it("fails a non match and shows the requirement as written, without comment", () => {
    const o = one(rule, p({ gender: "male" }));
    expect(o.result).toBe("fail");
    expect(o.quote).toBe("Female candidates only");
  });
  it("is unknown if the user hasn't given it", () => {
    expect(one(rule, base)).toMatchObject({ result: "unknown", needs: "gender" });
  });
});

describe("right_to_work", () => {
  const rule = f("right_to_work", { values: ["GB"], flag: false });
  it("passes with the right to work", () => {
    expect(one(rule, p({ rightToWork: { GB: "yes" } })).result).toBe("pass");
  });
  it("fails when the user needs sponsorship and none is offered", () => {
    expect(one(rule, p({ rightToWork: { GB: "needs_sponsorship" } })).result).toBe("fail");
  });
  it("passes needing sponsorship when the post offers it", () => {
    expect(one(f("right_to_work", { values: ["GB"], flag: true }), p({ rightToWork: { GB: "needs_sponsorship" } })).result).toBe("pass");
  });
  it("is unknown when we don't know", () => {
    expect(one(rule, base)).toMatchObject({ result: "unknown", needs: "right_to_work" });
  });
});

describe("deadline", () => {
  it("fails after the closing date with the date in words", () => {
    const r = checkEligibility({ filters: [], deadline: "2026-10-01", profile: base });
    expect(r.outcomes[0]).toMatchObject({ type: "deadline", result: "fail" });
    expect(r.outcomes[0]?.reason).toContain("1 Oct 2026");
  });
  it("passes on the closing date itself", () => {
    expect(checkEligibility({ filters: [], deadline: "2026-10-12", profile: base }).outcomes[0]?.result).toBe("pass");
  });
  it("is not applicable without a deadline", () => {
    expect(checkEligibility({ filters: [], deadline: null, profile: base }).outcomes).toHaveLength(0);
  });
});

describe("overall", () => {
  it("any fail is a fail", () => {
    const r = checkEligibility({ filters: [f("gender", { values: ["Female"] }), f("location", { values: ["Lagos"] })], deadline: null, profile: p({ gender: "male" }) });
    expect(r.overall).toBe("fail");
  });
  it("unknown without a fail is unknown", () => {
    expect(checkEligibility({ filters: [f("gender", { values: ["Female"] })], deadline: null, profile: base }).overall).toBe("unknown");
  });
  it("care alone is still a pass", () => {
    const r = checkEligibility({ filters: [f("discipline", { values: ["Accounting"] })], deadline: null, profile: p({ education: [{ title: "BSc Biology", grade: null, graduationYear: 2024 }] }) });
    expect(r.overall).toBe("pass");
  });
  it("carries the rule set version", () => {
    expect(checkEligibility({ filters: [], deadline: null, profile: base }).ruleSetVersion).toMatch(/^eligibility_v/);
  });
  it("never suggests hiding anything", () => {
    const r = checkEligibility({ filters: [f("max_age", { number: 20 })], deadline: null, profile: p({ dateOfBirth: "1995-01-01" }) });
    expect(r.outcomes[0]?.reason.toLowerCase()).not.toMatch(/hide|leave out|remove your|don't mention|omit/);
  });
});
