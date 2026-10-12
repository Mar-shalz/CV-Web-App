import Link from "next/link";
import { initials } from "@/lib/format";

export function Avatar({ name, size = 44 }: { name: string | null; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-800 font-semibold text-white ring-2 ring-white"
      style={{ width: size, height: size, fontSize: size * 0.34 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function UserChip({ name, stageLabel }: { name: string | null; stageLabel: string | null }) {
  return (
    <Link href="/settings" className="flex min-h-12 items-center gap-3 rounded-2xl py-1 pl-1 pr-1 transition-colors hover:bg-ink-75 xl:pr-3">
      <Avatar name={name} />
      <span className="hidden text-left leading-tight xl:block">
        <span className="block text-[0.9375rem] font-semibold text-ink-900">{name ?? "Your account"}</span>
        {stageLabel ? <span className="mt-0.5 block text-xs text-ink-500">{stageLabel}</span> : null}
      </span>
      <span className="sr-only">Account and settings</span>
    </Link>
  );
}
