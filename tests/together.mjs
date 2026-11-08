// Playing together, both sides in one browser: a host and a guest in two pages, paired by their codes (pasted, and the
// host's also read back off its QR to check it scans), then: linked, each sees the other, the time and a door go over.
//   node tests/together.mjs [--gpu]
import { chromium } from "playwright-core";
import { URL, findChromium } from "./browser.mjs";

// --gpu: the machine's real GPU, which loads the two pages far faster than software rendering
const gpu = process.argv.includes("--gpu");
const browser = await chromium.launch({ executablePath: findChromium(), args: [...(gpu ? ["--use-angle=default", "--enable-gpu"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]), "--ignore-gpu-blocklist",
  "--autoplay-policy=no-user-gesture-required", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });   // (the camera's a fake one, allowed without asking)
const errors = [], fails = [];
const open = async name => {
  const page = await (await browser.newContext({ viewport: { width: 1000, height: 700 }, deviceScaleFactor: 1 })).newPage();
  page.on("pageerror", e => errors.push(`${name}: ${e}`));
  page.on("console", m => { if (m.type() === "warning" && /Play together/.test(m.text())) console.log(`${name}: ${m.text()}`); });
  return page;
};
const ready = page => page.waitForFunction(() => !document.getElementById("mainMenu").hidden, null, { timeout: 300000 });
const check = (what, ok) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) fails.push(what); };
const state = page => page.evaluate("together.state");

const host = await open("host"), guest = await open("guest");
await Promise.all([host.goto(URL, { timeout: 300000 }), guest.goto(URL, { timeout: 300000 })]);
await Promise.all([ready(host), ready(guest)]);
await host.evaluate(() => { localStorage.clear(); localStorage.setItem("vaultbuster-save", JSON.stringify({ v: 3, mode: "sandbox", fresh: true })); localStorage.setItem("vaultbuster-name", "Alice"); });
await guest.evaluate(() => { localStorage.clear(); localStorage.setItem("vaultbuster-name", "Bob"); });
await host.reload({ timeout: 300000 }); await ready(host);

// the host: HOST, and a code on screen
await host.evaluate(s => document.querySelector(s).click(), "#mmTogetherBtn"); await host.evaluate(s => document.querySelector(s).click(), "#tgHost");
await host.waitForFunction("together.code", null, { timeout: 30000 });
const offer = await host.evaluate("together.code");
console.log(`host's code: ${offer.length} characters`);
check("the host's code reads back off its QR", await host.evaluate(() => {
  const cv = document.getElementById("tgQR"), g = cv.getContext("2d");
  return jsQR(g.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height)?.data === together.code;
}));
check("the host's camera is waiting on the reply", await host.evaluate("tgCam.want === 'a'"));

// the guest: JOIN, the host's code pasted, and a reload into the store as a guest
await guest.evaluate(s => document.querySelector(s).click(), "#mmTogetherBtn"); await guest.evaluate(s => document.querySelector(s).click(), "#tgJoin");
await Promise.all([guest.waitForNavigation({ timeout: 300000 }), guest.fill("#tgPaste", offer)]);
await ready(guest);
check("the guest reloaded as Alice's guest", await guest.evaluate("GUEST?.who") === "Alice");
await guest.waitForFunction("together.code", null, { timeout: 30000 });
const reply = await guest.evaluate("together.code");
check("the guest's reply is on its menu", await guest.evaluate("!document.getElementById('mmTogether').hidden && !document.getElementById('tgGive').hidden"));

// wrong codes are turned away
await host.fill("#tgPaste", offer);
check("the host's own code isn't taken as the reply", await host.evaluate("together.state === 'hosting' && /your own code/.test(document.getElementById('tgStatus').textContent)"));

// the host: the reply pasted, and the two linked
await host.fill("#tgPaste", reply);
await Promise.all([host, guest].map(p => p.waitForFunction("together.peer", null, { timeout: 60000 }).catch(() => {})));
check("host connected", await state(host) === "connected");
check("guest connected", await state(guest) === "connected");
check("the host sees Bob, the guest Alice", await host.evaluate("together.peer?.name") === "Bob" && await guest.evaluate("together.peer?.name") === "Alice");
check("the guest's menu says walk in", await guest.evaluate("!document.getElementById('mmMain').hidden && /WALK IN/.test(document.getElementById('playHint').textContent)"));

// in the store: where you are, the clock, a door
await host.evaluate("document.getElementById('mmBack')?.click?.()");
await host.evaluate(() => { __t.player.x = 3; __t.player.z = 12; });
await guest.waitForTimeout(1500);
const seen = await guest.evaluate(() => { const g = together.peer.c.group; return { v: g.visible, x: g.position.x, z: g.position.z }; });
check(`the guest sees the host where they are (${seen.x.toFixed(2)}, ${seen.z.toFixed(2)})`, seen.v && Math.abs(seen.x - 3) < 0.6 && Math.abs(seen.z - 12) < 0.6);
await host.evaluate(() => { __t.shift.h = 19.5; together.timeAt = 0; });
await guest.waitForTimeout(800);
check("the guest's clock is the host's", Math.abs(await guest.evaluate("shift.h") - 19.5) < 0.2);
const door = await host.evaluate(() => { const i = doors.findIndex(d => !d.push && !d.stall && !d.closer && !d.open && !d.locked); toggleDoor(doors[i]); return { i, open: doors[i].open, n: doors.length }; });
await guest.waitForTimeout(1000);
const there = await guest.evaluate(i => ({ open: doors[i].open, n: doors.length, locked: doors[i].locked }), door.i);
console.log(`door ${door.i}: host ${JSON.stringify(door)} · guest ${JSON.stringify(there)}`);
check("a door the host opens opens for the guest", door.open && there.open);

// the host leaves: the guest's sent home, and told why
await host.evaluate("tgStop()");
await guest.waitForNavigation({ timeout: 30000 }).catch(() => {}); await ready(guest);
check("the guest's back on their own menu, told the host left", await guest.evaluate("!GUEST && !document.getElementById('mmTogether').hidden && /left/.test(document.getElementById('tgStatus').textContent)"));

console.log(errors.length ? `page errors:\n${errors.join("\n")}` : "no page errors");
await browser.close();
process.exit(errors.length || fails.length ? 1 : 0);
