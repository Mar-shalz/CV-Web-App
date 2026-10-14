# Receipts browser extension

A small Chrome extension (Manifest V3) that sends the job advert you're looking at to
Receipts, where it is checked, matched and tailored like any job you add in the app. It
works on any job site, including LinkedIn pages you can only see when signed in, because it
reads the page you already have open.

What it does, and doesn't:
- Reads the page only when you tap a button (the `activeTab` permission). No access to any
  site in the background, no history, no cookies, no tracking.
- Copies the advert's text and the page address, and opens Receipts with them after the `#`
  in the link, which browsers never send to a server. Receipts reads them once and clears
  the address bar. Nothing is stored in the extension.
- Uses your normal Receipts sign in in the browser, so everything saves to your account and
  shows in the app on your phone too.

## Try it on your computer
1. Open `extension/config.js` and check `APP_URL` is the app's address.
2. In Chrome, go to `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**
   and choose this `extension` folder.
3. Open a job advert, click the Receipts icon (pin it from the puzzle piece), and choose
   **Tailor my CV to this job** or **Is this job real?**

## Publish it
Zip the folder's contents and upload them in the Chrome Web Store developer dashboard
(one time fee of 5 US dollars). Use the store listing text in this file's description,
and point the privacy policy to the app's /legal/privacy page.

Chrome on Android doesn't run extensions. On phones, people share a job from LinkedIn,
WhatsApp or the browser straight to the installed Receipts app instead (the share menu).
