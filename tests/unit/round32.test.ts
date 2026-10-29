import { describe, expect, it } from "vitest";
import { cleanHeadline, withCleanHeadline } from "@/lib/cv/headline";
import { fileBase, profileRules, PROFILES } from "@/lib/cv/profiles";
import { onLetterPaper, summaryHeading } from "@/lib/cv/format";
import { buildLetter, letterFileBase } from "@/lib/pack/letter";
import { isSentVia, SENT_VIA } from "@/lib/applications/sent-via";
import type { CvDoc } from "@/lib/cv/types";

describe("the headline under the name (founder round 32, D-198)", () => {
  it("drops the course, degree and class of degree, keeping what describes work", () => {
    expect(cleanHeadline("Accounting Graduate | ICAN Skills Level | Banking Operations and Reconciliation")).toBe("ICAN Skills Level | Banking Operations and Reconciliation");
    expect(cleanHeadline("B.Sc. Economics (Second Class Upper)")).toBe("");
    expect(cleanHeadline("HND Business Administration, Sales Executive")).toBe("Sales Executive");
    expect(cleanHeadline("Computer Science student | Data Analysis")).toBe("Data Analysis");
  });
  it("never claims the job's own title unless the person has held it", () => {
    expect(cleanHeadline("Graduate Trainee | Reconciliation", { jobTitle: "Graduate Trainee" })).toBe("Reconciliation");
    expect(cleanHeadline("Accounts Officer | Reconciliation", { jobTitle: "Accounts Officer", held: [] })).toBe("Reconciliation");
    expect(cleanHeadline("Accounts Officer | Reconciliation", { jobTitle: "Accounts Officer", held: ["Accounts Officer"] })).toBe("Accounts Officer | Reconciliation");
  });
  it("keeps a plain professional headline as written", () => {
    expect(cleanHeadline("Finance Assistant | Reconciliation and Banking Operations")).toBe("Finance Assistant | Reconciliation and Banking Operations");
    expect(cleanHeadline("")).toBe("");
    expect(cleanHeadline(null)).toBe("");
  });
  it("cleans an unsent CV made before the change, dropping flags on removed words", () => {
    const doc = { titleLine: "Accounting graduate, ICAN Skills level", titleFlags: [{ type: "grade", token: "graduate", message: "", status: "open" }] } as unknown as CvDoc;
    const clean = withCleanHeadline(doc);
    expect(clean.titleLine).toBe("ICAN Skills level");
    expect(clean.titleFlags).toHaveLength(0);
  });
});

describe("country formats (D-198)", () => {
  it("has Canada and the Gulf, with their own conventions", () => {
    expect(PROFILES.ca).toMatchObject({ label: "Resume", paper: "Letter", spelling: "Canadian English", referees: "left_out" });
    expect(PROFILES.ca.personal_fields.photo).toBe("never");
    expect(PROFILES.gulf).toMatchObject({ label: "CV", paper: "A4", referees: "available_on_request" });
    expect(PROFILES.gulf.personal_fields.religion).toBe("never");
  });
  it("Nigerian CVs name referees or leave the section out, never 'available on request' (Jobberman)", () => {
    expect(PROFILES.ng_private.referees).toBe("listed_or_left_out");
    expect(PROFILES.ng_graduate.referees).toBe("listed_or_left_out");
  });
  it("tells the writer class of degree never goes in the headline, for every format", () => {
    for (const p of Object.values(PROFILES)) {
      const rules = profileRules(p, true).join(" ");
      expect(rules).toMatch(/never in the headline/i);
      expect(rules).not.toMatch(/title line/i);
    }
    expect(profileRules(PROFILES.ca, false).join(" ")).toContain("Canadian resume");
    expect(profileRules(PROFILES.gulf, false).join(" ")).toContain("Gulf CV");
  });
  it("prints North American resumes on Letter paper with a Summary", () => {
    expect(onLetterPaper("us")).toBe(true);
    expect(onLetterPaper("ca")).toBe(true);
    expect(onLetterPaper("gulf")).toBe(false);
    expect(summaryHeading("ca")).toBe("Summary");
    expect(summaryHeading("uk")).toBe("Profile");
    expect(summaryHeading("ng_private")).toBe("Profile summary");
  });
  it("names resume files as resumes, and the letter beside them", () => {
    expect(fileBase("Tolu Adebayo", "Accounts Officer", "Resume")).toBe("Tolu_Adebayo_Resume_Accounts_Officer");
    expect(fileBase("Tolu Adebayo", "Accounts Officer")).toBe("Tolu_Adebayo_CV_Accounts_Officer");
    expect(letterFileBase("Tolu_Adebayo_Resume_Accounts_Officer")).toBe("Tolu_Adebayo_Cover_Letter_Accounts_Officer");
  });
  it("Canadian letters close like American ones", () => {
    const l = buildLetter({ paragraphs: ["One."], name: "Tolu", phone: null, email: null, place: null, employer: "Acme", role: "Analyst", today: "2026-10-25", format: "ca" });
    expect(l.closing).toBe("Sincerely,");
  });
});

describe("sent another way (founder round 32, D-199)", () => {
  it("knows the ways people send a CV themselves", () => {
    expect(SENT_VIA).toEqual(["whatsapp", "job_site", "website", "email", "in_person", "other"]);
    expect(isSentVia("whatsapp")).toBe(true);
    expect(isSentVia("fax")).toBe(false);
    expect(isSentVia(null)).toBe(false);
  });
});

describe("the applications board (founder rounds 33 and 34, D-201, D-202)", async () => {
  const { COLUMNS, canDrop, needsSend } = await import("@/lib/applications/board");
  const { canCorrect, canTransition } = await import("@/lib/rules/status-flow");
  const col = (id: string) => COLUMNS.find((c) => c.id === id)!;
  const ids = (status: Parameters<typeof canDrop>[0]["status"]) => COLUMNS.filter((c) => canDrop({ status }, c)).map((c) => c.id);
  it("moves forward, back and across stages, never out of Not selected", () => {
    expect(ids("interview")).toEqual(["not_sent", "sent", "assessment", "offer", "no_reply", "closed"]);
    expect(ids("offer")).toContain("sent");
    expect(ids("no_response")).toContain("interview");
    expect(ids("rejected")).toEqual([]);
    expect(ids("withdrawn")).toEqual([]);
  });
  it("a job not sent yet can go anywhere but asks how it was sent first", () => {
    expect(ids("draft")).toEqual(["sent", "assessment", "interview", "offer", "no_reply", "closed"]);
    expect(needsSend({ status: "packed" }, col("interview"))).toBe(true);
    expect(needsSend({ status: "sent" }, col("interview"))).toBe(false);
    expect(canDrop({ status: "packed" }, col("not_sent"))).toBe(false);
  });
  it("corrections are free except out of a closed application; the detail page keeps the flow", () => {
    expect(canCorrect("offer", "sent")).toBe(true);
    expect(canCorrect("rejected", "interview")).toBe(false);
    expect(canCorrect("sent", "sent")).toBe(false);
    expect(canTransition("offer", "sent")).toBe(false);
  });
  it("every status has exactly one column", () => {
    for (const s of ["draft", "packed", "sent", "no_response", "rejected", "assessment", "interview", "second_interview", "offer", "accepted", "withdrawn"]) {
      expect(COLUMNS.filter((c) => (c.statuses as string[]).includes(s))).toHaveLength(1);
    }
  });
});
