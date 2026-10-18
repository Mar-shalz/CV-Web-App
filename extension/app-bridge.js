// Runs on the app's job pages only (D-181). It tells the page the extension is here, and
// passes "Send via Gmail" requests to the extension, which opens Gmail and attaches the CV
// (and the cover letter, when there is one).
// It reads nothing from the page and only answers messages from the page itself.
document.documentElement.dataset.receiptsExtension = "1";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || msg.type !== "receipts:gmail-attach" || typeof msg.id !== "string") return;
  const { email } = msg;
  // The CV, and the cover letter when there is one (D-186). Older pages send one `file`.
  const list = (Array.isArray(msg.files) ? msg.files : [msg.file]).filter((f) => f && typeof f.base64 === "string").slice(0, 3);
  if (!email || typeof email.subject !== "string" || typeof email.body !== "string" || !list.length) return;
  const files = list.map((f) => ({ name: String(f.name || "CV.pdf").slice(0, 120), base64: f.base64, mime: "application/pdf" }));
  chrome.runtime.sendMessage({ kind: "gmail-attach", email: { to: email.to || "", subject: email.subject, body: email.body }, files }, (result) => {
    const res = chrome.runtime.lastError ? { ok: false, reason: "extension_error" } : result;
    window.postMessage({ type: "receipts:gmail-attach-result", id: msg.id, result: res }, location.origin);
  });
});
