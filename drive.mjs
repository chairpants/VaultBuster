// Drive VaultBuster headlessly: load, click to enter, walk into the aisles,
// pick up a tape, screenshot each step. Usage: node drive.mjs [steps...]
import { chromium } from "playwright-core";

const exe = process.env.PLAYWRIGHT_CHROMIUM_PATH; // optional override; unset lets Playwright find its own install
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errors = [];
page.on("console", m => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", e => errors.push(String(e)));

await page.goto("http://localhost:8123/");
await page.waitForFunction(() => document.getElementById("enterHint").textContent.includes("CLICK"), null, { timeout: 30000 });
await page.screenshot({ path: "shot-1-title.png" });

await page.click("#titleScreen");                       // enter -> pointer lock
await page.waitForTimeout(1500);
await page.screenshot({ path: "shot-2-lobby.png" });

await page.keyboard.press("KeyW"); await page.waitForTimeout(3200); await page.keyboard.press("KeyW"); // walk in
await page.keyboard.press("KeyS"); await page.waitForTimeout(300);
await page.screenshot({ path: "shot-3-aisle.png" });

// turn to face a shelf and pick a tape: sweep until hoverTip shows
for (let i = 0; i < 30; i++) {
  await page.mouse.move(640 + (i % 2 ? 40 : -40), 360, { steps: 1 });  // pointer-lock mousemove
  const tip = await page.evaluate(() => document.getElementById("hoverTip").style.display);
  if (tip === "block") break;
}
await page.screenshot({ path: "shot-4-hover.png" });
const hover = await page.evaluate(() => document.getElementById("hoverTip").textContent);
console.log("hovered:", hover);
await page.mouse.click(10, 10);
await page.waitForTimeout(600);
await page.screenshot({ path: "shot-5-card.png" });

// play first episode on the TV
await page.click("#btnPlay");
await page.waitForTimeout(9000);
await page.screenshot({ path: "shot-6-tv.png" });
console.log("nowPlaying:", await page.evaluate(() => document.getElementById("nowPlaying").textContent));
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();