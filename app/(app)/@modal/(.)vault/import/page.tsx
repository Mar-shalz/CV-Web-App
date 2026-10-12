import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { RouteModal } from "@/components/ui/route-modal";
import { ImportPanel } from "@/components/vault/import-panel";

export const metadata: Metadata = { title: "Upload your CV" };

export default async function ImportModal() {
  await requireReadyViewer();
  return (
    <RouteModal title="Upload your CV" description="Got an old CV? Add it here, even a photo of the printout. We pull out what's useful, and you check it.">
      <ImportPanel />
    </RouteModal>
  );
}
