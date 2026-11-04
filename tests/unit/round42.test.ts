import { describe, expect, it } from "vitest";
import { visaFromText } from "@/lib/jobfeed/visa";
import { boardApi, readHeadcount, readPage, safeUrl } from "@/lib/jobfeed/open";

describe("Jobs for You: visa sponsorship in a post (round 42)", () => {
  it("reads an offer", () => {
    expect(visaFromText("We offer visa sponsorship for the right candidate.")).toBe("offered");
    expect(visaFromText("Benefits: pension, relocation support and 25 days holiday")).toBe("offered");
    expect(visaFromText("We are happy to sponsor a Skilled Worker visa.")).toBe("offered");
  });
  it("reads a refusal, which wins over any offer", () => {
    expect(visaFromText("Unfortunately we are unable to sponsor visas for this role.")).toBe("not_offered");
    expect(visaFromText("No visa sponsorship is available.")).toBe("not_offered");
    expect(visaFromText("Candidates must have the right to work in the UK.")).toBe("not_offered");
    expect(visaFromText("You must be authorized to work in the US without sponsorship now or in the future.")).toBe("not_offered");
    expect(visaFromText("We don't offer visa sponsorship, but we do offer relocation support within the EU.")).toBe("not_offered");
  });
  it("says nothing when the post says nothing", () => {
    expect(visaFromText("A hybrid role in our London office, three days a week.")).toBe("not_mentioned");
    expect(visaFromText(null)).toBe("not_mentioned");
  });
});

describe("Jobs for You: is a job still listed (round 42)", () => {
  it("reads Headcount's record", () => {
    expect(readHeadcount(410, null)).toBe("closed");
    expect(readHeadcount(404, null)).toBe("closed");
    expect(readHeadcount(200, { currentness: "not_current", postings: [] })).toBe("closed");
    expect(readHeadcount(200, { data: { currentness: "current", postings: [{ posting_status: "no_longer_listed" }] } })).toBe("closed");
    expect(readHeadcount(200, { currentness: "current", postings: [{ posting_status: "listed", latest_application_check: { result: "closed" } }] })).toBe("closed");
    expect(readHeadcount(200, { currentness: "current", postings: [{ posting_status: "listed", latest_application_check: { result: "available" } }] })).toBe("open");
    expect(readHeadcount(200, { currentness: "uncertain", postings: [{ posting_status: "listed" }] })).toBe("unknown");
    expect(readHeadcount(500, null)).toBe("unknown");
  });
  it("asks the job board directly where it can", () => {
    expect(boardApi("https://generac.wd5.myworkdayjobs.com/External/job/Toronto-Canada/Senior-UX-Designer_JR14759-1")?.url).toBe("https://generac.wd5.myworkdayjobs.com/wday/cxs/generac/External/job/Toronto-Canada/Senior-UX-Designer_JR14759-1");
    expect(boardApi("https://acme.wd1.myworkdayjobs.com/en-US/Careers/job/Lagos/Analyst_R123")?.url).toBe("https://acme.wd1.myworkdayjobs.com/wday/cxs/acme/Careers/job/Lagos/Analyst_R123");
    expect(boardApi("https://job-boards.greenhouse.io/acme/jobs/4012345")?.url).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/4012345");
    expect(boardApi("https://jobs.lever.co/acme/1b2c3d4e-0000-4000-8000-000000000000/apply")?.url).toBe("https://api.lever.co/v0/postings/acme/1b2c3d4e-0000-4000-8000-000000000000");
    expect(boardApi("https://jobs.smartrecruiters.com/Acme/743999-analyst")?.url).toBe("https://api.smartrecruiters.com/v1/companies/Acme/postings/743999");
    expect(boardApi("https://jobicy.com/jobs/157622-senior-product-designer")).toBeNull();
    const wd = boardApi("https://generac.wd5.myworkdayjobs.com/External/job/Toronto/X_1")!;
    expect(wd.read(200, JSON.stringify({ jobPostingInfo: { canApply: true, posted: true } }))).toBe("open");
    expect(wd.read(200, JSON.stringify({ jobPostingInfo: { canApply: false } }))).toBe("closed");
    expect(wd.read(404, "")).toBe("closed");
  });
  it("reads the page itself", () => {
    expect(readPage(404, "")).toBe("closed");
    expect(readPage(200, '<script>window.__appData = {"posting":{"isListed":false}}</script>')).toBe("closed");
    expect(readPage(200, '<script>{"isListed":true}</script>')).toBe("open");
    expect(readPage(200, "<main><h1>Analyst</h1><p>This job is no longer available.</p></main>")).toBe("closed");
    expect(readPage(200, "<main><h1>Analyst</h1><p>Apply now</p></main>")).toBe("open");
    expect(readPage(503, "")).toBe("unknown");
  });
  it("only follows public https links", () => {
    expect(safeUrl("https://jobs.example.com/1")).not.toBeNull();
    expect(safeUrl("http://jobs.example.com/1")).toBeNull();
    expect(safeUrl("https://127.0.0.1/admin")).toBeNull();
    expect(safeUrl("https://localhost/x")).toBeNull();
    expect(safeUrl("https://[::1]/x")).toBeNull();
    expect(safeUrl("https://metadata.internal/x")).toBeNull();
  });
});
