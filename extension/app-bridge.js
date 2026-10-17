// Runs on the app's job pages only (D-181). It tells the page the extension is here, and
// passes "Send via Gmail" requests to the extension, which opens Gmail and attaches the CV.
// It reads nothing from the page and only answers messages from the page itself.
document.documentElement.dataset.receiptsExtension = "1";

window.addEventListener("message", (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const msg = event.data;
  if (!msg || msg.type !== "receipts:gmail-attach" || typeof msg.id !== "string") return;
  const { email, file } = msg;
  if (!email || typeof email.subject !== "string" || typeof email.body !== "string" || !file || typeof file.base64 !== "string") return;
  chrome.runtime.sendMessage({ kind: "gmail-attach", email: { to: email.to || "", subject: email.subject, body: email.body }, file: { name: String(file.name || "CV.pdf"), base64: file.base64, mime: "application/pdf" } }, (result) => {
    const res = chrome.runtime.lastError ? { ok: false, reason: "extension_error" } : result;
    window.postMessage({ type: "receipts:gmail-attach-result", id: msg.id, result: res }, location.origin);
  });
});
