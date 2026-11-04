import { describe, expect, it } from "vitest";
import { bandFor, cleanRole, fresh, isNewMatch, levelFits, newestFirst, prescore, rolesFrom } from "@/lib/jobfeed/rank";
import { fits, openTo, parseGeo, placeOf, sponsored } from "@/lib/jobfeed/place";
import { countryNames, reachOf } from "@/lib/markets";
import { titleQuery } from "@/lib/jobfeed/headcount";
import { plainText } from "@/lib/jobfeed/types";

describe("Jobs for you: which found jobs get a fit check (D-205)", () => {
  it("bands years of work", () => {
    expect(bandFor(0)).toBe("entry");
    expect(bandFor(24)).toBe("early");
    expect(bandFor(60)).toBe("mid");
    expect(bandFor(120)).toBe("senior");
  });
  it("keeps jobs at a level the person could be hired at", () => {
    expect(levelFits("Senior Accountant", "entry")).toBe(false);
    expect(levelFits("Graduate Trainee, Finance", "entry")).toBe(true);
    expect(levelFits("Finance Director", "mid")).toBe(false);
    expect(levelFits("Graduate Trainee", "senior")).toBe(false);
    expect(levelFits("Head of Finance", "senior")).toBe(true);
  });
  it("turns titles into roles to search for, the jobs they go for first", () => {
    expect(cleanRole("Finance Assistant (NYSC)")).toBe("Finance Assistant");
    expect(cleanRole("SIWES Intern, Retail Banking")).toBe("Intern, Retail Banking");
    expect(cleanRole("IT Support Officer")).toBe("IT Support Officer");
    expect(rolesFrom(["Graduate Trainee, Finance", "graduate trainee, finance", null], ["Accounts Officer"], 3)).toEqual(["Graduate Trainee, Finance", "Accounts Officer"]);
  });
  it("drops jobs posted more than 60 days ago", () => {
    const now = Date.parse("2026-10-29T00:00:00Z");
    expect(fresh({ postedAt: "2026-09-01T00:00:00Z" }, 60, now)).toBe(true);
    expect(fresh({ postedAt: "2026-08-01T00:00:00Z" }, 60, now)).toBe(false);
    expect(fresh({ postedAt: null }, 60, now)).toBe(true);
  });
  it("keeps jobs where they live and remote jobs open to people there (round 40)", () => {
    const remote = (geo: string) => placeOf({ source: "jobicy", location: `Remote (${geo})` });
    // Someone in Nigeria.
    expect(openTo(remote("Anywhere"), "NG")).toBe(true);
    expect(openTo(remote("EMEA"), "NG")).toBe(true);
    expect(openTo(remote("Africa"), "NG")).toBe(true);
    expect(openTo(remote("Nigeria"), "NG")).toBe(true);
    expect(openTo(remote("USA"), "NG")).toBe(false);
    expect(openTo(remote("Canada,  USA"), "NG")).toBe(false);
    expect(openTo(remote("Europe"), "NG")).toBe(false);
    expect(openTo(remote("Philippines"), "NG")).toBe(false);
    expect(openTo(placeOf({ source: "jobicy", location: "Remote" }), "NG")).toBe(false);
    expect(openTo(placeOf({ source: "headcount", location: "Lagos, Lagos, NG" }), "NG")).toBe(true);
    expect(openTo(placeOf({ source: "headcount", location: "London, England, GB" }), "NG")).toBe(false);
    expect(openTo(placeOf({ source: "headcount", location: "Accra, GH", countries: ["GH", "NG"] }), "NG")).toBe(true);
    expect(openTo(placeOf({ source: "headcount", location: null }), "NG")).toBe(false);
    // Someone abroad: the same rule for where they live.
    expect(openTo(remote("UK"), "GB")).toBe(true);
    expect(openTo(remote("Europe"), "GB")).toBe(true);
    expect(openTo(remote("USA"), "GB")).toBe(false);
    expect(openTo(remote("Canada, USA"), "CA")).toBe(true);
    expect(openTo(placeOf({ source: "headcount", location: "Toronto, Ontario, CA" }), "CA")).toBe(true);
  });
  it("adds office jobs abroad for people who apply abroad (round 41)", () => {
    // "Abroad" and "Both" add the usual countries; "Nigeria" adds none. Older accounts named their own.
    expect(reachOf(["NG"], "NG")).toEqual({ home: "NG", away: [], canWork: [] });
    expect(reachOf(["INTL"], "NG")).toEqual({ home: "NG", away: ["GB", "US", "CA", "AE", "IE"], canWork: [] });
    expect(reachOf(["NG", "INTL"], "NG").away).toEqual(["GB", "US", "CA", "AE", "IE"]);
    expect(reachOf(["NG", "GB"], "NG").away).toEqual(["GB"]);
    expect(reachOf(["INTL"], "GB").away).toEqual(["US", "CA", "AE", "IE"]);
    expect(reachOf(["NG"], "GB").away).toEqual(["NG"]);
    const abroad = reachOf(["NG", "INTL"], "NG");
    const office = (location: string, countries: string[], remote = false, visa = "offered") => ({ source: "headcount", location, countries, remote, visa });
    expect(fits(office("London, England, GB", ["GB"]), abroad)).toBe(true);
    expect(fits(office("Lagos, NG", ["NG"], false, "not_mentioned"), abroad)).toBe(true);
    expect(fits(office("Berlin, DE", ["DE"]), abroad)).toBe(false);
    // Round 42: an office job abroad needs a visa the post offers, or their right to work there.
    expect(fits(office("London, England, GB", ["GB"], false, "not_mentioned"), abroad)).toBe(false);
    expect(fits(office("London, England, GB", ["GB"], false, "not_offered"), abroad)).toBe(false);
    expect(fits(office("London, England, GB", ["GB"], false, "not_mentioned"), reachOf(["NG", "INTL"], "NG", ["GB"]))).toBe(true);
    expect(sponsored(office("London, England, GB", ["GB"]), abroad)).toBe(true);
    expect(sponsored(office("Lagos, NG", ["NG"]), abroad)).toBe(false);
    // A remote job tied to another country needs the right to live there: not shown.
    expect(fits(office("London, England, GB", ["GB"], true), abroad)).toBe(false);
    expect(fits({ source: "jobicy", location: "Remote (USA)", remote: true }, abroad)).toBe(false);
    expect(fits({ source: "jobicy", location: "Remote (EMEA)", remote: true }, abroad)).toBe(true);
    // Applying in Nigeria only: no office jobs abroad.
    expect(fits(office("London, England, GB", ["GB"]), reachOf(["NG"], "NG"))).toBe(false);
    expect(countryNames(["GB", "CA"])).toBe("United Kingdom, Canada");
  });
  it("reads a list cut off before its closing bracket", () => {
    expect(placeOf({ source: "jobicy", location: "Remote (Australia, Brazil, Nigeria, Norw" }).countries).toContain("NG");
    expect(parseGeo("USA only").countries).toEqual(["US"]);
    expect(parseGeo("Worldwide").anywhere).toBe(true);
  });
  it("scores the title and the skills the post names", () => {
    const job = { title: "Accounts Officer", description: "You will handle reconciliation, Excel reports and IFRS." };
    const high = prescore(job, ["Accounts Officer"], ["reconciliation", "excel", "ifrs"]);
    const low = prescore({ title: "Nurse", description: "Patient care." }, ["Accounts Officer"], ["reconciliation"]);
    expect(high).toBeGreaterThan(60);
    expect(low).toBe(0);
  });
  it("builds a title search with every word, in any order", () => {
    expect(titleQuery("Graduate Trainee, Finance")).toBe("graduate & trainee & finance");
    expect(titleQuery("Head of Finance & Admin")).toBe("head & finance & admin");
  });
  it("reads job text as plain text, never HTML", () => {
    expect(plainText("<p>Hello&nbsp;<b>world</b></p><ul><li>One</li></ul><script>x</script>")).toBe("Hello world\n\n- One");
  });
});

