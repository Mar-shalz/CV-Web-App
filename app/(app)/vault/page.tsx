import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { Briefcase } from "@/components/icons";

export const metadata: Metadata = { title: "My experience" };

export default function VaultPage() {
  return (
    <ComingNext
      title="My experience"
      intro="Everything your CV is built from: your roles, your wins and your own words. We never add anything you didn't tell us."
      slice="Slice 1"
      icon={<Briefcase size={22} variant="bulk" />}
      points={[
        "Upload your old CV as a PDF, a Word file or a photo of the printout.",
        "Check each role and achievement we find. Nothing is used until you confirm it.",
        "Add or edit anything yourself, any time.",
      ]}
    />
  );
}
