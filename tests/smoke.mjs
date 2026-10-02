// VaultBuster smoke tests: load the game headless from file:// and drive its
// systems through the window.__t hooks, checking each still works. Run with
//   npm test                   (after: npm install; npx playwright install chromium)
// or point it at any Chromium: PLAYWRIGHT_CHROMIUM_PATH=/path/to/chrome npm test
// Software rendering is slow, so this takes a few minutes; it exits non-zero on any failure.
import { URL, launch } from "./browser.mjs";

let failed = 0;
const check = (name, ok, detail = "") => { console.log(`${ok ? "  ✓" : "  ✗"} ${name}${detail ? `  (${detail})` : ""}`); if (!ok) failed++; };
const browser = await launch();
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
  __t.shift.h = 13; __t.setFrontLock(true); for (const e of __t.staff) e.state = "test"; for (const k of [...__t.custs]) __t.custGone(k);
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

check("trash: a full bin spills, bag it, down the chute", await ev(() => { const b = __t.trashBins.lobby, m0 = __t.messes.length; __t.trashAdd(b, b.cap + 1);
  const spilled = __t.messes.length > m0; __t.binBag(b); const bagged = __t.bagCarry.length === 1 && b.n === 0; const s0 = __t.shift.stats.score; __t.chuteDrop();
  return spilled && bagged && !__t.bagCarry.length && __t.shift.stats.score === s0 + 10; }));

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
  return { dana: __t.staff.length, board: __t.jobBoardMesh().g.visible, theater: hall.locked, lib: all.filter(c => c.libLocked).length, members: __t.posTerm.members.filter(m => m.active).length }; });
check("no Dana, no job board", !sim.dana && !sim.board);
check("theater locked, library tiers off the shelves", sim.theater && sim.lib > 0, `${sim.lib} tapes`);
check("a small member base", sim.members === 40, `${sim.members}`);
await ev(() => __t.upgBuy("hire")); await page.waitForTimeout(1500);
const apps = await ev(() => ({ open: __t.hiring.open, n: __t.hiring.apps.length, totals: __t.hiring.apps.map(a => Object.values(a.levels).reduce((x, y) => x + y, 0)), names: new Set(__t.hiring.apps.map(a => a.first + a.last)).size }));
check("hiring: three applicants, every one's stats add up the same", apps.open && apps.n === 3 && apps.totals.every(t => t === apps.totals[0]) && apps.names === 3, JSON.stringify(apps));
await ev(() => { __t.hirePick(1); __t.staff[0].sched[__t.weekday()] = (1 << 15) - 1; }); await page.waitForTimeout(1500);   // (on the clock all day today)
check("the hire shows up and the board goes up", await ev(() => __t.staff.length === 1 && !!__t.staff[0].c && __t.jobBoardMesh().g.visible && !__t.hiring.open));
const cost = await ev(async () => { const c0 = __t.hireCost(); __t.upgBuy("hire"); await new Promise(r => setTimeout(r, 3000)); __t.hirePick(0); return { c0, c1: __t.hireCost(), n: __t.staff.length }; });
check("a second hire, and the next one costs more", cost.n === 2 && cost.c1 > cost.c0, JSON.stringify(cost));
check("the schedule: 25 hours max, and off the clock they head out the door", await ev(() => {
  const e = __t.staff[0], d = __t.weekday(); e.sched = Array(7).fill(0);
  const err0 = __t.setSched(e.id, d, 5, true);
  e.sched = Array(7).fill(0); for (let k = 0; k < 25; k++) e.sched[Math.floor(k / 5)] |= 1 << (10 + k % 5);   // 25 hours, all evenings (not now)
  const full = __t.setSched(e.id, 6, 3, true);
  e.state = "post"; e.t = 0; __t.empTick(0.05);
  return !err0 && /25 HOURS/.test(full || "") && e.leaving && e.state === "toExit"; }));
check("skills level up with XP (you and staff)", await ev(() => { const e = __t.staff[0], l0 = __t.lv(e, "dex"); __t.gainXp(e, "dex", (__t.xpToNext(l0) + 1) / __t.SKILLS.dex.rate); __t.gainXp("you", "str", (__t.xpToNext(1) + 1) / __t.SKILLS.str.rate);   /* (each stat earns at its own rate) */ return __t.lv(e, "dex") === l0 + 1 && __t.lv("you", "str") >= 2; }));

