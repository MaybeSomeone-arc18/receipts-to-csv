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
