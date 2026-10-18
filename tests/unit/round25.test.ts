import { describe, expect, it, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { jobTermsTheyHave, reviewDraft, reviewSummary } from "@/lib/cv/quality";
import { asksForLetter, buildLetter, cleanParagraphs, letterDate, letterFileBase, letterText } from "@/lib/pack/letter";
import { sameItem, sameRole } from "@/lib/vault/save";
import { googleDirectFor, readPending, startGoogle } from "@/lib/auth/google";

const good = {
  title_line: "Accounting Graduate | Reconciliation and Excel",
  summary: {
    text: "Accounting graduate (B.Sc., Second Class Upper) with hands-on retail banking and public sector finance experience from SIWES and NYSC. Opened about 15 customer accounts a day at a bank branch, checking every customer's documents, and prepared a state ministry finance unit's monthly expense summaries matched to payment vouchers. Skilled in reconciliation, customer onboarding and Excel, including pivot tables. Brings accuracy, steady customer service and a working grasp of banking procedures to a graduate finance role.",
  },
  experience: [
    {
      role_id: "r1",
      bullets: [
        { text: "Prepared the finance unit's monthly expense summaries in Excel and reconciled each one to its payment vouchers before month end" },
        { text: "Opened about 15 customer accounts a day at the branch, checking every customer's documents against bank requirements first" },
        { text: "Answered customer questions at the account opening desk and passed complaints to the right officer the same day" },
      ],
    },
  ],
  skills: { tools: ["Excel"], professional: ["Reconciliation"], languages: ["English"] },
};
const ctx = { requirements: ["Strong Excel skills", "Experience with reconciliation"], skills: ["Excel", "Reconciliation", "Sage 50"], itemsPerRole: { r1: 3 } };

describe("CV quality review (D-185)", () => {
  it("passes a draft that meets the standard", () => {
    expect(reviewDraft(good, ctx)).toEqual([]);
  });

  it("finds weak openers, first person, repeated verbs and missing job terms", () => {
    const bad = {
      ...good,
      experience: [{ role_id: "r1", bullets: [{ text: "Responsible for preparing summaries every month for the finance unit at the ministry" }, { text: "Prepared reports." }, { text: "Prepared my team's weekly figures for the unit head at the ministry office" }] }],
      skills: { tools: [], professional: [], languages: [] },
      summary: { text: "I am seeking an opportunity to grow." },
      title_line: "Graduate",
    };
    const issues = reviewDraft(bad, { ...ctx, itemsPerRole: { r1: 5 } }).join("\n");
    expect(issues).toMatch(/opens weakly/);
    expect(issues).toMatch(/first person/);
    expect(issues).toMatch(/Two bullets in a row start with "prepared"/);
    expect(issues).toMatch(/thin/);
    expect(issues).toMatch(/End them all the same way/);
    expect(issues).toMatch(/"Excel", "Reconciliation"/);
    expect(issues).toMatch(/says what the person wants/);
  });

  it("catches claims the items don't state (round 25 live draft)", () => {
    const itemText = {
      i2: "Prepared bank reconciliation schedules for 6 client companies Audit Assistant Ndukwe & Partners",
      i3: "Drafted audit working papers reviewed by the senior auditor Audit Assistant Ndukwe & Partners",
      i4: "Attended to around 40 customers daily at the customer service desk Industrial Trainee (SIWES) Kestrel Bank",
      i1: "Vouched about 300 expense transactions a month to supporting documents Audit Assistant Ndukwe & Partners",
    };
    const draft = {
      ...good,
      summary: { text: `${good.summary.text} Ready to deliver detailed financial support and drive operational efficiency.` },
      experience: [
        {
          role_id: "r1",
          bullets: [
            { text: "Drafted audit working papers reviewed by the senior auditor to ensure full compliance with audit standards", source_item_ids: ["i3"] },
            { text: "Vouched about 300 expense transactions a month to supporting documents during client reviews", source_item_ids: ["i1"] },
            { text: "Prepared bank reconciliation schedules for 6 client companies every month in the audit team", source_item_ids: ["i2"] },
          ],
        },
        { role_id: "r2", bullets: [{ text: "Delivered customer service to around 40 daily account holders at the active bank customer service desk", source_item_ids: ["i4"] }] },
      ],
    };
    const issues = reviewDraft(draft, { ...ctx, itemsPerRole: { r1: 3, r2: 1 }, itemText, evidence: Object.values(itemText).join(" ") }).join("\n");
    expect(issues).toMatch(/adds a purpose its items don't state \("to ensure full compliance/);
    expect(issues).toMatch(/adds words its items don't support \((?=.*account)(?=.*active)/);
    expect(issues).not.toMatch(/Vouched about 300/);
    expect(issues).toMatch(/stock phrase \("(drive operational efficiency|ready to deliver)"\)/i);
  });

  it("only asks for job terms the person has", () => {
    expect(jobTermsTheyHave(["Strong Excel skills", "IFRS knowledge"], ["Excel", "Sage 50", "excel"])).toEqual(["Excel"]);
    expect(reviewSummary("")).toEqual([]);
  });
});

describe("cover letter (D-186)", () => {
  it("knows when a post asks for one", () => {
    expect(asksForLetter(["CV", "Cover letter"], null)).toBe(true);
    expect(asksForLetter([], "Send your CV and application letter to jobs@x.com")).toBe(true);
    expect(asksForLetter(["CV"], "Send your CV to jobs@x.com")).toBe(false);
  });

  it("keeps only the body paragraphs the model wrote", () => {
    expect(cleanParagraphs(["Dear Hiring Manager,", "I am applying — with care.\n\nSecond paragraph here.", "Yours faithfully,", "Tolu Adebayo"], "Tolu Adebayo")).toEqual(["I am applying, with care.", "Second paragraph here."]);
  });

  it("writes the details itself, in the format's conventions", () => {
    const l = buildLetter({ paragraphs: ["One.", "Two."], name: "Tolu Adebayo", phone: "+234 803 000 0000", email: "t@example.com", place: "Yaba, Lagos", employer: "Northbridge Bank", role: "Graduate Trainee", today: "2026-10-18", format: "ng_graduate" });
    expect(l.heading).toBe("APPLICATION FOR THE POSITION OF GRADUATE TRAINEE");
    expect(l.closing).toBe("Yours faithfully,");
    expect(l.recipient).toEqual(["The Hiring Manager", "Northbridge Bank"]);
    expect(l.date).toBe("18 October 2026");
    const us = buildLetter({ paragraphs: ["One."], name: "A B", phone: null, email: null, place: null, employer: "the employer", role: "Analyst", today: "2026-10-18", format: "us" });
    expect(us.closing).toBe("Sincerely,");
    expect(us.recipient).toEqual(["The Hiring Manager"]);
    expect(letterDate("2026-03-05", true)).toBe("March 5, 2026");
    expect(letterText(l)).toContain("Dear Hiring Manager,\n\nAPPLICATION FOR THE POSITION OF GRADUATE TRAINEE\n\nOne.");
    expect(letterFileBase("Tolu_Adebayo_CV_Graduate_Trainee")).toBe("Tolu_Adebayo_Cover_Letter_Graduate_Trainee");
  });
});

describe("adding a second CV (D-184)", () => {
  it("spots the same role however it is written", () => {
    expect(sameRole({ kind: "job", organisation: "Northline Bank Ltd.", title: "SIWES Intern" }, { kind: "job", organisation: "Northline bank", title: "SIWES intern" })).toBe(true);
    expect(sameRole({ kind: "job", organisation: "Northline Bank", title: "Intern" }, { kind: "volunteer", organisation: "Northline Bank", title: "Intern" })).toBe(false);
    expect(sameRole({ kind: "job", organisation: null, title: null }, { kind: "job", organisation: null, title: null })).toBe(false);
  });

  it("spots an item already saved", () => {
    const saved = [{ text: "Opened about 15 accounts a day.", source_quote: "I opened around 15 accounts daily" }];
    expect(sameItem(saved, { text: "opened about 15 accounts a day", source_quote: "x" })).toBe(true);
    expect(sameItem(saved, { text: "Checked documents", source_quote: "I opened around 15 accounts daily" })).toBe(true);
    expect(sameItem(saved, { text: "Checked documents", source_quote: "checked documents" })).toBe(false);
  });
});

describe("Google sign in on our own address (D-187)", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "test-secret";
    process.env.APP_URL = "https://app.example.com";
  });

  it("is used only on the app's own address and locally", () => {
    expect(googleDirectFor("https://app.example.com")).toBe(true);
    expect(googleDirectFor("http://localhost:3000")).toBe(true);
    expect(googleDirectFor("https://preview-123.vercel.app")).toBe(false);
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(googleDirectFor("https://app.example.com")).toBe(false);
  });

  it("sends Google our callback, a hashed nonce and PKCE, and checks the state", () => {
    const { url, cookie } = startGoogle("https://app.example.com", "app");
    const q = new URL(url).searchParams;
    const pending = JSON.parse(cookie) as { state: string; nonce: string; verifier: string };
    expect(q.get("redirect_uri")).toBe("https://app.example.com/auth/google");
    expect(q.get("nonce")).toBe(createHash("sha256").update(pending.nonce).digest("hex"));
    expect(q.get("code_challenge")).toBe(createHash("sha256").update(pending.verifier).digest("base64url"));
    expect(readPending(cookie, pending.state)?.dest).toBe("app");
    expect(readPending(cookie, "forged")).toBeNull();
    expect(readPending(undefined, pending.state)).toBeNull();
  });
});