console.log("\nsimulation: unlocks, upgrades, staff, the closet, the register");
check("milestones: DEX 5 unlocks Quick Thread", await ev(() => {
  const sk = __t.you.skills.dex; sk.lvl = 4; sk.xp = 0; const before = __t.has("you", "dex", 5);
  __t.gainXp("you", "dex", (__t.xpToNext(4) + 1) / __t.SKILLS.dex.rate);
  return !before && __t.has("you", "dex", 5) && /Unlocked Quick Thread/.test(document.getElementById("actLog").textContent); }));
const rw = await ev(() => { const st = () => __t.rewinders.map(r => r.on ? (r.car ? "car" : "box") : "-").join("+");
  const out = [st(), __t.upgBuy("rewinders")]; __t.upgBuy("rewinder2"); out.push(st()); __t.upgBuy("rewinders"); out.push(st()); return out; });
check("rewinders: one box, a second, then the cars (in that order)", rw.join() === "box+-,SECOND REWINDER FIRST.,box+box,car+car", rw.join(" | "));
check("staff: once the shift's over, no new jobs, and returns go back in the tote", await ev(() => {
  const e = __t.staff[1], tapes = __t.catalog.filter(t => t.pos && !t.offShelf).slice(0, 3);
  e.sched = Array(7).fill((1 << 15) - 1); if (!e.c) __t.empTick(0.05);
  for (const t of tapes) { __t.setOnShelf(t, false); __t.returnBin.push(t); }
  e.jobs.forEach(j => j.pri = j.id === "returns" ? 1 : 0); e.sched = Array(7).fill(0);
  Object.assign(e, { state: "post", t: 0, paused: false, task: "register" }); __t.empTick(0.05);   // shift over, work waiting: they leave anyway
  const left = e.state === "toExit";
  const t = __t.returnBin.pop();                    // (and mid-returns, carrying one:)
  e.task = "returns"; e.carry = [t]; __t.withEmp(e, () => __t.empNext());
  return left && e.task === "register" && !e.carry.length && __t.returnBin.includes(t); }));
check("members come on their own rhythm (nobody who was just in)", await ev(() => {
  const ms = __t.posTerm.members.filter(m => m.active), now = __t.shift.day + __t.shift.h / 24, was = ms.map(m => m.lastVisit);
  ms.forEach(m => m.lastVisit = now); const none = [0, 1, 2, 3, 4].every(() => !__t.custPickMember());
  ms.forEach((m, i) => m.lastVisit = was[i]); return none && !!__t.custPickMember(true); }));
check("day goals: two of them", await ev(() => __t.shift.goals?.length === 2));
check("the closet: the ladder fixes a dead light, and goes back", await ev(() => {
  __t.lightDie(0, 0); const dead = __t.deadLights.length === 1;
  __t.toolTake("ladder"); const held = __t.toolHeld() === "ladder" && !__t.TOOLS.ladder.g.visible;
  __t.lightFix(__t.deadLights[0]); __t.toolReturn();
  return dead && held && !__t.deadLights.length && !__t.toolHeld() && __t.TOOLS.ladder.g.visible; }));
check("the register shows the sale once the card's tapped", await ev(() => {
  __t.setFrontLock(true); for (const e of __t.staff) e.state = "test"; for (const k of [...__t.custs]) __t.custGone(k);
  __t.custSpawn(); const k = __t.custs.at(-1), tape = __t.catalog.find(t => !t.offShelf && !t.lost && t.pos && !t.libLocked);
  __t.setOnShelf(tape, false); k.tapes = [tape]; k.holding = 1; k.tickets = 0;
  k.c.group.position.set(__t.CUST_COUNTER.x, 0, __t.CUST_COUNTER.z); k.path = []; k.state = "wait"; k.t = 99; __t.custLine.push(k);
  __t.custInteract(k); const before = __t.posTerm.ringing();
  __t.coAct("register"); const s = __t.posTerm.ringing();
  return before && !before.carded && s?.carded && s.member === k.member && s.items.length === 1; }));

console.log(`\nerrors on the page: ${errors.length}`); errors.slice(0, 3).forEach(e => console.log("   " + e));
check("no page errors overall", errors.length === 0);
await browser.close();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
