// Who can do what in the back office. Pure, so it is unit tested.
export const ADMIN_ROLES = ["owner", "reviewer", "support", "finance"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const PERMISSIONS = [
  "overview",
  "users",
  // Full emails, usage, pause and delete accounts. Owner only.
  "users.manage",
  "waitlist",
  "payments",
  "payments.refund",
  // Charging on or off, and the amounts (D-196). Owner only: it is a money decision.
  "payments.pricing",
  "reviews",
  "reviews.resolve",
  "rules",
  "rules.publish",
  "ai",
  // Company records built by job checks, and what our own records saved (D-200).
  "companies",
  "audit",
  "team",
  "messages",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<AdminRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  reviewer: ["overview", "reviews", "reviews.resolve", "rules", "ai", "companies"],
  support: ["overview", "users", "waitlist", "reviews", "messages"],
  finance: ["overview", "payments", "payments.refund", "ai"],
};

export function can(role: AdminRole | null | undefined, permission: Permission): boolean {
  return role ? MATRIX[role].includes(permission) : false;
}

export const ROLE_LABELS: Record<AdminRole, { label: string; body: string }> = {
  owner: { label: "Owner", body: "Everything, including full emails, pausing and deleting accounts, team access, publishing rules and refunds." },
  reviewer: { label: "Reviewer", body: "Truth reports, CV quality samples, rules and AI quality." },
  support: { label: "Support", body: "Users and the waitlist, with emails masked. Can read reports and send messages to users." },
  finance: { label: "Finance", body: "Payments, refunds and AI cost." },
};

/** Masks an email for staff screens: to•••@gm•••.com */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "Unknown";
  const [user, domain] = email.split("@");
  if (!user || !domain) return "Hidden";
  const [host, ...tld] = domain.split(".");
  return `${user.slice(0, 2)}•••@${(host ?? "").slice(0, 2)}•••${tld.length ? "." + tld.join(".") : ""}`;
}
