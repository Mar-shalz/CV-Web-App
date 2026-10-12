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
    summary: { text: DEMO_CV.summary, sourceItemIds: ["i3", "i1"], flags: [] },
    sections: [
      { key: "education", heading: "Education", kind: "lines", lines: DEMO_CV.sections[0]!.lines },
      { key: "nysc", heading: "NYSC", kind: "lines", lines: DEMO_CV.sections[1]!.lines },
      {
        key: "experience",
        heading: "Experience",
        kind: "roles",
        roles: DEMO_CV.roles.map((r, ri) => ({
          roleId: `r${ri}`,
          title: r.title,
          organisation: r.org,
          location: null,
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
          })),
        })),
      },
      { key: "skills", heading: "Skills", kind: "lines", lines: DEMO_CV.skills.split(" · ") },
      { key: "referees", heading: "Referees", kind: "lines", lines: ["Available on request"] },
    ],
    include: { date_of_birth: false, gender: false, state_of_origin: false },
    fileBase: "Tolu_Adebayo_CV_Graduate_Trainee_Finance",
    jobTitle: "Graduate Trainee, Finance",
  };
}
