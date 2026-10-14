# Receipts browser extension

A Chrome side panel (Manifest V3) that sits beside any job page. It finds the job advert on
the page by itself, checks whether the job is real right in the panel, saves it for later,
or sends it to Receipts to tailor a CV. Adverts posted as pictures are read too (scan the
screen, pick an image on the page, or right-click an image).

How it works:
- Sign in: the panel opens Receipts' "Connect the extension" page. Signed in there, the app
  makes a long random key for this browser and hands it to the extension's helper on that
  page only. The server keeps a hash of the key; the extension sends it with each request.
  "Sign out of the extension" in the panel, or "Sign the extension out on every browser" in
  the app, stops it at once.
- Reading a page: only while the panel is open on it, after Chrome asks once for permission.
  In order: the text you highlighted; the page's own job data (schema.org JobPosting, which
  most job boards publish); the job box on boards we know (LinkedIn, Indeed, Greenhouse,
  Lever, Workday, Ashby, Jobberman, MyJobMag, Glassdoor); otherwise the block of the page
  that reads most like a job advert. Only that text and the page address are sent.
- Nothing from web pages is turned into HTML in the panel; it is built with DOM calls only.

## Try it on your computer (free)
Loading it this way costs nothing and needs no Chrome Web Store account. The 5 US dollar fee
is only for publishing in the store. Testers can add it the same way: the app serves the
zip at /receipts-extension.zip, and its "Chrome extension" page explains the steps.

1. `npm run extension:build` fills in the app's address and writes `extension-dist/` and the
   zip. For local testing: `EXT_APP_URL=http://localhost:3001 npm run extension:build`.
2. In Chrome, go to `chrome://extensions`, turn on Developer mode, click Load unpacked and
   choose `extension-dist`.
3. Pin it, click it, and tap Sign in.

## Publish it
Upload the zip in the Chrome Web Store developer dashboard, with the privacy policy at the
app's /legal/privacy page. Permissions to explain: side panel, storage, scripting and access
to sites (read the job on the page you choose), context menus (right-click an image).

Chrome on Android doesn't run extensions. On phones, people share a job to the installed
Receipts app from LinkedIn, WhatsApp or the browser instead.
