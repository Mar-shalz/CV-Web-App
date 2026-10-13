import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { MODAL_ROUTES } from "@/components/ui/modal-routes";
import { ImportPanel } from "@/components/vault/import-panel";

export const metadata: Metadata = { title: "Upload your CV" };

export default async function ImportModal() {
  await requireReadyViewer();
  return (
    <RouteModal {...MODAL_ROUTES["/vault/import"]}>
      <ImportPanel />
    </RouteModal>
  );
}
