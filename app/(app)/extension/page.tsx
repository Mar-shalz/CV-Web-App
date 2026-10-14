import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { APP } from "@/lib/config";
import { CopyButton } from "@/components/ui/copy-button";
import { Global, DocumentDownload, ShieldTick, Magicpen, ShieldSearch, TickCircle } from "@/components/icons";

export const metadata: Metadata = { title: "Chrome Extension" };

const STEPS = [
  { title: "Download the extension", body: "It's a small zip file (about 30KB)." },
  { title: "Unzip it", body: "Double click the file. You get a folder called receipts-extension." },
  { title: "Open Chrome's extensions page", body: "Type this in the address bar, then press Enter:", copy: "chrome://extensions" },
  { title: "Turn on Developer mode", body: "It's the switch at the top right of that page." },
  { title: "Click Load unpacked", body: "Choose the receipts-extension folder." },
  { title: "Pin it", body: "Click the puzzle piece next to the address bar, then the pin beside Receipts." },
] as const;

/**
 * The browser extension (D-133, D-138): what it does and how to add it. Until it is in the
 * Chrome Web Store, it installs from a download, free, the way testers try any extension.
 */
export default async function ExtensionPage() {
  await requireReadyViewer();
  const store = (APP as { chrome_extension_store_url?: string }).chrome_extension_store_url;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header className="animate-rise">
        <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Global size={30} variant="bulk" />
        </span>
        <h1 className="mt-4 font-display text-[1.75rem] font-semibold leading-9 tracking-[-0.03em] text-ink-900 lg:text-[2.125rem] lg:leading-10">Chrome Extension</h1>
        <p className="mt-1 max-w-2xl text-[0.9375rem] leading-6 text-ink-600">See a job on LinkedIn, a company site or any job board? One click sends it here: we check it&apos;s real, see if you fit, and tailor your CV. It saves to your account, so it&apos;s on your phone too.</p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Magicpen, title: "Tailor my CV to this job", body: "From the job you're looking at, in one click." },
          { icon: ShieldSearch, title: "Is this job real?", body: "Check the company and the post before you apply." },
          { icon: ShieldTick, title: "Private", body: "It reads the page only when you click it. Nothing else." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-4 shadow-card">
            <Icon size={24} variant="bulk" className="text-brand-600" />
            <p className="mt-2 text-sm font-semibold text-ink-900">{title}</p>
            <p className="mt-0.5 text-[0.8125rem] leading-5 text-ink-600">{body}</p>
          </div>
        ))}
      </section>

      {store ? (
        <a href={store} target="_blank" rel="noopener noreferrer" className="cta-sheen inline-flex min-h-12 items-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
          <Global size={20} />
          Add to Chrome
        </a>
      ) : (
        <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-4">
            <div>
              <h2 className="text-[0.9375rem] font-semibold text-ink-900">Add It to Chrome on a Laptop</h2>
              <p className="text-[0.8125rem] text-ink-500">Takes about two minutes. Free.</p>
            </div>
            <a href="/receipts-extension.zip" download className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
              <DocumentDownload size={20} />
              Download the extension
            </a>
          </div>
          <ol className="divide-y divide-ink-100">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3.5 px-5 py-3.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900">{s.title}</p>
                  <p className="text-[0.8125rem] leading-5 text-ink-600">{s.body}</p>
                  {"copy" in s ? (
                    <div className="mt-2 flex items-center gap-2">
                      <code className="rounded-lg bg-ink-75 px-2.5 py-1.5 font-mono text-[0.8125rem] text-ink-900">{s.copy}</code>
                      <CopyButton value={s.copy} label="address" />
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="flex items-start gap-2 border-t border-ink-100 px-5 py-3 text-xs leading-5 text-ink-500">
            <TickCircle size={16} variant="bulk" className="mt-px shrink-0 text-proof-600" />
            Chrome may show a note about Developer mode extensions. That&apos;s normal for extensions added this way. Phones don&apos;t run extensions: on your phone, share a job to the app from LinkedIn, WhatsApp or your browser instead.
          </p>
        </section>
      )}
    </div>
  );
}
