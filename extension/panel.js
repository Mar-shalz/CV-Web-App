import { APP_URL } from "./config.js";
import { detectJob } from "./detect.js";

// The side panel (D-144). It stays open while you browse, reads the job on the page you're
// on, and checks, saves or sends it to Receipts. It is built with DOM calls only: nothing
// from a web page or the server is ever turned into HTML.

const view = document.getElementById("view");
const $ = (id) => document.getElementById(id);

// Icons: our own fixed SVG, never page data.
const ICON = {
  shield: '<path d="M10.5 2.2 5.5 4.1C4.3 4.5 3.4 5.8 3.4 7.1v7.4c0 1.2.8 2.7 1.7 3.4l4.3 3.2c1.4 1 3.7 1 5.1 0l4.3-3.2c1-.7 1.7-2.2 1.7-3.4V7.1c0-1.3-.9-2.6-2.1-3l-5-1.9c-.8-.3-2.1-.3-2.9 0Z" fill="currentColor" opacity=".4"/><path d="m10.7 14.2-2-2a.8.8 0 1 1 1.1-1.1l1.4 1.4 3.6-3.6a.8.8 0 1 1 1.1 1.1l-4.1 4.2a.8.8 0 0 1-1.1 0Z" fill="currentColor"/>',
  magic: '<path d="m3.5 20.5 13-13-2-2-13 13 2 2Z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/><path d="m14.5 5.5 4 4M9 2.5l.6 1.4L11 4.5l-1.4.6L9 6.5l-.6-1.4L7 4.5l1.4-.6L9 2.5ZM19 2.5l.6 1.4 1.4.6-1.4.6L19 6.5l-.6-1.4-1.4-.6 1.4-.6.6-1.4ZM19 12.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6.6-1.4Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>',
  bookmark: '<path d="M16.8 2H7.2C5.1 2 3.4 3.7 3.4 5.8v14.1c0 1.8 1.3 2.5 2.8 1.7l4.4-2.5c.5-.3 1.3-.3 1.8 0l4.4 2.5c1.5.8 2.8.1 2.8-1.7V5.8C20.6 3.7 18.9 2 16.8 2Z" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linejoin="round"/>',
  briefcase: '<path d="M8 22h8c4 0 4.7-1.6 4.9-3.6l.8-8C22 8 21.3 6 17 6H7c-4.3 0-5 2-4.7 4.4l.8 8C3.3 20.4 4 22 8 22Z" fill="currentColor" opacity=".4"/><path d="M8 6v-.8C8 3.4 8 2 11.2 2h1.6C16 2 16 3.4 16 5.2V6M21.7 11A16.5 16.5 0 0 1 14 13.8v.7c0 1.1 0 1.1-2 1.1s-2 0-2-1.1v-.7a16.6 16.6 0 0 1-7.5-2.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"/>',
  scan: '<path d="M2 9V6.5C2 4 4 2 6.5 2H9M15 2h2.5C20 2 22 4 22 6.5V9M22 16v1.5c0 2.5-2 4.5-4.5 4.5H16M9 22H6.5C4 22 2 20 2 17.5V15M7 12h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  tick: '<path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" fill="currentColor" opacity=".25"/><path d="m7.8 12 2.8 2.8 5.6-5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  cross: '<path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" fill="currentColor" opacity=".25"/><path d="m9.2 14.8 5.6-5.6M14.8 14.8 9.2 9.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  minus: '<path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" fill="currentColor" opacity=".25"/><path d="M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  warn: '<path d="M12 22c5.5 0 10-4.5 10-10S17.5 2 12 2 2 6.5 2 12s4.5 10 10 10Z" fill="currentColor" opacity=".25"/><path d="M12 7.5v5M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
  user: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" fill="currentColor" opacity=".4"/><path d="M20.6 22c0-3.9-3.9-7-8.6-7s-8.6 3.1-8.6 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" fill="none"/>',
  key: '<path d="M19.8 14.9a7.4 7.4 0 0 1-7.4 1.8L7.7 21.4c-.3.4-1 .6-1.6.6H3.9c-.8 0-1.5-.7-1.5-1.5v-2.2c0-.6.3-1.3.7-1.6l4.7-4.7a7.4 7.4 0 1 1 12 3Z" fill="currentColor" opacity=".35"/><path d="M14.5 11.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" fill="currentColor"/>',
  share: '<path d="M16.96 6.17c2 1.39 3.38 3.6 3.66 6.15M3.49 12.37A8.6 8.6 0 0 1 7.1 6.22M8.19 20.94a8.6 8.6 0 0 0 7.56.05M12.05 7.7a2.47 2.47 0 1 0 0-4.94 2.47 2.47 0 0 0 0 4.94ZM4.83 19.92a2.47 2.47 0 1 0 0-4.94 2.47 2.47 0 0 0 0 4.94ZM19.17 19.92a2.47 2.47 0 1 0 0-4.94 2.47 2.47 0 0 0 0 4.94Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
  close: '<path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>',
  external: '<path d="M13 11 21.2 2.8M22 6.8V2h-4.8M11 2H9C4 2 2 4 2 9v6c0 5 2 7 7 7h6c5 0 7-2 7-7v-2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
};
function icon(name, size = 20, cls = "") {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24");
  s.setAttribute("width", size);
  s.setAttribute("height", size);
  s.setAttribute("aria-hidden", "true");
  if (cls) s.setAttribute("class", cls);
  s.innerHTML = ICON[name]; // fixed strings above only
  return s;
}

