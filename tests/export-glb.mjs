// The world, as one .glb: a fresh store before opening, everything the game builds (every room, the roof, the lot,
// Tony's), grouped by room, for looking at or editing somewhere else (Blender, Godot). One way: the game doesn't
// read it back. Left out: people, lights, the sky and weather (shaders), and the unseen boxes things are aimed at by.
// Instanced things (the trees) go out as one ordinary mesh each: Godot doesn't read glTF's instancing extension.
//   node tests/export-glb.mjs ../VaultBusterGodot/world/vaultbuster.glb
// With --data first, no .glb: the things there are to use, as JSON (each door's hinge, swing and the floor it sweeps;
// every seat; the screens a tape plays on), for whatever's on the other end to work them the way the game does. And
// beside it tapes.json: every copy on the shelves, where its slot is, and the episodes on it.
//   node tests/export-glb.mjs --data ../VaultBusterGodot/data/interact.json
import { URL, launch } from "./browser.mjs";
import { resolve } from "path";
import { writeFileSync } from "fs";

const dataOnly = process.argv[2] === "--data", out = resolve(process.argv[dataOnly ? 3 : 2] || (dataOnly ? "interact.json" : "vaultbuster.glb"));
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
          cine: { proj: mid(roof.cine.proj), vcr: mid(roof.cine.vcr),               // the movie on the roof: the projector, its VCR, the sheet (and the part of it the picture lands on)
            sheet: { p: at(sh), q: sh.getWorldQuaternion(new THREE.Quaternion()).toArray().map(r), w: r(sh.geometry.parameters.width), h: r(sh.geometry.parameters.height), img: [u.x, u.y, u.z, u.w].map(r) } },
        };
      })(),
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
  const { GLTFExporter } = await import("https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/exporters/GLTFExporter.js");
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
