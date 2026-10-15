import { describe, expect, it } from "vitest";
import { boardListing, careersHit, foundedYear, nameIn, titleIn } from "@/lib/legitimacy/evidence";

// Real search results (Serper, 15 Oct 2026), trimmed.
const MONIEPOINT = [
  { title: "Moniepoint | About", url: "https://moniepoint.com/about", snippet: "Beginnings. 2015. We created financial products for banks." },
  { title: "Moniepoint Inc. - Wikipedia", url: "https://en.wikipedia.org/wiki/Moniepoint_Inc.", snippet: "The company was founded by Tosin Eniolorunda and Felix Ike in 2015. In November 2024, Bayo Olujobi was appointed its chief financial officer (CFO)." },
];
const COWRYWISE = [
  { title: "About Cowrywise", url: "https://cowrywise.com/about", snippet: "Cowrywise Financial Technology Limited is a Fund/Portfolio Manager. License #1940." },
  { title: "Cowrywise and Meristem partner", url: "https://cowrywise.com/blog/x", snippet: "Established in 2017 and led by Razaq Ahmed (CFA) and Edward Popoola, Cowrywise has created an all-in-one investment app." },
  { title: "Cowrywise | LinkedIn", url: "https://ng.linkedin.com/company/cowrywise", snippet: "Founded 2017 Specialties FinTech, Wealth Management, Savings." },
];
// A made up company: the results are about other banks and must not give it their age.
const NORTHBRIDGE = [
  { title: "First Bank of Nigeria - Wikipedia", url: "https://en.wikipedia.org/wiki/First_Bank_of_Nigeria", snippet: "The bank was founded in 1894 and is Nigeria's oldest bank." },
  { title: "Our history | GTBank", url: "https://www.gtbank.com/about/our-company/history", snippet: "The Bank commenced operations in February 1991." },
];
const BOARD_HITS = [
  { title: "Glassdoor interview", url: "https://www.glassdoor.com/Interview/Moniepoint-Product-Designer-Interview-Questions-EI_IE5299398.htm", snippet: "Moniepoint Product Designer interview questions." },
  { title: "Senior Product Designer - UX Design", url: "https://ng.linkedin.com/jobs/view/senior-product-designer-ux-at-moniepoint-group-4370637421", snippet: "Senior Product Designer - UX Design. Moniepoint Group. Nigeria 6 days ago." },
];

describe("search readers (D-156)", () => {
  it("finds when a company started, only from pages about it", () => {
    expect(foundedYear(MONIEPOINT, "Moniepoint")).toEqual({ year: 2015, url: "https://en.wikipedia.org/wiki/Moniepoint_Inc." });
    expect(foundedYear(COWRYWISE, "Cowrywise")?.year).toBe(2017);
    expect(foundedYear(NORTHBRIDGE, "Northbridge Bank")).toBeNull();
    expect(foundedYear([{ title: "Acme", url: "https://acme.ng", snippet: "Acme was founded in 2031." }], "Acme", 2026)).toBeNull();
  });

  it("matches names as whole phrases and most of a job title", () => {
    expect(nameIn("Helium health was founded by three entrepreneurs", "Helium Health Ltd")).toBe(true);
    expect(nameIn("Helium balloons", "Helium Health")).toBe(false);
    expect(titleIn("Senior Product Designer (UX) at Moniepoint", "Product Designer")).toBe(true);
    expect(titleIn("Graduate Trainee programme 2026, Finance", "Graduate Trainee, Finance")).toBe(true);
    expect(titleIn("Sales Executive", "Graduate Trainee, Finance")).toBe(false);
  });

  it("finds the job listed under the company's name on a job site, not salary or interview pages", () => {
    expect(boardListing(BOARD_HITS, "Moniepoint", "Product Designer")).toEqual({ board: "LinkedIn", url: BOARD_HITS[1]!.url });
    expect(boardListing(BOARD_HITS.slice(0, 1), "Moniepoint", "Product Designer")).toBeNull();
    expect(boardListing(BOARD_HITS, "Kuda", "Product Designer")).toBeNull();
  });

  it("finds the job on the company's own careers page", () => {
    const hits = [{ title: "Careers", url: "https://moniepoint.com/careers/roles/4612209101", snippet: "Explore career opportunities at Moniepoint as a Senior Product Designer (UX) in Remote, Nigeria." }];
    expect(careersHit(hits, "Product Designer", (u) => u.includes("moniepoint.com"))?.url).toBe(hits[0]!.url);
    expect(careersHit(hits, "Product Designer", () => false)).toBeNull();
  });
});
