// Builds pitch_deck.pptx from the rendered slide images (same design as the PDF) with speaker notes.
const path = require("path");
const pptxgen = require("pptxgenjs");

// Expects hi1.png … hi7.png rendered from pitch_deck.pdf at 144 dpi in this folder.
const DIR = __dirname;
const OUT = process.argv[2] || path.join(__dirname, "pitch_deck.pptx");

const slides = [
  {
    alt: "Team ARVYDLiKuz: OEE Engine. Yuzevych Vladyslav, Kuz Oleksandr, Lopatnov Daniil, Rykitsianski Artsem.",
    notes: "(10 s) We are team ARVYDLiKuz. Our project is OEE Engine: every production loss visible and actionable before the line stops.",
  },
  {
    alt: "Problem: 88 % OEE hides 1,108 lost drives; the same losses repeat every week.",
    notes:
      "(35 s) The problem. The line runs at 88 % OEE, above the 85 % target, so on paper everything is fine. But in 21 shifts it never built 1,108 drives. Half of that is slow running that the downtime log does not show. And the losses repeat: the camera ST-038 stops the line every Wednesday at 09:08, four weeks out of four; ST-047 every Thursday; hours 1 and 5 are slow every day; three codes make 79 % of scrap. Repeating means preventable, but today nobody gets a warning.",
  },
  {
    alt: "Solution: live data, detection engine, AI assistant, fix with an owner; desktop view of the app.",
    notes:
      "(25 s) Our solution is an app for the shop floor. It replays the line data live, the detection engine finds the repeating losses and predicts the next stop, the AI assistant answers why using only the line data, and every one of 82 error codes has a Lean countermeasure and an owner. The same app works on a phone, a laptop and the line's screen.",
  },
  {
    alt: "Screens: role picker, Coming up, Now with the line stopped, Top errors.",
    notes:
      "(25 s) You pick your role, no account. Coming up warns that ST-038 is expected in 16 minutes. At 09:08 the line stops; the timer runs and the recommended fix is already on the screen. Top errors puts ST-038 first by pieces lost.",
  },
  {
    alt: "Screens: Error detail, If we fix it, Ask AI, Fixes.",
    notes:
      "(25 s) The detail shows when it happens: every Wednesday 09:08. If we fix it shows the OEE before and after. Ask AI explains why OEE is low on Wednesdays from the data. One tap creates the action for Maintenance, and Fixes tracks it from open to done.",
  },
  {
    alt: "Result: +2.74 pp OEE, 88.0 % to 90.8 %, +253 drives a month, no new equipment.",
    notes:
      "(30 s) The result. Fixing the two repeating stops gives +1.59 points, levelling hours 1 and 5 another +1.14: from 88.0 to 90.8 % OEE, 253 more drives every month, with no new equipment — standard work and autonomous maintenance. The team is warned before the stop, the fix comes with an owner, and the hidden speed losses become visible.",
  },
  {
    alt: "Every loss visible. Every fix owned. Before the line stops. QR code to the app; team members.",
    notes: "(10 s) Every loss visible, every fix owned, before the line stops. Scan the QR code to try it. Thank you — team ARVYDLiKuz.",
  },
];

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in, same 16:9 as the PDF
  pres.title = "AI OEE Improvement Engine";
  pres.company = "Magna Hackathon 2026";
  pres.author = "Team ARVYDLiKuz";
  slides.forEach((s, i) => {
    const slide = pres.addSlide();
    slide.background = { color: i === 0 || i === 6 ? "0E1116" : "F3F4F7" };
    slide.addImage({ path: path.join(DIR, `hi${i + 1}.png`), x: 0, y: 0, w: 10, h: 5.625, altText: s.alt });
    slide.addNotes(s.notes);
  });
  await pres.writeFile({ fileName: OUT });
  console.log("written", OUT);
})();
