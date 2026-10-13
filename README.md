# Receipts to spreadsheet

Add pictures of receipts, check the highlighted fields, download a CSV. No terminal, no account, no API key. Everything is read in your browser; your pictures are not uploaded.

Built for DEV's Hacktoberfest "Side Hustle" challenge (Oct 2026). Built with AI coding help. Nobody is paying for it and it has no users yet.

## How it works
- Reading: PP-OCRv5 mobile detection and recognition models (Apache-2.0) run through PaddleOCR.js and ONNX Runtime Web (wasm), in the page.
- A rules-based step picks vendor, date, total and tax from the text lines. Anything unsure is shown as "Please check".
- The CSV has a BOM (opens in Excel), quoted text, and a leading apostrophe on text that starts with = + - @ so spreadsheets do not run it as a formula.
- One-time model download is roughly 60 MB uncompressed (models 21 MB, script 11 MB, ONNX wasm up to 28 MB; estimated from file sizes, not measured on the wire) from the same site. After that, picture data stays on the device.

## Measured (honest numbers)
Test data: CORD-v2 test split, 100 Indonesian receipt photos (CC-BY-4.0, Naver Clova, https://huggingface.co/datasets/naver-clova-ix/cord-v2). Rules were tuned on receipts 0-49 only, then frozen and scored once on 50-99.
- Total exactly right: 35/47 on the tuning half, 35/48 on the held-out half (about 73%). Amounts are plain numbers; currency and thousands/decimal conventions are not understood, only flagged when ambiguous. Receipts without a usable ground-truth total were not counted: 3 of the 50 tuning receipts (47 counted) and 2 of the 50 held-out receipts (48 counted).
- All 13 wrong held-out totals were flagged "Please check", but about half of all receipts get flagged, and this is one dataset. Other layouts, languages and currencies are untested and will do worse. This is not a safety guarantee.
- Tax: 10/23 (only receipts that have a tax line in the ground truth) on the held-out half. Treat tax as a guess. Vendor and date were not scored.
- Memory: on a 2 GB Linux box, reading all in one page ran Chrome out of memory after about 5 receipts. The reader now lives in a hidden page that is replaced every 4 pictures. 67 receipts in a row ran without a crash (peak Chrome RSS about 1.5 GB). Phones were NOT tested. If a tab runs out of memory, the rows on screen are lost, so the list is also kept in the browser tab (sessionStorage, fields only, no pictures) until you press Start over or close the tab; still download the CSV as you go and use small batches.
- Network: during the test runs there were 0 requests to anything but the local server.

## Not for accounting
Totals are only as right as you checked them. No tax or financial advice. PDF and HEIC are not supported.

## Reproducing the tests
The test scripts in test/ expect the CORD-v2 test split downloaded separately into data/cord (not included here: rights and size). Raw OCR dumps are not published.

## Run it
`npm i && bash build/setup.sh && node server.js` then open http://localhost:8777

## Licences
App code: MIT (to be confirmed at publish). PaddleOCR / PP-OCRv5 models: Apache-2.0. ONNX Runtime Web: MIT. CORD dataset: CC-BY-4.0, used only for testing and not redistributed in the app.

## Update: total cross-check, service charge, currency (Oct 13, evening)
- Totals are now cross-checked against cash paid minus change, and against subtotal + tax + service charge. If the first guess does not add up but another amount on the receipt does, the page uses that one and says why. Service charge is no longer counted as tax. There is a setting for how amounts are printed (guess and flag, 1,234.56, or 1.234,56) and a currency field (read only when a code like Rp/IDR, USD, EUR is printed; blank otherwise) and a Currency column in the CSV.
- Measured on a different set the earlier numbers did not use: the 100 receipts of the CORD v2 validation split (98 with a usable total), OCR run once, old and new rules scored on the same files. Old rules 78/98 totals exact (80%), new rules 82/98 (84%); wrong-and-not-flagged 5 down to 3; tax 27/46 up to 29/46. That is +4 receipts, small, on one dataset of mostly Indonesian restaurant receipts, and I have not checked how many are phone photos. The earlier 35/47 and 35/48 numbers above were measured with the older rules and are unchanged.
- Currency was detected on only 5 of 100 receipts, so the field is usually blank and you type it.
- Where the check goes wrong: 4 of the 56 totals that matched "subtotal + tax + service" were still wrong (tax or service was missed and the subtotal matched). So that match only shows a note and does not clear the "Please check" flag. Only a match with cash minus change clears it. I changed that rule after seeing these validation errors, so treat the validation numbers as one look at the rules before that change, not a final held-out score. A final claim would need another unseen set, scored once with the rules frozen.
- The cash-minus-change and subtotal checks are consistency checks, not proof: arithmetic on a misread number can also match. The new amounts setting was tested on one receipt (28,000 reads as 28000, or 28 under the comma setting), not scored. Not done: reading real phone photos (none tested, no device), .xlsx export.

## Update: review queue, optional shared vendor (Oct 14, past midnight)
- The results page now shows how many receipts are not ticked yet and how many of those have fields to check, plus a "Next receipt to check" button that jumps to the next one with something flagged. Nothing is ticked for you. "Not ticked" does not mean "right": some unflagged totals are wrong.
- Optional "same shop" box: fills only vendors that are blank and that you have not typed in. It never overwrites a vendor the reader found or one you edited.
- Reading rules did not change in this update (extract.js is the same as the previous version). I tried a rule to stop the cash amount being picked as the total. On the validation set it fixed 1 receipt, on the earlier dev half it broke 1, so I dropped it.
- Fresh score, declared before running (see test/EVAL_PLAN.txt): the first 100 receipts of the CORD v2 train split, which my rules were never tuned on. 2 of the 100 have no usable truth total and are excluded, so 98 are scored. Totals exact: 79/98 (81%). 60 receipts flagged for checking; 18 wrong, 17 of those flagged, 1 wrong and not flagged. Tax exact 29/45 where a truth tax exists.
- Caveat: this set is unseen by my rules, but the OCR model may have seen CORD train images in its own training, so this is not an independent out-of-domain test. Scores on validation (82/98) were measured before the final rules were frozen and were used for tuning, so do not read them as a held-out result.
- Still not tested: real phone photos in other countries and languages, and receipts in a real browser on a real phone. Always compare against the picture before you download.

## Update: reading rules v3 (Oct 14, after midnight)
- Rule changes (extract.js): glue a thousands group the reader split into two boxes ("33." + "000"), read ":" as a thousands mark, read "TL" and "resto" labels, only use the subtotal check when a tax or service line was read (the old check replaced right totals with the subtotal in some receipts), accept total + tax/service when that sum is printed elsewhere, and prefer the bill over the cash handed over when cash minus change is printed. That last rule fixed some receipts, not all: in my regression list two receipts still fail (a split "33." + "OOO" box that is not glued, and a "Pay Cash / Change" row layout), and both stay flagged. test/regress.js lists them as known failures; it needs OCR files you make locally with test/dump.js, since no dataset images or OCR text are included here.
- On the receipts I looked at while building these rules (CORD train rows 0-99, validation, CORD test) totals went from 79/98, 82/98 and 77/95 to 89/98, 90/98 and 79/95. Those numbers are tuned on, so they overstate what to expect.
- Fresh check, plan written before OCR (test/EVAL_PLAN.txt): CORD v2 train rows 100-199, 98 scored (2 have no usable truth total, excluded up front). Old rules 84/98 (86%), new rules 85/98 (87%) on the same OCR. 53 flagged, 0 wrong-and-not-flagged. Tax 25/40 both. So the honest gain on unseen receipts is about 1 receipt in 100: most of the dev gain was fitting what I had looked at.
- Same caveats: the OCR model may have seen CORD train images; mostly Indonesian restaurant receipts; no real-phone test. Remaining misses are mostly misread digits and two-column layouts the row grouping mixes up. Those need a better reader, not another rule, so I stopped here.
