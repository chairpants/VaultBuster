// The world, as one .glb: a fresh store before opening, everything the game builds (every room, the roof, the lot,
// Tony's), grouped by room, for looking at or editing somewhere else (Blender, Godot). One way: the game doesn't
// read it back. Left out: people, lights, the sky and weather (shaders), and the unseen boxes things are aimed at by.
// Instanced things (the trees) go out as one ordinary mesh each: Godot doesn't read glTF's instancing extension.
//   node tests/export-glb.mjs ../VaultBusterGodot/world/vaultbuster.glb
// With --data first, no .glb: the things there are to use, as JSON (each door's hinge, swing and the floor it sweeps;
// every seat; the screens a tape plays on), for whatever's on the other end to work them the way the game does. And
// beside it tapes.json: every copy on the shelves, where its slot is, and the episodes on it.
//   node tests/export-glb.mjs --data ../VaultBusterGodot/data/interact.json
// With --people first, a cast: two dozen customers (and Dana, and your own body twice: uniformed, and not) as customers.js builds them (their jointed-blocks build, each joint
// named, so whatever's on the other end can pose them), a sheet of each one's face in every mood, and who they are.
//   node tests/export-glb.mjs --people ../VaultBusterGodot/people
// With --tony first: just Tony, from next door, beside them (tony.glb, tony.json, face_35.png).
//   node tests/export-glb.mjs --tony ../VaultBusterGodot/people
// With --extras first, a second .glb: what a fresh store hasn't got out (so the world's .glb hasn't either): the tapes
// of the library's locked tiers and their sections' signs, the second rewinder, and the rewinders as sports cars. It sits beside the world, on top of it.
//   node tests/export-glb.mjs --extras ../VaultBusterGodot/world/extras.glb
// With --cars first: one car of each style (and the rain on the storefront glass, as three pictures beside it).
//   node tests/export-glb.mjs --cars ../VaultBusterGodot/world/cars.glb
import { URL, launch } from "./browser.mjs";
import { resolve } from "path";
import { writeFileSync } from "fs";

const dataOnly = process.argv[2] === "--data", tonyOnly = process.argv[2] === "--tony", people = process.argv[2] === "--people" || tonyOnly, extras = process.argv[2] === "--extras", cars = process.argv[2] === "--cars", out = resolve(process.argv[dataOnly || people || extras || cars ? 3 : 2] || (dataOnly ? "interact.json" : people ? "people" : cars ? "cars.glb" : extras ? "extras.glb" : "vaultbuster.glb"));
const browser = await launch({ gpu: true });
const page = await (await browser.newContext({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (/GLTFExporter/.test(m.text()) && !/for best results/.test(m.text())) console.log("  ", m.text().slice(0, 160)); });
const ready = () => page.waitForFunction(() => !document.getElementById("mainMenu").hidden, null, { timeout: 300000 });
await page.goto(URL, { timeout: 300000 }); await ready();
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("vaultbuster-save", JSON.stringify({ v: 3, mode: "sandbox", fresh: true })); });
await page.reload({ timeout: 300000 }); await ready();
await page.click("#mmFiles .acts .go"); await page.waitForTimeout(4000);
await page.evaluate(() => __t.stopSaving());
// three's GLTFExporter, onto the page: the game's three.js is one plain script (vendor/three.js) with no import map, so the
// exporter's own `import ... from "three"` couldn't be loaded as a module. Bundled here from node_modules, with "three" the page's THREE
{
  const { build } = await import("esbuild");
  const r = await build({ stdin: { contents: `import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js"; window.GLTFExporter = GLTFExporter;`, resolveDir: resolve(import.meta.dirname, "..") },
    bundle: true, write: false, format: "iife", logLevel: "silent",
    plugins: [{ name: "page-three", setup(b) {
      b.onResolve({ filter: /^three$/ }, () => ({ path: "three", namespace: "page-three" }));
      b.onLoad({ filter: /.*/, namespace: "page-three" }, () => ({ contents: "module.exports = window.THREE", loader: "js" }));
    } }] });
  await page.addScriptTag({ content: r.outputFiles[0].text });
}