/** Element builder: text always goes in as text. */
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(typeof kid === "string" ? document.createTextNode(kid) : kid);
  return el;
}
// The note that sits above an open job while you're on another page (set by showOpen).
let keptNote = null;
const show = (...nodes) => view.replaceChildren(...(keptNote ? [keptNote] : []), ...nodes);

// ---------------------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------------------
let token = null;
let me = null;

async function api(path, body) {
  const res = await fetch(`${APP_URL}${path}`, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  // A protected deployment answers with its own sign in page, not our JSON: don't sign out for that.
  if (!isJson) throw new Error(`Receipts at ${new URL(APP_URL).host} isn't answering the extension. If the site is protected (Vercel Deployment Protection), turn that off, or rebuild the extension for your live address.`);
  if (res.status === 401) {
    await signOutLocal();
    throw new Error("signin");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Something didn't work on our side. Try again.");
  return data;
}

async function signOutLocal() {
  token = null;
  me = null;
  await chrome.storage.local.remove(["token", "name"]);
  $("profile").hidden = true;
  signedOut();
}

function setProfile() {
  $("profile").hidden = false;
  $("initials").textContent = me.initials;
  $("who-name").textContent = me.name;
  $("who-email").textContent = `${me.email} · ${new URL(APP_URL).host}`;
}

$("avatar").addEventListener("click", () => {
  const open = $("menu").hidden;
  $("menu").hidden = !open;
  $("avatar").setAttribute("aria-expanded", String(open));
});
document.addEventListener("click", (e) => {
  if (!$("profile").contains(e.target)) {
    $("menu").hidden = true;
    $("avatar").setAttribute("aria-expanded", "false");
  }
});
$("open-app").addEventListener("click", () => chrome.tabs.create({ url: `${APP_URL}/home` }));
$("sign-out").addEventListener("click", async () => {
  $("menu").hidden = true;
  try {
    await fetch(`${APP_URL}/api/ext/signout`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  } catch {}
  await signOutLocal();
});

function signedOut() {
  show(
    h(
      "section",
      { class: "card hero" },
      h("div", { class: "art" }, icon("key", 30)),
      h("h1", {}, "Sign in to Receipts"),
      h("p", {}, "Sign in once, and the panel can check jobs and save them to your account while you browse."),
      h(
        "ul",
        { class: "points" },
        ["Is this job real? Checked right here", "Save any job for later", "Tailor your CV to it in one tap"].map((t) => h("li", {}, icon("tick", 18), t)),
      ),
      h("button", { class: "btn primary", type: "button", onclick: () => chrome.tabs.create({ url: `${APP_URL}/extension/connect` }) }, icon("user", 18), "Sign in"),
      h("p", { class: "small" }, "We open Receipts in a tab. Sign in there, and this panel signs in by itself."),
    ),
  );
}

// ---------------------------------------------------------------------------------------
// Reading the page
// ---------------------------------------------------------------------------------------
let current = null; // what the page gave us: { url, host, title, company, location, text, source, jobLike, images }
const captured = new Map(); // page url + text length -> { jobId, title, employer, location }
const keyOf = (d) => `${d.url}|${d.text.length}|${d.image ? "img" : ""}`;

async function hasAllSites() {
  return chrome.permissions.contains({ origins: ["<all_urls>"] });
}

function allowCard() {
  show(
    h(
      "section",
      { class: "card hero" },
      h("div", { class: "art" }, icon("scan", 30)),
      h("h1", {}, "Let Receipts read job pages"),
      h("p", {}, "Chrome asks once. Receipts reads a page only when this panel is open on it, and only sends the job advert."),
      h(
        "button",
        {
          class: "btn primary",
          type: "button",
          onclick: async () => {
            const ok = await chrome.permissions.request({ origins: ["<all_urls>"] });
            if (ok) scan();
          },
        },
        "Allow",
      ),
    ),
  );
}

function scanning() {
  show(
    h(
      "section",
      { class: "card" },
      h("div", { class: "working" }, h("span", { class: "spin", "aria-hidden": "true" }), h("p", {}, h("strong", {}, "Scanning this page"))),
      h("div", { class: "skeleton", style: "margin-top:14px;width:80%" }),
      h("div", { class: "skeleton", style: "margin-top:8px;width:55%" }),
    ),
  );
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ---------------------------------------------------------------------------------------
// The open job (founder, round 18): once a job is scanned, it stays in the panel while you
// browse, with its check results, until you close it. Kept for this browser session.
// ---------------------------------------------------------------------------------------
let openJob = null; // { current, captured, view, saved }

async function keepOpen(patch = {}) {
  if (!current) return;
  openJob = { ...(openJob || {}), current, captured: captured.get(keyOf(current)) || openJob?.captured || null, ...patch };
  await chrome.storage.session.set({ openJob });
}

async function closeJob() {
  openJob = null;
  current = null;
  keptNote = null;
  await chrome.storage.session.remove("openJob");
  scanFresh();
}

/** The open job again, with a note when the page you're on isn't where you scanned it. */
async function showOpen() {
  current = openJob.current;
  if (openJob.captured) captured.set(keyOf(current), openJob.captured);
  const tab = await activeTab();
  const elsewhere = tab?.url && tab.url.split("#")[0] !== current.url.split("#")[0];
  keptNote = elsewhere
    ? h(
        "section",
        { class: "kept" },
        h("p", {}, h("strong", {}, "Still showing the job you scanned"), ` on ${current.host}. It stays here until you close it.`),
        h("button", { class: "btn ghost small-btn", type: "button", onclick: () => ((keptNote = null), closeJob()) }, icon("scan", 16), "Scan this page instead"),
      )
    : null;
  if (openJob.view && openJob.captured) return results(openJob.captured, openJob.view);
  return jobCard();
}

/** Tab or page changes: keep the open job, otherwise read the new page. */
async function scan() {
  if (!token) return signedOut();
  if (openJob) return showOpen();
  return scanFresh();
}

async function scanFresh() {
  if (!token) return signedOut();
  keptNote = null;
  // Permission first: until Chrome grants it, it hides the page's address from us, so any
  // check on the address would wrongly say "no job here" (founder, round 17).
  if (!(await hasAllSites())) return allowCard();
  const tab = await activeTab();
  if (!tab?.id) return emptyCard("Open a job advert", "Go to a job on LinkedIn, a company's careers page or any job site, and Receipts reads it here.");
  if (tab.url && tab.url.startsWith(APP_URL)) return emptyCard("You're on Receipts", "Open a job advert on another site, and this panel reads it.");
  if (tab.url && !/^https?:/.test(tab.url)) return emptyCard("Open a job advert", "This is one of Chrome's own pages. Go to a job advert on any website, and Receipts reads it here.");
  scanning();
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: detectJob });
    current = res?.result || null;
  } catch {
    current = null;
  }
  if (!current) return emptyCard("We can't read this page", "Some pages block extensions. Scan what's on your screen instead, or highlight the job's text and read again.", true);
  if (current.jobLike || current.source === "selection" || current.source === "structured") return jobCard();
  return noJobCard();
}

/** Every state has a way forward: read again, and scan the screen when a page can be shown. */
function emptyCard(title, body, canScan = false) {
  show(
    h(
      "section",
      { class: "card hero" },
      h("div", { class: "art" }, icon("briefcase", 30)),
      h("h1", {}, title),
      h("p", {}, body),
      canScan ? h("button", { class: "btn primary", type: "button", onclick: scanScreen }, icon("scan", 20), "Scan the screen") : null,
      h("button", { class: `btn ${canScan ? "ghost" : "primary"}`, type: "button", onclick: scanFresh }, "Scan this page"),
    ),
  );
}

/** The app couldn't be reached: say so, name the address, and offer to try again. */
function offline(message) {
  show(
    h(
      "section",
      { class: "card hero" },
      h("div", { class: "art" }, icon("warn", 30)),
      h("h1", {}, "Can't reach Receipts"),
      h("p", {}, message || "Check your connection, then try again."),
      h("p", { class: "small" }, `The extension talks to ${new URL(APP_URL).host}.`),
      h("button", { class: "btn primary", type: "button", onclick: start }, "Try again"),
    ),
  );
}

const SOURCE_LABEL = { structured: "Found the job details on this page", site: "Found the job description", page: "Found what looks like the job description", selection: "Using the text you highlighted", image: "Read from the image" };

function jobCard(note) {
  const c = captured.get(keyOf(current));
  const title = c?.title || current.title || "This job";
  const employer = c?.employer || current.company;
  const place = c?.location || current.location;
  show(
    h(
      "section",
      { class: "card job" },
      h("div", { class: "card-top" }, h("p", { class: "eyebrow" }, "Job you scanned"), h("button", { class: "close", type: "button", onclick: closeJob, "aria-label": "Close this job", title: "Close this job" }, icon("close", 16), "Close")),
      h("div", { class: "job-head" }, h("span", { class: "job-icon" }, icon("briefcase", 22)), h("div", {}, h("p", { class: "job-title" }, title), employer || place ? h("p", { class: "job-meta" }, [employer, place].filter(Boolean).join(" · ")) : null)),
      h("div", { class: "chips" }, h("span", { class: "chip good" }, icon("tick", 14), SOURCE_LABEL[current.source] || "Job found"), h("span", { class: "chip" }, current.host)),
      note ? h("p", { class: "small muted" }, note) : null,
    ),
    h(
      "section",
      { class: "actions" },
      h("button", { class: "btn primary", type: "button", onclick: checkReal }, icon("shield", 20), "Is this job real?"),
      h("div", { class: "row" }, h("button", { class: "btn outline", type: "button", onclick: tailor }, icon("magic", 18), "Tailor my CV"), h("button", { class: "btn outline", type: "button", onclick: save }, icon("bookmark", 18), "Save for later")),
    ),
    h("p", { class: "foot" }, "Not the right job? Highlight its text on the page, then ", h("a", { class: "link", href: "#", onclick: (e) => (e.preventDefault(), closeJob()) }, "scan again"), "."),
  );
  keepOpen();
}

function noJobCard() {
  const imgs = current.images || [];
  show(
    h(
      "section",
      { class: "card" },
      h("h2", {}, "No job advert found here"),
      h("p", { class: "muted small", style: "margin-top:4px" }, "If the job is in a picture, or the page hides it, scan what's on your screen. You can also highlight the job's text and scan again."),
      h("div", { class: "actions", style: "margin-top:12px" }, h("button", { class: "btn primary", type: "button", onclick: scanScreen }, icon("scan", 20), "Scan the screen"), h("button", { class: "btn ghost", type: "button", onclick: scanFresh }, "Scan this page again")),
    ),
    imgs.length
      ? h(
          "section",
          { class: "card" },
          h("p", { class: "eyebrow" }, "Is it one of these pictures?"),
          h(
            "div",
            { class: "thumbs", style: "margin-top:10px" },
            imgs.map((im) => h("button", { class: "thumb", type: "button", title: im.alt || "Read this image", onclick: () => readImage(im.src) }, h("img", { src: im.src, alt: im.alt || "Picture on this page" }), h("span", {}, "Read this one"))),
          ),
        )
      : null,
  );
}

// ---------------------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------------------
let working = false;
function busy(title, steps) {
  let i = 0;
  working = true;
  const bars = h("div", { class: "steps", "aria-hidden": "true" }, steps.map((_, n) => h("span", { class: n === 0 ? "on" : "" })));
  const line = h("p", { class: "small muted", style: "margin-top:2px" }, steps[0]);
  show(h("section", { class: "card" }, h("div", { class: "working" }, h("span", { class: "spin", "aria-hidden": "true" }), h("div", {}, h("p", {}, h("strong", {}, title)), line)), bars));
  const t = setInterval(() => {
    i = Math.min(i + 1, steps.length - 1);
    line.textContent = steps[i];
    bars.children[i]?.classList.add("on");
  }, 3500);
  return () => {
    clearInterval(t);
    working = false;
  };
}

function failed(message, retry) {
  show(h("section", { class: "card" }, h("div", { class: "banner bad" }, icon("warn", 20), h("span", {}, message)), h("div", { class: "actions", style: "margin-top:12px" }, retry ? h("button", { class: "btn primary", type: "button", onclick: retry }, "Try again") : null, h("button", { class: "btn ghost", type: "button", onclick: scan }, "Back"))));
}

/** Sends the job to Receipts once per page, then reuses it. */
async function ensureCaptured() {
  const k = keyOf(current);
  if (captured.has(k)) return captured.get(k);
  const body = current.image ? (current.image.startsWith("data:") ? { image: current.image, url: current.url } : { imageUrl: current.image, url: current.url }) : { text: current.text, url: current.url };
  const res = await api("/api/ext/capture", body);
  const c = { jobId: res.jobId, title: res.title, employer: res.employer, location: res.location };
  captured.set(k, c);
  return c;
}

async function checkReal() {
  const stop = busy("Checking this job", ["Reading the advert", "Looking up the company", "Checking its website and email", "Looking for warnings"]);
  try {
    const c = await ensureCaptured();
    const { view: v } = await api("/api/ext/check", { jobId: c.jobId });
    stop();
    results(c, v);
  } catch (e) {
    stop();
    if (e.message !== "signin") failed(e.message, checkReal);
  }
}

async function tailor() {
  const stop = busy("Sending the job to Receipts", ["Reading the advert", "Opening Receipts"]);
  try {
    const c = await ensureCaptured();
    stop();
    chrome.tabs.create({ url: `${APP_URL}/jobs/${c.jobId}` });
    jobCard("Opened in Receipts: check the details there, then tailor your CV.");
  } catch (e) {
    stop();
    if (e.message !== "signin") failed(e.message, tailor);
  }
}

async function save() {
  const stop = busy("Saving this job", ["Reading the advert", "Saving it to your account"]);
  try {
    const c = await ensureCaptured();
    await api("/api/ext/save", { jobId: c.jobId });
    stop();
    keepOpen({ saved: true });
    show(
      h(
        "section",
        { class: "card hero" },
        h("div", { class: "art", style: "color:var(--proof)" }, icon("bookmark", 30)),
        h("h1", {}, "Saved for later"),
        h("p", {}, `${c.title || "This job"}${c.employer ? ` at ${c.employer}` : ""} is in your Applications, under Saved for later.`),
        h("button", { class: "btn outline", type: "button", onclick: () => chrome.tabs.create({ url: `${APP_URL}/applications?status=saved` }) }, icon("external", 18), "See it in Receipts"),
        h("button", { class: "btn ghost", type: "button", onclick: () => (openJob?.view ? results(openJob.captured, openJob.view) : jobCard()) }, "Back to the job"),
      ),
    );
  } catch (e) {
    stop();
    if (e.message !== "signin") failed(e.message, save);
  }
}

async function scanScreen() {
  try {
    const tab = await activeTab();
    const shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg", quality: 72 });
    current = { url: tab.url, host: new URL(tab.url).hostname.replace(/^www\./, ""), title: "", company: "", location: "", text: "", image: shot, source: "image", jobLike: true, images: [] };
    await readCaptured();
  } catch {
    failed("Chrome wouldn't let us take that screenshot. Try again on the job's tab.", scanScreen);
  }
}

async function readImage(src, pageUrl) {
  const tab = await activeTab();
  const url = pageUrl || tab?.url || "";
  current = { url, host: url ? new URL(url).hostname.replace(/^www\./, "") : "", title: "", company: "", location: "", text: "", image: src, source: "image", jobLike: true, images: [] };
  await readCaptured();
}

async function readText(text, pageUrl) {
  current = { url: pageUrl, host: new URL(pageUrl).hostname.replace(/^www\./, ""), title: "", company: "", location: "", text, source: "selection", jobLike: true, images: [] };
  await readCaptured();
}

/** Images and highlights are read on our side first, so the card can show the real title. */
async function readCaptured() {
  keptNote = null;
  const stop = busy("Reading the job", ["Reading the words", "Finding the title and employer"]);
  try {
    await ensureCaptured();
    stop();
    jobCard();
  } catch (e) {
    stop();
    if (e.message !== "signin") failed(e.message);
  }
}

/** Share the verdict (D-147): a public link with the job and what was checked, never who checked it. */
function shareBox(c, v) {
  const box = h("section", { class: "card" });
  const make = async () => {
    box.replaceChildren(h("div", { class: "working" }, h("span", { class: "spin", "aria-hidden": "true" }), h("p", {}, "Making the link")));
    try {
      const res = await api("/api/ext/share", { jobId: c.jobId, title: c.title || current.title || undefined, employer: c.employer || current.company || undefined, state: v.state });
      const wa = `https://wa.me/?text=${encodeURIComponent(`${res.text} ${res.url}`)}`;
      const x = `https://x.com/intent/post?text=${encodeURIComponent(res.text)}&url=${encodeURIComponent(res.url)}`;
      const copied = h("span", {}, "Copy link");
      box.replaceChildren(
        h("p", { class: "eyebrow" }, "Share the check"),
        h("p", { class: "small muted", style: "margin-top:2px" }, "Shows the job and what we found. Never your name or details."),
        h(
          "button",
          {
            class: "btn wa",
            type: "button",
            style: "margin-top:10px",
            // The picture card (D-154): saved to the computer, then WhatsApp opens with the words.
            onclick: async () => {
              try {
                const blob = await (await fetch(`${res.url}/card`)).blob();
                const file = new File([blob], "job-check.png", { type: "image/png" });
                if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file], text: `${res.text} ${res.url}` }));
                const a = h("a", { href: URL.createObjectURL(blob), download: "job-check.png" });
                a.click();
                chrome.tabs.create({ url: wa });
              } catch {
                chrome.tabs.create({ url: wa });
              }
            },
          },
          "Share as a picture on WhatsApp",
        ),
        h("div", { class: "row", style: "margin-top:8px" }, h("button", { class: "btn outline", type: "button", onclick: () => chrome.tabs.create({ url: wa }) }, "WhatsApp link"), h("button", { class: "btn xbtn", type: "button", onclick: () => chrome.tabs.create({ url: x }) }, "Post on X")),
        h(
          "button",
          {
            class: "btn ghost",
            type: "button",
            onclick: async () => {
              await navigator.clipboard.writeText(res.url).catch(() => {});
              copied.textContent = "Copied";
            },
          },
          copied,
        ),
      );
    } catch (e) {
      if (e.message !== "signin") box.replaceChildren(h("p", { class: "error" }, e.message), h("button", { class: "btn ghost", type: "button", onclick: make }, "Try again"));
    }
  };
  box.append(h("button", { class: "btn outline", type: "button", onclick: make }, icon("share", 18), "Share this check"));
  return box;
}

