# CV typefaces (D-157)

Embedded in PDF CVs, cut down to the letters each CV uses. All are licensed under the
SIL Open Font License 1.1 (the licence files sit beside the fonts), which allows embedding
and redistribution. Static instances with Latin and Latin Extended (including ₦), from
Google Fonts.

| Design    | Typeface          | Files                  | Word file uses |
| --------- | ----------------- | ---------------------- | -------------- |
| Classic   | Source Sans 3     | SourceSans3-*.ttf      | Calibri        |
| Modern    | Inter             | Inter-*.ttf            | Arial          |
| Executive | Source Serif 4    | SourceSerif4-*.ttf     | Georgia        |
| Signature | Plus Jakarta Sans | PlusJakartaSans-*.ttf  | Calibri        |

Carlito was tried for Classic and dropped: pdf-lib's subsetting loses most of its letters.
After changing a font, render all four designs and check the text extracts cleanly
(no letter spaced headings, no ligatures, ₦ intact).
