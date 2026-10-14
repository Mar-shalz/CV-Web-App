import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { MODAL_ROUTES } from "@/components/ui/modal-routes";
import { LogForm } from "@/components/applications/log-form";

export const metadata: Metadata = { title: "Add an Application" };

export default async function LogApplicationModal() {
  await requireReadyViewer();
  return (
    <RouteModal {...MODAL_ROUTES["/applications/new"]}>
      <LogForm inModal />
    </RouteModal>
  );
}
