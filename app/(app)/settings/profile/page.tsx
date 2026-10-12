import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { getContact } from "@/lib/cv/data";
import { createClient } from "@/lib/supabase/server";
import { SettingsShell } from "@/components/settings/settings-shell";
import { ProfileForm } from "@/components/settings/settings-forms";

export const metadata: Metadata = { title: "Personal details" };

export default async function ProfilePage() {
  const viewer = await requireReadyViewer();
  const c = await getContact(viewer);
  let linkedin = c.linkedin ?? "";
  if (!viewer.preview && !linkedin) {
    const supabase = await createClient();
    const { data } = await supabase.from("profiles").select("linkedin_url").eq("user_id", viewer.id).maybeSingle();
    linkedin = data?.linkedin_url ?? "";
  }
  return (
    <SettingsShell title="Personal details" intro="These go at the top of every CV you make. Changes apply to new CVs, never to ones you've already sent.">
      <section className="rounded-[var(--radius-card)] border border-ink-150 bg-white p-5 shadow-card lg:p-6">
        <ProfileForm initial={{ full_name: c.fullName ?? "", phone: c.phone ?? "", contact_email: c.email ?? "", city: c.city ?? "", state: c.state ?? "", linkedin_url: linkedin }} />
      </section>
    </SettingsShell>
  );
}