if (people) {
  const download = page.waitForEvent("download", { timeout: 600000 });
  const cast = await page.evaluate(async only => {
    const { GLTFExporter } = window;   // (put on the page below: see gltfExporter)
    const MOODS = ["neutral", "browse", "happy", "love", "meh", "wait", "impatient", "angry", "alarm", "thanks", "shifty", "ask", "off", "on", "shock", "watch"];
    const holder = new THREE.Scene(), who = [], random = Math.random;
    for (let i = only ?? 0; i < (only != null ? only + 1 : 35); i++) {   // (only: just the one, by its number. 35: Tony, from next door, as tonys/inside.js dresses him)                 // two dozen customers, Dana (in her uniform), you (in the uniform, and in your own clothes: player.js's me), and eight more in the uniform for whoever's hired (staff.js's rollApplicant: his khakis and polo, hers)
      const dana = i === 24, you = i === 25 || i === 26, crew = i > 26 && i < 35, female = dana || (!you && i % 2 === 1);
      const hired = crew && { ...VaultCustomers.randomOutfit(seeded(3000 + i * 13), female), top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, pants: female ? "jeans" : "khaki", pantsColor: "#b9a27a", shoes: "#1e1e1e", hat: null, sleeve: female ? "cap" : "short", hightop: false, tights: null };
      const yours = you && { ...VaultCustomers.randomOutfit(seeded(1985), false), height: 1, build: 1, hat: null, ...(i === 25 ? { top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, pants: "khaki", pantsColor: "#b9a27a", shoes: "#1e1e1e" } : {}) };
      const o = { ...(i === 35 ? { ...VaultCustomers.randomOutfit(seeded(4417), false), hat: null } : dana ? DANA_APP.outfit : yours || hired || VaultCustomers.randomOutfit(seeded(1000 + i * 7), female)), skinned: false };   // (skinned: false: the blocks, not the one stretched skin over them)
      const c = VaultCustomers.build(o), R = c.rig, body = c.group.children[0];
      const shown = new Set(c.parts.filter(p => p.visible)); c.holdTape(3); c.parts.filter(p => p.visible && !shown.has(p)).forEach((m, k) => m.name = `p${i}_tape${k}`);   // the tapes in their hand: there, to be hidden
      const N = n => `p${i}_${n}`;   // (every name its own: an importer may not allow two nodes one name, even under different parents)
      c.group.name = "p" + i; body.name = N("body"); R.upper.name = N("upper"); R.head.name = N("head"); R.neck.name = N("neck"); c.screen.name = N("screen");
      R.upper.children.find(m => m.isMesh).name = N("torso");
      R.legs.forEach((l, k) => { l.hip.name = N("hip" + k); l.knee.name = N("knee" + k); }); R.arms.forEach((a, k) => { a.sh.name = N("sh" + k); a.el.name = N("el" + k); a.hand.name = N("hand" + k); });
      for (const m of c.group.children) if (m.isMesh && m.geometry.type === "PlaneGeometry") m.visible = false;   // the blob of shadow under them
      // what they hold out at the counter (and the umbrella): each there, named, to be hidden till it's wanted
      const hidden = R.arms[0].el.children.filter(m => !m.visible), props = [];
      for (const name of ["card", "cash", "receipt", "form", "umbrella"]) { c.holdProp(name); const m = hidden.find(h => h.visible); if (m) { m.name = N("prop_" + name); props.push(m); } }
      c.holdProp(null);
      // their face in every mood, off the little canvas it's drawn on (no blinks: they'd be caught mid-blink)
      Math.random = () => 1;
      const fc = c.screen.material.map.image, sheet = document.createElement("canvas"); sheet.width = fc.width * 4; sheet.height = fc.height * 8;   // (and under them, the same sixteen mid-blink)
      const g = sheet.getContext("2d");
      c.tick(0.05, 0); c.tick(0.2, 0);
      MOODS.forEach((m, k) => { c.setMood(m); for (let n = 0; n < 5; n++) c.tick(0.05, 0); g.drawImage(fc, (k % 4) * fc.width, Math.floor(k / 4) * fc.height); });
      // ...and blinking: a blink's 0.12 s, so each is timed to start 0.15 s into the mood and be caught at 0.25, as the open-eyed one was
      Math.random = () => (0.12 - 2) / 3; c.tick(1.01, 0); c.tick(0.2, 0);
      MOODS.forEach((m, k) => { c.setMood(m); for (let n = 0; n < 5; n++) c.tick(0.05, 0); g.drawImage(fc, (k % 4) * fc.width, (4 + Math.floor(k / 4)) * fc.height); c.tick(0.05, 0); });
      Math.random = random;
      c.setMood("neutral"); c.tick(0.05, 0);
      for (const m of props) m.visible = true;
      c.group.traverse(n => { n.userData = {}; });
      holder.add(c.group);
      who.push({ height: o.height, build: o.build, female: !!o.female, gait: c.gait, staff: dana ? DANA_APP.first : i === 25 ? "You" : i === 26 ? "You (own clothes)" : crew ? "Crew" : i === 35 ? "Tony" : undefined, face: sheet.toDataURL("image/png") });
    }
    const glb = await new GLTFExporter().parseAsync(holder, { binary: true, onlyVisible: true });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })); a.download = "people.glb"; document.body.appendChild(a); a.click();
    return { moods: MOODS, who, mb: +(glb.byteLength / 1048576).toFixed(1) };
  }, tonyOnly ? 35 : null);
  const { mkdirSync } = await import("fs");
  mkdirSync(out, { recursive: true });
  await (await download).saveAs(resolve(out, tonyOnly ? "tony.glb" : "people.glb"));
  cast.who.forEach((w, i) => { writeFileSync(resolve(out, `face_${tonyOnly ? 35 : i}.png`), Buffer.from(w.face.split(",")[1], "base64")); delete w.face; });
  writeFileSync(resolve(out, tonyOnly ? "tony.json" : "people.json"), JSON.stringify(tonyOnly ? cast.who[0] : { moods: cast.moods, who: cast.who }, null, 1));
  console.log(out, { people: cast.who.length, mb: cast.mb });
  await browser.close(); process.exit(0);
}

