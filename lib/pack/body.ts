// The application email's layout (founder, round 24): paragraphs separated by one blank
// line, and the sign-off written by code from the person's own details, so a model can
// never mistype their email address or phone number.

const SIGN_OFF = /\n[ \t]*(kind regards|best regards|warm regards|regards|yours faithfully|yours sincerely|sincerely|best wishes|many thanks|thank you),?[ \t]*(\n[\s\S]*)?$/i;

export function formatEmailBody(raw: string, sign: { name: string; phone: string | null; email: string | null }): string {
  const text = raw.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  const main = text.replace(SIGN_OFF, "").trim();
  // One blank line between paragraphs; lines inside a paragraph stay as written.
  const paragraphs = main
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const signature = ["Kind regards,", sign.name, sign.phone, sign.email].filter((l): l is string => Boolean(l && l.trim()));
  return `${paragraphs.join("\n\n")}\n\n${signature.join("\n")}`;
}
