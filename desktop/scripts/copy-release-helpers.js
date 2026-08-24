const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "dist-release", "win-unpacked");
if (!fs.existsSync(outDir)) {
  console.error("找不到 dist-release/win-unpacked，请先 npm run dist");
  process.exit(1);
}

// 清掉可能乱码的中文启动脚本
for (const f of fs.readdirSync(outDir)) {
  if (f.endsWith(".bat") || f.endsWith(".txt")) {
    try {
      fs.unlinkSync(path.join(outDir, f));
    } catch (_) {}
  }
}

const helpers = {
  "1-Start-Fullscreen.bat": `@echo off\r
cd /d "%~dp0"\r
start "" "PizzaBoard.exe"\r
`,
  "2-Start-Windowed.bat": `@echo off\r
cd /d "%~dp0"\r
start "" "PizzaBoard.exe" --windowed\r
`,
  "3-Start-Kiosk.bat": `@echo off\r
cd /d "%~dp0"\r
start "" "PizzaBoard.exe" --kiosk\r
`,
  "README.txt": `Pizza Board v0.1.14 - Client Test Build
=====================================

HOW TO RUN
1. Copy this WHOLE folder to the Win10 meeting panel (USB ok)
2. Double-click: 1-Start-Fullscreen.bat
3. Pick "Draw now" / baseline to test the latest board

v0.1.14 FIX
- Leaderboard pizza finally stays circular and centered
  (width:auto was falling back to the canvas's 240px intrinsic
  size and squashing it; now locked to 110×110px)

v0.1.13 FIX
- Leaderboard pizza thumbnails no longer look squashed flat
  (cards are shorter now; canvas keeps a 1:1 square aspect ratio)

v0.1.12 - LAYOUT PROPORTIONS (55" 1080p)
- Leaderboard: narrower (204px) with compact cards (132px tall)
  so Top 3+ entries fit on screen without being cut off
- Pizza wall: slightly larger on big screens (up to ~8% zoom)
  so plates feel right on a 55" touch panel
- Toolbar / empty-plate labels: bigger touch targets at 1400px+

v0.1.11 FIXES - SIGNATURE IN THE LEADERBOARD
- Fixed: only a sliver of the signature showed on leaderboard
  cards. The thumbnail was clipped to a circle, and the signature
  sits in the bottom-right corner - outside that circle. The clip
  is gone (the pizza is already round, so it looked the same, but
  it was also shaving off the hand-drawn wobbly crust edge)
- Fixed: the dark signature ink disappeared into the dark blue
  panel. In the leaderboard it is now drawn in white with a soft
  dark outline, so it reads both on the panel and where it
  overlaps the light crust. Slightly larger for 55" viewing.
- On the wall and on the printed card the ink stays dark as before

v0.1.10 FIXES - SIGNATURE PAD
- Fixed: the signature box showed up black (or flashed leftover
  desktop content) on the panel. It was a low-latency canvas being
  pushed onto its own GPU layer, where transparent pixels are not
  blended with the page. That canvas no longer uses low-latency
  mode - drawing is unaffected, the pizza canvas still uses it.
- The signature box now looks like cream paper instead of dark
  blue, so the dark ink is easy to see and matches the printed card

v0.1.9 UPDATES - PRINTING
- Guests can now get an A4 keepsake card of their pizza
  (brand line, big pizza, their own signature, No. + date)
- Prints silently: no Windows print dialog ever appears on the panel
- Print quality: the card is re-rendered from the recorded brush
  strokes at 1200px, so it is sharp on paper (the on-screen pizza
  is only 240px and would look blurry if printed directly)

THREE WAYS TO PRINT
1. Automatic - a card prints as soon as the guest signs
2. Guest chooses - the sign dialog shows "Just save" next to
   "Save & print", so paper is only used when asked for
3. Staff reprint - in Review mode every pizza gets a printer
   button next to the X; use it if the printer was jammed or
   a guest comes back later

STAFF SETUP (once)
   Tap the leaderboard title 5 times -> Review mode
   - "Printer" dropdown ....... which printer to use
   - "Printing on" ............ master switch; off = nothing prints
   - "Auto-print after each save"
        ON  = way 1 above
        OFF = way 2 above (guests choose)
   - "Print a test card" ...... check the printer
- Saved to "data\\print-config.json" next to the exe
- To change the store name on the card, edit "brand" in that file
- If the printer is off/out of paper the pizza is still saved and
  the board keeps running; only a small toast appears

v0.1.8 UPDATES
- Leaderboard: always expanded, single column of square pizza cards
- Rank + likes overlay top-left; pizza fills ~80% of each card
- Tabs Top / New / Random auto-rotate every ~9s (manual tap pauses)
- Idle still hides the leaderboard; only shows on the pizza wall
- Performance pass for 55" i5 panels:
  - Rank cards reuse DOM (no full rebuild on like / tab rotate)
  - Save only re-encodes pizzas that actually changed
  - Dropped heavy blur / drop-shadow on always-visible UI
  - Idle pan capped at 30fps so ghost replay stays smooth
  - Undo snapshot no longer blocks the brush on stroke start

v0.1.7 UPDATES
- Idle screen REPLAYS a real guest pizza, stroke by stroke
- Playback length scales with ink length
- Playlist mixes Top1 / newest / Top2 / random / Top3
- Brush strokes recorded; last 30 pizzas kept

START MODES
1-Start-Fullscreen.bat  = fullscreen (recommended)
2-Start-Windowed.bat    = windowed (debug)
3-Start-Kiosk.bat       = hard kiosk (harder to exit)

HOW TO EXIT
- Tap bottom-left corner 5 times -> Home / Quit
- Ctrl+Shift+Q = Quit
- Ctrl+Shift+L = Back to launcher
- Ctrl+Shift+W = Exit fullscreen/kiosk

NOTES
- Copy the WHOLE folder, not only PizzaBoard.exe
- Saved pizzas live in the "data" folder next to PizzaBoard.exe (NOT C:\\Users\\...)
- To use another drive: PizzaBoard.exe --data-dir=D:\\PizzaBoardData
- If antivirus blocks it, choose Allow / Run anyway
`,
};

for (const [name, body] of Object.entries(helpers)) {
  fs.writeFileSync(path.join(outDir, name), body, "utf8");
}

const tip = path.join(__dirname, "..", "dist", "COPY-THIS-FOLDER.txt");
fs.writeFileSync(
  tip,
  [
    "Copy this folder to the client PC:",
    "",
    outDir,
    "",
    "Then open it and run: 1-Start-Fullscreen.bat",
    "",
  ].join("\r\n"),
  "utf8"
);

console.log("Release helpers ready ->", outDir);
