import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { Crown1 } from "@/components/icons";
import { PRICES, LIMITS } from "@/lib/config";
import { formatNaira } from "@/lib/format";

export const metadata: Metadata = { title: "Job hunt pass" };

export default function PassPage() {
  const pass = PRICES.products.job_hunt_30d;
  return (
    <ComingNext
      title="Job hunt pass"
      intro={`${formatNaira(pass.amount_kobo)} for ${pass.days} days. Pay once by card, bank transfer or USSD. No auto renewal.`}
      slice="Slice 9"
      icon={<Crown1 size={22} variant="bulk" />}
      points={[
        "Free forever: your vault, eligibility and scam checks, your application log and check ins.",
        `The pass adds tailored CVs, application packs and interview prep. The free trial covers ${LIMITS.trial.days} days and up to ${LIMITS.trial.tailored_cv_cap} CVs.`,
        `Refund within ${PRICES.refund_rule.within_days} days if you packed fewer than ${PRICES.refund_rule.max_packed_applications + 1} applications.`,
      ]}
    />
  );
}
