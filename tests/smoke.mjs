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
check("restock fills a lane from the back, even pointing at the pack in front", await ev(() => {
  const lane = __t.snackLane(__t.snackUnits().find(u => !__t.snackLane(u).every(k => k === u) && __t.snackLane(u).length >= 2 && !u.userData.snack.kind));
  lane.forEach(u => u.visible = true); const back = lane.at(-1); back.visible = false; __t.stockTake("food");
  const slot = __t.stockSlotIn(lane[0]); __t.stockPlace(slot); return slot === back && back.visible; }));
check("shoppers take the front pack of a lane", await ev(() => {
  for (const k of [...__t.custs]) __t.custGone(k); __t.custSpawn(); const k = __t.custs.at(-1);
  const spot = __t.snackSpots().find(s => !s.drinks); spot.units.forEach(u => u.visible = true);
  Object.assign(k, { spot, state: "snack", t: 0, path: [] }); k.c.group.position.set(spot.x, 0, spot.z); __t.custTick(0.05);
  const u = k.snackUnit, ok = !!u && __t.snackLane(u)[0] === u; __t.custGone(k); return ok; }));
check("restock from the cupboard", await ev(() => { const u = __t.snackUnits().find(u => !u.userData.snack.r); u.visible = false; __t.stockTake("food"); __t.stockPlace(u); return u.visible && __t.stockCarry.size === 0; }));
const hold = await ev(() => { __t.phone.next = null; __t.phone.ring = { member: __t.posTerm.members.find(m => m.active), title: __t.catalog.find(t => t.pos && !t.offShelf), t: 0, rang: 99 };
  __t.phoneAnswer(); __t.callAnswer(1); const h = __t.holds.at(-1); const c = [h.title, ...(h.title.copies || [])].find(c => !c.offShelf && c.pos); __t.pickup(c); __t.holdPlace(c); return !!h.copy; });
check("phone call -> hold put aside", hold);
const calls = await ev(() => {                   // the other calls: the right answer scores, a waived fee clears the account
  const m = __t.posTerm.members.find(m => m.active); m.owed = 6;
  const ring = r => { __t.phone.ring = { ...r, t: 0, rang: 99 }; __t.phoneAnswer(); return document.getElementById("callPanel").textContent; };
  const s0 = __t.shift.stats.score, q = ring({ kind: "hours", member: m }); __t.callAnswer(1);
  ring({ kind: "fee", member: m }); __t.callAnswer(1);
  return q.includes("close") && __t.shift.stats.score > s0 && __t.posTerm.owed(m) === 0; });
check("other calls: closing time answered, late fee waived", calls);
const inbox = await ev(() => {                   // a tape a week late: a call to make in the message center; a missed call leaves a note
  const m = __t.posTerm.members.find(m => m.rentals.length); if (!m) return "no rentals";
  const n0 = __t.posTerm.inbox();
  m.rentals[0].due = new Date(+__t.shiftDate() - 7 * 864e5);
  const n1 = __t.posTerm.inbox(); __t.phone.ring = { kind: "hours", member: m, t: 30, rang: 99 }; __t.phoneTick(0.1);
  return n1 > n0 && __t.posTerm.inbox() > n1 && __t.posTerm.messagesAll().at(-1).text.includes("MISSED CALL"); });
check("message center: overdue call to make, missed call noted", inbox === true, String(inbox));
const cal = await ev(() => {                     // day 1 is Mon Sept 30 1996; day 32 is Halloween: busier, and horror's in season
  const d0 = __t.shift.day, out = [__t.shiftDate().getDay() === 1 || d0 !== 1];
  __t.shift.day = 32; const s = __t.season(); out.push(s.rush > 1, s.today[0]?.label === "HALLOWEEN", s.lean.includes("Horror"));
  __t.shift.day = 40; out.push(!__t.season().lean.length); __t.shift.day = d0; __t.season(); return out.join(); });
check("calendar: day 1 a Monday, Halloween busier with horror in season", cal === "true,true,true,true,true", cal);
check("sound effects follow mute (M) and the volume setting", await ev(() => {
  const ac = new AudioContext(), was = VaultAmbience.muted(); VaultAmbience.setMuted(true); const off = __t.sfxOut(ac).gain.value;
  VaultAmbience.setMuted(false); const on = __t.sfxOut(ac).gain.value; VaultAmbience.setMuted(was); return off === 0 && on > 0; }));
