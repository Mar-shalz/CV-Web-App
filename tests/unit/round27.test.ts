import { describe, expect, it } from "vitest";
import { repairCvRead, repairMonth } from "@/lib/vault/repair";
import { parseCv } from "@/lib/ai/tasks/parse-cv";

describe("CV read repair (round 27)", () => {
  it("turns common date forms into months", () => {
    expect(repairMonth("2023-03", false)).toBe("2023-03");
    expect(repairMonth("2023", false)).toBe("2023-01");
    expect(repairMonth("2023", true)).toBe("2023-12");
    expect(repairMonth("03/2022", false)).toBe("2022-03");
    expect(repairMonth("Aug. '22", false)).toBe("2022-08");
    expect(repairMonth("September 2021", true)).toBe("2021-09");
    expect(repairMonth("2023-3-15", false)).toBe("2023-03");
    expect(repairMonth("Present", true)).toBeNull();
    expect(repairMonth("2023-13", false)).toBeNull();
  });

  it("saves a read with small slips instead of failing it", () => {
    const slip = {
      is_cv: true,
      person: { full_name: "Ada Obi", phone: "0803", email: null, city: "Enugu", state: null, linkedin_url: null, portfolio_url: null, website_url: null },
      sensitive_found: { date_of_birth: "12/03/1999", gender: null, state_of_origin: null, marital_status_present: false, religion_present: false },
      roles: [
        {
          kind: "internship",
          organisation: "Kestrel Bank",
          title: "Industrial Trainee",
          location: null,
          start: "2023",
          end: "Nov 2023",
          is_current: false,
          grade: null,
          employment_type: "intern",
          items: Array.from({ length: 25 }, (_, n) => ({ text: `Attended to customers at the desk, line ${n} `.repeat(n === 0 ? 30 : 1), source_quote: "Attended to customers", metrics: [{ value: 40, unit: "customers", approximate: "yes" }], ownership: "assisted", skills: [] })),
        },
      ],
      skills: ["Excel", "", "QuickBooks"],
      summary: "x".repeat(2000),
      referees: [{ name: "Mr Emeka Nwosu", role: null }, { name: "" }],
    };
    expect(parseCv.output.safeParse(slip).success).toBe(false);
    const fixed = parseCv.output.safeParse(repairCvRead(slip));
    expect(fixed.success).toBe(true);
    const d = fixed.data!;
    expect(d.roles[0]?.kind).toBe("job");
    expect(d.roles[0]?.start).toBe("2023-01");
    expect(d.roles[0]?.end).toBe("2023-11");
    expect(d.roles[0]?.employment_type).toBeNull();
    expect(d.roles[0]?.items).toHaveLength(20);
    expect(d.roles[0]?.items[0]?.ownership).toBe("did");
    expect(d.roles[0]?.items[0]?.metrics[0]?.approximate).toBe(false);
    expect(d.sensitive_found.date_of_birth).toBeNull();
    expect(d.skills).toEqual(["Excel", "QuickBooks"]);
    expect(d.summary).toHaveLength(1500);
    expect(d.referees).toHaveLength(1);
  });
});
