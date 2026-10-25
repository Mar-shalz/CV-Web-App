import { describe, expect, it } from "vitest";
import { detectDestination } from "@/lib/rules/destination";
import { EMPTY_JOB, type ParsedJob } from "@/lib/jobs/schema";

const job = (patch: Partial<ParsedJob>): ParsedJob => ({ ...EMPTY_JOB, ...patch });

describe("destination detection (Build pack section 8)", () => {
  it("a stated location wins with high confidence and no question", () => {
    const d = detectDestination(job({ location: { ...EMPTY_JOB.location, country: "United Kingdom", country_code: "GB" } }), ["NG"]);
    expect(d).toMatchObject({ country: "GB", profile: "uk", ask: false });
    expect(d.confidence).toBeGreaterThanOrEqual(0.8);
  });
  it("graduate programmes in Nigeria get the graduate format", () => {
    const d = detectDestination(job({ location: { ...EMPTY_JOB.location, country_code: "NG" }, experience_level: "graduate_programme" }), ["NG"]);
    expect(d.profile).toBe("ng_graduate");
  });
  it("salary currency alone asks once", () => {
    const d = detectDestination(job({ salary: { min: 2000, max: 2500, currency: "£", period: "month" } }), ["NG", "GB"]);
    expect(d).toMatchObject({ country: "GB", ask: true });
  });
  it("a .ng email and a +234 number agree on Nigeria", () => {
    const d = detectDestination(job({ how_to_apply: { ...EMPTY_JOB.how_to_apply, email: "hr@acme.com.ng" }, contacts: { emails: [], phones: ["+234 803 000 0000"] } }), ["GB"]);
    expect(d.country).toBe("NG");
    expect(d.confidence).toBeGreaterThan(0.6);
  });
  it("no signal falls back to the first target market without asking", () => {
    const d = detectDestination(EMPTY_JOB, ["GB", "NG"]);
    expect(d).toMatchObject({ country: "GB", ask: false, confidence: 0.3 });
  });
  it("a country with no format of its own uses the UK format and says so", () => {
    const d = detectDestination(job({ location: { ...EMPTY_JOB.location, country: "Germany", country_code: "DE" } }), ["NG"]);
    expect(d.profile).toBe("uk");
    expect(d.fallbackNote).toContain("Germany");
  });
  it("Canada, the Gulf and Ireland get their own formats, with no stand-in note (D-198)", () => {
    const at = (code: string) => detectDestination(job({ location: { ...EMPTY_JOB.location, country_code: code } }), ["NG"]);
    expect(at("CA")).toMatchObject({ profile: "ca", fallbackNote: null });
    for (const c of ["AE", "SA", "QA", "KW", "OM", "BH"]) expect(at(c)).toMatchObject({ profile: "gulf", fallbackNote: null });
    expect(at("IE")).toMatchObject({ profile: "uk", fallbackNote: null });
  });
  it("a Saudi riyal salary or a +966 number points to the Gulf", () => {
    expect(detectDestination(job({ salary: { min: 5000, max: 7000, currency: "SAR", period: "month" } }), ["NG"]).profile).toBe("gulf");
    expect(detectDestination(job({ contacts: { emails: [], phones: ["+966 50 000 0000"] } }), ["GB"]).country).toBe("SA");
  });

  it("uses the US resume format for US jobs, with no stand-in note (D-168)", () => {
    const d = detectDestination(job({ location: { ...EMPTY_JOB.location, country: "United States", country_code: "US" } }), ["NG"]);
    expect(d).toMatchObject({ country: "US", profile: "us", fallbackNote: null });
  });
  it("remote roles default to the employer's home country", () => {
    const d = detectDestination(job({ location: { ...EMPTY_JOB.location, remote: true }, employer_domain_claimed: "acme.co.uk" }), ["NG"]);
    expect(d.country).toBe("GB");
  });
  it("abroad without a country: the post decides, and no post signal means the international format", () => {
    expect(detectDestination(job({ location: { ...EMPTY_JOB.location, country_code: "CA", country: "Canada" } }), ["INTL"]).country).toBe("CA");
    const d = detectDestination(EMPTY_JOB, ["INTL"]);
    expect(d).toMatchObject({ country: "GB", profile: "uk", confidence: 0.3 });
    expect(d.alternatives).not.toContain("INTL");
  });
  it("Nigeria and abroad with no signal falls back to Nigeria", () => {
    expect(detectDestination(EMPTY_JOB, ["NG", "INTL"]).country).toBe("NG");
  });
});
