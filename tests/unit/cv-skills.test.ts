import { describe, expect, it } from "vitest";
import { removeSkill, splitSkills } from "@/lib/cv/ops";
import { demoCvDoc } from "@/lib/demo/cv-doc";

describe("removing a skill from a CV (round 22)", () => {
  it("keeps bracketed detail with its skill", () => {
    expect(splitSkills("Excel (macros, pivot tables), Sage 50")).toEqual(["Excel (macros, pivot tables)", "Sage 50"]);
  });

  it("takes it out of its line and keeps the rest", () => {
    const doc = removeSkill(demoCvDoc(), "Sage 50");
    const skills = doc.sections.find((s) => s.key === "skills");
    expect(skills?.kind === "lines" && skills.lines).toContain("Tools and software: Excel (macros, pivot tables)");
  });

  it("drops a line, then the section, when nothing is left", () => {
    let doc = removeSkill(demoCvDoc(), "english");
    doc = removeSkill(doc, "Yoruba");
    const skills = doc.sections.find((s) => s.key === "skills");
    expect(skills?.kind === "lines" && skills.lines.some((l) => l.startsWith("Languages"))).toBe(false);
  });
});
