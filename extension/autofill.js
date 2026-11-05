// Filling an employer's application form (founder round 35, D-206). Both functions run
// inside the employer's page through chrome.scripting, so each is self-contained. We fill
// what the person's own details and CV say, mark the written answers for them to read, and
// never press Submit or touch date of birth, gender, state of origin or similar (the app
// leaves those out). A field the person already typed in is never changed.

/** The form's fields, each tagged so the fill step finds it again. */
export function scanFormFields() {
  const text = (el) => (el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : "");
  const labelFor = (el) => {
    const aria = el.getAttribute("aria-label");
    if (aria) return aria;
    const by = el.getAttribute("aria-labelledby");
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => text(document.getElementById(id)))
        .join(" ")
        .trim();
      if (t) return t;
    }
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l && text(l)) return text(l);
    }
    const wrap = el.closest("label");
    if (wrap && text(wrap)) return text(wrap);
    // The nearest text before the field in its group (Workday, Greenhouse and Google Forms style).
    let box = el.parentElement;
    for (let i = 0; i < 4 && box; i++, box = box.parentElement) {
      const heading = box.querySelector("label, legend, [role=heading], .label, [data-automation-id*=label]");
      if (heading && heading !== el && text(heading)) return text(heading);
    }
    return el.getAttribute("placeholder") || el.name || "";
  };
  const skip = ["hidden", "submit", "button", "reset", "image", "password", "checkbox", "radio", "search", "range", "color", "date", "datetime-local", "month", "week", "time"];
  const out = [];
  let n = 0;
  for (const el of document.querySelectorAll("input, textarea")) {
    const type = el.tagName === "TEXTAREA" ? "textarea" : (el.type || "text").toLowerCase();
    if (skip.includes(type) || el.disabled || el.readOnly) continue;
    const r = el.getBoundingClientRect();
    if (type !== "file" && r.width === 0 && r.height === 0) continue;
    if (!el.dataset.rcptKey) el.dataset.rcptKey = `f${Math.random().toString(36).slice(2, 8)}${n++}`;
    out.push({ key: el.dataset.rcptKey, label: labelFor(el).slice(0, 400), type, autocomplete: el.getAttribute("autocomplete"), name: (el.name || el.id || "").slice(0, 120), placeholder: (el.placeholder || "").slice(0, 200) });
    if (out.length >= 80) break;
  }
  return out;
}

/**
 * An application form, not a job board's search box or a newsletter sign up: two or more
 * fields for personal details, or a CV upload plus one (founder round 46, D-217).
 */
export function isApplicationForm(fields) {
  const personal = /name|e-?mail|phone|mobile|linkedin|resume|\bcv\b|cover/i;
  return fields.filter((f) => ["file", "email", "tel"].includes(f.type) || personal.test(`${f.label} ${f.name} ${f.autocomplete || ""} ${f.placeholder || ""}`)).length >= 2;
}

/** Puts each value in its field the way typing would, attaches the CV, and marks what was filled. */
export function fillFormFields(values, file) {
  let filled = 0;
  let review = 0;
  const type = (el, v) => {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
    for (const e of ["input", "change", "blur"]) el.dispatchEvent(new Event(e, { bubbles: true }));
  };
  for (const v of values) {
    const el = document.querySelector(`[data-rcpt-key="${CSS.escape(v.key)}"]`);
    if (!el) continue;
    if (v.kind === "cv_file") {
      if (!file || (el.files && el.files.length)) continue;
      const bytes = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], file.name, { type: file.mime }));
      el.files = dt.files;
      for (const e of ["input", "change"]) el.dispatchEvent(new Event(e, { bubbles: true }));
    } else {
      if (el.value && el.value.trim()) continue;
      type(el, v.value);
    }
    el.style.outline = v.review ? "3px solid #d97706" : "2px solid #16a34a";
    el.style.outlineOffset = "2px";
    if (v.review) {
      el.title = "Drafted from your CV. Read it and make it yours before you submit.";
      review++;
    }
    filled++;
  }
  return { filled, review };
}
