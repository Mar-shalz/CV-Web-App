# Brand system

Version 0.2, 12 October 2026. Code source of truth: `app/globals.css`. Figma: `design/tokens.json`. Words: `design/voice.md`.

The product name is a **placeholder** (`APP_NAME` in `config/app.json`). Nothing in the brand depends on it.

## 1. Idea: proof

The product sells proof, not polish. Every choice says three things:

1. **Credible.** Calm, bank grade blue. Nothing loud.
2. **On your side.** Rounded forms, warm words, no shame on a hard verdict.
3. **Light.** Built for a ₦100,000 Android phone on a 1GB bundle.

## 2. Mark

A verified seal with a tick, white on a blue gradient tile. It carries no letters, so a rename only changes the wordmark beside it.

- Tile corner radius: 31% of its size. Minimum size 20px. Clear space: half the tile.
- On gradients the tile turns translucent white with a thin white border (`tone="onDark"`).
- The tile is a CSS gradient, not an SVG gradient, so many marks on one page never clash.

## 3. Colour

| Role | Token | Hex | Use |
|---|---|---|---|
| Proof Blue | brand-600 | #1E47D9 | Primary buttons, links. White text 7.1:1 |
| Deep Blue | brand-800 / 900 | #172F87 / #14275F | Active nav bar, text on tints |
| Night | brand-950 | #0B1838 | Back office sidebar, promise band |
| Sky | sky-300 / 400 | #7DD3FC / #38BDF8 | Gradient light only, never behind body text |
| Ink | ink-900 | #0F172A | Body text |
| Muted ink | ink-500 | #586679 | Secondary text, 5.5:1 on the page |
| Page | #F5F7FB | | App background |
| Field | ink-75 | #F3F5F9 | Filled inputs and chips |
| Proof green | proof-600 | #0B7A53 | Apply, Met, Verified, Invited |
| Care amber | care-600 / 700 | #A15C07 / #7F4805 | Apply with care, Partly met, warnings |
| Flag red | flag-600 / 700 | #C42B2B / #9F1F1F | Scam red flags, form errors, the alert dot |

- Status is never colour alone: every badge has an icon and a word.
- **Skip, Not selected and No reply are grey, never red.**
- All text pairings pass WCAG 2.2 AA, checked by script.

### Gradients

- `.aurora`: the access panel and Home hero. Deep blue base, a sky bloom drifting slowly inside, a navy floor where text sits. Pure CSS.
- `.aurora-soft`: same, dimmer bloom, for surfaces with longer text.
- `.brand-gradient`: small surfaces (plan card).
- `.nav-active`: the sidebar's active item, a blue wash fading to the right, from the reference.

## 4. Type

- **Lufga** for everything (founder's choice), with **Urbanist** as the fallback, then the system font.
- The files in `app/fonts/` are the vendor's **DEMO** files. They replace 30 characters (symbols, the hyphen and the digit 4) with a watermark, so they are subset to letters and `. , : ; ?`. Urbanist draws digits and symbols. **Buy a Lufga web licence before launch** and re-subset to full Latin.
- Scale: hero 30 to 64, page title 28 / 34, card title 17 to 18, body 15 to 16 / 24, small 13 / 20, smallest 12.

## 5. Icons

Iconsax, generated into `components/icons/iconsax.ts` (MIT). Two variants only:

- **Linear** (1.5 stroke) for resting states.
- **Bulk** (two tone) for active nav items, status badges and feature tiles.

Icons are decorative: always next to a word or an sr-only label.

## 6. Components and states

**Buttons** (`components/ui/button.tsx`): primary, secondary, ghost, light (on gradients), danger. Every button is at least 48px tall; main actions on phones are 56px and full width.

| State | Primary looks like |
|---|---|
| Ready | Proof Blue fill, white text, soft blue shadow |
| Hover | Deep Blue fill |
| Pressed | Darker fill, scales to 98% |
| Focus | 3px blue ring, 2px offset |
| **Inactive** | Grey fill (ink-150), muted text, no shadow. Uses aria-disabled, so a tap explains what's missing |
| Busy | Spinner and a busy label ("Sending your code") |

**Inputs**: filled grey wells, 56px tall, 16px radius; white with a blue ring on focus; red border and tint on error, with an icon and a fix in words.

**Cards**: white, 20px radius, 1px ink-150 border, soft shadow. Cards that are links lift 2px on hover.

**Badges**: pill, icon plus word, tinted by status.

## 7. Layouts

- **Access screens**: full white page. A rounded aurora panel on the left (logo, two floating proof cards, tagline, three step cards with the current one in white). Form on the right with a centred title. On phones the panel becomes a short band above the form.
- **App**: white sidebar (logo, collapse button, divider, nav, plan card, Get help) that collapses to icons; top bar with search, update bell, the "Tailor my CV" button and the account chip; content starts right next to the sidebar. Phones get a bottom nav with "Tailor CV" raised in the centre.
- **Back office**: same system with a Night sidebar, so staff always know they are in the staff area.

## 8. Motion

Quick and quiet, and all of it switches off under `prefers-reduced-motion`.

| Effect | Where |
|---|---|
| Rise (520ms, staggered 70ms) | Page sections, step cards, lists |
| Pop (spring) | Verdict card, success states, dialogs |
| Aurora drift (18 to 24s) | Gradient panels |
| Float (7s) | Proof cards on the panels |
| Sheen sweep | The main "Tailor my CV" button |
| Count up | Home numbers, once on screen |
| Shimmer skeleton | The live scam check while it loads |