const STATE = {
  verified: { cls: "good", icon: "tick", title: "Looks genuine on the checks we could run" },
  unverified: { cls: "warn", icon: "warn", title: "We couldn't confirm it. Be careful." },
  red_flags: { cls: "bad", icon: "cross", title: "Red flags found" },
};
const CHECK = { pass: { icon: "tick", cls: "pass", word: "Yes" }, fail: { icon: "cross", cls: "fail", word: "No" }, unknown: { icon: "minus", cls: "unknown", word: "Couldn't check" } };

function results(c, v) {
  const s = STATE[v.state] || STATE.unverified;
  const flags = (v.signals || []).filter((x) => String(x.id).startsWith("L1") && x.severity !== "info");
  keepOpen({ view: v });
  show(
    h(
      "section",
      { class: "card job" },
      h("div", { class: "card-top" }, h("p", { class: "eyebrow" }, `Job you scanned · ${current.host}`), h("button", { class: "close", type: "button", onclick: closeJob, "aria-label": "Close this job", title: "Close this job" }, icon("close", 16), "Close")),
      h("div", { class: "job-head" }, h("span", { class: "job-icon" }, icon("briefcase", 22)), h("div", {}, h("p", { class: "job-title" }, c.title || current.title || "This job"), c.employer ? h("p", { class: "job-meta" }, c.employer) : null)),
    ),
    h(
      "section",
      { class: "card" },
      h("h2", { style: "display:flex;align-items:center;gap:8px" }, icon("shield", 22, "brand-ic"), "Is this job real?"),
      h("div", { class: `banner ${s.cls}`, style: "margin-top:12px" }, icon(s.icon, 20), h("span", {}, s.title)),
      h("p", { class: "small", style: "margin-top:10px;color:var(--ink-2)" }, v.headline || ""),
      flags.length ? h("ul", { class: "checks", style: "margin-top:8px" }, flags.map((f) => h("li", {}, icon(f.severity === "red" ? "cross" : "warn", 18, `ic ${f.severity === "red" ? "fail" : ""}`), h("div", {}, h("p", { class: "detail", style: "margin:0;color:var(--ink)" }, f.text))))) : null,
      h("p", { class: "eyebrow", style: "margin-top:14px" }, "What we checked"),
      h(
        "ul",
        { class: "checks" },
        (v.checks || []).map((k) => {
          const m = CHECK[k.status] || CHECK.unknown;
          return h("li", {}, icon(m.icon, 18, `ic ${m.cls}`), h("div", { style: "flex:1;min-width:0" }, h("div", { style: "display:flex" }, h("span", { class: "label" }, k.label), h("span", { class: `word ${m.cls}` }, m.word)), h("p", { class: "detail" }, k.detail)));
        }),
      ),
      h("p", { class: "small muted", style: "margin-top:10px" }, "We describe what we found online. We can't prove a job is real, so never pay to apply and never share your BVN or bank PIN."),
    ),
    shareBox(c, v),
    h("section", { class: "row" }, h("button", { class: "btn outline", type: "button", onclick: save }, icon("bookmark", 18), "Save"), h("button", { class: "btn primary", type: "button", onclick: tailor }, icon("magic", 18), "Tailor my CV")),
    h("button", { class: "btn ghost", type: "button", onclick: () => chrome.tabs.create({ url: `${APP_URL}/jobs/${c.jobId}/real` }) }, icon("external", 16), "Open the full check in Receipts"),
  );
}

