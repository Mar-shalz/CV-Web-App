import { LIMITS } from "@/lib/config";

export type AccessState =
  | { kind: "pass"; daysLeft: number; passType: string }
  | { kind: "trial"; daysLeft: number; cvsLeft: number; cvsUsed: number; cvCap: number }
  | { kind: "trial_ready"; trialDays: number; cvCap: number }
  | { kind: "trial_ended"; reason: "time" | "cv_cap" };

const DAY = 24 * 60 * 60 * 1000;

/**
 * What the user can do right now. Pure, so it is easy to test; the database stays
 * the source of truth (only a verified webhook writes passes).
 */
export function accessState(
  input: {
    trialStartedAt: string | null;
    trialEndsAt: string | null;
    trialCvsUsed: number;
    activePass: { type: string; endsAt: string | null } | null;
  },
  now: Date = new Date(),
): AccessState {
  const cvCap = LIMITS.trial.tailored_cv_cap;

  if (input.activePass?.endsAt && new Date(input.activePass.endsAt) > now) {
    const daysLeft = Math.max(1, Math.ceil((new Date(input.activePass.endsAt).getTime() - now.getTime()) / DAY));
    return { kind: "pass", daysLeft, passType: input.activePass.type };
  }
  if (!input.trialStartedAt) return { kind: "trial_ready", trialDays: LIMITS.trial.days, cvCap };

  const ends = input.trialEndsAt ? new Date(input.trialEndsAt) : new Date(new Date(input.trialStartedAt).getTime() + LIMITS.trial.days * DAY);
  if (ends <= now) return { kind: "trial_ended", reason: "time" };
  if (input.trialCvsUsed >= cvCap) return { kind: "trial_ended", reason: "cv_cap" };

  const daysLeft = Math.max(1, Math.ceil((ends.getTime() - now.getTime()) / DAY));
  return { kind: "trial", daysLeft, cvsLeft: cvCap - input.trialCvsUsed, cvsUsed: input.trialCvsUsed, cvCap };
}

/** Free forever, whatever the access state (PRD F12). */
export const FREE_FOREVER = ["vault", "eligibility_check", "scam_check", "application_log", "check_ins"] as const;

export function canUse(feature: string, state: AccessState): boolean {
  if ((FREE_FOREVER as readonly string[]).includes(feature)) return true;
  return state.kind === "pass" || state.kind === "trial" || state.kind === "trial_ready";
}
