import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { RoleFormPage } from "@/components/vault/role-form-page";

export const metadata: Metadata = { title: "Add a role" };

export default async function NewRoleModal() {
  await requireReadyViewer();
  return (
    <RouteModal title="Add a role" description="A job, SIWES, NYSC, a campus role, a project, a degree or a certificate. Then add what you did there.">
      <RoleFormPage />
    </RouteModal>
  );
}
