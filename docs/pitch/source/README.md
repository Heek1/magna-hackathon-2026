# Pitch deck source

- `deck.html` — the 7 slides (1280 × 720, same design as the app). Edit text here.
- PDF: open in Chrome and print, or
  `chrome --headless=new --no-pdf-header-footer --print-to-pdf=../pitch_deck.pdf deck.html`
- PPTX: render the PDF pages to `hi1.png … hi7.png` (144 dpi) in this folder, then
  `npm install pptxgenjs@3.12.0 && node build_pptx.js ../pitch_deck.pptx` — slides are images with speaker notes.
- `now.jpg`, `top.jpg`, `detail.jpg`, `ask.jpg` — app screenshots at 390 × 844; `qr.png` — the demo link with the access key.