describe("filling an employer's form (founder round 35, D-206)", async () => {
  const { classify, splitName } = await import("@/lib/autofill/fields");
  const f = (label: string, type = "text", extra: Record<string, string> = {}) => classify({ key: "k", label, type, ...extra });
  it("never touches personal details, salary or passwords", () => {
    for (const label of ["Date of birth", "Gender", "State of origin", "Religion", "Marital status", "Nationality", "Expected salary", "Do you have a disability?"]) expect(f(label)).toBe("personal");
  });
  it("knows the usual fields", () => {
    expect(f("First name")).toBe("first_name");
    expect(f("Surname")).toBe("last_name");
    expect(f("Email address", "email")).toBe("email");
    expect(f("Mobile number", "tel")).toBe("phone");
    expect(f("LinkedIn profile URL")).toBe("linkedin");
    expect(f("Resume/CV", "file")).toBe("cv_file");
    expect(f("Cover letter", "textarea")).toBe("cover_letter");
    expect(f("Current job title")).toBe("current_title");
    expect(f("", "text", { autocomplete: "given-name" })).toBe("first_name");
  });
  it("treats written questions as questions, and an address as nothing to fill", () => {
    expect(f("Why do you want to work at Northbridge Bank?", "textarea")).toBe("question");
    expect(f("Describe a time you solved a problem")).toBe("question");
    expect(f("Home address", "textarea")).toBe("unknown");
    expect(f("Upload a passport photograph", "file")).toBe("personal");
  });
  it("splits a name, the last word as the surname", () => {
    expect(splitName("Tolu Grace Adebayo")).toEqual({ first: "Tolu Grace", last: "Adebayo" });
    expect(splitName("Tolu")).toEqual({ first: "Tolu", last: "" });
  });
});

describe("Jobs for You's order (founder round 39, D-210)", () => {
  const now = Date.parse("2026-11-02T12:00:00Z");
  const ago = (d: number) => new Date(now - d * 86_400_000).toISOString();
  it("marks jobs added to the list in the last few days as new", () => {
    expect(isNewMatch(ago(1), 2, now)).toBe(true);
    expect(isNewMatch(ago(3), 2, now)).toBe(false);
    expect(isNewMatch(null, 2, now)).toBe(false);
  });
  it("puts new jobs first, then the most recently posted, then the better match", () => {
    const list = [
      { id: "old-best", postedAt: ago(20), foundAt: ago(5), percent: 97, isNew: false },
      { id: "recent", postedAt: ago(2), foundAt: ago(4), percent: 86, isNew: false },
      { id: "new-old-post", postedAt: ago(30), foundAt: ago(1), percent: 88, isNew: true },
      { id: "new-recent", postedAt: ago(1), foundAt: ago(1), percent: 85, isNew: true },
      { id: "no-date", postedAt: null, foundAt: ago(2), percent: 90, isNew: false },
      { id: "recent-better", postedAt: ago(2), foundAt: ago(4), percent: 92, isNew: false },
    ];
    expect([...list].sort(newestFirst).map((m) => m.id)).toEqual(["new-recent", "new-old-post", "recent-better", "no-date", "recent", "old-best"]);
  });
});
