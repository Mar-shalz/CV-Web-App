import { APP_URL } from "./config.js";

// The toolbar button opens the side panel; right-clicking an image or highlighted text
// sends it to the panel to read.
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  chrome.contextMenus.create({ id: "image", title: "Read this job image with Receipts", contexts: ["image"] });
  chrome.contextMenus.create({ id: "text", title: "Send this job to Receipts", contexts: ["selection"] });
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

// The app's own pages never need reading.
export const isAppPage = (url) => typeof url === "string" && url.startsWith(APP_URL);