describe("mock interview (D-189)", async () => {
  const { newMock, fallbackNext, cvChecks } = await import("@/lib/shortlist/mock");
  const lines = [
    { id: "b1", role: "SIWES Intern, Northline Bank", text: "Opened about 15 customer accounts a day", original: "opened about 15 accounts a day", sourceQuote: null },
    { id: "b2", role: "NYSC, Ministry of Works", text: "Prepared monthly expense summaries matched to vouchers", original: "prepared summaries", sourceQuote: null },
  ];

  it("opens with Tell me about yourself and runs to the configured length", () => {
    const m = newMock();
    expect(m.turns).toHaveLength(1);
    expect(m.turns[0]?.kind).toBe("intro");
    expect(m.total).toBe(7);
  });

  it("falls back to the next likely question not yet asked, then CV lines", () => {
    const m = newMock();
    const questions = [
      { id: "q0", question: "Tell me about yourself.", why: "", bulletId: null, bulletText: null, kind: "intro" as const },
      { id: "q1", question: "Walk me through the 15 accounts a day.", why: "w", bulletId: "b1", bulletText: lines[0]!.text, kind: "defend_cv" as const },
    ];
    expect(fallbackNext(m, { questions, lines }).question).toBe("Walk me through the 15 accounts a day.");
    const asked = { ...m, turns: [...m.turns, { ...m.turns[0]!, id: "m2", question: "Walk me through the 15 accounts a day.", bulletId: "b1" }] };
    expect(fallbackNext(asked, { questions, lines }).bulletId).toBe("b2");
  });

  it("checks numbers in an answer against the CV", () => {
    expect(cvChecks("I opened about 15 accounts a day", "b1", lines)).toEqual([]);
    expect(cvChecks("I opened 40 accounts a day", "b1", lines)[0]).toMatch(/You said 40/);
    expect(cvChecks("I handled 300 files", null, lines)[0]).toMatch(/You said 300/);
  });
});
