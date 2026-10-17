// Send via Gmail with the CV attached (founder, round 24, D-181). Gmail's own "compose"
// link fills in the address, subject and message but can't carry a file, so the extension
// opens that compose window and attaches the CV inside it, the way a person would. If
// Gmail has changed its page and the CV can't be attached, the result says so: the app
// tells the person, saves the CV to attach by hand, and tells our team.

/** Runs inside the Gmail tab. Self-contained: it is sent into the page as one function. */
export async function attachToGmail(b64, name, mime) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const signedOut = () => /(^|\.)accounts\.google\.com$/.test(location.hostname) || /ServiceLogin|\/signin/.test(location.href);
  if (signedOut()) return { ok: false, reason: "signed_out" };
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const file = new File([bytes], name, { type: mime });
  const until = Date.now() + 30000;
  let editor = null;
  let input = null;
  while (Date.now() < until) {
    if (signedOut()) return { ok: false, reason: "signed_out" };
    editor = document.querySelector('div[aria-label="Message Body"][contenteditable="true"], div[g_editable="true"][contenteditable="true"], div[role="textbox"][contenteditable="true"]');
    const inputs = [...document.querySelectorAll('input[type="file"]')];
    input = inputs.find((i) => i.name === "Filedata") || inputs[inputs.length - 1] || null;
    if (editor && input) break;
    await sleep(500);
  }
  if (!editor) return { ok: false, reason: "compose_not_found" };
  const dt = new DataTransfer();
  dt.items.add(file);
  let method = "input";
  if (input) {
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    method = "drop";
    for (const type of ["dragenter", "dragover", "drop"]) editor.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  }
  // Gmail shows the file's name once it's attached (long names are cut short).
  const stem = name.replace(/\.[a-z0-9]+$/i, "").slice(0, 16);
  const check = Date.now() + 15000;
  while (Date.now() < check) {
    if (document.body.innerText.includes(stem)) return { ok: true, method };
    await sleep(400);
  }
  return { ok: false, reason: "not_confirmed", method };
}

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listen);
      resolve();
    };
    const listen = (id, info) => {
      if (id === tabId && info.status === "complete") done();
    };
    chrome.tabs.onUpdated.addListener(listen);
    setTimeout(done, 20000);
  });
}

/**
 * Opens Gmail's compose window with the email filled in, then attaches the CV.
 * `file` is { name, base64, mime }. Resolves to { ok, reason?, method? }.
 */
export async function composeWithCv(email, file) {
  const url = `https://mail.google.com/mail/?view=cm&fs=1${email.to ? `&to=${encodeURIComponent(email.to)}` : ""}&su=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
  const tab = await chrome.tabs.create({ url });
  await waitForLoad(tab.id);
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: attachToGmail, args: [file.base64, file.name, file.mime || "application/pdf"] });
    return res?.result || { ok: false, reason: "no_result" };
  } catch (e) {
    return { ok: false, reason: "script_blocked", detail: String(e?.message || e).slice(0, 200) };
  }
}

/** Turns a Blob into base64 without blowing the stack on big files. */
export async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
