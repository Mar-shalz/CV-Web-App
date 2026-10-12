import { describe, expect, it } from "vitest";
import { guessSource, targetStatus } from "@/lib/applications/outcome-rules";
import { linkQuestions, fallbackQuestions, answerContradictions, type CvLine } from "@/lib/shortlist/questions";
import { logisticsFor, daysUntil } from "@/lib/shortlist/logistics";
import { lintCopy } from "@/lib/copy-lint";

const lines: CvLine[] = [
  { id: "b1", role: "SIWES Intern, Northbridge Bank", text: "Opened about 15 customer accounts a day at the Yaba branch", original: "I opened like 15 accounts every day", sourceQuote: "I opened like 15 accounts every day", },
  { id: "b2", role: "SIWES Intern, Northbridge Bank", text: "Reconciled teller cash at close of business", original: "I balanced the tellers at close", sourceQuote: null },
  { id: "b3", role: "NYSC, Ministry of Works", text: "Prepared monthly expense summaries for the finance unit in 2025", original: "I did the monthly expense summaries in 2025", sourceQuote: null },
];

describe("paste to classify: status mapping", () => {
  it("maps an invite on a sent application to interview", () => {
    expect(targetStatus("sent", "interview")).toBe("interview");
  });
  it("maps a second invite to second interview", () => {
    expect(targetStatus("interview", "interview")).toBe("second_interview");
  });
  it("lets a late reply move a No reply application forward", () => {
    expect(targetStatus("no_response", "rejected")).toBe("rejected");
    expect(targetStatus("no_response", "interview")).toBe("interview");
  });
  it("refuses moves the status flow doesn't allow", () => {
    expect(targetStatus("rejected", "interview")).toBeNull();
    expect(targetStatus("packed", "offer")).toBeNull();
    expect(targetStatus("offer", "rejected")).toBeNull();
  });
  it("labels long or formal messages as email and short ones as SMS", () => {
    expect(guessSource("Dear Tolu, we are pleased to invite you")).toBe("forwarded_email");
    expect(guessSource("Congrats! Interview Thu 10am at VI office. Reply YES")).toBe("pasted_sms");
  });
});

describe("Shortlist questions link to the CV sent", () => {
  it("drops questions whose bullet id isn't in the CV", () => {
    const out = linkQuestions(
      [
        { question: "How did you open 15 accounts a day?", why: "It's a number on your CV", bullet_id: "b1", kind: "defend_cv" },
        { question: "Tell us about your audit work", why: "Invented", bullet_id: "b99", kind: "defend_cv" },
      ],
      lines,
    );
    expect(out).toHaveLength(1);
    expect(out[0].bulletId).toBe("b1");
    expect(out[0].bulletText).toBe(lines[0].text);
  });
  it("drops duplicate questions", () => {
    const q = { question: "Walk me through reconciling cash", why: "x", bullet_id: "b2", kind: "defend_cv" as const };
    expect(linkQuestions([q, { ...q, question: " walk me through reconciling cash " }], lines)).toHaveLength(1);
  });
  it("falls back to one question per line, every one linked, numbers first", () => {
    const out = fallbackQuestions(lines);
    expect(out.every((q) => lines.some((l) => l.id === q.bulletId))).toBe(true);
    expect(/\d/.test(out[0].bulletText)).toBe(true);
    for (const q of out) expect(lintCopy(q.question)).toEqual([]);
  });
});

describe("drill flags answers that contradict the CV", () => {
  it("flags a number that isn't on the CV line", () => {
    const issues = answerContradictions("I opened about 40 accounts a day at the branch", lines[0]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("40");
  });
  it("accepts the CV's own number", () => {
    expect(answerContradictions("I opened about 15 accounts a day", lines[0])).toEqual([]);
  });
  it("flags a year the CV doesn't have", () => {
    expect(answerContradictions("I did the summaries in 2023", lines[2])[0]).toContain("2023");
    expect(answerContradictions("I did the summaries in 2025", lines[2])).toEqual([]);
  });
});

describe("logistics", () => {
  it("gives a checklist for every format with no banned phrases", () => {
    for (const f of ["in_person", "video", "phone", "test", "unknown"] as const) {
      const items = logisticsFor(f);
      expect(items.length).toBeGreaterThan(2);
      for (const i of items) expect(lintCopy(i)).toEqual([]);
    }
  });
  it("counts days to the interview in Lagos time", () => {
    const now = new Date("2026-10-12T23:30:00Z"); // 00:30 on 13 Oct in Lagos
    expect(daysUntil("2026-10-13", now)).toBe(0);
    expect(daysUntil("2026-10-16", now)).toBe(3);
    expect(daysUntil(null, now)).toBeNull();
  });
});
