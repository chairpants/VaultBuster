// The world, as one .glb: a fresh store before opening, everything the game builds (every room, the roof, the lot,
// Tony's), grouped by room, for looking at or editing somewhere else (Blender, Godot). One way: the game doesn't
// read it back. Left out: people, lights, the sky and weather (shaders), and the unseen boxes things are aimed at by.
// Instanced things (the trees) go out as one ordinary mesh each: Godot doesn't read glTF's instancing extension.
//   node tests/export-glb.mjs ../VaultBusterGodot/world/vaultbuster.glb
import { URL, launch } from "./browser.mjs";
import { resolve } from "path";

const out = resolve(process.argv[2] || "vaultbuster.glb");
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
    if (ms.some(m => m.isShaderMaterial)) { o.visible = false; n.shader++; return; }
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
  const glb = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 });
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([glb], { type: "model/gltf-binary" })); a.download = "world.glb"; document.body.appendChild(a); a.click();
  return { ...n, tris: Math.round(n.tris), mb: +(glb.byteLength / 1048576).toFixed(1) };
});
await (await download).saveAs(out);
console.log(out, stats);
if (errors.length) console.log("page errors:\n" + errors.slice(0, 5).join("\n"));
await browser.close();