check("move the desensitizer along the counter", await ev(() => { __t.player.x = -4.9; __t.player.z = 3; const it = __t.counterItemsList().find(i => i.id === "desens");
  __t.moveStart(it); __t.cmove.spot = { x: -3.4, z: 3.85 }; __t.cmove.ok = true; __t.movePlace(); return Math.abs(__t.DESENS_AT.x + 3.4) < 0.01 && !__t.cmove.item; }));
await page.waitForTimeout(2500);
await page.reload({ timeout: 300000 }); await ready(); await page.click("#mmContinue"); await page.waitForTimeout(1000);
check("save/reload keeps the counter layout and the hold", await ev(() => Math.abs(__t.DESENS_AT.x + 3.4) < 0.01 && __t.holds.length === 1));
await ev(() => {                                 // a store saved in 2026 (before the game was set in 1996): its dates move back
  __t.stopSaving(); const k = Object.keys(localStorage).find(k => k.startsWith("vaultbuster-save") && JSON.parse(localStorage.getItem(k))?.shift);
  const s = JSON.parse(localStorage.getItem(k)), dt = +new Date(2026, 9, 5, 12) - s.shift.date0; s.shift.date0 += dt;
  for (const r of Object.values(s.rentals || {})) if (r) r[1] += dt;
  localStorage.setItem(k, JSON.stringify(s)); });
await page.reload({ timeout: 300000 }); await ready(); await page.click("#mmContinue"); await page.waitForTimeout(1000);
check("an old 2026 save moves to 1996, rentals with it", await ev(() => __t.shiftDate().getFullYear() === 1996 && __t.posTerm.members.flatMap(m => m.rentals).every(r => r.due.getFullYear() < 1998)));

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
check("a gap in the schedule: out the door, back in, and not still heading home", await ev(() => {
  const e = __t.staff[0], d = __t.weekday(), h0 = __t.shift.h; e.sched = Array(7).fill(0); e.sched[d] = (0b11 << 3) | (0b111 << 6);   // 12-2, 3-6
  const run = (h, n) => { __t.shift.h = h; for (let i = 0; i < n; i++) __t.empTick(0.05); };
  run(12.2, 400); const on = !!e.c; run(14.2, 3000); const gone = !e.c; run(15.2, 400); const back = !!e.c && !e.leaving;
  __t.shift.h = h0; return on && gone && back; }));
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
check("the closet: carry the ladder out, set it up under a dead light, climb, swap the tube, put it back", await ev(() => {
  const L = __t.ladder, p = __t.player, tr = __t.TROFFERS[0];
  __t.lightDie(0, 0); const dead = __t.deadLights.length === 1;
  __t.ladderPickUp(); const carried = L.state === "carried";
  L.spot = { x: tr.x, z: tr.z + 0.2, ry: 0, ok: true }; __t.ladderPutDown();   // (as if set down right under it)
  const placed = L.state === "placed" && __t.colliders.includes(L.box);
  p.x = tr.x; p.z = tr.z + 1.4; __t.ladderClimb(); for (let i = 0; i < 40; i++) __t.ladderTick(0.05);
  const up = L.on && L.lift === 1;
  L.fix = { d: __t.deadLights[0], t: 0 }; for (let i = 0; i < 40; i++) __t.ladderTick(0.05);
  const fixed = !__t.deadLights.length;
  __t.ladderDown(); const down = !L.on && Math.hypot(p.x - L.x, p.z - L.z) > 0.6;
  __t.ladderPickUp(); __t.ladderStore();
  return dead && carried && placed && up && fixed && down && L.state === "stored" && !__t.colliders.includes(L.box) && __t.colliders.includes(L.stowBox); }));
check("the closet: the mop goes to the floor, works a spill over and cleans it", await ev(() => {
  __t.toolTake("mop"); const g = __t.TOOLS.mop.held, p = __t.player;
  __t.toolTick(0.016); const onFloor = g.parent === __t.scene && Math.abs(g.position.y - 0) < 0.05;
  __t.messAdd("spill", p.x - Math.sin(p.yaw) * 1.2, p.z - Math.cos(p.yaw) * 1.2); const m = __t.messes.at(-1);
  __t.scrubStart(m); const xs = [];
  for (let i = 0; i < 200 && __t.scrub(); i++) { __t.toolTick(0.02); xs.push(g.position.x + g.position.z); }
  const swept = Math.max(...xs) - Math.min(...xs) > 0.2;   // it went back and forth over it
  const cleaned = !__t.messes.includes(m); __t.toolReturn();
  return onFloor && swept && cleaned && !__t.toolHeld() && !g.parent && __t.TOOLS.mop.g.visible; }));
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
