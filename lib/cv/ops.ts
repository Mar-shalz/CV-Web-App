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
