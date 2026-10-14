// Runs only on the app's "Connect the extension" page. It says hello, receives this
// browser's key from the page (same tab, same address only), keeps it, and says thanks.
(() => {
  const origin = location.origin;
  const hello = () => window.postMessage({ source: "receipts-extension", type: "hello" }, origin);
  window.addEventListener("message", async (e) => {
    if (e.source !== window || e.origin !== origin) return;
    const d = e.data || {};
    if (d.source !== "receipts-app") return;
    if (d.type === "ping") hello();
    if (d.type === "connect" && typeof d.token === "string" && /^[A-Za-z0-9_-]{40,60}$/.test(d.token)) {
      await chrome.storage.local.set({ token: d.token, name: typeof d.name === "string" ? d.name.slice(0, 80) : "" });
      window.postMessage({ source: "receipts-extension", type: "connected" }, origin);
    }
  });
  hello();
})();
