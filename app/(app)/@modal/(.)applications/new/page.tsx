import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { LogForm } from "@/components/applications/log-form";

export const metadata: Metadata = { title: "Add an application" };

export default async function LogApplicationModal() {
  await requireReadyViewer();
  return (
    <RouteModal title="Add an application you already sent" description="Made your CV somewhere else? Keep it here with the job, and we'll check in and help you prepare when they reply.">
      <LogForm inModal />
    </RouteModal>
  );
}
