import type { CvBullet, CvDoc, CvFlag } from "./types";
import type { Flag } from "@/lib/rules/fact-lock";

export function findBullet(doc: CvDoc, bulletId: string): { bullet: CvBullet; roleId: string } | null {
  for (const s of doc.sections) {
    if (s.kind !== "roles") continue;
    for (const r of s.roles) {
      const b = r.bullets.find((x) => x.id === bulletId);
      if (b) return { bullet: b, roleId: r.roleId };
    }
  }
  return null;
}

/** New flags after an edit. A flag the user chose to keep stays kept if the same token is still there. */
export function mergeFlags(previous: CvFlag[], next: Flag[]): CvFlag[] {
  return next.map((f) => {
    const was = previous.find((p) => p.type === f.type && p.token === f.token);
    return { ...f, status: was?.status === "kept" ? "kept" : "open" };
  });
}

export function updateBullet(doc: CvDoc, bulletId: string, fn: (b: CvBullet) => CvBullet | null): CvDoc {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.kind !== "roles"
        ? s
        : {
            ...s,
            roles: s.roles.map((r) => ({ ...r, bullets: r.bullets.flatMap((b) => (b.id === bulletId ? (fn(b) ? [fn(b)!] : []) : [b])) })),
          },
    ),
  };
}

/** Splits "Excel (macros, pivot tables), Sage 50" on commas outside brackets. */
export function splitSkills(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Takes one skill out of the Skills section ("Core skills: a, b, c"), dropping empty lines (round 22). */
export function removeSkill(doc: CvDoc, skill: string): CvDoc {
  const want = skill.trim().toLowerCase();
  return {
    ...doc,
    sections: doc.sections
      .map((s) => {
        if (s.key !== "skills" || s.kind !== "lines") return s;
        const lines = s.lines
          .map((l) => {
            const at = l.indexOf(": ");
            const label = at > 0 && at < 30 ? l.slice(0, at) : null;
            const items = splitSkills(label ? l.slice(at + 2) : l).filter((x) => x.toLowerCase() !== want);
            return items.length ? (label ? `${label}: ${items.join(", ")}` : items.join(", ")) : null;
          })
          .filter((l): l is string => Boolean(l));
        return { ...s, lines };
      })
      .filter((s) => !(s.key === "skills" && s.kind === "lines" && !s.lines.length)),
  };
}

