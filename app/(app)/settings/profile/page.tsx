import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getContact } from "@/lib/cv/data";
import phoneCodes from "@/config/lists/phone_codes.json";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ProfileForm } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Personal details" };

const PHONE_CODES = phoneCodes;

export default async function ProfilePage() {
  const viewer = await requireReadyViewer();
  const c = await getContact(viewer);
  return (
    <SettingsShell title="Personal details" intro="These go at the top of every CV you make. Changes apply to new CVs, never to ones you've already sent. If you uploaded a CV, we filled in what we found.">
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        <ProfileForm
          codes={PHONE_CODES.codes}
          initial={{ full_name: c.fullName ?? "", phone: c.phone ?? "", contact_email: c.email ?? "", city: c.city ?? "", state: c.state ?? "", linkedin_url: c.linkedin ?? "", portfolio_url: c.portfolio ?? "", website_url: c.website ?? "" }}
        />
      </section>
    </SettingsShell>
  );
}
