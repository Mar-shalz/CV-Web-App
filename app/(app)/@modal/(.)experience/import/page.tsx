import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { MODAL_ROUTES } from "@/components/ui/modal-routes";
import { ImportPanel } from "@/components/vault/import-panel";
import { getVault } from "@/lib/vault/data";

export const metadata: Metadata = { title: "Upload your CV" };

export default async function ImportModal() {
  const viewer = await requireReadyViewer();
  // A second CV asks whether to replace what's saved or add to it (D-184).
  const vault = await getVault(viewer);
  return (
    <RouteModal {...MODAL_ROUTES["/experience/import"]}>
      <ImportPanel savedRoles={vault.roles.length} />
    </RouteModal>
  );
}
