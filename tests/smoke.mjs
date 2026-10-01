// VaultBuster smoke tests: load the game headless from file:// and drive its
// systems through the window.__t hooks, checking each still works. Run with
//   npm test                   (after: npm install; npx playwright install chromium)
// or point it at any Chromium: PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm test
// Software rendering is slow, so this takes a few minutes; it exits non-zero on any failure.
import { chromium } from "playwright-core";
import { existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const URL = pathToFileURL(join(ROOT, "index.html")).href;
function findChromium() {                        // an explicit path, else a Playwright-installed Chromium, else Playwright's own lookup
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  for (const base of [join(homedir(), "Library/Caches/ms-playwright"), join(homedir(), ".cache/ms-playwright")]) {
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()) for (const rel of [
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing", "chrome-mac/Chromium.app/Contents/MacOS/Chromium", "chrome-linux/chrome", "chrome-linux64/chrome"]) {
      const p = join(base, d, rel); if (existsSync(p)) return p;
    }
  }
  return undefined;
}

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failed++; };
const browser = await chromium.launch({ executablePath: findChromium(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 } })).newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
const ev = (f, a) => page.evaluate(f, a);
const ready = () => page.waitForFunction(() => !document.getElementById("mainMenu").hidden, null, { timeout: 300000 });
async function freshStore(mode) {                // a new store in slot 1, into the game
  await ev(m => { window.__t?.stopSaving(); localStorage.clear(); localStorage.setItem("vaultbuster-save", JSON.stringify({ v: 3, mode: m, fresh: true })); }, mode);   // (stop the current store saving over the new one on the way out, as the menu does)
  await page.reload({ timeout: 300000 }); await ready();
  await page.click("#mmContinue"); await page.waitForFunction(() => document.pointerLockElement, null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

console.log("VaultBuster smoke tests");
await page.goto(URL, { timeout: 300000 });

console.log("\nstartup + menu");
await ev(() => localStorage.clear()); await page.reload({ timeout: 300000 }); await ready();
check("loads with no errors", errors.length === 0, errors[0]);
check("first visit: only NEW GAME (no continue/load)", await page.isHidden("#mmContinue") && await page.isHidden("#mmLoad"));
await page.click("#mmNew");
check("new game asks which slot (3)", (await page.$$("#mmSlotList button")).length === 3);
await page.click("#mmSlotsBack"); await page.click("#mmSettingsBtn");
await page.fill("#setSens", "150").catch(() => {}); await ev(() => { const e = document.getElementById("setSens"); e.value = 150; e.dispatchEvent(new Event("input")); });
check("settings save (sensitivity)", (await ev(() => JSON.parse(localStorage.getItem("vaultbuster-settings")).sens)) === 150);

console.log("\nsandbox: the counter");
await freshStore("sandbox");
check("in the store, no errors", errors.length === 0, errors[0]);
const co = await ev(async () => {
  __t.shift.h = 13; __t.setFrontLock(true); __t.emp.state = "test"; for (const k of [...__t.custs]) __t.custGone(k);
  __t.custSpawn(); const k = __t.custs.at(-1), tape = __t.catalog.find(t => !t.offShelf && !t.lost && t.pos);
  __t.setOnShelf(tape, false); k.tapes = [tape]; k.holding = 1; k.member.owed = 2; k.tickets = 0;
  k.c.group.position.set(__t.CUST_COUNTER.x, 0, __t.CUST_COUNTER.z); k.path = []; k.state = "wait"; k.t = 99; __t.custLine.push(k);
  __t.custInteract(k); for (const at of ["register", "customer", "customer", "customer", "pad", "customer", "register"]) __t.coAct(at);
  window.__k = k; return { step: __t.coStep()?.id, total: __t.co()?.total };
});
check("checkout reaches the receipt (fees charged)", co.step === "tear" && co.total > 1.99, JSON.stringify(co));
await page.waitForFunction(() => __t.printer.job?.done, null, { timeout: 300000 }).catch(() => {});
await ev(() => { __t.coAct("printer"); for (let i = 0; i < 4 && __t.co(); i++) __t.coAct("customer"); });
check("checkout completes and scores", await ev(() => !__t.co() && __t.shift.stats.served === 1 && __t.shift.stats.score > 0));

console.log("\nsandbox: stock, phone, counter gear");
check("restock from the cupboard", await ev(() => { const u = __t.snackUnits().find(u => !u.userData.snack.r); u.visible = false; __t.stockTake("food"); __t.stockPlace(u); return u.visible && __t.stockCarry.size === 0; }));
const hold = await ev(() => { __t.phone.next = null; __t.phone.ring = { member: __t.posTerm.members.find(m => m.active), title: __t.catalog.find(t => t.pos && !t.offShelf), t: 0, rang: 99 };
  __t.phoneAnswer(); __t.callAnswer(1); const h = __t.holds.at(-1); const c = [h.title, ...(h.title.copies || [])].find(c => !c.offShelf && c.pos); __t.pickup(c); __t.holdPlace(c); return !!h.copy; });
check("phone call -> hold put aside", hold);
check("move the desensitizer along the counter", await ev(() => { __t.player.x = -4.9; __t.player.z = 3; const it = __t.counterItemsList().find(i => i.id === "desens");
  __t.moveStart(it); __t.cmove.spot = { x: -3.4, z: 3.85 }; __t.cmove.ok = true; __t.movePlace(); return Math.abs(__t.DESENS_AT.x + 3.4) < 0.01 && !__t.cmove.item; }));
await page.waitForTimeout(2500);
await page.reload({ timeout: 300000 }); await ready(); await page.click("#mmContinue"); await page.waitForTimeout(1000);
check("save/reload keeps the counter layout and the hold", await ev(() => Math.abs(__t.DESENS_AT.x + 3.4) < 0.01 && __t.holds.length === 1));

console.log("\nsandbox: the restroom");
await ev(() => { const d = __t.doors.find(d => !d.push && Math.abs(d.c - 9.65) < 0.1); if (d && !d.open) __t.toggleDoor(d);
  __t.player.x = 10.25; __t.player.z = 31.2; const dx = 0, dy = 0.41 - 1.65, dz = 32.3 - 31.2; __t.player.yaw = Math.atan2(-dx, -dz); __t.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)); });
