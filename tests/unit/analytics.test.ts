import { describe, expect, it } from "vitest";
import { sanitize } from "@/lib/analytics/events";

describe("analytics allow list", () => {
  it("drops properties that are not on the list", () => {
    const leaky = { career_stage: "nysc", target_markets_count: 2, email: "tolu@example.test" } as never;
    expect(sanitize("setup_completed", leaky)).toEqual({ career_stage: "nysc", target_markets_count: 2 });
  });
});