if (cars) {                                      // the cars (one of each style, painted a colour nobody would: the other end paints them), and the rain on the glass
  const download = page.waitForEvent("download", { timeout: 600000 });
  const { mkdirSync } = await import("fs");
  const got = await page.evaluate(async () => {
    const { GLTFExporter } = window;   // (put on the page below: see gltfExporter)
    const holder = new THREE.Scene(); let s = 0;
    for (; s < 6; s++) {
      const c = driveIn({ s, c: 0xff00ff }, null), g = c.g; driveOut(c);   // (not parked yet: just gone, and the car's ours)
      g.name = "car" + s; g.position.set(0, 0, 0); g.rotation.set(0, 0, 0);
      let k = 0;
      g.traverse(m => {
        if (!m.isMesh) return;
        if (m.userData.pool) { m.visible = false; return; }
        if (m.userData.lamp) m.name = `car${s}_lamp_${m.userData.lamp}_${k++}`;
        if (m.material.color && m.material.color.getHex() === 0xff00ff) m.material.name = "paint";
      });
      g.userData = { L: g.userData.car.L, W: g.userData.car.W };
      g.traverse(m => { if (m !== g) m.userData = {}; });
      holder.add(g);
    }
    // the rain on the storefront glass: its three sheets (the beads, and two sets of runners), as they were drawn
    const glass = []; scene.traverse(o => { const im = o.isMesh && o.material.map && o.material.map.image; if (im && im.width === 256 && im.height === 512 && Math.abs(o.position.y - 1.55) < 0.01 && !glass.includes(im)) glass.push(im); });
    const glb = await new GLTFExporter().parseAsync(holder, { binary: true, onlyVisible: true });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })); a.download = "cars.glb"; document.body.appendChild(a); a.click();
    return { styles: s, sizes: holder.children.map(g => [g.userData.L, g.userData.W]), glass: glass.map(c => c.toDataURL("image/png")), mb: +(glb.byteLength / 1048576).toFixed(1) };
  });
  await (await download).saveAs(out);
  got.glass.forEach((d, i) => writeFileSync(resolve(out, "..", `glass_${i}.png`), Buffer.from(d.split(",")[1], "base64"))); got.glass = got.glass.length;
  console.log(out, got, errors.length ? errors : "");
  await browser.close(); process.exit(0);
}

