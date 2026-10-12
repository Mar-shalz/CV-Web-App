import { describe, expect, it } from "vitest";
import { isSilent, nextCheckIn, scheduleKind } from "@/lib/applications/schedule";

const sent = new Date("2026-10-12T10:00:00Z");
const days = (d: Date | null) => (d ? Math.round((d.getTime() - sent.getTime()) / 86_400_000) : null);

describe("check in schedule", () => {
  it("private roles: about 7 then 21 days, then stop", () => {
    expect(days(nextCheckIn("private", sent, null, 0))).toBe(7);
    expect(days(nextCheckIn("private", sent, null, 1))).toBe(21);
    expect(nextCheckIn("private", sent, null, 2)).toBeNull();
  });
  it("graduate programmes: closing date plus 14 and 45", () => {
    expect(days(nextCheckIn("programme", sent, "2026-10-24", 0))).toBe(26);
    expect(days(nextCheckIn("programme", sent, "2026-10-24", 1))).toBe(57);
  });
  it("programmes with no or past deadline count from the send date", () => {
    expect(days(nextCheckIn("programme", sent, null, 0))).toBe(14);
    expect(days(nextCheckIn("programme", sent, "2026-09-01", 0))).toBe(14);
  });
  it("government roles use the programme schedule", () => {
    expect(scheduleKind("entry", true)).toBe("programme");
    expect(scheduleKind("entry", false)).toBe("private");
    expect(scheduleKind("graduate_programme", false)).toBe("programme");
  });
  it("silence becomes No reply at 30 days", () => {
    expect(isSilent(sent, new Date("2026-11-10T10:00:00Z"))).toBe(false);
    expect(isSilent(sent, new Date("2026-11-11T10:00:00Z"))).toBe(true);
  });
});
