import { LIMITS } from "@/lib/config";

export type AccessState =
  /** Charging is off (D-196): everything is open, with no trial or pass. */
  | { kind: "open" }
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
  opts: { charging?: boolean; trialDays?: number; trialCvs?: number } = {},
): AccessState {
  if (opts.charging === false) return { kind: "open" };
  const cvCap = opts.trialCvs ?? LIMITS.trial.tailored_cv_cap;
  const trialDays = opts.trialDays ?? LIMITS.trial.days;

  if (input.activePass?.endsAt && new Date(input.activePass.endsAt) > now) {
    const daysLeft = Math.max(1, Math.ceil((new Date(input.activePass.endsAt).getTime() - now.getTime()) / DAY));
    return { kind: "pass", daysLeft, passType: input.activePass.type };
  }
  if (!input.trialStartedAt) return { kind: "trial_ready", trialDays, cvCap };

  const ends = input.trialEndsAt ? new Date(input.trialEndsAt) : new Date(new Date(input.trialStartedAt).getTime() + trialDays * DAY);
  if (ends <= now) return { kind: "trial_ended", reason: "time" };
  if (input.trialCvsUsed >= cvCap) return { kind: "trial_ended", reason: "cv_cap" };

  const daysLeft = Math.max(1, Math.ceil((ends.getTime() - now.getTime()) / DAY));
  return { kind: "trial", daysLeft, cvsLeft: cvCap - input.trialCvsUsed, cvsUsed: input.trialCvsUsed, cvCap };
}

/** Free forever, whatever the access state (PRD F12). */
export const FREE_FOREVER = ["vault", "eligibility_check", "scam_check", "application_log", "check_ins"] as const;

export function canUse(feature: string, state: AccessState): boolean {
  if ((FREE_FOREVER as readonly string[]).includes(feature)) return true;
  return state.kind === "open" || state.kind === "pass" || state.kind === "trial" || state.kind === "trial_ready";
}

/** A viewer's access, with the pricing in force (D-196). */
export function accessOf(v: {
  trial: { startedAt: string | null; endsAt: string | null; cvsUsed: number };
  activePass: { type: string; endsAt: string | null } | null;
  pricing: { charging: boolean; trial: { days: number; cvs: number } };
}): AccessState {
  return accessState({ trialStartedAt: v.trial.startedAt, trialEndsAt: v.trial.endsAt, trialCvsUsed: v.trial.cvsUsed, activePass: v.activePass }, new Date(), {
    charging: v.pricing.charging,
    trialDays: v.pricing.trial.days,
    trialCvs: v.pricing.trial.cvs,
  });
}
