import { Danger } from "@/components/icons";

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex animate-rise items-start gap-2.5 rounded-2xl bg-flag-50 px-4 py-3 text-sm font-medium leading-5 text-flag-700">
      <Danger size={18} className="mt-px shrink-0" />
      <p>{message}</p>
    </div>
  );
}
