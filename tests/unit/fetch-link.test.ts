import { describe, expect, it } from "vitest";
import { htmlToText, isPrivateAddress } from "@/lib/jobs/fetch-link";

describe("SSRF guard", () => {
  it("blocks private, loopback and link local addresses", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "172.20.1.1", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
  it("allows public addresses", () => {
    for (const ip of ["102.89.1.1", "8.8.8.8", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
});

describe("htmlToText", () => {
  it("prefers a JobPosting in JSON-LD", () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","title":"Graduate Trainee","hiringOrganization":{"name":"Acme"},"description":"<p>Send your CV</p>"}</script><body>noise</body>`;
    expect(htmlToText(html)).toBe("Graduate Trainee\nEmployer: Acme\nSend your CV");
  });
  it("drops scripts and tags", () => {
    expect(htmlToText("<script>alert(1)</script><p>Hello &amp; welcome</p>")).toBe("Hello & welcome");
  });
});
