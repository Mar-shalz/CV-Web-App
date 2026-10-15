import type { CvDoc } from "@/lib/cv/types";
import { DEMO_CV } from "./job";

/** The sample tailored CV for the design preview, with one number flag and one ownership flag. */
export function demoCvDoc(): CvDoc {
  return {
    format: "ng_graduate",
    profileVersion: "ng_graduate_v1",
    name: DEMO_CV.name,
    contactLine: DEMO_CV.contact,
    titleLine: DEMO_CV.title,
    titleFlags: [],
    // A suggested summary from their own, waiting for a yes (D-163).
    summary: { text: DEMO_CV.summary, sourceItemIds: ["i3", "i1"], flags: [], own: "Accounting graduate with SIWES banking experience. Good with Excel, reconciliations and customers.", confirmed: false },
    sections: [
      { key: "education", heading: "Education", kind: "entries", entries: [{ title: "B.Sc. Accounting", subtitle: "University of Lagos, Akoka, Lagos", dates: "2019 to 2024", detail: "Class of degree: Second Class Upper" }] },
      { key: "nysc", heading: "NYSC", kind: "entries", entries: [{ title: "National Youth Service Corps (NYSC)", subtitle: "Place of primary assignment: Finance Unit, Ministry of Works, Abeokuta, Ogun State", dates: "Nov 2025 to Oct 2026", detail: "Completed Oct 2026" }] },
      {
        key: "experience",
        heading: "Work experience",
        kind: "roles",
        roles: DEMO_CV.roles.map((r, ri) => ({
          roleId: `r${ri}`,
          title: r.title,
          organisation: r.org.split(", ")[0] ?? r.org,
          location: r.org.split(", ").slice(1).join(", ") || null,
          dates: r.dates,
          grade: null,
          bullets: r.bullets.map((b) => ({
            id: b.id,
            text: b.text,
            sourceItemIds: ["i1"],
            rewriteType: b.change,
            original: b.source.replace(/^"|"$/g, ""),
            sourceQuote: b.source.replace(/^"|"$/g, ""),
            flags: b.flag ? [{ type: b.flag.type, token: b.flag.type === "number" ? "20%" : "Led", message: b.flag.message, status: "open" as const }] : [],
            pending: b.change !== "kept" && !b.flag,
          })),
        })),
      },
      { key: "skills", heading: "Skills", kind: "lines", lines: ["Core skills: reconciliation, customer onboarding, financial reporting support", "Tools and software: Excel (macros, pivot tables), Sage 50", "Languages: English, Yoruba"] },
      { key: "referees", heading: "Referees", kind: "lines", lines: ["Available on request"] },
    ],
    include: { date_of_birth: false, gender: false, state_of_origin: false },
    fileBase: "Tolu_Adebayo_CV_Graduate_Trainee_Finance",
    jobTitle: "Graduate Trainee, Finance",
  };
}
