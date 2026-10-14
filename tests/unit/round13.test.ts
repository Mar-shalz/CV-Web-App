import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai", () => ({ runTask: vi.fn() }));
vi.mock("@/lib/copy-lint", async () => ({ lintCopy: () => [] }));

import { numbersIn, addsNoNumbers } from "@/lib/vault/polish";
import { movedAway } from "@/lib/jobs/fetch-link";
import { linkedInJobId } from "@/lib/jobs/boards";
import { hiringBoard, normaliseName, isAtsHost } from "@/lib/legitimacy/company";
import { sortItems } from "@/lib/vault/order";

describe("spoken numbers (D-125)", () => {
  it("reads digits and number words", () => {
    const n = numbersIn("I opened fifteen accounts a day and handled ₦200,000 and two hundred and fifty thousand naira");
    expect(n.has(15)).toBe(true);
    expect(n.has(200000)).toBe(true);
    expect(n.has(250000)).toBe(true);
  });
  it("accepts a tidied line that only rewrites numbers as digits", () => {
    expect(addsNoNumbers("i opened like fifteen customer accounts every day", "Opened about 15 customer accounts a day.")).toBe(true);
    expect(addsNoNumbers("we cut waiting time by twenty percent", "Helped cut waiting time by 20%.")).toBe(true);
  });
  it("rejects a tidied line that adds a number", () => {
    expect(addsNoNumbers("i opened customer accounts every day", "Opened 15 customer accounts a day.")).toBe(false);
    expect(addsNoNumbers("served customers at the branch", "Served 300 customers a week at the branch.")).toBe(false);
  });
});

describe("closed job links", () => {
  it("spots a job link that redirects to the careers list", () => {
    expect(movedAway(new URL("https://job-boards.eu.greenhouse.io/moniepoint/jobs/4987961101"), new URL("https://job-boards.eu.greenhouse.io/moniepoint?error=true"))).toBe(true);
    expect(movedAway(new URL("https://acme.com/careers/jobs/123456"), new URL("https://acme.com/careers"))).toBe(true);
  });
  it("leaves normal redirects alone", () => {
    expect(movedAway(new URL("http://acme.com/jobs/123456"), new URL("https://www.acme.com/jobs/123456"))).toBe(false);
    expect(movedAway(new URL("https://acme.com/careers"), new URL("https://acme.com/en/careers"))).toBe(false);
  });
});

describe("LinkedIn job ids", () => {
  it("reads every link shape", () => {
    expect(linkedInJobId(new URL("https://ng.linkedin.com/jobs/view/senior-product-designer-at-moniepoint-group-4463977991"))).toBe("4463977991");
    expect(linkedInJobId(new URL("https://www.linkedin.com/jobs/view/4463977991/"))).toBe("4463977991");
    expect(linkedInJobId(new URL("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4463978927"))).toBe("4463978927");
    expect(linkedInJobId(new URL("https://www.linkedin.com/in/someone"))).toBeNull();
  });
});

describe("company checks without search (D-118)", () => {
  it("normalises company names", () => {
    expect(normaliseName("Moniepoint Inc.")).toBe("moniepoint");
    expect(normaliseName("Access Bank PLC")).toBe("access bank");
  });
  it("knows a company's own hiring board", () => {
    expect(hiringBoard("https://job-boards.eu.greenhouse.io/moniepoint/jobs/4944264101", "Moniepoint")).toEqual({ service: "Greenhouse", slug: "moniepoint", matchesEmployer: true });
    expect(hiringBoard("https://jobs.lever.co/someoneelse/6ed76ce8-4156-4b60-b120-403538bd66cd", "Moniepoint")?.matchesEmployer).toBe(false);
    expect(hiringBoard("https://moniepoint.com/careers", "Moniepoint")).toBeNull();
    expect(isAtsHost("jobs.ashbyhq.com")).toBe(true);
  });
});

describe("achievement order (D-119)", () => {
  it("puts moved ones in their place and the rest by date", () => {
    const rows = [
      { id: "a", position: null, created_at: "2026-01-01" },
      { id: "b", position: 1, created_at: "2026-01-02" },
      { id: "c", position: 0, created_at: "2026-01-03" },
      { id: "d", position: undefined, created_at: "2025-12-01" },
    ];
    expect(sortItems(rows).map((r) => r.id)).toEqual(["c", "b", "d", "a"]);
  });
});
