/**
 * Fills a dictated subject format with the applicant's real details. Unknown
 * placeholders are left visible so the person notices and fills them in.
 */
export function fillSubject(format: string | null, v: { fullName: string; role: string; course: string | null }): string {
  if (!format?.trim()) return `Application: ${v.role}, ${v.fullName}`;
  return format
    .replace(/[[{(<]\s*(full\s*name|your\s*name|name|surname\s*first\s*name|applicant'?s?\s*name)\s*[\]})>]/gi, v.fullName)
    .replace(/[[{(<]\s*(position|role|job\s*title|post|vacancy)\s*(applied\s*for)?\s*[\]})>]/gi, v.role)
    .replace(/[[{(<]\s*(course|course\s*of\s*study|discipline)\s*[\]})>]/gi, v.course ?? "[Course]");
}

/** True when a subject still has a [placeholder] in it. */
export const hasPlaceholder = (s: string) => /[[{<][^\]}>]{2,30}[\]}>]/.test(s);
