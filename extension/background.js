import { composeWithCv } from "./gmail.js";

// The toolbar button opens the side panel; right-clicking an image or highlighted text
// sends it to the panel to read.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.create({ id: "image", title: "Read this job image with __APP_NAME__", contexts: ["image"] });
  chrome.contextMenus.create({ id: "text", title: "Send this job to __APP_NAME__", contexts: ["selection"] });
});
chrome.runtime.onStartup.addListener(() => chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {}));

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  // Opening the panel must happen straight away, inside the click.
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  const pending =
    info.menuItemId === "image" && info.srcUrl && /^https?:/.test(info.srcUrl)
      ? { kind: "image", imageUrl: info.srcUrl, pageUrl: info.pageUrl }
      : info.menuItemId === "text" && info.selectionText
        ? { kind: "text", text: info.selectionText.slice(0, 40000), pageUrl: info.pageUrl }
        : null;
  if (pending) await chrome.storage.session.set({ pending: { ...pending, at: Date.now() } });
});

// "Send via Gmail" from the app's pages (D-181): open Gmail's compose window and attach the CV.
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg?.kind !== "gmail-attach" || !sender.tab) return false;
  composeWithCv(msg.email, msg.files || msg.file).then(reply, (e) => reply({ ok: false, reason: "extension_error", detail: String(e?.message || e).slice(0, 200) }));
  return true; // answered later
});