if (extras) {                                    // what a fresh store hasn't got out yet, and so the world's .glb hasn't either
  const download = page.waitForEvent("download", { timeout: 600000 });
  const { existsSync, readFileSync } = await import("fs"), bareAt = resolve(out, "..", "bare.json");
  const got = await page.evaluate(async bare => {
    const { GLTFExporter } = window;   // (put on the page below: see gltfExporter)
    const holder = new THREE.Scene();
    // the library's locked tiers: every copy that isn't on the shelves yet, put out, and just those lifted out of the
    // shelves' merged meshes (a cover's 4 corners, a body's 24), each mesh under its own material
    // (and whatever else the world's .glb has nothing on the shelf for: the copies that were out on rental when it was
    // written. Which ones those were is bare.json beside it, as the other end reports them: godot -- --shot --bare)
    const locked = []; for (const t of catalog) for (const c of [t, ...(t.copies || [])]) if (c.slot && (c.libLocked || (bare ? bare.includes(copyKey(c)) : c.offShelf))) locked.push(c);
    for (let tier = 1; tier <= LIBRARY.length; tier++) libUnlock(tier);
    for (const c of locked) setOnShelf(c, true);
    const want = new Map();                        // mesh -> the vertices wanted from it
    const add = (mesh, v0, n) => { let w = want.get(mesh); if (!w) want.set(mesh, w = new Set()); for (let i = 0; i < n; i++) w.add(v0 + i); };
    for (const c of locked) { add(c.slot.cover, c.slot.cv, 4); add(bodyMesh, c.slot.bv, 24); }
    let k = 0;
    for (const [mesh, vs] of want) {
      const src = mesh.geometry, geo = new THREE.BufferGeometry(), order = [...vs].sort((a, b) => a - b), at = new Map(order.map((v, i) => [v, i]));
      for (const name of Object.keys(src.attributes)) {
        const A = src.attributes[name], out = new Float32Array(order.length * A.itemSize);
        order.forEach((v, i) => { for (let j = 0; j < A.itemSize; j++) out[i * A.itemSize + j] = A.array[v * A.itemSize + j]; });
        geo.setAttribute(name, new THREE.BufferAttribute(out, A.itemSize));
      }
      const idx = src.index ? src.index.array : order, tris = [];
      for (let i = 0; i + 2 < idx.length; i += 3) if (vs.has(idx[i]) && vs.has(idx[i + 1]) && vs.has(idx[i + 2])) tris.push(at.get(idx[i]), at.get(idx[i + 1]), at.get(idx[i + 2]));
      geo.setIndex(tris);
      const m = new THREE.Mesh(geo, mesh.material); m.name = `library_${k++}`;
      mesh.updateWorldMatrix(true, false); mesh.matrixWorld.decompose(m.position, m.quaternion, m.scale);
      for (const mt of [].concat(m.material)) if (mt.map && !mt.transparent && !mt.alphaTest) mt.map.userData.mimeType = "image/jpeg";
      holder.add(m);
    }
    // the signs that said COMING SOON, as they read once the section's in (named for the tier that takes: the last of
    // theirs): each section's header strip, the endcaps' genre lists, the MONSTERVISION topper
    const tierOf = cat => LIBRARY.findIndex(L => L.cats.includes(cat)) + 1;
    let signs = 0;
    const sign = (o, tier, kind) => { o.updateWorldMatrix(true, true); const c = o.clone(true); c.name = `${kind}${signs++}_tier${tier}`; o.matrixWorld.decompose(c.position, c.quaternion, c.scale); c.visible = true; holder.add(c); };
    scene.traverse(o => { o.userData = {}; });
    const strips = Object.entries(catStripMat).filter(([cat]) => cat !== "__soon" && tierOf(cat)), tags = endTags.map(t => [t.mat, Math.max(0, ...t.cats.map(tierOf))]).filter(([, tier]) => tier);
    const using = []; scene.traverse(o => { if (!o.isMesh) return; for (const [cat, m] of strips) if (o.material === m) using.push([o, tierOf(cat), "strip"]); for (const [m, tier] of tags) if (o.material === m) using.push([o, tier, "tag"]); });
    for (const [o, tier, kind] of using) sign(o, tier, kind);
    if (mvTopper) sign(mvTopper, tierOf("MonsterVision"), "topper");
    // the rewinders: the second one (bought later) as the plain box, and both as the sports car (the high-speed upgrade)
    rewinderOn(rewinders[1], true);
    const copy = (rw, name) => { rw.g.traverse(o => { o.userData = {}; }); rw.g.updateWorldMatrix(true, true); const g = rw.g.clone(true); g.name = name; rw.g.matrixWorld.decompose(g.position, g.quaternion, g.scale); holder.add(g); };
    copy(rewinders[1], "rewinder2_box");
    rewinders.forEach((rw, i) => { rewinderKit.model(rw, true); copy(rw, `rewinder${i + 1}_car`); });
    holder.traverse(o => { o.userData = {}; });
    const glb = await new GLTFExporter().parseAsync(holder, { binary: true, onlyVisible: true });
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })); a.download = "extras.glb"; document.body.appendChild(a); a.click();
    return { tapes: locked.length, meshes: k, signs, mb: +(glb.byteLength / 1048576).toFixed(1) };
  }, existsSync(bareAt) ? JSON.parse(readFileSync(bareAt, "utf8")) : null);
  await (await download).saveAs(out);
  console.log(out, got, errors.length ? errors : "");
  await browser.close(); process.exit(0);
}

