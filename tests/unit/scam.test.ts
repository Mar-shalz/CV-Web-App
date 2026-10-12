import { describe, expect, it } from "vitest";
import { layer1 } from "@/lib/rules/scam/layer1";
import { scamState, type Finding } from "@/lib/rules/scam/state";
import { EMPTY_JOB, type ParsedJob } from "@/lib/jobs/schema";

const job = (patch: Partial<ParsedJob>): ParsedJob => ({ ...EMPTY_JOB, ...patch });
const ids = (text: string, j: ParsedJob = EMPTY_JOB) => layer1(text, j).map((s) => `${s.id}:${s.severity}`);

describe("scam check layer 1 (Build pack section 9)", () => {
  it("L1-01: a form fee is red, with the post's words as evidence", () => {
    const s = layer1("Successful applicants will pay a form fee of N5,000 before the screening.", EMPTY_JOB);
    expect(s[0]).toMatchObject({ id: "L1-01", severity: "red" });
    expect(s[0]?.evidence).toContain("form fee");
  });
  it("L1-02: a bank account number with a bank name is red", () => {
    expect(ids("Pay into 0123456789 Opay, name: HR Desk")).toContain("L1-02:red");
  });
  it("L1-03: a free email for a bank is amber; for a government agency it is red", () => {
    expect(ids("Send CV", job({ employer_name: "Northbridge Bank Plc", how_to_apply: { ...EMPTY_JOB.how_to_apply, email: "northbridgehr@gmail.com" } }))).toContain("L1-03:amber");
    expect(ids("Send CV", job({ employer_name: "Federal Airports Authority of Nigeria", how_to_apply: { ...EMPTY_JOB.how_to_apply, email: "faanrecruit@yahoo.com" } }))).toContain("L1-03:red");
  });
  it("L1-04: government recruitment through WhatsApp is red", () => {
    expect(ids("Apply now on WhatsApp 08030000000", job({ employer_name: "Nigeria Customs Service" }))).toContain("L1-04:red");
  });
  it("L1-04: a government agency on its official domain is not flagged", () => {
    expect(ids("Apply on the portal", job({ employer_name: "NAICOM", how_to_apply: { ...EMPTY_JOB.how_to_apply, url: "https://recruitment.naicom.gov.ng" } }))).not.toContain("L1-04:red");
  });
  it("L1-05: employer name plus recruitment words is amber", () => {
    expect(ids("Apply", job({ employer_name: "Northbridge Bank", how_to_apply: { ...EMPTY_JOB.how_to_apply, url: "https://northbridge-recruitment.com/apply" } }))).toContain("L1-05:amber");
  });
  it("L1-06: WhatsApp as the only contact is amber", () => {
    expect(ids("Interested candidates should send a WhatsApp message to 0803 000 0000")).toContain("L1-06:amber");
  });
  it("L1-07: asking for a BVN is red; L1-08: NIN is amber", () => {
    expect(ids("Send your BVN and CV")).toContain("L1-07:red");
    expect(ids("Attach your NIN slip")).toContain("L1-08:amber");
  });
  it("a portal asking you to create a password is not a red flag", () => {
    expect(ids("Create an account and choose a password on our careers portal.")).not.toContain("L1-07:red");
  });
  it("L1-09 pressure, L1-10 hotel venue, L1-11 guaranteed job", () => {
    expect(ids("Limited slots, apply within 24 hours")).toContain("L1-09:amber");
    expect(ids("Interview holds at Grand Hotel, Ikeja")).toContain("L1-10:amber");
    expect(ids("Guaranteed job abroad, no interview")).toContain("L1-11:red");
  });
  it("L1-12: pay far above the band is amber", () => {
    expect(ids("", job({ experience_level: "entry", salary: { min: 2_500_000, max: 3_000_000, currency: "₦", period: "month" } }))).toContain("L1-12:amber");
  });
  it("'our client' alone is information, never a flag", () => {
    const s = layer1("Our client, a reputable firm, is hiring.", job({ employer_is_agency_client: true }));
    expect(s).toEqual([expect.objectContaining({ id: "L1-00", severity: "info" })]);
  });
  it("'our client' plus a money request becomes amber", () => {
    expect(ids("Our client requires a registration fee of ₦3,000", job({ employer_is_agency_client: true }))).toContain("L1-00:amber");
  });
  it("a clean post has no signals", () => {
    expect(layer1("Graduate Trainee. Send your CV to careers@northbridgebank.com with the subject GTP2026.", job({ employer_name: "Northbridge Bank", employer_domain_claimed: "northbridgebank.com", how_to_apply: { ...EMPTY_JOB.how_to_apply, email: "careers@northbridgebank.com" } }))).toEqual([]);
  });
  it("copy never calls a job safe", () => {
    const all = layer1("pay a form fee of N5000, send your BVN, limited slots, hotel interview, guaranteed job", job({ employer_is_agency_client: true })).map((s) => s.text.toLowerCase());
    expect(all.join(" ")).not.toMatch(/\bsafe\b|\bscam company\b/);
  });
});

describe("scam state", () => {
  const official: Finding = { id: "L2-01", result: "found", text: "On the careers page", sourceUrl: "https://acme.com/careers", sourceType: "official" };
  const match: Finding = { id: "L2-02", result: "match", text: "Email matches", sourceUrl: null, sourceType: null };
  it("verified needs the official page and a matching route, and no red", () => {
    expect(scamState([], [official, match])).toBe("verified");
    expect(scamState([], [official])).toBe("unverified");
    expect(scamState([{ id: "L1-01", severity: "red", text: "", evidence: null }], [official, match])).toBe("red_flags");
  });
  it("a forum report is never red on its own, and never verifies", () => {
    const forum: Finding = { id: "L2-08", result: "warning", text: "Thread", sourceUrl: "https://www.nairaland.com/1", sourceType: "forum" };
    expect(scamState([], [forum])).toBe("unverified");
    expect(scamState([], [{ ...official, sourceType: "forum" }, match])).toBe("unverified");
  });
  it("an official warning covering this exercise is red", () => {
    expect(scamState([], [{ id: "L2-05", result: "warning", text: "Agency warning", sourceUrl: "https://faan.gov.ng/notice", sourceType: "official" }])).toBe("red_flags");
  });
  it("no information means couldn't verify, never safe", () => {
    expect(scamState([], [])).toBe("unverified");
  });
});
