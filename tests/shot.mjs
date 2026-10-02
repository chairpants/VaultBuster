// Look at the game from anywhere: a fresh store, the player put at x,z facing yaw (radians; 0 looks at the
// front door, PI toward the back) with pitch, then a screenshot. Optionally run some setup first (any JS, with
// the window.__t test hooks), or time the frames instead.
//   node tests/shot.mjs out.png 7.5,28.9,-1.57,0
//   node tests/shot.mjs out.png 10.3,29.1,-1.7,0.1 --setup "__t.setZone('closet', true)"
//   node tests/shot.mjs - 3,12,3.14,0 --mode simulation --gpu --fps   (frame times on the real GPU, no picture)
import { URL, launch } from "./browser.mjs";

const args = process.argv.slice(2), flag = f => args.includes(f), opt = f => args[args.indexOf(f) + 1];
const [out, at = "0,2.6,3.14,0"] = args, [x, z, yaw, pitch] = at.split(",").map(Number);
const browser = await launch({ gpu: flag("--gpu") });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
const ready = () => page.waitForFunction(() => !document.getElementById("mainMenu").hidden, null, { timeout: 300000 });
await page.goto(URL, { timeout: 300000 }); await ready();
await page.evaluate(m => { localStorage.clear(); localStorage.setItem("vaultbuster-save", JSON.stringify({ v: 3, mode: m, fresh: true })); }, flag("--mode") ? opt("--mode") : "sandbox");
await page.reload({ timeout: 300000 }); await ready();
await page.click("#mmContinue"); await page.waitForTimeout(2500);
if (flag("--setup")) await page.evaluate(opt("--setup"));
await page.evaluate(([x, z, yaw, pitch]) => Object.assign(__t.player, { x, z, yaw, pitch }), [x, z, yaw, pitch]);
await page.waitForTimeout(2000);
if (flag("--fps")) {
  const ts = await page.evaluate(() => new Promise(r => { const ts = [], t0 = performance.now(); const f = t => { ts.push(t); if (performance.now() - t0 < 6000) requestAnimationFrame(f); else r(ts); }; requestAnimationFrame(f); }));
  const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
  console.log(`fps ${(ts.length / 6).toFixed(1)} · median ${d[d.length >> 1].toFixed(2)} ms · p95 ${d[Math.floor(d.length * 0.95)].toFixed(2)} ms`);
}
if (out !== "-") await page.screenshot({ path: out });
console.log(errors.length ? `page errors:\n${errors.join("\n")}` : "no page errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
