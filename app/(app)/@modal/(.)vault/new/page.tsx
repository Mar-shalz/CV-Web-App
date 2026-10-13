import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { MODAL_ROUTES } from "@/components/ui/modal-routes";
import { RoleFormPage } from "@/components/vault/role-form-page";

export const metadata: Metadata = { title: "Add a role" };

export default async function NewRoleModal() {
  await requireReadyViewer();
  return (
    <RouteModal {...MODAL_ROUTES["/vault/new"]}>
      <RoleFormPage inModal />
    </RouteModal>
  );
}
