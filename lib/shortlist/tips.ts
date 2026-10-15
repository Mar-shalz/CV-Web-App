import type { QuestionKind } from "./questions";

/**
 * How to answer each kind of question (founder round 20, from the question bank they
 * shared): STAR for experience, a plan with when to escalate for scenarios, and so on.
 */
export const ANSWER_TIPS: Record<QuestionKind, string> = {
  intro: "About a minute: who you are now, your strongest proof for this job, and why this role.",
  defend_cv: "Use STAR: the Situation, your Task, the Action you took, and the Result, with the real number from your CV.",
  standard: "Use STAR: the Situation, your Task, the Action you took, and the Result. Pick a real example.",
  situational: "Say what you would do, why you'd do it, and when you'd ask for help or escalate it.",
  job_fit: "Connect your interests, skills and experience to the role's duties and the organisation. For values questions, give a genuine example.",
  technical: "Explain how you'd do it step by step, then give a time you did something similar.",
};

