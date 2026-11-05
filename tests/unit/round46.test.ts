import { describe, expect, it } from "vitest";
import { isApplicationForm } from "../../extension/autofill.js";

// Founder round 46 (D-217): the extension offers "Fill this form" on application forms only.
const f = (label: string, type = "text", name = "") => ({ key: label, label, type, name, autocomplete: null, placeholder: "" });

describe("isApplicationForm", () => {
  it("knows an application form", () => {
    expect(isApplicationForm([f("First name"), f("Last name"), f("Email", "email"), f("Phone", "tel"), f("Resume/CV", "file")])).toBe(true);
    expect(isApplicationForm([f("", "text", "applicant_email"), f("Upload", "file")])).toBe(true);
  });

  it("ignores a job board's search boxes", () => {
    expect(isApplicationForm([f("Search by title, skill, or company"), f("City, state, or zip code")])).toBe(false);
  });

  it("ignores a lone newsletter box and an empty page", () => {
    expect(isApplicationForm([f("Get job alerts by email", "email")])).toBe(false);
    expect(isApplicationForm([])).toBe(false);
  });
});
