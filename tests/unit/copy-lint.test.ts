import { describe, expect, it } from "vitest";
import { lintCopy } from "@/lib/copy-lint";

describe("copy lint", () => {
  it("flags banned phrases, any case", () => {
    expect(lintCopy("Spearheaded a dynamic team").map((i) => i.match)).toEqual(["spearheaded", "dynamic"]);
  });
  it("flags em dashes", () => {
    expect(lintCopy("Opened accounts — 15 a day")).toHaveLength(1);
  });
  it("does not flag words that only contain a banned word", () => {
    expect(lintCopy("Worked on aerodynamics")).toHaveLength(0);
  });
  it("passes clean copy", () => {
    expect(lintCopy("Opened about 15 customer accounts a day during SIWES.")).toHaveLength(0);
  });
});
