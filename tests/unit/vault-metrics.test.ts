import { describe, expect, it } from "vitest";
import { extractMetrics } from "@/lib/vault/metrics";

describe("extractMetrics", () => {
  it("finds a number with its unit and an approximate flag", () => {
    expect(extractMetrics("Opened about 15 customer accounts a day")).toEqual([{ value: 15, unit: "customer accounts", approximate: true }]);
  });
  it("reads naira, thousands and plus signs", () => {
    const m = extractMetrics("Collected ₦250,000 in dues from 200+ members and 3k followers");
    expect(m.map((x) => x.value)).toEqual([250000, 200, 3000]);
    expect(m[0]?.unit).toBe("naira");
    expect(m[1]?.approximate).toBe(true);
  });
  it("reads percentages", () => {
    expect(extractMetrics("Cut waiting time by 20%")[0]).toMatchObject({ value: 20, unit: "percent" });
  });
  it("ignores bare years", () => {
    expect(extractMetrics("From 2023 to 2024 I handled 40 files")).toHaveLength(1);
  });
});
