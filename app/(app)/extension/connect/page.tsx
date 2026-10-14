import type { Metadata } from "next";
import { requireReadyViewer } from "@/lib/auth/viewer";
import { ConnectExtension } from "@/components/extension/connect";

export const metadata: Metadata = { title: "Connect the Extension" };

export default async function ConnectPage() {
  const viewer = await requireReadyViewer();
  return (
    <div className="mx-auto max-w-xl">
      <ConnectExtension name={viewer.fullName ?? viewer.email} />
    </div>
  );
}
