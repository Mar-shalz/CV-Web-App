import { describe, expect, it } from "vitest";
import { chosenRoles } from "@/lib/jobfeed/rank";

// Founder round 49 (D-220): roles a person types for Jobs for You to search.
describe("chosenRoles", () => {
  it("keeps plain role names and drops blanks and repeats", () => {
    expect(chosenRoles(["Data Analyst", "", "data analyst", "UI/UX Designer"])).toEqual(["Data Analyst", "UI/UX Designer"]);
  });
  it("strips anything that isn't part of a role name", () => {
    expect(chosenRoles(["<script>alert(1)</script> Nurse", "C++ Developer", "  Sales   & Marketing "])).toEqual(["script alert(1) /script Nurse", "C++ Developer", "Sales & Marketing"]);
  });
  it("drops what is too short to search", () => {
    expect(chosenRoles(["a", "!!"])).toEqual([]);
  });
});