if (dataOnly) {
  const data = await page.evaluate(() => {
    const r = v => +v.toFixed(4), box = b => ({ x0: r(b.x0), x1: r(b.x1), z0: r(b.z0), z1: r(b.z1) });
    const seat = (s, kind) => ({ kind, x: r(s.y != null ? s.x : Math.sign(s.x) * Math.max(0, Math.abs(s.x) - 0.04)), y: r(s.y || 0), z: r(s.z), ry: r(s.ry || 0), hipY: s.hipY ?? 0.5 });   // (the couch's: a hair inboard, as meTick sits you)
    return {
      doors: doors.map(d => ({ x: r(d.pivot.position.x), z: r(d.pivot.position.z), base: r(d.base), openA: r(d.openA), push: d.push, locked: d.locked, at: r(d.at), c: r(d.c), alongX: d.alongX, hinge: d.hinge, shut: box(d.shut), openBox: box(d.openBox) })),
      frontDoor: { x: r(frontDoor.leaves[1].position.x), z: r(frontDoor.leaves[1].position.z), near: { x: 0.9, z: -0.2, r: 1.3 }, openA: -1.35 },   // the right leaf (see frontDoorTick)
      screens: [[screenMesh, "tv", 4.5], [theaterScreenMesh, "theater", 9]].filter(([m]) => m).map(([m, kind, reach]) => {   // where a tape plays: E on one from within reach (see vcrUse)
        const p = m.getWorldPosition(new THREE.Vector3()), n = m.getWorldDirection(new THREE.Vector3());
        return { kind, x: r(p.x), y: r(p.y), z: r(p.z), ry: r(Math.atan2(n.x, n.z)), w: m.geometry.parameters.width, h: m.geometry.parameters.height, reach };
      }),
      // every other screen a tape shows on (the monitors hung over the aisles): where it is, which way it faces, how big
      minis: miniScreens.filter(m => m !== screenMesh && m !== theaterScreenMesh).map(m => {
        const p = m.getWorldPosition(new THREE.Vector3()), q = m.getWorldQuaternion(new THREE.Quaternion()), s = m.getWorldScale(new THREE.Vector3());
        return { p: [r(p.x), r(p.y), r(p.z)], q: [r(q.x), r(q.y), r(q.z), r(q.w)], w: r(m.geometry.parameters.width * s.x), h: r(m.geometry.parameters.height * s.y) };
      }),
      // the counter's pass-through: the leaf lifts (about z, at its pivot), the half gate under it swings in (about y)
      flap: { pivot: flapPivot.position.toArray().map(r), gate: flapGate.position.toArray().map(r), openA: r(flapOpenA), gateA: r(Math.PI / 2), box: box(flapCollider) },
      // the ladders: each one's rungs (x, z), and its climb (where the camera goes, which way you face, where you step off: CLIMBS)
      ladders: { roofY: ROOF.y, dur: 3.4,
        hatch: { x: ROOF_LADDER.x, z: ROOF_LADDER.z, climb: CLIMBS.hatch, lid: roof.lid.getWorldPosition(new THREE.Vector3()).toArray().map(r), lidA: 1.45 },
        back: { x: BACK_LADDER.x, z: BACK_LADDER.z, mid: BACK_LADDER.mid, raise: BACK_LADDER.raise, climb: CLIMBS.back } },
      // the lights: every switch (which zone, where its rocker is; plates: the zones that share a plate), the zones' rooms
      // (the room shader's boxes: uFloorBox x0 x1 z1 ceiling, uBohBox x0 x1 hall|rooms z z1, uBohSplit breakroom|restroom x and ceiling, ...), the side lamps
      lights: {
        zones: Object.fromEntries(LIGHT_ZONES.map(z => [z, zoneOn[z]])), names: ZONE_NAMES, plates: switchPlate,
        switches: switchToggles.map(t => ({ zone: t.zone, p: t.mesh.getWorldPosition(new THREE.Vector3()).toArray().map(r) })),
        boxes: { floor: TVU.uFloorBox.value.toArray().map(r), boh: TVU.uBohBox.value.toArray().map(r), bohSplit: TVU.uBohSplit.value.toArray().map(r), lobby: TVU.uLobbyBox.value.toArray().map(r), theater: TVU.uThBox.value.toArray().map(r) },
        lamps: lamps.map(l => ({ p: l.getWorldPosition(new THREE.Vector3()).toArray().map(r), on: !!l.userData.on, color: l.color.getHex(), energy: LAMP_ON, range: l.distance })),
        // the closet's bare bulb: its pull (what you aim at) and the glass (what lights up)
        closet: (() => { const parts = aimables.filter(o => o.userData.lightZone === "closet" && o.isMesh), b = new THREE.Box3(); for (const o of parts) b.expandByObject(o);
          const glass = parts.find(o => o.material === closetBulb.mat); return { at: b.getCenter(new THREE.Vector3()).toArray().map(r), bulb: glass ? glass.getWorldPosition(new THREE.Vector3()).toArray().map(r) : null }; })(),
        // every light object in the scene (a few: the lobby's, the lot's and the street's lamps): on is its strength when it's lit
        // (the lot's are dark by day, so now is 0), zone the switch it's on, if any
        scene: (() => { const out = []; scene.traverse(o => { if (!o.isLight || o.isAmbientLight || o.isHemisphereLight || o.isDirectionalLight) return;
          const p = o.getWorldPosition(new THREE.Vector3()), t = o.isSpotLight ? o.target.getWorldPosition(new THREE.Vector3()) : null;
          out.push({ kind: o.isSpotLight ? "spot" : "point", p: p.toArray().map(r), to: t ? t.toArray().map(r) : null, color: o.color.getHex(), on: r(o.userData.on ?? o.intensity), now: r(o.intensity), zone: o.userData.zone || null, range: r(o.distance || 0), angle: o.isSpotLight ? r(o.angle) : null }); });
          return out; })(),
      },
      // the loose and the small: where each is, and its numbers
      things: (() => {
        const at = o => o.getWorldPosition(new THREE.Vector3()).toArray().map(r);
        const mid = os => { const b = new THREE.Box3(); for (const o of os) b.expandByObject(o); return b.getCenter(new THREE.Vector3()).toArray().map(r); };   // the middle of a few meshes
        const tagged = t => aimables.filter(o => o.userData[t]);
        const sh = roof.cine.sheet, u = roof.cineU.uImg.value;
        return {
          stool: { x: r(stool.x), z: r(stool.z), ...STOOL },                       // seat height, how far ahead it's carried, a shove's spin, its cap, the bearing's drag
          cutout: { x: r(cutout.x), z: r(cutout.z), ry: r(cutout.ry) },            // the standee
          cooler: { pivot: at(coolerDoor), openA: 1.75, hit: mid(tagged("coolerDoor")) },
          lock: { at: mid(tagged("frontLock")), turn: at(frontLock.turn), wall: box(frontWallBox) },
          flush: { at: mid(tagged("flush")), water: bath.water ? at(bath.water) : null, drop: 0.07 },
          towels: tagged("towels").length ? { at: mid(tagged("towels")) } : null,
          sink: tagged("sink").length ? { at: mid(tagged("sink")), spout: bath.sinkAt.map(r) } : null,
          bed: { at: mid(tagged("bed")) },
          tools: Object.fromEntries(Object.entries(TOOLS).map(([id, t]) => [id, { label: t.label, home: at(t.home), size: ["width", "height", "depth"].map(k => t.home.geometry.parameters[k]) }])),   // the janitor's closet: where each tool lives (the box it's put back in)
          ladder: (() => { const b = new THREE.Box3().setFromObject(ladder.g), c = b.getCenter(new THREE.Vector3()), z = b.getSize(new THREE.Vector3()); return { home: c.toArray().map(r), size: z.toArray().map(r) }; })(),   // the step ladder, folded against the closet wall
          troffers: TROFFERS.map(t => [r(t.x), r(t.y), r(t.z)]),   // every ceiling light panel (a tile each: 1.8 x 0.9)
          bins: Object.values(trashBins).map(b => ({ id: b.id, name: b.name, cap: b.cap, x: b.x, z: b.z, rimY: b.rimY ?? 0.9, r: b.r ?? 0.25, towels: !!b.towels, stand: b.stand })),
          chute: { at: chute.at, stand: chute.stand },
          snacks: snackUnits().map(u => { const n = u.parent.getWorldDirection(new THREE.Vector3()); return { n: u.userData.snack.name, k: u.userData.snack.kind || "", at: at(u), f: [r(n.x), r(n.z)], lane: `${u.parent.uuid.slice(0, 8)}|${u.userData.snack.name}|${Math.round(u.position.x * 100)}`, lz: r(u.position.z), ly: r(u.position.y) }; }),   // every snack and drink on the racks: what it is (k: a drink's kind), where, which way its fixture faces, its lane (front and top are taken first)
          cupboards: aimables.filter(m => m.userData.stock).map(m => ({ kind: m.userData.stock, at: at(m) })),   // the stock cupboards' doors, behind the counter
          phone: PHONE_AT.toArray(), holds: HOLDS_AT.toArray(),   // the desk phone and the holds tray, on the back cabinet
          rewinders: rewinders.filter(rw => rw.tapeMesh.parent?.visible !== false).map(rw => at(rw.tapeMesh)),   // the counter's rewinder(s): where the tape sits in each
          // Returns: the slot customers drop tapes into (from the lane), and the bin behind it you take them out of
          returns: { slot: at(returnSlotMesh), bin: mid(tagged("returns")) },
          // the counter's working parts: the register, the desensitizer pad, the receipt printer; where the clerk stands; what a tape rents for
          register: { pos: mid(tagged("pos")), pad: mid(tagged("desens")), printer: mid(tagged("printer")), post: EMP_POST, rate: { new: 3.99, catalog: 1.99 } },
          cine: { proj: mid(roof.cine.proj), vcr: mid(roof.cine.vcr),               // the movie on the roof: the projector, its VCR, the sheet (and the part of it the picture lands on)
            sheet: { p: at(sh), q: sh.getWorldQuaternion(new THREE.Quaternion()).toArray().map(r), w: r(sh.geometry.parameters.width), h: r(sh.geometry.parameters.height), img: [u.x, u.y, u.z, u.w].map(r) } },
        };
      })(),
      // where people can walk: the grid the customers' paths are found on (NAV), and every solid thing on the floor
      // (not the doors they open on the way, nor what gets carried about, nor anyone standing there)
      nav: (() => { const not = new Set([...doors.filter(d => !d.locked).flatMap(d => [d.shut, d.openBox]), stool.box, cutout.box, ...staff.map(e => e.box), ...custs.map(k => k.box)]);
        return { ...NAV, door: CUST_DOOR, outside: OUTSIDE_IN, inside: INSIDE_DOOR, counter: CUST_COUNTER, colliders: colliders.filter(c => !not.has(c)).map(c => [r(c.x0), r(c.x1), r(c.z0), r(c.z1)]) }; })(),
      seats: [...SEATS.map(s => seat(s, "couch")), seat(bath.seat, "toilet"), ...theaterSeats.map(s => seat(s.seat || s, "theater")), ...roof.seats.map(h => seat(h.userData.seatPos, "roof"))],
    };
  });
  writeFileSync(out, JSON.stringify(data, null, 1));
  const tapes = await page.evaluate(() => {
    const r = v => +v.toFixed(4);
    return catalog.flatMap(t => [t, ...(t.copies || [])]).filter(c => c.pos).map(c => ({ k: copyKey(c), t: tapeName(c), c: c.category, n: c.newRelease ? 1 : 0, p: [r(c.pos.x), r(c.pos.y), r(c.pos.z)], ry: r(c.ry), e: c.seasons[0].episodes }));
  });
  const tapesOut = resolve(out, "..", "tapes.json");
  writeFileSync(tapesOut, JSON.stringify({ size: { w: 0.032, h: 0.192, d: 0.105 }, tapes }));   // size: TAPE (thick, tall, wide: the cover's on a wide face)
  console.log(out, { doors: data.doors.length, seats: data.seats.length, screens: data.screens.length }, tapesOut, { tapes: tapes.length });
  await browser.close(); process.exit(0);
}

