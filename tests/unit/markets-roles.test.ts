import { describe, expect, it } from "vitest";
import { ABROAD, countryMarkets, marketsFor, marketsLabel, regionOf } from "@/lib/markets";
import { EMPLOYMENT_ON_CV, withTerms } from "@/lib/vault/schema";

describe("where people apply (no country list)", () => {
  it("stores a region, not countries", () => {
    expect(marketsFor("nigeria")).toEqual(["NG"]);
    expect(marketsFor("abroad")).toEqual([ABROAD]);
    expect(marketsFor("both")).toEqual(["NG", ABROAD]);
  });
  it("reads old country lists as a region", () => {
    expect(regionOf(["NG", "GB"])).toBe("both");
    expect(regionOf(["GB", "CA"])).toBe("abroad");
    expect(regionOf(["NG"])).toBe("nigeria");
    expect(regionOf([])).toBeNull();
  });
  it("labels and filters", () => {
    expect(marketsLabel(["NG", ABROAD])).toBe("Nigeria and abroad");
    expect(marketsLabel([ABROAD])).toBe("Abroad");
    expect(countryMarkets(["NG", ABROAD])).toEqual(["NG"]);
  });
});

describe("employment type on the CV", () => {
  it("prints part time and contract, never full time", () => {
    expect(withTerms("Accounts Officer", EMPLOYMENT_ON_CV.contract)).toBe("Accounts Officer (Contract)");
    expect(withTerms("Sales Associate", EMPLOYMENT_ON_CV.part_time)).toBe("Sales Associate (Part-time)");
    expect(withTerms("Analyst", EMPLOYMENT_ON_CV.full_time)).toBe("Analyst");
    expect(withTerms("", "Contract")).toBe("Contract");
  });
});
