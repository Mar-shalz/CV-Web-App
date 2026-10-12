import type { ReactNode } from "react";
import { FieldError } from "@/components/ui/field";

/** A large, fully tappable checkbox row. The whole row is the label. */
export function CheckRow({
  name,
  title,
  children,
  required,
  error,
  checked,
  onChange,
}: {
  name: string;
  title: ReactNode;
  children?: ReactNode;
  required?: boolean;
  error?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = `chk-${name}`;
  return (
    <div>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-colors duration-200 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-brand-500 ${
          error ? "border-flag-600 bg-flag-50/40" : checked ? "border-brand-500 bg-brand-50/70" : "border-transparent bg-ink-75 hover:bg-ink-100"
        }`}
      >
        <input
          id={id}
          name={name}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-6 shrink-0 cursor-pointer appearance-none rounded-lg border-2 border-ink-300 bg-white bg-center bg-no-repeat transition-colors checked:border-brand-600 checked:bg-brand-600 checked:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%223%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><path%20d=%22m5%2012.5%204.5%204.5L19%207.5%22/></svg>')] focus:outline-none"
        />
        <span className="min-w-0">
          <span className="block text-[0.9375rem] font-semibold leading-6 text-ink-900">
            {title}
            {required ? <span className="sr-only"> (required)</span> : <span className="ml-1.5 text-xs font-medium text-ink-500">Optional</span>}
          </span>
          {children ? <span className="mt-1 block text-[0.8125rem] leading-5 text-ink-600">{children}</span> : null}
        </span>
      </label>
      {error ? (
        <div className="mt-1.5 px-1">
          <FieldError id={`${id}-error`}>{error}</FieldError>
        </div>
      ) : null}
    </div>
  );
}
