// Check in timing (PRD F9) [Hypothesis, tune with beta outcome data]:
// most private sector roles at about 7 and 21 days after sending; graduate
// programmes and government roles at the closing date plus 14 and 45 days.

const DAY = 86_400_000;

export type ScheduleKind = "private" | "programme";

export function scheduleKind(experienceLevel: string, isGovernment: boolean): ScheduleKind {
  return experienceLevel === "graduate_programme" || isGovernment ? "programme" : "private";
}

/** When to ask "Heard back yet?" next. Null after the second check in: silence becomes No reply at 30 days. */
export function nextCheckIn(kind: ScheduleKind, sentAt: Date, deadline: string | null, checkInsSoFar: number): Date | null {
  if (checkInsSoFar >= 2) return null;
  if (kind === "private") return new Date(sentAt.getTime() + (checkInsSoFar === 0 ? 7 : 21) * DAY);
  const base = deadline ? new Date(`${deadline}T12:00:00+01:00`) : sentAt;
  const anchor = base.getTime() < sentAt.getTime() ? sentAt : base;
  return new Date(anchor.getTime() + (checkInsSoFar === 0 ? 14 : 45) * DAY);
}

/** No reply after 30 days is set automatically, without asking. */
export function isSilent(sentAt: Date, now: Date): boolean {
  return now.getTime() - sentAt.getTime() >= 30 * DAY;
}