await page.waitForFunction(() => document.getElementById("tvHint").textContent.includes("toilet"), null, { timeout: 120000 }).catch(() => {});
await page.keyboard.press("KeyE"); await page.waitForTimeout(1500);
check("sit on the toilet: seated, pants down", await ev(() => { const hip = __t.meBody().rig.legs[0].hip.children.find(m => m.isMesh); return __t.seated() && !!__t.seatAt()?.toilet && hip.material !== hip.userData.pantsM; }));
await page.keyboard.press("KeyE"); await page.waitForTimeout(800);
check("stand back up: pants up", await ev(() => { const hip = __t.meBody().rig.legs[0].hip.children.find(m => m.isMesh); return !__t.seated() && hip.material === hip.userData.pantsM; }));

console.log("\nsimulation: starts bare");
await freshStore("simulation");
const sim = await ev(() => { const all = __t.catalog.flatMap(t => [t, ...(t.copies || [])]), hall = __t.doors.find(d => d.push && !d.alongX);
  return { dana: !!__t.emp.c, board: __t.jobBoardMesh().g.visible, theater: hall.locked, lib: all.filter(c => c.libLocked).length, members: __t.posTerm.members.filter(m => m.active).length }; });
check("no Dana, no job board", !sim.dana && !sim.board);
check("theater locked, library tiers off the shelves", sim.theater && sim.lib > 0, `${sim.lib} tapes`);
check("a small member base", sim.members === 25, `${sim.members}`);
await ev(() => __t.upgBuy("hireDana")); await page.waitForTimeout(1500);
check("hiring Dana: she shows up, the board goes up", await ev(() => !!__t.emp.c && __t.jobBoardMesh().g.visible));

console.log(`\nerrors on the page: ${errors.length}`); errors.slice(0, 3).forEach(e => console.log("   " + e));
check("no page errors overall", errors.length === 0);
await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
