// Logistics checklist for an invite (Build pack screen 21). Plain rules by format, so it
// costs nothing and never invents a requirement the employer didn't state.

export type InviteFormat = "in_person" | "video" | "phone" | "test" | "unknown";

const COMMON = ["Re-read the job post and the CV you sent (both are on this page)", "Prepare 2 questions to ask them at the end"];

const BY_FORMAT: Record<InviteFormat, string[]> = {
  in_person: [
    "Print 2 clean copies of the CV you sent",
    "Original certificates, NYSC discharge or exemption certificate, and a valid ID",
    "2 recent passport photographs",
    "Plan your route and leave early enough to arrive 30 minutes before time",
    "A pen and a small notebook",
  ],
  video: [
    "Open the link the day before and test your camera and microphone",
    "Charge your phone and buy enough data: about 500MB for an hour of video",
    "A quiet spot with light in front of you, not behind",
    "Keep the CV you sent open where you can see it",
  ],
  phone: ["Charge your phone and find a quiet spot with good signal", "Keep the CV you sent in front of you", "Save their number so you know it's them when they call"],
  test: ["Check what the test allows: calculator, scratch paper, time limit", "Practise numerical and verbal reasoning questions", "Charge your phone or laptop and buy enough data if it's online", "A valid ID if it's at a test centre"],
  unknown: ["Ask them by reply how the interview will run: in person, video or phone", "Have the CV you sent printed and on your phone"],
};

export function logisticsFor(format: InviteFormat): string[] {
  return [...BY_FORMAT[format], ...COMMON];
}

/** Whole days from today (Lagos) to the interview date, or null when we don't know it. */
export function daysUntil(date: string | null, now: Date = new Date()): number | null {
  if (!date) return null;
  const today = new Date(now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }) + "T00:00:00Z");
  const target = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}