const download = page.waitForEvent("download", { timeout: 600000 });
const stats = await page.evaluate(async () => {
  const { GLTFExporter } = window;   // (put on the page below: see gltfExporter)
  roomSort(); window.regionTick = () => {};      // everything filed into its room, and no room hidden for being out of sight
  for (const [r, g] of Object.entries(roomGroups)) { g.visible = true; g.name = r; }
  roof.g.visible = true; roof.g.name = "roof";
  const people = new Set([me.group, ...staff.map(e => e.c?.group), ...custs.map(k => k.c?.group)]);
  const n = { meshes: 0, tris: 0, instanced: 0, shader: 0, unseen: 0, people: 0, lights: 0, doors: 0 }, inst = [];
  scene.traverse(o => {
    if (people.has(o)) { o.visible = false; n.people++; return; }
    if (o.isLight) { o.visible = false; n.lights++; return; }
    if (o.isSprite || o.isPoints || o.isCamera) { o.visible = false; return; }
    if (o.userData.door) { o.name = "door"; n.doors++; }
    o.userData = {};                                // (the game's own bookkeeping: it points back into the game, and can't be written out)
    if (!o.isMesh) return;
    const ms = [].concat(o.material);
    if (ms.some(m => m.isShaderMaterial || m === mat.cloud)) { o.visible = false; n.shader++; return; }   // (the clouds too: they drift, so they're not part of the place)
    if (!o.visible || ms.every(m => m.visible === false)) { o.visible = false; n.unseen++; return; }
    if (o.isInstancedMesh) { n.instanced++; inst.push(o); }
    n.meshes++; n.tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    for (const m of ms) if (m.map && !m.transparent && !m.alphaTest) m.map.userData.mimeType = "image/jpeg";   // (opaque pictures: the cover atlases would be enormous as PNGs)
  });
  for (const l of frontDoor.leaves) l.name = "door_front";
  const M = new THREE.Matrix4(), C = new THREE.Color();
  for (const im of inst) {                         // every copy, moved to where it stands (and tinted its own colour), all in one mesh
    im.visible = false; if (Array.isArray(im.material) || !im.count) continue;
    const gs = [];
    for (let i = 0; i < im.count; i++) {
      const g = im.geometry.clone(); im.getMatrixAt(i, M); g.applyMatrix4(M);
      if (im.instanceColor) {
        im.getColorAt(i, C); const was = g.attributes.color, k = g.attributes.position.count, a = new Float32Array(k * 3);
        for (let v = 0; v < k; v++) { a[v * 3] = C.r * (was ? was.getX(v) : 1); a[v * 3 + 1] = C.g * (was ? was.getY(v) : 1); a[v * 3 + 2] = C.b * (was ? was.getZ(v) : 1); }
        g.setAttribute("color", new THREE.BufferAttribute(a, 3));
      }
      gs.push(g);
    }
    const mat = im.instanceColor ? Object.assign(im.material.clone(), { vertexColors: true }) : im.material, m = new THREE.Mesh(mergeGeometries(gs), mat);
    m.name = im.name; m.position.copy(im.position); m.quaternion.copy(im.quaternion); m.scale.copy(im.scale); im.parent.add(m);
  }
  // names to find things by: what shape it is and how big ("box 1.20 x 0.90 x 0.05"), a group by how many parts it has;
  // and whatever sits across two rooms (walls, mostly) under one node of its own, not loose at the top
  const box = new THREE.Box3(), size = new THREE.Vector3(), rooms = new Set([...Object.values(roomGroups), roof.g]), between = new THREE.Group();
  between.name = "between_rooms"; scene.add(between);
  for (const o of [...scene.children]) if (!rooms.has(o) && o !== between && o.visible && (o.isMesh || o.isGroup)) between.add(o);
  scene.traverse(o => {
    if (o.name || !o.visible) return;
    if (o.isMesh) {
      o.geometry.computeBoundingBox(); o.geometry.boundingBox.getSize(size).multiply(o.scale);
      o.name = `${o.geometry.type.replace("Geometry", "").replace("Buffer", "mesh").toLowerCase() || "mesh"} ${[size.x, size.y, size.z].map(v => Math.abs(v).toFixed(2)).join(" x ")}`;
    } else if (o.isGroup && o.children.length) o.name = `group of ${o.children.length}`;
  });
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })); a.download = "world.glb"; document.body.appendChild(a); a.click();
  return { ...n, tris: Math.round(n.tris), mb: +(glb.byteLength / 1048576).toFixed(1) };
});
await (await download).saveAs(out);
console.log(out, stats);
if (errors.length) console.log("page errors:\n" + errors.slice(0, 5).join("\n"));
await browser.close();
