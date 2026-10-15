import { describe, expect, it } from "vitest";
import { paymentRequest } from "@/lib/rules/scam/layer1";

// D-151: the applicant being asked to pay is a red flag; salary and "no fee" lines are not.
describe("payment requests vs pay", () => {
  it.each([
    "Successful candidates will pay a registration fee of N5,000 for the training.",
    "Pay ₦3,500 to the account below for your medical test.",
    "A form fee of 2,000 naira applies.",
    "Transfer N10,000 to 0123456789 (Access Bank) to secure your slot.",
    "Applicants are required to make a payment of N2,500 for processing.",
    "Send N5000 for your ID card before the interview.",
  ])("flags: %s", (line) => {
    expect(paymentRequest(line)).not.toBeNull();
  });

  it.each([
    "Pay: ₦150,000 - ₦200,000 monthly.",
    "Salary: N250,000 per month plus allowances.",
    "We offer competitive pay, HMO and pension.",
    "Monthly pay of 180,000 naira, paid on the 25th.",
    "There is no application fee. Never pay anyone to get a job with us.",
    "Training is free of charge and provided by the company.",
    "We pay transport allowance of N20,000 to trainees.",
    "Our recruitment process is free. We do not charge any fee.",
  ])("ignores: %s", (line) => {
    expect(paymentRequest(line)).toBeNull();
  });
});
