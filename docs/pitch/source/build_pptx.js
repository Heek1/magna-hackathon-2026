// Builds pitch_deck.pptx from the rendered slide images (same design as the PDF) with speaker notes.
const path = require("path");
const pptxgen = require("pptxgenjs");

// Expects hi1.png … hi7.png rendered from pitch_deck.pdf at 144 dpi in this folder.
const DIR = __dirname;
const OUT = process.argv[2] || path.join(__dirname, "pitch_deck.pptx");

const slides = [
  {
    alt: "88 % OEE looks fine. It hides 1,108 lost drives.",
    notes:
      "88 % OEE beats the 85 % target, so on paper the line is fine. But in 21 shifts it lost 1,108 electric drives, and today nobody gets a warning before a stop. Our engine makes every loss visible and actionable before the line stops.",
  },
  {
    alt: "Where the losses are: speed 579, downtime 410, scrap 119 pieces.",
    notes:
      "Where did 1,108 drives go? 52 % is speed — slowdowns, microstops and retests that never show up in the downtime log. 37 % is downtime, 33 stops; the camera ST-038 alone costs 100 minutes. 11 % is scrap, led by fluid leaks Q-031.",
  },
  {
    alt: "Repeating patterns: ST-038 every Wednesday 09:08, ST-047 every Thursday, slow hours 1 and 5, three scrap codes.",
    notes:
      "The losses repeat. ST-038 stops the line every Wednesday at 09:08, four weeks out of four. ST-047 leaks every Thursday at 08:08. Hours 1 and 5 — start-up and after the break — run slower every day. Three codes make 79 % of scrap. Repeating means preventable.",
  },
  {
    alt: "How it works: live line data, detection engine, AI assistant, fix with an owner.",
    notes:
      "Line data streams in every second. The detection engine finds repeating stops, slow hours and scrap causes and predicts the next stop. The AI assistant answers why and what to do, only from the line data, in English or Slovak. Every error code has a Lean countermeasure and an owner.",
  },
  {
    alt: "Live demo screens: Now, Top errors, If we fix it, Ask AI, and a QR code.",
    notes:
      "Live demo: Settings, Start demo. Coming up warns that ST-038 is due in 18 minutes. At 09:08 the line stops; the fix is already on screen. Top errors shows ST-038 as fix first; the detail shows every Wednesday 09:08 and +1.00 pp if fixed. Ask AI: why is OEE low on Wednesdays? Create the action for Maintenance. Scan the QR code to try it.",
  },
  {
    alt: "Impact waterfall: 88.0 % to 90.8 % OEE, +253 drives a month, no CapEx.",
    notes:
      "Fixing the two repeating stops gives +1.59 pp, levelling hours 1 and 5 another +1.14 pp: 88.0 % to 90.8 % OEE, 253 more drives a month. The what-if model runs the removed losses at the month's own speed and quality. No new equipment — standard work and autonomous maintenance.",
  },
  {
    alt: "Next steps: pilot on line L01, push alerts and handover, scale to 10 lines.",
    notes:
      "Next: one month on line L01 with a live PLC feed, fixing ST-038 and ST-047 first. Then push alerts and an AI shift handover. Then ten assembly lines. Every loss visible, every fix owned — before the line stops. Thank you.",
  },
];

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in, same 16:9 as the PDF
  pres.title = "AI OEE Improvement Engine";
  pres.company = "Magna Hackathon 2026";
  slides.forEach((s, i) => {
    const slide = pres.addSlide();
    slide.background = { color: i === 0 || i === 6 ? "0E1116" : "F3F4F7" };
    slide.addImage({ path: path.join(DIR, `hi${i + 1}.png`), x: 0, y: 0, w: 10, h: 5.625, altText: s.alt });
    slide.addNotes(s.notes);
  });
  await pres.writeFile({ fileName: OUT });
  console.log("written", OUT);
})();
