import { StatusPill } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";
import type { Plan } from "@/lib/admin/users";

export function PlanPill({ plan }: { plan: Plan }) {
  const tone = plan.kind === "paid" || plan.kind === "free_access" ? "good" : plan.kind === "trial" ? "warn" : "none";
  return <StatusPill status={tone} label={plan.until && plan.kind !== "trial_ended" ? `${plan.label} until ${formatDate(plan.until)}` : plan.label} />;
}

export function lastSeen(iso: string | null): string {
  if (!iso) return "Not yet";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 14 ? `${days} days ago` : formatDate(iso);
}
