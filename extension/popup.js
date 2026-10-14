import { APP_URL } from "./config.js";

// Runs inside the job page, only when the person taps a button (activeTab). It reads the
// advert's text: what they highlighted, else the job description box on known job sites,
// else the page's main content. Nothing else leaves the page, and nothing is stored here.
function grabJob() {
  const text = (el) => (el ? el.innerText.replace(/\n{3,}/g, "\n\n").trim() : "");
  const first = (selectors) => {
    for (const s of selectors) {
      const t = text(document.querySelector(s));
      if (t.length > 200) return t;
    }
    return "";
  };
  const picked = String(window.getSelection() || "").trim();
  const header = first([".job-details-jobs-unified-top-card__container--two-pane", ".jobs-unified-top-card", ".top-card-layout", "[data-testid='jobsearch-HeaderContainer']"]).slice(0, 1500);
  const body =
    picked.length > 200
      ? picked
      : first([
          ".jobs-description__content",
          ".jobs-box__html-content",
          "#job-details",
          ".show-more-less-html__markup",
          "#jobDescriptionText",
          "[data-testid='jobDescriptionText']",
          ".job__description",
          ".job-description",
          "[class*='job-description']",
          "[class*='JobDescription']",
          "main article",
          "article",
          "main",
        ]) || text(document.body);
  const all = picked.length > 200 || !header || body.includes(header.slice(0, 40)) ? body : `${header}\n\n${body}`;
  return { url: location.href, text: all.slice(0, 40000) };
}

// UTF-8 safe base64url, so the job rides after "#" in the link: never sent to a server.
function pack(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const status = document.getElementById("status");
const buttons = [document.getElementById("tailor"), document.getElementById("real")];

async function send(path) {
  status.textContent = "";
  buttons.forEach((b) => (b.disabled = true));
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/.test(tab.url ?? "")) throw new Error("page");
    const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: grabJob });
    const job = result?.result;
    if (!job || job.text.length < 80) {
      status.textContent = "We couldn't find a job advert on this page. Open the job itself, or highlight its text, then try again.";
      return;
    }
    await chrome.tabs.create({ url: `${APP_URL}${path}#ext=${pack(job)}` });
    window.close();
  } catch {
    status.textContent = "We can't read this page. Open the job advert in a normal tab and try again.";
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

document.getElementById("tailor").addEventListener("click", () => send("/jobs/new"));
document.getElementById("real").addEventListener("click", () => send("/jobs/real"));
document.getElementById("open").addEventListener("click", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: `${APP_URL}/home` });
  window.close();
});
