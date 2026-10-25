import { describe, expect, it } from "vitest";
import { canTransition, nextStatuses, opensShortlist, STATUSES } from "@/lib/rules/status-flow";

describe("application status flow (Build pack section 4)", () => {
  it("draft becomes packed, or sent when the CV went another way (D-199); packed only becomes sent", () => {
    expect(nextStatuses("draft")).toEqual(["packed", "sent"]);
    expect(nextStatuses("packed")).toEqual(["sent"]);
  });

  it("sent can move to the six outcomes the pack lists", () => {
    for (const to of ["no_response", "rejected", "assessment", "interview", "offer", "withdrawn"] as const) {
      expect(canTransition("sent", to)).toBe(true);
    }
    expect(canTransition("sent", "accepted")).toBe(false);
    expect(canTransition("sent", "second_interview")).toBe(false);
  });

  it("assessment, interview, second interview and offer follow the pack", () => {
    expect(nextStatuses("assessment")).toEqual(["interview", "rejected", "withdrawn"]);
    expect(nextStatuses("interview")).toEqual(["second_interview", "offer", "rejected", "withdrawn"]);
    expect(nextStatuses("second_interview")).toEqual(["offer", "rejected", "withdrawn"]);
    expect(nextStatuses("offer")).toEqual(["accepted", "withdrawn"]);
  });

  it("no_response can still move on when an employer replies late", () => {
    expect(canTransition("no_response", "interview")).toBe(true);
    expect(canTransition("no_response", "rejected")).toBe(true);
    expect(canTransition("no_response", "no_response")).toBe(false);
  });

  it("final states go nowhere", () => {
    for (const s of ["rejected", "accepted", "withdrawn"] as const) expect(nextStatuses(s)).toHaveLength(0);
  });

  it("a draft never jumps past sent", () => {
    for (const to of ["no_response", "interview", "offer", "accepted"] as const) expect(canTransition("draft", to)).toBe(false);
  });

  it("only interview opens Shortlist mode", () => {
    expect(STATUSES.filter(opensShortlist)).toEqual(["interview"]);
  });
});
