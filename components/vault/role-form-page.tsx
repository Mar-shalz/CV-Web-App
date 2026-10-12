"use client";

import { useRouter } from "next/navigation";
import { RoleForm } from "./role-form";

export function RoleFormPage() {
  const router = useRouter();
  return <RoleForm onDone={() => router.push("/vault")} />;
}
