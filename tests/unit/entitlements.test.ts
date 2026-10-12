import { describe, expect, it } from "vitest";
import { accessState, canUse } from "@/lib/entitlements";
import limits from "@/config/limits.json";

const now = new Date("2026-10-12T12:00:00Z");
const h = (hours: number) => new Date(now.getTime() + hours * 3600_000).toISOString();

describe("entitlements", () => {
  it("trial is ready until the first job check", () => {
    const s = accessState({ trialStartedAt: null, trialEndsAt: null, trialCvsUsed: 0, activePass: null }, now);
    expect(s).toEqual({ kind: "trial_ready", trialDays: limits.trial.days, cvCap: limits.trial.tailored_cv_cap });
  });

  it("counts days left in an active trial", () => {
    const s = accessState({ trialStartedAt: h(-24), trialEndsAt: h(48), trialCvsUsed: 2, activePass: null }, now);
    expect(s).toMatchObject({ kind: "trial", daysLeft: 2, cvsLeft: limits.trial.tailored_cv_cap - 2 });
  });

  it("ends the trial at the CV cap even with time left", () => {
    const s = accessState({ trialStartedAt: h(-1), trialEndsAt: h(70), trialCvsUsed: limits.trial.tailored_cv_cap, activePass: null }, now);
    expect(s).toEqual({ kind: "trial_ended", reason: "cv_cap" });
  });

  it("ends the trial when time runs out", () => {
    const s = accessState({ trialStartedAt: h(-80), trialEndsAt: h(-8), trialCvsUsed: 1, activePass: null }, now);
    expect(s).toEqual({ kind: "trial_ended", reason: "time" });
  });

  it("an active pass wins over an ended trial", () => {
    const s = accessState({ trialStartedAt: h(-200), trialEndsAt: h(-100), trialCvsUsed: 5, activePass: { type: "job_hunt_30d", endsAt: h(24 * 10) } }, now);
    expect(s).toMatchObject({ kind: "pass", daysLeft: 10 });
  });

  it("an expired pass grants nothing", () => {
    const s = accessState({ trialStartedAt: h(-200), trialEndsAt: h(-100), trialCvsUsed: 5, activePass: { type: "job_hunt_30d", endsAt: h(-1) } }, now);
    expect(s.kind).toBe("trial_ended");
  });

  it("free forever features survive the end of the trial", () => {
    const ended = { kind: "trial_ended", reason: "time" } as const;
    for (const f of ["vault", "eligibility_check", "scam_check", "application_log", "check_ins"]) expect(canUse(f, ended)).toBe(true);
    expect(canUse("tailored_cv", ended)).toBe(false);
  });
});
