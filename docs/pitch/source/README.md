# Pitch deck source

- `deck.html` — the 7 slides (1280 × 720, same design as the app). Edit text here.
- PDF: open in Chrome and print, or
  `chrome --headless=new --no-pdf-header-footer --print-to-pdf=../pitch_deck.pdf deck.html`
- PPTX: render the PDF pages to `hi1.png … hi7.png` (144 dpi) in this folder, then
  `npm install pptxgenjs@3.12.0 && node build_pptx.js ../pitch_deck.pptx` — slides are images with speaker notes.
- App screenshots at 390 × 844: `role.jpg`, `coming.jpg`, `now.jpg`, `top.jpg`, `detail.jpg` (dark theme), `whatif.jpg`, `ask.jpg`, `fixes.jpg`; `desktop.jpg` at 1440 × 900.
- `qr.png` — the demo link with the access key.
- Built for a 3-minute pitch: problem (slide 2), solution (3–5), result (6); the speaker notes in `build_pptx.js` carry the timing.