// ---------------------------------------------------------------------------------------
// Start, and keep up with tab changes, sign in and right-click requests
// ---------------------------------------------------------------------------------------
async function takePending() {
  const { pending } = await chrome.storage.session.get("pending");
  if (!pending || Date.now() - pending.at > 60_000) return false;
  await chrome.storage.session.remove("pending");
  if (pending.kind === "image") await readImage(pending.imageUrl, pending.pageUrl);
  else if (pending.kind === "text") await readText(pending.text, pending.pageUrl);
  return true;
}

async function start() {
  ({ token } = await chrome.storage.local.get("token"));
  if (!token) return signedOut();
  try {
    me = await api("/api/ext/me");
    setProfile();
  } catch (e) {
    if (e.message !== "signin") offline(e.message === "Failed to fetch" ? null : e.message);
    return;
  }
  if (await takePending()) return;
  ({ openJob } = await chrome.storage.session.get("openJob"));
  await scan();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.token) start();
  if (area === "session" && changes.pending?.newValue && token) takePending();
});
// A new tab, a new page, or a job board that changes the job without reloading (LinkedIn).
let again = null;
const rescan = (delay = 0) => {
  if (!token || working) return;
  clearTimeout(again);
  again = setTimeout(scan, delay);
};
chrome.tabs.onActivated.addListener(() => rescan());
chrome.tabs.onUpdated.addListener((_id, info, tab) => {
  if (!tab.active) return;
  if (info.status === "complete") rescan();
  else if (info.url) rescan(900);
});
start();
