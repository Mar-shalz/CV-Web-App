"use client";

import { useRouter } from "next/navigation";
import { RoleForm } from "./role-form";

/** In the modal, saving goes back to the page underneath and refreshes it; on its own page, to My experience. */
export function RoleFormPage({ inModal = false }: { inModal?: boolean }) {
  const router = useRouter();
  return (
    <RoleForm
      onDone={() => {
        if (inModal) {
          router.back();
          setTimeout(() => router.refresh(), 60);
        } else router.push("/vault");
      }}
    />
  );
}
