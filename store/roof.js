// ---------------- the roof ----------------
// Up the fixed ladder in the janitor's closet (beside the chute) and out through a hatch: a flat gravel roof behind a
// 3 ft parapet all the way round, with the building's kit on it. Two rooftop AC units (their condenser fans going in
// the warm months), a whirlybird vent turning in the wind, mushroom exhaust fans over the restroom and the break
// room, a satellite dish, an old TV antenna, vent stacks, drains, walkway pads out to the units. Up here is its own
// level: its own colliders (the parapets and the kit), the inside of the store isn't drawn, the camera's on the deck.
// And now that you can see it from up there, the world around the building: the stucco outside of its walls, a
// paved apron round the sides and back with the dumpster, grass beyond, and the pizza place next door
const roof = { g: new THREE.Group(), cols: [], ladderParts: [], climb: null, cam: new THREE.Vector3(), fans: [], units: [], turbine: null, lid: null, lidA: 0, bulb: null, sign: null, puddles: null, grime: null, shades: null, smoke: null, seats: [] };
scene.add(roof.g); roof.g.visible = false;
const ROOF_LADDER = { x: 12.2, z: 28.28 };                 // the rungs' line: against the closet's south wall, beside the chute
const ROOF_HATCH = { x0: 11.88, x1: 12.48, z0: 28.12, z1: 28.87 };
const ROOF_UP = { x: 11.4, z: 29.3 }, ROOF_DOWN = { x: 11.68, z: 28.8 };   // where you step off at the top / at the bottom
const onDeck = (x, z) => ROOF.rects.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
const playerFloor = () => player.onRoof ? ROOF.y : floorHeightAt(player.x, player.z);
const roofHandsFull = () => stool.carried || cutout.carried || ladder.state === "carried" || boxCarry.length || bagCarry.length || toolHeld || cmove.item;
{
  const Y = ROOF.y, G = roof.g, T = 0.2, PH = ROOF.wall;
  const lam = c => new THREE.MeshLambertMaterial({ color: c }), phong = (c, s = 60) => new THREE.MeshPhongMaterial({ color: c, specular: 0x555555, shininess: s });
  const put = (geo, m, x, y, z, par = G) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
  const bx = (w, h, d, m, x, y, z, par) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z, par);
  const cy = (rt, rb, h, m, x, y, z, seg = 16, par) => put(new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y, z, par);
  const col = (x0, x1, z0, z1) => roof.cols.push({ x0, x1, z0, z1 });
  const ext = o => { o.traverse(k => k.layers.set(EXTERIOR_LAYER)); return o; };   // (the world outside: lit by the sun / moon rig only)
  const stick = (a, b, r, m, par = G) => { const d = new THREE.Vector3().subVectors(b, a), o = put(new THREE.CylinderGeometry(r, r, d.length(), 8), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, par); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; };
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const galv = phong(0xa9aeb3, 40), alum = phong(0xd3d6da, 80), dark = lam(0x2a2c2f), beige = phong(0xd9d3c3, 20), cement = lam(0x9d9a92);

  // ---- the deck: gravel ballast over the membrane, one sheet over the whole outline (a hole for the hatch) ----
  const P = [[-7.84, -0.1], [11.1, -0.1], [11.1, 27.9], [12.7, 27.9], [12.7, 29.9], [11.1, 29.9], [11.1, 33.1], [1.33, 33.1], [1.33, 46.6], [-7.07, 46.6], [-7.07, 33.1], [-7.84, 33.1]];
  const gravelTex = makeTexture((ctx, W, H) => {   // 1.2 m of pea gravel: thousands of rounded stones, each lit from the top left
    ctx.fillStyle = "#77736c"; ctx.fillRect(0, 0, W, H);
    const cols = ["#a8a49b", "#6f6b64", "#bdb6a8", "#5d5a55", "#9a8f7d", "#c9c2b3", "#837d72", "#b1a48d"];
    for (let i = 0; i < 9000; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 2 + Math.random() * 3.5, a = Math.random() * 3;
      for (const [dx, dy] of [[0, 0], [W, 0], [-W, 0], [0, H], [0, -H]]) {   // (tiles seamlessly)
        if (dx || dy) { if (x + dx < -8 || x + dx > W + 8 || y + dy < -8 || y + dy > H + 8) continue; }
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(x + dx + 1.2, y + dy + 1.2, r, r * 0.75, a, 0, 7); ctx.fill();
        ctx.fillStyle = cols[i % cols.length]; ctx.beginPath(); ctx.ellipse(x + dx, y + dy, r, r * 0.75, a, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.22)"; ctx.beginPath(); ctx.ellipse(x + dx - r * 0.3, y + dy - r * 0.25, r * 0.4, r * 0.3, a, 0, 7); ctx.fill();
      }
    }
  }, 512, 512);
  gravelTex.wrapS = gravelTex.wrapT = THREE.RepeatWrapping; gravelTex.repeat.set(1 / 1.2, 1 / 1.2); gravelTex.anisotropy = 8;
  const gravel = new THREE.MeshLambertMaterial({ map: gravelTex });
  WX_GROUND.push({ m: gravel, dry: new THREE.Color(0xffffff), wet: new THREE.Color(0x8a8f96), snow: 1 });   // gets wet and snowed on like the lot
  {
    const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z))), hole = new THREE.Path();
    const { x0, x1, z0, z1 } = ROOF_HATCH; hole.moveTo(x0, -z0); hole.lineTo(x0, -z1); hole.lineTo(x1, -z1); hole.lineTo(x1, -z0); hole.lineTo(x0, -z0); sh.holes.push(hole);
    const deck = put(new THREE.ShapeGeometry(sh), gravel, 0, Y, 0); deck.rotation.x = -Math.PI / 2;   // (shape y = -world z; its uvs are world metres)
  }

  // ---- parapets: a wall just inside every edge, the stucco skin outside it all the way down, aluminium coping on top ----
  const stucco = lam(0xcdbf9f), base = lam(0x8f8573), coping = phong(0xc2c6cb, 50), fasciaBlue = lam(0x00349c), fasciaY = lam(0xf2c200);
  const membrane = new THREE.MeshLambertMaterial({ map: makeTexture((ctx, W, H) => {   // 3 m of the parapet's inside: the roof's white sheet run up it, weathered
    ctx.fillStyle = "#c4c5bf"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 2500; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "60,58,52" : "255,255,250"},${0.03 + Math.random() * 0.05})`; ctx.fillRect(Math.random() * W, Math.random() * H, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    for (let i = 0; i < 26; i++) {                 // grime streaks run down from under the coping
      const x = Math.random() * W, w = 2 + Math.random() * 7, h = H * (0.25 + Math.random() * 0.6), g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(70,64,55,${0.12 + Math.random() * 0.15})`); g.addColorStop(1, "rgba(70,64,55,0)"); ctx.fillStyle = g; ctx.fillRect(x, 18, w, h);
    }
    const d = ctx.createLinearGradient(0, H, 0, H * 0.65); d.addColorStop(0, "rgba(78,70,58,0.6)"); d.addColorStop(1, "rgba(78,70,58,0)"); ctx.fillStyle = d; ctx.fillRect(0, H * 0.65, W, H * 0.35);   // splash from the gravel
    ctx.fillStyle = "#8f9397"; ctx.fillRect(0, 10, W, 6); ctx.fillStyle = "#3d3b37"; ctx.fillRect(0, 8, W, 2);   // the termination bar and its bead of caulk
    for (let x = 12; x < W; x += 38) { ctx.fillStyle = "#55585b"; ctx.fillRect(x, 12, 2, 2); }
    ctx.fillStyle = "rgba(0,0,0,0.16)"; ctx.fillRect(4, 16, 3, H); ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.fillRect(7, 16, 1, H);   // the welded lap between sheets
  }, 512, 160) });
  const tileU = (o, k) => { const uv = o.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (i >= 16 ? k : i < 8 ? 0.07 : 1)); return o; };   // (a box face's u runs 0..1 across its length: repeat it every 3 m along the long faces, the ends a sliver of it)
  const joints = [];                               // where the coping's 10 ft lengths meet, a cover plate over each joint
  const skin = new THREE.Group(); scene.add(skin);   // (the building's outside, in the scene not the roof group: seen from up here over the edge, and from anywhere out there)
  for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx_, bz] = P[(i + 1) % P.length], len = Math.hypot(bx_ - ax, bz - az), dx = (bx_ - ax) / len, dz = (bz - az) / len;
    let nx = -dz, nz = dx; const mx = (ax + bx_) / 2, mz = (az + bz) / 2;
    if (!onDeck(mx + nx * 0.05, mz + nz * 0.05)) { nx = -nx; nz = -nz; }   // n: inward, onto the deck
    const along = Math.abs(dx) > 0.5, ry = along ? 0 : Math.PI / 2;
    const wall = (inset, th, y0, y1, m, extra = 0, par = G) => { const o = bx(len + extra, y1 - y0, th, m, mx + nx * inset, (y0 + y1) / 2, mz + nz * inset, par); o.rotation.y = ry; return o; };
    tileU(wall(T / 2, T, Y, Y + PH, membrane), len / 3);                     // the parapet, its inside face in the roof's membrane
    wall(0.02, 0.4, Y + PH, Y + PH + 0.05, coping, 0.32);                    // coping over wall and skin
    for (let s = 3.05; s < len - 0.3; s += 3.05) joints.push([ax + dx * s + nx * 0.02, az + dz * s + nz * 0.02, ry]);
    const front = Math.abs(az + 0.1) < 0.01 && Math.abs(bz + 0.1) < 0.01;  // the storefront: above the glass only, a blue fascia with a yellow stripe
    if (front) {                                   // (2 cm thicker and longer than the sides' skin: it laps over their ends at the corners, no faces in the same plane)
      wall(-0.085, 0.17, 2.75, Y + PH, fasciaBlue, 0.34, skin); wall(-0.1, 0.2, 3.45, 3.6, fasciaY, 0.4, skin);
    } else { wall(-0.075, 0.15, 0, Y + PH, stucco, 0.3, skin); wall(-0.1, 0.16, 0, 0.5, base, 0.36, skin); }   // a darker band at the foot: 3 cm proud of the stucco at its face and ends, its back 2 cm inside it (flush, its back fought the stucco's in the return beside the storefront glass)
    if (along) col(Math.min(ax, bx_), Math.max(ax, bx_), Math.min(az, az + nz * T), Math.max(az, az + nz * T));
    else col(Math.min(ax, ax + nx * T), Math.max(ax, ax + nx * T), Math.min(az, bz), Math.max(az, bz));
  }
  {
    const jm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.012, 0.44), phong(0xd4d8dc, 70), joints.length), o = new THREE.Object3D();
    joints.forEach(([x, z, ry], i) => { o.position.set(x, Y + PH + 0.056, z); o.rotation.set(0, ry, 0); o.updateMatrix(); jm.setMatrixAt(i, o.matrix); });
    skin.add(jm);
  }
  ext(skin);

  // ---- the hatch: a curb round the opening, a lid that props open while you're up here, the ladder's rails through it ----
  {
    const { x0, x1, z0, z1 } = ROOF_HATCH, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, CH = 0.35, steel = phong(0x8b9096, 30), CLOSET_Z0 = STORE.z + WALL_T / 2;   // (the closet's south wall face)
    const hatch = new THREE.Group(); scene.add(hatch);              // (out in the scene: the shut lid is what you see looking up from the closet)
    const add = (w, h, d, m, x, y, z, par = hatch) => bx(w, h, d, m, x, y, z, par);
    add(x1 - x0 + 0.12, CH, 0.06, steel, cx, Y + CH / 2, z0 - 0.03); add(x1 - x0 + 0.12, CH, 0.06, steel, cx, Y + CH / 2, z1 + 0.03);
    add(0.06, CH, z1 - z0, steel, x0 - 0.03, Y + CH / 2, cz); add(0.06, CH, z1 - z0, steel, x1 + 0.03, Y + CH / 2, cz);
    const lid = new THREE.Group(); lid.position.set(cx, Y + CH, z0 - 0.06); hatch.add(lid); roof.lid = lid;   // hinged along its south edge
    add(x1 - x0 + 0.16, 0.05, z1 - z0 + 0.14, steel, 0, 0.025, (z1 - z0 + 0.14) / 2, lid);
    add(0.04, 0.03, 0.2, dark, 0, 0.065, z1 - z0 - 0.05, lid);     // its handle
    add(0.03, 0.4, 0.03, galv, -(x1 - x0) / 2 + 0.04, 0.2, 0.05, lid).rotation.x = 0.3;   // the hold-open arm (folded)
    ext(hatch); col(x0 - 0.06, x1 + 0.06, z0 - 0.06, z1 + 0.06);
    // the shaft through the plenum, closet ceiling to deck (unlit: it's dark in there, and the room lighting would take it for outdoors)
    const shaftM = new THREE.MeshBasicMaterial({ color: 0x34322e }), sy0 = BOH.h, sh = Y - sy0;
    for (const [w, d, x, z] of [[x1 - x0, 0.02, cx, z0 - 0.01], [x1 - x0, 0.02, cx, z1 + 0.01], [0.02, z1 - z0, x0 - 0.01, cz], [0.02, z1 - z0, x1 + 0.01, cz]]) box(w, sh, d, shaftM, x, sy0 + sh / 2, z);
    for (const [w, d, x, z] of [[x1 - x0 + 0.1, 0.05, cx, z0 - 0.025], [x1 - x0 + 0.1, 0.05, cx, z1 + 0.025], [0.05, z1 - z0, x0 - 0.025, cz], [0.05, z1 - z0, x1 + 0.025, cz]]) box(w, 0.03, d, mat.frame, x, sy0 - 0.015, z);   // trim round it, under the ceiling
    // the ladder: galvanised rails standing off the wall on brackets, round rungs every 30 cm, the rails carried on up past
    // the hatch so there's something to hold stepping off
    const { x: lx, z: lz } = ROOF_LADDER, top = Y + 1.05;
    for (const sx of [-1, 1]) {
      roof.ladderParts.push(box(0.05, top, 0.016, galv, lx + sx * 0.22, top / 2, lz));
      for (const y of [0.4, 1.6, 2.6]) box(0.04, 0.03, lz - CLOSET_Z0, galv, lx + sx * 0.22, y, (lz + CLOSET_Z0) / 2);   // wall brackets
      const g = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 6, 12, Math.PI), galv); g.position.set(lx + sx * 0.22, top, lz - 0.12); g.rotation.y = Math.PI / 2; scene.add(g); roof.ladderParts.push(g);   // the rails curl over at the top
    }
    for (let y = 0.3; y < Y - 0.05; y += 0.3) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.44, 8), galv); r.rotation.z = Math.PI / 2; r.position.set(lx, y, lz); scene.add(r); roof.ladderParts.push(r); }
    for (const o of [...roof.ladderParts, ...hatch.children, ...lid.children]) if (o.isMesh) { o.userData.roofLadder = true; aimables.push(o); }
    colliders.push({ x0: lx - 0.26, x1: lx + 0.26, z0: CLOSET_Z0, z1: lz + 0.03, y1: Y });
    // a caged bulb on the parapet by the hatch, on at night (see roofTick)
    roof.bulb = new THREE.MeshBasicMaterial({ color: 0x4a4a44 });
    glow(put(new THREE.SphereGeometry(0.045, 10, 8), roof.bulb, 12.35, Y + PH - 0.18, 27.9 + T + 0.08));
    bx(0.14, 0.14, 0.05, dark, 12.35, Y + PH - 0.18, 27.9 + T + 0.025);
    for (const a of [0, 1, 2]) { const w = put(new THREE.TorusGeometry(0.06, 0.004, 4, 12), dark, 12.35, Y + PH - 0.18, 27.9 + T + 0.08); w.rotation.y = a * Math.PI / 3; }
  }

  // ---- rooftop AC units: packaged units on curbs, louvred coil grilles down the long sides, two condenser fans on top ----
  const louvre = makeTexture((ctx, W, H) => {
    ctx.fillStyle = "#cfc9b8"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#3b3a36"; ctx.fillRect(12, 12, W - 24, H - 24);
    for (let y = 16; y < H - 14; y += 7) { ctx.fillStyle = "#8e8a80"; ctx.fillRect(14, y, W - 28, 3); ctx.fillStyle = "#bdb7a6"; ctx.fillRect(14, y, W - 28, 1); }
  }, 256, 128);
  const louvreM = new THREE.MeshLambertMaterial({ map: louvre });
  const grille = makeTexture((ctx, W, H) => {        // the fan guard: wire rings and spokes, see-through
    ctx.clearRect(0, 0, W, H); ctx.strokeStyle = "#2a2a2a"; ctx.lineWidth = 3;
    for (let r = 14; r < W / 2; r += 14) { ctx.beginPath(); ctx.arc(W / 2, H / 2, r, 0, 7); ctx.stroke(); }
    for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(W / 2, H / 2); ctx.lineTo(W / 2 + Math.cos(a * 0.785) * W / 2, H / 2 + Math.sin(a * 0.785) * H / 2); ctx.stroke(); }
  }, 256, 256);
  const grilleM = new THREE.MeshLambertMaterial({ map: grille, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide });
  const rtu = (x, z, ry, phase) => {
    const u = new THREE.Group(); u.position.set(x, Y, z); u.rotation.y = ry; G.add(u);
    const L = 2.3, W = 1.35, H = 1.05;
    bx(L + 0.1, 0.3, W + 0.1, lam(0x7d7a73), 0, 0.15, 0, u);                    // the curb
    bx(L, H, W, beige, 0, 0.3 + H / 2, 0, u);
    for (const s of [-1, 1]) { const p = put(new THREE.PlaneGeometry(L * 0.62, H * 0.75), louvreM, L * 0.17, 0.3 + H * 0.48, s * (W / 2 + 0.003), u); if (s < 0) p.rotation.y = Math.PI; }
    for (const s of [-1, 1]) bx(0.004, H * 0.8, 0.5, lam(0xb9b3a2), -L / 2 - 0.002, 0.3 + H / 2, s * 0.3, u);   // service panels on the end
    bx(0.12, 0.06, 0.03, dark, -L / 2 - 0.02, 0.3 + H * 0.5, 0.3, u); bx(0.12, 0.06, 0.03, dark, -L / 2 - 0.02, 0.3 + H * 0.5, -0.3, u);   // their handles
    for (const fx of [0.2, 0.85]) {
      cy(0.33, 0.33, 0.12, dark, fx, 0.3 + H + 0.06, 0, 24, u);                   // the shroud
      const blades = new THREE.Group(); blades.position.set(fx, 0.3 + H + 0.09, 0); u.add(blades);
      for (let b = 0; b < 4; b++) { const bl = bx(0.28, 0.008, 0.11, lam(0x1c1c1c), 0.15, 0, 0, blades); bl.rotation.x = 0.35; const piv = new THREE.Group(); piv.rotation.y = b * Math.PI / 2; blades.add(piv); piv.add(bl); }
      cy(0.04, 0.04, 0.05, dark, 0, 0, 0, 10, blades);
      const gr = put(new THREE.CircleGeometry(0.32, 24), grilleM, fx, 0.3 + H + 0.125, 0, u); gr.rotation.x = -Math.PI / 2;
      roof.fans.push({ g: blades, v: 0, phase });
    }
    const plate = textPlane("CARRIER", 0.32, 0.07, "#ffffff", "#1d4f9c", "Arial Black", 60); plate.material = new THREE.MeshLambertMaterial({ map: plate.material.map });
    plate.position.set(-L / 2 - 0.004, 0.3 + H - 0.12, 0); plate.rotation.y = -Math.PI / 2; u.add(plate);
    // the disconnect on a strut beside it, and its conduit
    const sx = -L / 2 - 0.45;
    bx(0.04, 0.9, 0.04, galv, sx, 0.45, 0.5, u); bx(0.26, 0.34, 0.12, lam(0x7e858c), sx, 0.75, 0.5, u); bx(0.03, 0.12, 0.05, dark, sx - 0.13, 0.75, 0.5, u);
    stick(V(sx, 0.55, 0.45), V(-L / 2, 0.55, 0.45), 0.012, galv, u);
    // the gas line in on its blocks
    const gasM = lam(0xe0b400);
    stick(V(-L / 2 + 0.3, 0.12, -W / 2 - 0.25), V(-L / 2 + 0.3, 0.12, -W / 2 - 2.6), 0.018, gasM, u);
    stick(V(-L / 2 + 0.3, 0.12, -W / 2 - 0.25), V(-L / 2 + 0.3, 0.45, -W / 2 - 0.25), 0.018, gasM, u);
    stick(V(-L / 2 + 0.3, 0.45, -W / 2 - 0.25), V(-L / 2 + 0.3, 0.45, -W / 2), 0.018, gasM, u);
    for (let k = 0; k < 3; k++) bx(0.12, 0.08, 0.1, lam(0x4a3f33), -L / 2 + 0.3, 0.04, -W / 2 - 0.7 - k * 0.8, u);
    const c = Math.abs(Math.cos(ry)), s = Math.abs(Math.sin(ry)), hx = (L / 2 + 0.55) * c + (W / 2 + 0.1) * s, hz = (L / 2 + 0.55) * s + (W / 2 + 0.1) * c;
    col(x - hx, x + hx, z - hz, z + hz);
    roof.units.push({ x, z, phase, on: false });
  };
  rtu(-2.6, 9.5, 0, 0); rtu(4.6, 19.5, 0, 120);

  // ---- the whirlybird over the lobby: a turbine vent that turns with the wind ----
  {
    const tx = -3.2, tz = 30.4, t = new THREE.Group(); t.position.set(tx, Y, tz); G.add(t);
    cy(0.2, 0.24, 0.25, alum, 0, 0.125, 0, 16, t);                               // the throat on its flashing
    cy(0.34, 0.34, 0.015, alum, 0, 0.01, 0, 20, t);
    const head = new THREE.Group(); head.position.y = 0.28; t.add(head); roof.turbine = head;
    const n = 20, R = 0.24, HH = 0.32;
    for (let i = 0; i < n; i++) {                                                // curved vanes: each sweeps a quarter turn as it bulges out and back in
      const a0 = i / n * Math.PI * 2, pts = [];
      for (let k = 0; k <= 8; k++) { const f = k / 8, r = R * (0.62 + 0.38 * Math.sin(f * Math.PI)), a = a0 + f * 0.9; pts.push(V(Math.cos(a) * r, f * HH, Math.sin(a) * r)); }
      put(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.012, 3), alum, 0, 0, 0, head);
    }
    cy(R * 0.64, R * 0.64, 0.025, alum, 0, 0, 0, 20, head);                      // bottom ring
    const cap = put(new THREE.SphereGeometry(R * 0.66, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), alum, 0, HH, 0, head); cap.scale.y = 0.45;
    col(tx - 0.36, tx + 0.36, tz - 0.36, tz + 0.36);
  }
  // ---- mushroom exhaust fans over the restroom and the break room ----
  for (const [ex, ez] of [[9.6, 31.4], [5.2, 31.6]]) {
    bx(0.62, 0.3, 0.62, lam(0x8a877f), ex, Y + 0.15, ez);
    cy(0.2, 0.22, 0.25, alum, ex, Y + 0.42, ez, 20);
    const dome = put(new THREE.SphereGeometry(0.36, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), alum, ex, Y + 0.58, ez); dome.scale.y = 0.55;
    cy(0.36, 0.36, 0.02, alum, ex, Y + 0.58, ez, 20);
    put(new THREE.CylinderGeometry(0.34, 0.34, 0.1, 20, 1, true), grilleM, ex, Y + 0.52, ez);   // the screen under the hood
    col(ex - 0.36, ex + 0.36, ez - 0.36, ez + 0.36);
  }
  // ---- the satellite dish: a 1 m offset dish on a ballasted sled, aimed south and up at the satellites ----
  {
    const dx = 8.4, dz = 3.2, d = new THREE.Group(); d.position.set(dx, Y, dz); G.add(d);
    bx(1.1, 0.06, 0.1, galv, 0, 0.05, 0.4, d); bx(1.1, 0.06, 0.1, galv, 0, 0.05, -0.4, d); bx(0.1, 0.06, 0.9, galv, 0, 0.08, 0, d);   // the sled
    for (const [sx, sz] of [[-0.42, 0.4], [0.42, 0.4], [-0.42, -0.4], [0.42, -0.4]]) bx(0.2, 0.1, 0.4, cement, sx, 0.13, sz, d);   // the blocks holding it down
    cy(0.035, 0.035, 1.1, galv, 0, 0.6, 0, 10, d);
    for (const [sx, sz] of [[0.5, 0], [-0.5, 0], [0, 0.4]]) stick(V(sx, 0.1, sz), V(0, 0.75, 0), 0.012, galv, d);   // braces
    const aim = new THREE.Group(); aim.position.set(0, 1.12, 0); aim.rotation.set(0.68, 0, 0); d.add(aim);   // tipped up toward -z (south)
    const prof = []; for (let k = 0; k <= 10; k++) { const r = k / 10 * 0.5; prof.push(new THREE.Vector2(r, r * r * 0.45)); }
    const dish = put(new THREE.LatheGeometry(prof, 28), new THREE.MeshPhongMaterial({ color: 0xdedfe0, specular: 0x888888, shininess: 30, side: THREE.DoubleSide }), 0, 0, 0, aim);
    dish.rotation.x = -Math.PI / 2;                                             // (opening toward local -z)
    cy(0.06, 0.06, 0.1, dark, 0, 0, 0.04, 10, aim).rotation.x = Math.PI / 2;
    stick(V(0, -0.45, 0.02), V(0, -0.05, -0.55), 0.014, galv, aim);              // the feed arm
    bx(0.07, 0.07, 0.13, dark, 0, -0.03, -0.58, aim);                             // the LNB
    stick(V(0, -0.05, -0.55), V(0, -0.9, -0.1), 0.007, dark, aim);                // its cable, down the mast
    col(dx - 0.65, dx + 0.65, dz - 0.6, dz + 0.6);
  }
  // ---- an old TV antenna on a tripod (from before the dish), a little bent ----
  {
    const ax = -6.4, az = 24, a = new THREE.Group(); a.position.set(ax, Y, az); G.add(a);
    for (let k = 0; k < 3; k++) { const t = k * 2.09; stick(V(Math.cos(t) * 0.45, 0.02, Math.sin(t) * 0.45), V(0, 0.9, 0), 0.015, galv, a); }
    cy(0.022, 0.022, 3.0, galv, 0, 1.5, 0, 8, a);
    const boom = new THREE.Group(); boom.position.y = 2.85; boom.rotation.set(0.04, 0.6, 0.05); a.add(boom);
    bx(0.03, 0.03, 1.6, galv, 0, 0, 0, boom);
    for (let k = 0; k < 9; k++) { const w = 1.0 - k * 0.07; bx(w, 0.012, 0.012, alum, 0, 0, -0.75 + k * 0.18, boom); }
    stick(V(0, 0.2, 0), V(-0.1, 2.85, 0), 0.006, dark, a);
    col(ax - 0.5, ax + 0.5, az - 0.5, az + 0.5);
  }
  // ---- vent stacks with their boots, drains, and walkway pads out to the units ----
  for (const [vx, vz] of [[9.2, 32.4], [5.8, 32.6], [-1.2, 31.6], [-4.8, 40.5]]) {
    cy(0.16, 0.2, 0.12, lam(0x5a5c5e), vx, Y + 0.06, vz, 12); cy(0.05, 0.05, 0.42, lam(0x9a9c9e), vx, Y + 0.21, vz, 10);
  }
  for (const [dx, dz] of [[1.5, 8], [1.5, 22], [-2.9, 40], [-6.5, 15]]) {
    cy(0.22, 0.24, 0.02, dark, dx, Y + 0.01, dz, 16); const s = put(new THREE.SphereGeometry(0.12, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark, dx, Y + 0.02, dz); s.scale.y = 0.8;
  }
  const padM = lam(0x8f908c);
  const pads = (pts) => { for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx2, bz] = pts[i + 1], n = Math.ceil(Math.hypot(bx2 - ax, bz - az) / 0.75);
    for (let k = 0; k < n; k++) { const f = (k + 0.5) / n, p = bx(0.6, 0.025, 0.6, padM, ax + (bx2 - ax) * f, Y + 0.012, az + (bz - az) * f); p.rotation.y = Math.atan2(bx2 - ax, bz - az); } } };
  pads([[10.6, 29.2], [6.6, 26], [6.6, 21.2]]); pads([[6.6, 21.2], [-0.4, 14], [-0.4, 10.9]]);

  buildGrounds({ lam, put, bx, cy, ext, dark });   // around the building: the grass, the paved apron, the dumpster, the cardboard bed (exterior/grounds.js)
  tonyOutside({ lam, put, ext, beige, cement, coping });   // Tony's, next door (tonys/outside.js)

  // ---- the sign over the storefront: an internally lit cabinet on the fascia, standing up past the coping. From the lot
  // it's the store's name, lit at night (see roofTick); from up here it's the back of a sheet-metal box on three kickers ----
  {
    const SX = 0.8, SW = 7.2, y0 = 3.75, y1 = 5.55, zb = -0.3, zf = -0.66, s = new THREE.Group(); scene.add(s);
    const face = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#00349c"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#f2c200"; ctx.fillRect(0, H * 0.7, W, H * 0.3);
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 6; ctx.strokeRect(10, 10, W - 20, H - 20);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      let fs = 132; ctx.font = `italic 900 ${fs}px Arial Black, Arial`; while (ctx.measureText("VAULTBUSTER").width > W - 90) ctx.font = `italic 900 ${fs -= 4}px Arial Black, Arial`;
      ctx.lineWidth = 10; ctx.strokeStyle = "#0b1f5c"; ctx.strokeText("VAULTBUSTER", W / 2 + 6, H * 0.37 + 6);
      ctx.fillStyle = "#f2c200"; ctx.fillText("VAULTBUSTER", W / 2, H * 0.37);
      ctx.font = "900 52px Arial Black, Arial"; ctx.fillStyle = "#00349c"; ctx.fillText("V  I  D  E  O", W / 2, H * 0.85);
    }, 1024, 256);
    const frame = phong(0x2b2a2c, 30);
    bx(SW, y1 - y0, zb - zf, frame, SX, (y0 + y1) / 2, (zb + zf) / 2, s);
    const day = put(new THREE.PlaneGeometry(SW - 0.16, y1 - y0 - 0.16), new THREE.MeshLambertMaterial({ map: face, emissiveMap: face, emissive: 0xffffff, emissiveIntensity: 0.3 }), SX, (y0 + y1) / 2, zf - 0.004, s); day.rotation.y = Math.PI;
    const lit = put(new THREE.PlaneGeometry(SW - 0.16, y1 - y0 - 0.16), new THREE.MeshBasicMaterial({ map: face, color: 0xffffff }), SX, (y0 + y1) / 2, zf - 0.006, s); lit.rotation.y = Math.PI; lit.visible = false; glow(lit);
    for (const x of [SX - SW / 2 + 0.6, SX + SW / 2 - 0.6]) bx(0.08, 0.32, 0.36, frame, x, y0 - 0.12, (zb + zf) / 2 + 0.04, s);   // its hangers off the fascia
    ext(s); roof.sign = { day, lit };
    // the back, above the coping: an access panel, the kickers down to the deck, its power coming over the top
    const back = lam(0x55575a);
    bx(SW - 0.4, 0.42, 0.01, back, SX, y1 - 0.3, zb + 0.005);
    for (const x of [SX - 1.8, SX + 1.8]) bx(0.5, 0.36, 0.012, lam(0x6a6c70), x, y1 - 0.3, zb + 0.012);
    for (const x of [SX - 3.1, SX, SX + 3.1]) {
      stick(V(x, y1 - 0.1, zb + 0.02), V(x, Y + 0.05, 1.55), 0.022, galv);
      bx(0.22, 0.03, 0.22, galv, x, Y + 0.015, 1.55); bx(0.26, 0.05, 0.26, lam(0x5a5852), x, Y + 0.025, 1.55);   // its base plate set in a pitch pocket
      col(x - 0.12, x + 0.12, 0.1, 1.7);
    }
    const flex = new THREE.CatmullRomCurve3([V(SX + 2.4, y1 - 0.55, zb + 0.02), V(SX + 2.4, Y + PH + 0.22, 0.05), V(SX + 2.4, Y + 0.45, 0.55), V(SX + 2.4, Y + 0.12, 1.0)]);
    put(new THREE.TubeGeometry(flex, 16, 0.016, 6), dark, 0, 0, 0);
    bx(0.2, 0.24, 0.14, lam(0x7e858c), SX + 2.4, Y + 0.2, 1.1); bx(0.06, 0.08, 0.06, lam(0x2a2c2f), SX + 2.4, Y + 0.36, 1.1);   // the junction box, a photocell on top
    col(SX + 2.25, SX + 2.55, 0.1, 1.2);
  }

  // ---- shade under the kit: soft dark footprints, so nothing floats on the gravel ----
  const aoTex = (() => {
    const c = document.createElement("canvas"), N = 64; c.width = c.height = N; const g = c.getContext("2d"), im = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const qx = Math.abs((i + 0.5) / N * 2 - 1), qy = Math.abs((j + 0.5) / N * 2 - 1), d = Math.hypot(Math.max(qx - 0.45, 0), Math.max(qy - 0.45, 0)) / 0.55;
      const a = Math.max(0, 1 - d); im.data[(j * N + i) * 4 + 3] = Math.round(255 * a * a * (3 - 2 * a));
    }
    g.putImageData(im, 0, 0); return new THREE.CanvasTexture(c);
  })();
  const aoGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), aoM = new THREE.MeshBasicMaterial({ color: 0x000000, map: aoTex, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  roof.shades = aoM;
  const shade = (x, z, w, d, ry = 0, par = G, y = Y) => { const o = put(aoGeo, aoM, x, y + 0.006, z, par); o.scale.set(w, 1, d); o.rotation.y = ry; o.renderOrder = 1; return o; };
  for (const u of roof.units) { shade(u.x, u.z, 3.1, 2.1); shade(u.x - 1.6, u.z + 0.5, 0.5, 0.5); }
  shade(-3.2, 30.4, 0.95, 0.95); for (const [ex, ez] of [[9.6, 31.4], [5.2, 31.6]]) shade(ex, ez, 1.05, 1.05);
  shade(8.4, 3.2, 1.6, 1.4); shade(-6.4, 24, 1.1, 1.1);
  for (const [vx, vz] of [[9.2, 32.4], [5.8, 32.6], [-1.2, 31.6], [-4.8, 40.5]]) shade(vx, vz, 0.55, 0.55);

  // ---- the gravel's weathering: blown thin and bare in the windy corners, dark rings of silt round the drains where
  // the water sits, rust under the gas line, a green slick where the condensate dribbles, grime along the parapets.
  // One sheet over the deck, its picture laid over the whole building ----
  const DX0 = -7.84, DXW = 20.54, DZ0 = -0.1, DZD = 46.7, DRAINS = [[1.5, 8], [1.5, 22], [-2.9, 40], [-6.5, 15]];
  {
    const W = 512, H = 1024, px = x => (x - DX0) / DXW * W, py = z => (z - DZ0) / DZD * H, m = W / DXW;   // m: pixels per metre (near enough both ways)
    const tex = makeTexture((ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      const blot = (x, z, r, rgba) => { const g = ctx.createRadialGradient(px(x), py(z), 0, px(x), py(z), r * m); g.addColorStop(0, rgba); g.addColorStop(1, rgba.replace(/[\d.]+\)$/, "0)")); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px(x), py(z), r * m, 0, 7); ctx.fill(); };
      let sd = 7; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) blot(DX0 + r() * DXW, DZ0 + r() * DZD, 1 + r() * 3.5, i % 3 ? `rgba(34,30,26,${0.1 + r() * 0.14})` : `rgba(236,230,214,${0.08 + r() * 0.1})`);
      ctx.strokeStyle = "rgba(30,27,24,0.28)"; ctx.lineWidth = 0.9 * m; ctx.lineJoin = "round"; ctx.beginPath();   // swept up against the parapets
      P.forEach(([x, z], i) => i ? ctx.lineTo(px(x), py(z)) : ctx.moveTo(px(x), py(z))); ctx.closePath(); ctx.stroke();
      for (const [x, z] of DRAINS) { blot(x, z, 2.2, "rgba(18,20,22,0.42)"); blot(x, z, 1.1, "rgba(120,106,82,0.35)"); }
      for (const [x, z] of [[-4.6, 26], [5.6, 13.5], [-1.5, 43]]) blot(x, z, 1.6, "rgba(18,20,22,0.3)");   // the low spots that pond
      for (const u of roof.units) for (let k = 0; k < 3; k++) blot(u.x - 0.85, u.z - 1.6 - k * 0.8, 0.28, "rgba(122,62,24,0.45)");
      blot(6.4, 18.6, 0.7, "rgba(46,70,38,0.5)");
      for (const [x, z, s] of [[-7.0, 0.9, 1.4], [10.2, 0.8, 1.1], [-6.2, 45.7, 1.2], [10.3, 32.4, 0.8]]) {   // scoured to the bare sheet
        ctx.fillStyle = "rgba(186,187,181,0.92)"; ctx.beginPath();
        for (let a = 0; a < 18; a++) { const t = a / 18 * Math.PI * 2, rr = s * m * (0.55 + r() * 0.45); ctx.lineTo(px(x) + Math.cos(t) * rr * 1.3, py(z) + Math.sin(t) * rr * 0.8); }
        ctx.fill();
        for (let k = 0; k < 160; k++) { const t = r() * 7, rr = s * m * (0.3 + r() * 0.9); ctx.fillStyle = r() < 0.5 ? "#6f6b64" : "#a8a49b"; ctx.fillRect(px(x) + Math.cos(t) * rr * 1.3, py(z) + Math.sin(t) * rr * 0.8, 1.5, 1.5); }
      }
    }, W, H);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.repeat.set(1 / DXW, 1 / DZD); tex.offset.set(-DX0 / DXW, (DZD + DZ0) / DZD);   // (the deck's uvs are world metres, v = -z)
    const sh = new THREE.Shape(P.map(([x, z]) => new THREE.Vector2(x, -z))), hole = new THREE.Path(), { x0, x1, z0, z1 } = ROOF_HATCH;
    hole.moveTo(x0, -z0); hole.lineTo(x0, -z1); hole.lineTo(x1, -z1); hole.lineTo(x1, -z0); hole.lineTo(x0, -z0); sh.holes.push(hole);
    const o = put(new THREE.ShapeGeometry(sh), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), 0, Y + 0.003, 0);
    o.rotation.x = -Math.PI / 2; roof.grime = o.material;
  }
  // puddles: standing water in the low spots and round the drains after rain, the sky shining in them; they outlast the
  // wet on the lot (see roofTick)
  {
    const blob = (() => {
      const c = document.createElement("canvas"), N = 128; c.width = c.height = N; const g = c.getContext("2d");
      g.fillStyle = "#000"; g.fillRect(0, 0, N, N); g.filter = "blur(3px)"; g.fillStyle = "#fff"; g.beginPath();
      for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2, rr = N * (0.34 + 0.05 * Math.sin(t * 2 + 1) + 0.035 * Math.sin(t * 5 + 2) + 0.02 * Math.sin(t * 9)); g.lineTo(N / 2 + Math.cos(t) * rr, N / 2 + Math.sin(t) * rr); }
      g.fill(); return new THREE.CanvasTexture(c);
    })();
    const pm = new THREE.MeshBasicMaterial({ color: 0x8a96a6, alphaMap: blob, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const pg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (const [x, z, w, d, ry] of [[1.5, 8, 3.2, 2.4, 0.3], [1.6, 22.2, 2.6, 2.2, 1.1], [-2.9, 40, 2.8, 2.0, 0.2], [-6.4, 15, 1.6, 2.6, 0], [-4.6, 26, 2.6, 1.7, 0.7], [5.6, 13.5, 2.2, 1.6, 2.0], [-1.5, 43, 2.0, 1.4, 0.4]]) {
      const o = put(pg, pm, x, Y + 0.008, z); o.scale.set(w, 1, d); o.rotation.y = ry; o.renderOrder = 2;
    }
    roof.puddles = pm;
  }

  // ---- overflow scuppers through the parapet, each with a collector head and a downspout down the outside ----
  {
    const sm = lam(0xb7b2a4), hole = new THREE.MeshBasicMaterial({ color: 0x141414 });
    for (const [x, z, nx, nz] of SCUPPERS) {
      const ry = nx ? Math.PI / 2 : 0, at = (k, y, w, h, d, m, par) => { const o = bx(w, h, d, m, x + nx * k, y, z + nz * k, par); o.rotation.y = ry; return o; };
      at(T + 0.004, Y + 0.09, 0.42, 0.2, 0.012, galv); at(T + 0.012, Y + 0.09, 0.34, 0.13, 0.006, hole);   // the opening's sheet-metal lining, from the deck
      const o = -0.24;                                                    // outside the skin
      at(-0.16, Y + 0.09, 0.3, 0.12, 0.2, galv, skin);                    // the scupper's lip
      at(o, Y - 0.12, 0.42, 0.34, 0.22, sm, skin);                        // the collector head
      at(o, (Y - 0.3 + 0.32) / 2, 0.1, Y - 0.62, 0.08, sm, skin);           // the downspout
      at(o - 0.12, 0.26, 0.1, 0.08, 0.28, sm, skin);                      // its kick-out at the foot
      for (const y of [1.0, 2.2, 3.3]) at(-0.18, y, 0.14, 0.03, 0.06, sm, skin);   // straps
    }
  }

  // ---- conduit and condensate: the disconnects' feeds on blocks to where they go down through the roof; the condensate
  // lines to a drain and a splash block ----
  {
    const blockM = lam(0x6b5a45), pvc = lam(0xe6e4dc);
    const run = (pts, r, m, blocks = true) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = V(...pts[i]), b = V(...pts[i + 1]); stick(a, b, r, m);
        if (!blocks || Math.abs(a.y - b.y) > 0.05) continue;
        const n = Math.floor(a.distanceTo(b) / 1.5); for (let k = 1; k <= n; k++) { const p = a.clone().lerp(b, k / (n + 1)); bx(0.12, a.y - Y - r, 0.1, blockM, p.x, (Y + a.y - r) / 2, p.z); }
      }
    };
    const y = Y + 0.1;
    run([[-4.2, Y + 0.6, 10.0], [-4.2, y, 10.0], [-4.2, y, 13.5], [-6.9, y, 13.5], [-6.9, Y + 0.02, 13.5]], 0.018, galv);
    run([[3.0, Y + 0.6, 20.0], [3.0, y, 20.0], [3.0, y, 24.6], [3.0, Y + 0.02, 24.6]], 0.018, galv);
    for (const [x, z] of [[-6.9, 13.5], [3.0, 24.6]]) { bx(0.3, 0.16, 0.3, lam(0x3b3a37), x, Y + 0.08, z); col(x - 0.2, x + 0.2, z - 0.2, z + 0.2); }   // pitch pockets, filled with sealant round the pipe
    run([[-1.42, Y + 0.32, 9.0], [-1.3, Y + 0.32, 9.0], [-1.3, Y + 0.08, 9.0], [1.15, Y + 0.08, 8.15]], 0.013, pvc);
    run([[5.72, Y + 0.32, 19.2], [6.05, Y + 0.32, 19.2], [6.05, Y + 0.08, 19.2], [6.3, Y + 0.08, 18.75]], 0.013, pvc);
    bx(0.3, 0.05, 0.6, cement, 6.4, Y + 0.025, 18.6).rotation.y = 0.5;    // the splash block
  }

  // ---- where the staff come up for a smoke: a webbed lawn chair facing the lot, a coffee can of butts, a milk crate
  // for a table ----
  {
    const lawnChair = (x, z, ry, web) => {
    const c = new THREE.Group(); c.position.set(x, Y, z); c.rotation.y = ry; G.add(c);
    const tube = phong(0xc8ccd0, 70), R = 0.011;
    const L = (a, b) => stick(V(...a), V(...b), R, tube, c);
    for (const s of [-1, 1]) {
      const x = s * 0.27;
      L([x, 0, -0.26], [x, 0.4, 0.2]); L([x, 0, 0.26], [x, 0.4, -0.2]);                // the X legs
      L([x, 0.38, -0.22], [x, 0.38, 0.22]);                                              // seat rail
      L([x, 0.4, 0.22], [x, 0.95, 0.38]);                                                // back upright
      L([x, 0.6, -0.2], [x, 0.6, 0.27]); L([x, 0.38, -0.2], [x, 0.6, -0.2]);             // arm and its post
      bx(0.05, 0.025, 0.46, lam(0xd8d2c2), x, 0.62, 0.03, c);                            // armrest
    }
    L([-0.27, 0.38, -0.22], [0.27, 0.38, -0.22]); L([-0.27, 0.95, 0.38], [0.27, 0.95, 0.38]); L([-0.27, 0, -0.26], [0.27, 0, -0.26]); L([-0.27, 0, 0.26], [0.27, 0, 0.26]);
    for (let k = 0; k < 6; k++) bx(0.075, 0.004, 0.44, web[k % 2], -0.22 + k * 0.088, 0.37, 0, c);   // seat webbing, front to back, sagging a bit
    for (let k = 0; k < 6; k++) { const b = bx(0.54, 0.004, 0.07, web[(k + 1) % 2], 0, 0.36, -0.17 + k * 0.07, c); }
    for (let k = 0; k < 6; k++) { const t = (k + 0.5) / 6, b = bx(0.54, 0.07, 0.004, web[k % 2], 0, 0.42 + t * 0.5, 0.235 + t * 0.14, c); b.rotation.x = -0.29; }
    // to sit in: E on it (see onE). The sitter faces the way the chair does (-z, its back to +z), hips down in the sag of the webbing
    const hit = bx(0.58, 0.62, 0.56, new THREE.MeshBasicMaterial({ visible: false }), 0, 0.5, 0.06, c);
    hit.userData.sit = true; hit.userData.seatPos = { x, y: Y, z, ry: ry + Math.PI, hipY: 0.43, roof: true }; roof.seats.push(hit);
    };
    lawnChair(9.9, 26.4, 0.55, [lam(0x2f8a58), lam(0xe8e4d4)]);
    // the can, by the right arm: an old coffee can, lid long gone, half full of sand gone grey with ash, the butts
    // stubbed out standing up in it, and a few that missed it. (Open tube, its own inside wall and floor: no two
    // surfaces in the same place to fight)
    const can = new THREE.Group(); can.position.set(10.5, Y, 26.1); can.rotation.y = 2.2; G.add(can);
    const canTex = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#a3302a"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#e9dfc4"; ctx.fillRect(0, H * 0.38, W, H * 0.26);
      ctx.fillStyle = "#a3302a"; ctx.font = `bold ${H * 0.2}px Georgia, serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const x of [0.25, 0.75]) ctx.fillText("COFFEE", W * x, H * 0.52);
      ctx.fillStyle = "#e9dfc4"; ctx.font = `bold ${H * 0.1}px Arial`; for (const x of [0.25, 0.75]) ctx.fillText("ROASTED · GROUND", W * x, H * 0.24);
      ctx.fillStyle = "#00000030"; for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 6, 1 + Math.random() * 3);   // scuffs
    }, 256, 64);
    const CR = 0.078, CH = 0.16, tin = phong(0xb9bcc0, 50);
    put(new THREE.CylinderGeometry(CR, CR, 0.124, 24, 1, true), new THREE.MeshLambertMaterial({ map: canTex }), 0, 0.08, 0, can);       // the label
    for (const [y0, h] of [[0, 0.018], [0.142, 0.018]]) put(new THREE.CylinderGeometry(CR, CR, h, 24, 1, true), tin, 0, y0 + h / 2, 0, can);   // bare tin above and below it
    put(new THREE.CylinderGeometry(CR - 0.002, CR - 0.002, CH, 24, 1, true), new THREE.MeshLambertMaterial({ color: 0x5e5a55, side: THREE.BackSide }), 0, CH / 2, 0, can);   // the inside, sooty
    const rim = new THREE.TorusGeometry(CR - 0.001, 0.0025, 6, 24); rim.rotateX(Math.PI / 2);
    put(rim, tin, 0, CH, 0, can); put(rim, tin, 0, 0.003, 0, can);                                                     // rolled lip, rolled base
    for (const y of [0.025, 0.137]) { const b = new THREE.TorusGeometry(CR + 0.0005, 0.0015, 4, 24); b.rotateX(Math.PI / 2); put(b, tin, 0, y, 0, can); }   // the beads
    const disc = (r, y, c) => { const g = new THREE.CircleGeometry(r, 20); g.rotateX(-Math.PI / 2); return put(g, lam(c), 0, y, 0, can); };
    disc(CR - 0.002, 0.004, 0x3a3835);                                                                                // the floor (seen only from above, past the sand)
    const SY = 0.112, sand = new THREE.CircleGeometry(CR - 0.002, 24); sand.rotateX(-Math.PI / 2);
    const sp = sand.attributes.position; for (let i = 1; i < sp.count; i++) sp.setY(i, (Math.random() - 0.5) * 0.006);   // lumpy, not a lid
    sand.computeVertexNormals(); put(sand, lam(0x8f8a80), 0, SY, 0, can);
    for (let k = 0; k < 4; k++) { const a = Math.random() * 6.28, d = Math.random() * 0.04, ash = new THREE.CircleGeometry(0.012 + Math.random() * 0.012, 8); ash.rotateX(-Math.PI / 2);
      put(ash, lam(0x5c5955), Math.cos(a) * d, SY + 0.0045, Math.sin(a) * d, can); }                                    // grey ash heaps, sat on the lumps
    const butt = new THREE.CylinderGeometry(0.0045, 0.0045, 0.026, 6), filt = new THREE.CylinderGeometry(0.0046, 0.0046, 0.012, 6), bm = lam(0xe9e2cf), fm = lam(0xc9883e), burnt = lam(0x3b3633);
    const stub = (x, y, z, rx, rz, par, lying) => {                                                                     // a filter and what's left of the cigarette, the end charred
      const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.set(rx, Math.random() * 6.28, rz); par.add(s);
      put(filt, fm, 0, 0.006, 0, s); put(butt, bm, 0, 0.012 + 0.013 * (lying ? 1 : 0.6), 0, s).scale.y = lying ? 1 : 0.6;
      cy(0.0044, 0.0046, 0.003, burnt, 0, lying ? 0.0395 : 0.029, 0, 6, s); return s;
    };
    for (let k = 0; k < 11; k++) { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * 0.06;            // stubbed in, filter up, leaning every which way
      stub(Math.cos(a) * d, SY + 0.016, Math.sin(a) * d, Math.PI + (Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.9, can); }
    for (let k = 0; k < 5; k++) { const a = Math.random() * 6.28, d = 0.12 + Math.random() * 0.25;                  // the ones that missed, lying on the gravel
      stub(Math.cos(a) * d, 0.0046, Math.sin(a) * d, Math.PI / 2, 0, can, true); }
    // the crate, upside down, a can of soda and a paperback left on it
    const crateTex = makeTexture((ctx, W, H) => {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#24479a"; ctx.fillRect(0, 0, W, 18); ctx.fillRect(0, H - 14, W, 14); ctx.fillRect(0, 0, 14, H); ctx.fillRect(W - 14, 0, 14, H);
      for (let x = 14; x < W; x += 30) ctx.fillRect(x, 0, 8, H); for (let y = 18; y < H; y += 28) ctx.fillRect(0, y, W, 7);
    }, 128, 128);
    const crate = bx(0.33, 0.28, 0.33, new THREE.MeshLambertMaterial({ map: crateTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), 9.45, Y + 0.14, 25.95); crate.rotation.y = 0.3;
    cy(0.033, 0.033, 0.12, lam(0x3d8a3b), 9.42, Y + 0.34, 25.9, 12); cy(0.03, 0.03, 0.006, alum, 9.42, Y + 0.403, 25.9, 12);
    bx(0.11, 0.018, 0.17, lam(0x8a2f6a), 9.52, Y + 0.289, 26.02).rotation.y = 0.8;
    // ---- a movie up here: a second lawn chair beside the first, and behind them a projector on a box and two milk
    // crates, the VCR beside it, pointed over their heads at a bedsheet clipped to a length of conduit between a broom
    // and a mop stood up in crates of tapes, a few metres off. Whatever's in a VCR plays on it (see cineTick): washed
    // out to almost nothing in the day, the picture after dark, its edges soft and ragged, the sheet's weave and folds
    // through it, and the beam over your head. Built facing the way the chairs do (-z), from behind them ----
    lawnChair(9.9 - Math.cos(0.55) * 0.8, 26.4 + Math.sin(0.55) * 0.8, 0.62, [lam(0x2a5fa8), lam(0xf0d34a)]);   // the second: blue and yellow, the same vintage
    {
      const k = new THREE.Group(); k.position.set(9.9 - Math.cos(0.55) * 0.4 + Math.sin(0.55) * 0.95, Y, 26.4 + Math.sin(0.55) * 0.4 + Math.cos(0.55) * 0.95); k.rotation.y = 0.58; G.add(k); k.updateMatrixWorld(true);
      const cardboard = lam(0xb08a5a), crateM = new THREE.MeshLambertMaterial({ map: crateTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }), tapeM = lam(0x161616);
      // the stand: a shipping box of tapes, two crates upside down on it, a few tapes to shim it level; the VCR beside them
      bx(0.62, 0.42, 0.44, cardboard, 0, 0.21, 0, k); bx(0.62, 0.012, 0.06, lam(0xc9b58c), 0, 0.425, 0, k);   // (the packing tape down its middle)
      for (const y of [0.56, 0.84]) bx(0.33, 0.28, 0.33, crateM, -0.13, y, 0, k);
      for (let i = 0; i < 3; i++) bx(0.19, 0.025, 0.105, tapeM, -0.13, 0.993 + i * 0.026, 0, k).rotation.y = (Math.random() - 0.5) * 0.3;
      const proj = new THREE.Group(); proj.position.set(-0.13, 1.07, 0); k.add(proj);   // the projector: a 90s LCD one, a school's, from somebody's garage
      const shell = phong(0xcfcabf, 30);
      bx(0.31, 0.1, 0.25, shell, 0, 0.05, 0, proj); bx(0.29, 0.015, 0.23, lam(0x9a968e), 0, 0.105, 0, proj);
      for (let i = 0; i < 6; i++) bx(0.004, 0.06, 0.12, dark, 0.157, 0.05, -0.05 + i * 0.02, proj);   // its fan grille
      cy(0.042, 0.042, 0.05, dark, 0.07, 0.055, -0.14, 16, proj).rotation.x = Math.PI / 2;               // the lens barrel
      const lens = put(new THREE.CircleGeometry(0.03, 16), new THREE.MeshBasicMaterial({ color: 0x223040 }), 0.07, 0.055, -0.1655, proj); lens.rotation.y = Math.PI;
      const led = put(new THREE.PlaneGeometry(0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x331a00 }), -0.1, 0.1135, 0.06, proj); led.rotation.x = -Math.PI / 2;
      const vcr = new THREE.Group(); vcr.position.set(0.17, 0.425, 0.02); vcr.rotation.y = -0.08; k.add(vcr);
      bx(0.25, 0.085, 0.3, lam(0x1d1d1f), 0, 0.0425, 0, vcr);
      bx(0.17, 0.022, 0.004, lam(0x050505), -0.02, 0.05, -0.151, vcr);                              // the tape door
      const vled = put(new THREE.PlaneGeometry(0.05, 0.016), new THREE.MeshBasicMaterial({ color: 0x0a1a10 }), 0.08, 0.05, -0.1515, vcr); vled.rotation.y = Math.PI;
      const cord = lam(0xd8641c), blk = lam(0x111111);                                                 // the cables: video to the projector, and an orange extension cord off over the parapet
      stick(V(0.1, 0.47, 0.13), V(-0.02, 0.5, 0.2), 0.006, blk, k); stick(V(-0.02, 0.5, 0.2), V(-0.05, 1.1, 0.17), 0.006, blk, k);
      { const pts = [[0.2, 0.42, 0.1], [0.3, 0.02, 0.15], [0.55, 0.02, 0.7], [0.75, 0.02, 1.1]].map(([x, y, z]) => k.localToWorld(V(x, y, z)));
        pts.push(V(10.88, Y + 0.02, pts[3].z + 0.2), V(10.92, Y + PH, pts[3].z + 0.3), V(11.12, Y + PH - 0.04, pts[3].z + 0.3)); for (let i = 0; i < pts.length - 1; i++) stick(pts[i], pts[i + 1], 0.007, cord); }
      roof.cine = { proj: proj.children.slice(), vcr: vcr.children.slice(), led, vled, lens, on: false };
      const P = k.localToWorld(V(-0.06, 1.125, -0.17));                                                // the lens, in the world
      const box = (o, x0, x1, z0, z1) => { const p = [[x0, z0], [x1, z0], [x0, z1], [x1, z1]].map(([x, z]) => o.localToWorld(V(x, 0, z))), xs = p.map(q => q.x), zs = p.map(q => q.z); col(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)); };
      box(k, -0.32, 0.32, -0.23, 0.23);                                                                 // (the stand: you walk round it)
      // the screen, 4.6 m out in front
      const sc = new THREE.Group(); sc.position.copy(k.localToWorld(V(-0.06, 0, -4.6))).setY(Y); sc.rotation.y = 0.58; G.add(sc); sc.updateMatrixWorld(true);
      const SW = 1.9, SH = 1.32, TOP = 1.98, wood = lam(0x9a7448), tape = phong(0xb9bcc0, 40);
      for (const s of [-1, 1]) {
        bx(0.33, 0.28, 0.33, crateM, s * 1.02, 0.14, 0, sc);                                           // a crate, upside down, a stack of tapes in it to hold it down
        for (let i = 0; i < 5; i++) bx(0.105, 0.19, 0.025, tapeM, s * 1.02 + (Math.random() - 0.5) * 0.08, 0.1, -0.1 + i * 0.045, sc).rotation.z = (Math.random() - 0.5) * 0.3;
        stick(V(s * 1.02, 0.05, 0), V(s * 1.02, TOP + 0.08, 0), 0.013, wood, sc);                      // the broom handle / the mop handle, down through the crate
        for (const y of [0.3, TOP - 0.02]) cy(0.017, 0.017, 0.06, tape, s * 1.02, y, 0, 10, sc);      // duct tape
      }
      bx(0.32, 0.07, 0.07, lam(0x7a3a24), -1.02, TOP + 0.12, 0, sc); for (let i = 0; i < 14; i++) bx(0.012, 0.11, 0.05, lam(0xc89a3c), -1.16 + i * 0.021, TOP + 0.2, 0, sc);   // the broom's head, bristles up
      for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, r = 0.03 + Math.random() * 0.05; stick(V(1.02, TOP + 0.08, 0), V(1.02 + Math.cos(a) * r * 2.5, TOP + 0.2 + Math.random() * 0.12, Math.sin(a) * r * 2.5), 0.008, lam(0xa8a49a), sc); }   // the mop's head, strings flopped over
      stick(V(-1.1, TOP, 0.015), V(1.1, TOP, 0.015), 0.011, galv, sc);                                 // the crossbar: a stick of conduit
      // the sheet: an old twin flat sheet, cream with a faded stripe, clipped up along the bar, sagging between the clips,
      // creased from the linen closet, its bottom hem hanging free
      const sheetTex = makeTexture((c, W, H) => {
        c.fillStyle = "#e6dfcd"; c.fillRect(0, 0, W, H);
        for (let x = 0; x < W; x += 2) { c.fillStyle = `rgba(120,110,90,${0.04 + Math.random() * 0.05})`; c.fillRect(x, 0, 1, H); }   // the weave
        for (let y = 0; y < H; y += 2) { c.fillStyle = `rgba(255,255,255,${0.03 + Math.random() * 0.04})`; c.fillRect(0, y, W, 1); }
        for (let x = 18; x < W; x += 64) { c.fillStyle = "rgba(150,170,200,0.13)"; c.fillRect(x, 0, 14, H); c.fillStyle = "rgba(200,150,160,0.1)"; c.fillRect(x + 20, 0, 4, H); }   // the stripe, washed out
        const st = c.createRadialGradient(W * 0.72, H * 0.3, 0, W * 0.72, H * 0.3, 26); st.addColorStop(0, "rgba(160,130,70,0.16)"); st.addColorStop(1, "rgba(160,130,70,0)"); c.fillStyle = st; c.fillRect(0, 0, W, H);   // a stain
        c.fillStyle = "rgba(0,0,0,0.08)"; c.fillRect(0, H - 10, W, 3);                                 // the hem's stitching
      }, 512, 512);
      const geo = new THREE.PlaneGeometry(SW, SH, 48, 34), pa = geo.attributes.position, CLIPS = [-0.93, -0.47, 0, 0.47, 0.93];
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i), y = pa.getY(i), down = (SH / 2 - y) / SH;                                // 0 at the bar, 1 at the hem
        let gap = 1; for (let j = 0; j < CLIPS.length - 1; j++) if (x >= CLIPS[j] && x <= CLIPS[j + 1]) gap = Math.sin(Math.PI * (x - CLIPS[j]) / (CLIPS[j + 1] - CLIPS[j]));
        if (x < CLIPS[0] || x > CLIPS.at(-1)) gap = 0.4;
        const sag = 0.035 * gap * Math.max(0, 1 - down * 5);                                           // droops between the clips, near the top
        const fold = 0.012 * Math.sin(x * 9 + y * 2.3) + 0.008 * Math.sin(x * 23 - y * 5) + 0.02 * Math.sin(y * 4.4) * Math.sin(x * 2.2 + 0.7)   // creases, a couple of the folds it was stored in
          + 0.018 * Math.max(0, 1 - Math.abs(y + 0.05) * 30) + 0.014 * Math.max(0, 1 - Math.abs(x - 0.32) * 25);
        pa.setXYZ(i, x * (1 - 0.01 * down), y - sag, fold + 0.04 * down * down * Math.sin(x * 3.1));   // (the hem lifts a little in the air)
      }
      geo.computeVertexNormals();
      const sheetM = new THREE.MeshLambertMaterial({ map: sheetTex, side: THREE.DoubleSide });
      const IMG = { y: 0.06, w: 1.56 / SW, h: 1.04 / SH };                                             // the picture on it: 1.56 x 1.04 m (the 3:2 frame), a touch above the middle
      const cu = roof.cineU = { uVid: { value: videoTex }, uProj: { value: 0 }, uBlue: { value: 1 }, uImg: { value: new THREE.Vector4(0.5, 0.5 + IMG.y / SH, IMG.w, IMG.h) } };
      sheetM.onBeforeCompile = sh => {
        THREE.MeshLambertMaterial.prototype.onBeforeCompile(sh);                                   // (the lighting everything gets: see the top of the file)
        Object.assign(sh.uniforms, cu);
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform sampler2D uVid; uniform float uProj, uBlue; uniform vec4 uImg;")
          .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
          {
            vec2 pu = (vMapUv - uImg.xy) / uImg.zw + 0.5;                                  // where on the picture this bit of sheet is
            pu.x = (pu.x - 0.5) / (1.0 + 0.035 * (pu.y - 0.5)) + 0.5;                      // a touch of keystone: it's aimed up a little
            float n = 0.006 * sin(pu.y * 41.0) + 0.004 * sin(pu.y * 97.0 + 1.7) + 0.005 * sin(pu.x * 57.0 + 0.4);   // the frame's edge, ragged where it lands on the folds
            float m = smoothstep(-0.012, 0.025, pu.x + n) * (1.0 - smoothstep(0.975, 1.012, pu.x - n)) * smoothstep(-0.012, 0.03, pu.y - n) * (1.0 - smoothstep(0.97, 1.012, pu.y + n));
            vec2 q = pu - 0.5; float hot = 1.05 - 0.55 * dot(q, q) * 4.0;               // brighter in the middle, falling off to the corners
            vec3 img = mix(texture2D(uVid, clamp(pu, 0.0, 1.0), 0.6).rgb, vec3(0.06, 0.16, 0.78), uBlue);   // (a little soft: the focus); no tape: the VCR's blue
            float halo = (1.0 - m) * 0.06 * (1.0 - smoothstep(0.0, 0.12, max(max(-pu.x, pu.x - 1.0), max(-pu.y, pu.y - 1.0))));   // spill past the frame
            totalEmissiveRadiance += (img * m * hot + vec3(halo)) * uProj * diffuseColor.rgb * 1.15;   // lit on the sheet: its weave and stripe through it
          }`);
      };
      const sheet = put(geo, sheetM, 0, TOP - SH / 2 - 0.01, 0, sc);
      for (const x of CLIPS) { bx(0.032, 0.03, 0.022, lam(0x101010), x, TOP - 0.018, 0.012, sc); stick(V(x - 0.01, TOP - 0.002, 0.02), V(x - 0.01, TOP + 0.025, 0.02), 0.0015, alum, sc); }   // binder clips
      shade(sc.position.x, sc.position.z, 2.6, 0.5, 0.58);
      box(sc, -1.2, 1.2, -0.2, 0.2);
      // the beam: the frustum from the lens to the frame's corners, a faint haze, brightest by the lens; only shows after dark
      const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => sc.localToWorld(V(sx * 0.78, TOP - SH / 2 - 0.01 + IMG.y + sy * 0.52, 0.02)));
      const lensPts = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => V(P.x + sx * 0.02, P.y + sy * 0.015, P.z));
      const pos = [], along = [], across = [];
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4, a = lensPts[i], b = lensPts[j], c = corners[j], d = corners[i];
        for (const [p, al, ac] of [[a, 0, 0], [b, 0, 1], [c, 1, 1], [a, 0, 0], [c, 1, 1], [d, 1, 0]]) { pos.push(p.x, p.y, p.z); along.push(al); across.push(ac); }
      }
      const bg = new THREE.BufferGeometry(); bg.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1)); bg.setAttribute("aAcross", new THREE.Float32BufferAttribute(across, 1));
      const bu = roof.cineBeamU = { uK: { value: 0 }, uCol: { value: new THREE.Color(1, 1, 1) }, uT: { value: 0 } };
      const beam = new THREE.Mesh(bg, new THREE.ShaderMaterial({ uniforms: bu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        vertexShader: `attribute float aAlong, aAcross; varying float vA, vX; void main() { vA = aAlong; vX = aAcross; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform float uK, uT; uniform vec3 uCol; varying float vA, vX;
          void main() { float rays = 0.75 + 0.25 * sin(vX * 47.0 + sin(vX * 13.0) * 2.0) * sin(vX * 19.0 + uT * 0.3);
            float a = uK * rays * (0.15 + 0.85 * pow(1.0 - vA, 2.2)) * smoothstep(0.0, 0.04, vA) * (1.0 - smoothstep(0.9, 1.0, vA));
            gl_FragColor = vec4(uCol * a, 1.0); }` }));
      beam.frustumCulled = false; G.add(beam); roof.cine.beam = beam; roof.cine.sheet = sheet;
    }
    shade(9.9, 26.4, 0.8, 0.8, 0.55); shade(9.45, 25.95, 0.5, 0.5, 0.3); shade(9.9 - Math.cos(0.55) * 0.8, 26.4 + Math.sin(0.55) * 0.8, 0.8, 0.8, 0.62);
    col(9.35, 10.65, 25.7, 26.85); col(8.95, 9.65, 26.5, 27.25);
  }
  // things that ended up up here over the years and nobody came for
  {
    const fr = cy(0.135, 0.12, 0.022, lam(0xd8743a), -7.25, Y + 0.02, 18.3, 20); fr.rotation.set(0.12, 0, 0.08);
    for (const [x, z] of [[1.95, 8.45], [-6.25, 15.5], [-7.4, 31.2]]) put(new THREE.SphereGeometry(0.033, 10, 8), lam(0xc8dc48), x, Y + 0.03, z);
    const kick = put(new THREE.SphereGeometry(0.2, 16, 10), lam(0xa8302c), -5.4, Y + 0.06, 46.1); kick.scale.y = 0.32;
  }

  tonyRoof({ lam, phong, put, bx, cy, ext, V, alum, gravel, coping, shade });   // Tony's roof, seen from ours (tonys/outside.js)
}
let aimRoofLadder = false, aimGolf = false, aimCine = null;   // aimCine: "vcr" | "proj", the movie setup up top
// ---------------- golf on the roof ----------------
// A chipped square of fake turf out on the deck with a tee in it and a club lying beside it. E on either: golf. You're
// at address (the camera behind the ball, looking down the line); A/D walk you round the ball to aim, W/S slide the club
// face along it (toe ... heel). The swing's three clicks: hold to wind the power up and let go at the power you want; a
// line runs back down the meter from there, and the last click wants to land on the mark just above the bottom. On it:
// pure, and straight. A touch early it's pulled and draws left; a touch late it's pushed and fades right; let the line
// run out and it's a mishit, low and sliced, worse off the heel. Off the toe or heel costs distance and bends it too.
// The ball flies (gravity, drag, backspin's lift, sidespin bending it), bounces off the parapets and the deck, comes
// down out in the world and rolls out, and you get the yardage; then there's another ball on the tee. E or right-click: done
const GOLF = { x: 5.5, z: 12, R: 0.0214, SWEET: 0.08, PURE: 0.015, CLUB: 1.0, MAX: 48 };   // the tee; ball radius; the meter's mark and how close is pure; club length; how far out it can get (just past the treeline over the road)
const golf = { on: false, aim: 0, c: 0, st: "idle", pow: 0, peak: 0, line: 0, theta: 0, th0: 0, t: 0, hit: null, v: new THREE.Vector3(), spin: 0, lift: 0,
  carry: null, rolled: false, cam: new THREE.Vector3(), parts: [], ball: null, club: null, lie: null, trail: null, n: 0 };
const golfTee = new THREE.Vector3(GOLF.x, ROOF.y + 0.055 + GOLF.R, GOLF.z);   // the ball, sat on the tee
{
  const Y = ROOF.y, { x, z } = GOLF, lam = c => new THREE.MeshLambertMaterial({ color: c });
  const turf = makeTexture((ctx, W, H) => {        // short green blades, every which shade
    ctx.fillStyle = "#2f8a3a"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6000; i++) { ctx.fillStyle = `hsl(${112 + Math.random() * 20} ${40 + Math.random() * 30}% ${20 + Math.random() * 24}%)`; ctx.fillRect(Math.random() * W, Math.random() * H, 1, 2 + Math.random() * 3); }
  }, 256, 256);
  turf.wrapS = turf.wrapT = THREE.RepeatWrapping; turf.repeat.set(1.4, 1.4);
  const pts = [];                                   // a square, its corners and edges chipped off here and there
  for (let i = 0; i < 32; i++) { const a = (i + 0.5) / 32 * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), r = 0.6 / Math.max(Math.abs(c), Math.abs(s)) * (Math.random() < 0.35 ? 0.86 + Math.random() * 0.1 : 1); pts.push(new THREE.Vector2(c * r, s * r)); }
  const mat = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: 0.018, bevelEnabled: false }), new THREE.MeshLambertMaterial({ map: turf }));
  mat.rotation.x = -Math.PI / 2; mat.rotation.z = 0.12; mat.position.set(x, Y, z); roof.g.add(mat);
  const tee = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.003, 0.05, 10), lam(0xf4f1e8)); tee.position.set(x, Y + 0.035, z); roof.g.add(tee);
  golf.ball = new THREE.Mesh(new THREE.SphereGeometry(GOLF.R, 16, 12), new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x333333, shininess: 60 }));
  golf.ball.position.copy(golfTee); roof.g.add(golf.ball); golf.ball.visible = false;   // (only up top: see golfTick; in roof.g, or roomSort files it with the store under it and hides it)
  const club = () => {                              // the grip at the origin, the shaft down -y, the head at its foot toeing out along +x
    const g = new THREE.Group(), L = GOLF.CLUB;
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); g.add(o); return o; };
    add(new THREE.CylinderGeometry(0.012, 0.01, 0.26, 10), lam(0x1c1c1e), 0, -0.13, 0);                               // grip
    add(new THREE.CylinderGeometry(0.006, 0.0045, L - 0.24, 8), new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 90 }), 0, -0.26 - (L - 0.26) / 2, 0);   // shaft
    add(new THREE.BoxGeometry(0.105, 0.035, 0.03), new THREE.MeshPhongMaterial({ color: 0x3a3d42, specular: 0xaaaaaa, shininess: 70 }), 0.04, -L, 0);   // the head
    return g;
  };
  golf.lie = club(); golf.lie.rotation.set(0, 0.4, Math.PI / 2); golf.lie.position.set(x + 0.75, Y + 0.012, z - 0.45); roof.g.add(golf.lie);   // on the deck beside the mat
  golf.club = club(); golf.club.visible = false; roof.g.add(golf.club);
  for (const o of [mat, tee, ...golf.lie.children]) golf.parts.push(o);
  const tg = new THREE.BufferGeometry(); tg.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(120 * 3), 3)); tg.setDrawRange(0, 0);
  golf.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); golf.trail.frustumCulled = false; roof.g.add(golf.trail);
}
const golfF = () => new THREE.Vector3(-Math.sin(golf.aim), 0, -Math.cos(golf.aim));   // down the line
const golfRt = () => new THREE.Vector3(Math.cos(golf.aim), 0, -Math.sin(golf.aim));   // to its right
const golfStance = () => golfTee.clone().addScaledVector(golfRt(), -0.72).setY(ROOF.y);   // a right-hander: on the left of the line, facing the ball
function golfStart() {
  if (roofHandsFull()) { toast("Your hands are full"); return; }
  invStash(); invRender(); keys.clear();
  Object.assign(golf, { on: true, c: 0, st: "idle", pow: 0, theta: 0 });
  golfReTee();
  me.rig.head.visible = me.rig.neck.visible = true;   // (you can see yourself from back here)
  golf.lie.visible = false; golf.club.visible = true; $("golfHud").hidden = false;
}
function golfEnd() {
  golf.on = false; me.reachTo(null); me.reachAlso(null); me.rig.head.visible = me.rig.neck.visible = false;
  golf.club.visible = false; golf.lie.visible = true; $("golfHud").hidden = true;
  const p = golfStance(); player.x = p.x; player.z = p.z; player.yaw = golf.aim - Math.PI / 2; player.pitch = -0.45;   // left where you stood, looking at the ball
}
function golfReTee() {
  golf.ball.position.copy(golfTee); golf.v.set(0, 0, 0); golf.st = "idle"; golf.carry = null; golf.trail.geometry.setDrawRange(0, 0);
}
function golfMouse(down, button) {
  if (button === 2) { if (down && golf.st === "idle") golfEnd(); return; }
  if (button !== 0) return;
  if (down && golf.st === "idle") { golf.st = "power"; golf.pow = 0; }
  else if (!down && golf.st === "power") { if (golf.pow < 0.04) golf.st = "idle"; else { golf.peak = golf.line = golf.pow; golf.st = "back"; } }
  else if (down && golf.st === "back") golfStrike(golf.line);
}
function golfStrike(at) {                          // the last click (at = where the line was), or null: it ran out. Full power, pure: carries ~38 m, ~6 m over the deck. The strike point lofts it: W (toe) up to ~9 m and shorter, S (heel) a low runner (still clearing the parapet)
  if (CUSTOMER) cmTeeOff();
  const e0 = at == null ? null : at - GOLF.SWEET, e = e0 != null && Math.abs(e0) <= GOLF.PURE ? 0 : e0, c = golf.c;
  let ang = 0, spin = -c * 1.5, speed = 18 * golf.peak * (1 - 0.15 * Math.abs(c)), elev = 0.6 + c * (c > 0 ? 0.4 : 0.25), what = [];
  if (e == null) { speed *= 0.6; elev = 0.3 + c * 0.1; ang = 0.06; spin = 7 + Math.max(0, -c) * 4 - Math.max(0, c) * 3; what.push("mishit", "sliced it"); }
  else if (e > 0) { speed *= 1 - Math.min(0.3, e * 0.8); ang = -Math.min(0.12, e * 0.25); spin += -Math.min(3, e * 6); what.push(e > 0.12 ? "way early: hooked it" : "a touch early: pulled left"); }
  else if (e < 0) { speed *= 1 - Math.min(0.3, -e * 0.8); ang = Math.min(0.12, -e * 0.4); spin += Math.min(3, -e * 20); what.push("a touch late: pushed right"); }
  else if (!c || Math.abs(c) < 0.15) what.push("pure");
  if (Math.abs(c) >= 0.15) what.push(`off the ${c > 0 ? "toe" : "heel"}`);
  const dir = golfF().multiplyScalar(Math.cos(ang)).addScaledVector(golfRt(), Math.sin(ang));
  golf.hit = { v: dir.multiplyScalar(speed * Math.cos(elev)).setY(speed * Math.sin(elev)), spin, what }; golf.seen = new Set();   // (who it's given a scare this shot)
  golf.st = "down"; golf.t = 0; golf.th0 = golf.theta;
}
function golfTick(dt) {
  golf.ball.visible = (player.onRoof || golf.on) && golf.st !== "spout";   // (down the downspout: out of sight till it drops out the foot)
  if (!golf.on) return;
  const F = golfF(), Rt = golfRt(), stance = golfStance();
  if (golf.st === "idle") {                        // aim (A/D: round the ball), the strike point (W/S: along the face)
    const turn = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    golf.aim -= turn * dt * 0.9;
    const slide = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    golf.c = Math.max(-1, Math.min(1, golf.c + slide * dt * 1.2));
  }
  if (golf.st === "power") golf.pow = Math.min(1, golf.pow + dt / 1.1);
  if (golf.st === "back" && (golf.line -= dt * 0.85) <= 0) { golf.line = 0; golfStrike(null); }
  // the club: arms and shaft one lever from between the shoulders, swung in the plane of the line and the ball
  const pivot = stance.clone().setY(ROOF.y + 1.38), d0 = golfTee.clone().sub(pivot).normalize(), n = new THREE.Vector3().crossVectors(d0, F).normalize();
  const want = golf.st === "power" || golf.st === "back" ? -2.6 * (golf.st === "power" ? golf.pow : golf.peak) : golf.st === "idle" ? 0 : golf.st === "flight" || golf.st === "done" ? 2.3 : null;   // (after the strike: on up to the finish, and held)
  if (want != null) golf.theta += (want - golf.theta) * Math.min(1, dt * 10);
  if (golf.st === "down") {                        // the downswing: through the ball and up to the finish
    golf.t += dt; const k = Math.min(1, golf.t / 0.32), was = golf.theta;
    golf.theta = golf.th0 + (2.3 - golf.th0) * k * k;
    if (was < 0 && golf.theta >= 0) { golf.v.copy(golf.hit.v); golf.spin = golf.hit.spin; golf.lift = 0.09; golf.n = 0; golf.rolled = false; golf.st = "flight"; golf.t = 0; }
  }
  const d = d0.clone().applyAxisAngle(n, golf.theta), L = golfTee.distanceTo(pivot);
  const grip = pivot.clone().addScaledVector(d, L - GOLF.CLUB), yA = d.clone().negate(), xA = Rt.clone().addScaledVector(yA, -Rt.dot(yA)).normalize();
  golf.club.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, new THREE.Vector3().crossVectors(xA, yA)));
  golf.club.position.copy(grip).addScaledVector(xA, -0.04 - golf.c * 0.035);   // (the head toes out 4 cm: centred on the ball, less the strike point)
  me.reachTo(grip, 0, { lean: false }); me.reachAlso(grip, 1);
  if (golf.st === "flight") golfFly(dt);
  else if (golf.st === "spout" && (golf.t += dt) > 1.4) {   // out the foot of the downspout and off along the ground
    const [x, z, sx, sz] = golf.spout; golf.ball.position.set(x - sx * 0.52, 0.2, z - sz * 0.52); golf.v.set(-sx * 2.4, 0, -sz * 2.4);
    golf.st = "flight"; golf.rolled = false; golf.carry = null; toast("Down the scupper, rattling down the downspout... and out the bottom", true);
  }
  else if (golf.st === "done" && (golf.t += dt) > 2.4) { golfReTee(); }
  // the camera: behind the ball at address; in flight it chases the ball, a few metres back along the way it's gone
  const home = golfTee.clone().addScaledVector(F, -2.4).addScaledVector(Rt, 0.55).setY(ROOF.y + 1.55);   // (off to the right of the line: you're on the left of the picture)
  player.x = stance.x; player.z = stance.z;
  if (golf.st === "flight" || golf.st === "done" || golf.st === "spout") {
    const b = golf.ball.position, out = new THREE.Vector3(b.x - golfTee.x, 0, b.z - golfTee.z), far = out.length();
    const back = far > 0.5 ? out.divideScalar(far) : F, chase = b.clone().addScaledVector(back, -Math.min(4, 2.4 + far * 0.05));
    chase.y = Math.max(b.y + 1.3, (onDeck(chase.x, chase.z) ? ROOF.y : 0) + 0.6);   // (ponytail: no wall/tree collision: it can pass through the parapet or a tree)
    if (golf.st === "flight") golf.cam.addScaledVector(golf.v, dt);   // (carried along with it, so the easing below is only the swing round behind it, not a lag)
    golf.cam.lerp(chase, Math.min(1, dt * 3));
    const over = onDeck(golf.cam.x, golf.cam.z) ? ROOF.y + 0.6 : onTony(golf.cam.x, golf.cam.z) ? TONY.wall + 0.3 : 0;   // (never down inside a building: over its roof, looking down)
    if (golf.cam.y < over) golf.cam.y = over;
  } else golf.cam.copy(home);
  if (golf.st === "flight" || golf.st === "done" || golf.st === "spout") {
    const to = golf.ball.position.clone().sub(golf.cam), yaw = Math.atan2(-to.x, -to.z), pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    let dy = yaw - player.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    player.yaw += dy * Math.min(1, dt * 6); player.pitch += (Math.max(-0.6, pitch) - player.pitch) * Math.min(1, dt * 6);
  } else { player.yaw = golf.aim; player.pitch += (-0.3 - player.pitch) * Math.min(1, dt * 6); }
  golfHud();
}
function golfFly(dt) {
  const b = golf.ball.position, v = golf.v, cars = (carsOut?.all() || []).filter(c => Math.hypot(c.g.position.x - b.x, c.g.position.z - b.z) < 9);
  golf.t += dt;
  for (const c of cars) c.g.updateMatrixWorld();
  golfScares(b);
  for (let i = 0; i < 4; i++) {
    const h = dt / 4, sp = v.length(), air = !golf.rolled;
    if (air) {
      v.addScaledVector(v, -0.0025 * sp * h);       // drag
      const hl = Math.hypot(v.x, v.z) || 1, side = golf.spin * sp / 40;   // sidespin: off to the right of the way it's going (+: a fade / slice)
      const ax = -v.z / hl * side, az = v.x / hl * side; v.x += ax * h; v.z += az * h;
      v.y += (golf.lift * sp - 9.8) * h;            // backspin holds it up
    }
    const nx = b.x + v.x * h, ny = b.y + v.y * h, nz = b.z + v.z * h;
    if (ny < 2.4 && cars.some(c => golfCarHit(c, b, nx, ny, nz))) continue;   // off a car (see golfCarHit)
    if (onDeck(b.x, b.z) && !onDeck(nx, nz) && ny < ROOF.y + 0.15) {   // through a scupper, if it's rolled right into one
      const sc = SCUPPERS.find(([x, z, sx]) => sx ? Math.abs(nz - z) < 0.15 && Math.abs(nx - x) < 0.3 : Math.abs(nx - x) < 0.15 && Math.abs(nz - z) < 0.3);
      if (sc) { golfSpout(sc); return; }
    }
    if (onTony(b.x, b.z) !== onTony(nx, nz) && ny < TONY.wall) {   // next door's walls (from outside), its coping (from on its roof)
      if (onTony(nx, b.z) !== onTony(b.x, b.z)) v.x *= -0.4;
      if (onTony(b.x, nz) !== onTony(b.x, b.z)) v.z *= -0.4;
      v.y *= 0.7; continue;
    }
    if (onDeck(b.x, b.z) && !onDeck(nx, nz) && ny < ROOF.y + ROOF.wall + GOLF.R) {   // the parapet: off it and back
      if (!onDeck(nx, b.z)) v.x *= -0.4;
      if (!onDeck(b.x, nz)) v.z *= -0.4;
      v.y *= 0.7; continue;
    }
    if (Math.hypot(nx - golfTee.x, nz - golfTee.z) > GOLF.MAX) { v.x *= -0.15; v.z *= -0.15; continue; }   // into the trees: it drops out of them (ponytail: a ring round the tee, not the real treeline)
    const fl = (onDeck(nx, nz) ? ROOF.y : onTony(nx, nz) ? TONY.y : pavedAt(nx, nz) ? LOT.y : 0) + GOLF.R;
    b.set(nx, ny, nz);
    if (golf.rolled || b.y < fl) {
      b.y = fl;
      if (golf.carry == null) golf.carry = Math.hypot(b.x - golfTee.x, b.z - golfTee.z);
      golf.spin = 0; golf.lift = 0;
      if (!golf.rolled && v.y < -1.5) { v.y *= -0.3; v.x *= 0.45; v.z *= 0.45; }   // a bounce: it bites
      else {                                         // rolling out
        v.y = 0; golf.rolled = true;
        const hs = Math.hypot(v.x, v.z), k = Math.max(0, hs - 5 * h) / (hs || 1); v.x *= k; v.z *= k;
      }
    }
  }
  const tp = golf.trail.geometry.attributes.position;   // the trail, a point every so often
  if (golf.n < 120 && !golf.rolled) { tp.setXYZ(golf.n++, b.x, b.y, b.z); tp.needsUpdate = true; golf.trail.geometry.setDrawRange(0, golf.n); }
  if ((golf.rolled && Math.hypot(v.x, v.z) < 0.05) || golf.t > 25) {   // it's stopped: how far
    const yd = Math.hypot(b.x - golfTee.x, b.z - golfTee.z) / 0.9144, carry = (golf.carry ?? 0) / 0.9144;
    if (onTony(b.x, b.z)) {                          // up on Tony's roof: it stays there (the ball on the tee's a new one)
      const lost = golf.ball.clone(); scene.add(lost); golfLost.push(lost); if (golfLost.length > 20) golfLost.shift().removeFromParent();
      toast(`${Math.round(yd)} yards, onto Tony's roof. That one's not coming back`);
    } else toast(`${Math.round(yd)} yards${carry > 1 ? ` (${Math.round(carry)} in the air)` : ""} · ${golf.hit.what.join(", ")}`, golf.hit.what[0] === "pure");
    golf.st = "done"; golf.t = 0;
  }
}
// ---- what the ball can get into out there: the cars in the lot and going by on the road, people on the walk, the
// scuppers (down the downspout and out the foot), Tony's roof next door (and that's the end of that ball) ----
const TONY = { x0: 13, x1: 21, z0: 0, z1: 14, y: 4.385, wall: 4.65 };   // next door: its walls' footprint, its roof's gravel, the top of its coping
const onTony = (x, z) => x > TONY.x0 && x < TONY.x1 && z > TONY.z0 && z < TONY.z1;
const golfLost = [];
function golfSpout(sc) {                          // into a scupper: gone, a rattle down the pipe, then out the bottom (see golfTick)
  golf.st = "spout"; golf.t = 0; golf.spout = sc; golf.v.set(0, 0, 0); golf.ball.position.set(sc[0] - sc[2] * 0.36, 1.5, sc[1] - sc[3] * 0.36);   // (in the pipe: the camera looks down to the foot)
  golfSnd("rattle", golf.ball.position);
}
// the car's top line, nose to tail, in its own frame (+x the nose, y up: see car()), and where the ball is against it
const carTop = s => [[s.L / 2, s.noseY], [s.cowlX, s.hoodY], [s.wsTopX, s.roofY], [s.rTopX, s.roofY], [s.rBotX, s.rBotY], [-s.L / 2, s.bedTop ?? s.rearY]];
function carTopAt(s, x) {                         // -> { y, nx, ny (the surface's normal), seg (1: the windshield, 3: the rear glass) }
  const p = carTop(s); let i = 0; while (i < p.length - 2 && x < p[i + 1][0]) i++;
  const [x0, y0] = p[i], [x1, y1] = p[i + 1], f = Math.max(0, Math.min(1, (x - x0) / (x1 - x0 || 1))), l = Math.hypot(x1 - x0, y1 - y0) || 1;
  return { y: y0 + (y1 - y0) * f, nx: (y1 - y0) / l, ny: (x0 - x1) / l, seg: i };
}
const golfQ = new THREE.Vector3(), golfQp = new THREE.Vector3();
function golfCarHit({ g, m, lot }, b, nx, ny, nz) {   // the ball into a car this step: off it, and what it did -> true (it bounced: the step's done)
  const s = g.userData.car, R = GOLF.R + 0.04, q = g.worldToLocal(golfQ.set(nx, ny, nz));   // (the body's bevel stands 4 cm proud of its outline)
  if (Math.abs(q.x) > s.L / 2 + 0.14 + R || Math.abs(q.z) > s.W / 2 + R || q.y < 0.12) return false;
  const top = carTopAt(s, q.x); if (q.y > top.y + R) return false;
  const qp = g.worldToLocal(golfQp.copy(b)), was = carTopAt(s, qp.x), at = q.clone();
  let n, glass;
  if (qp.y > was.y + R - 0.03) {                  // came down on it
    n = new THREE.Vector3(top.nx, top.ny, 0); glass = top.seg === 1 || top.seg === 3;
    at.y = top.y; at.addScaledVector(n, glass ? 0.06 : 0.045);
  } else if (Math.abs(qp.z) > s.W / 2 + R - 0.03) {   // into its side (above the beltline: a window)
    n = new THREE.Vector3(0, 0, Math.sign(qp.z)); glass = q.y > s.hoodY + 0.05;
    at.z = n.z * (s.W / 2 + (glass ? 0.012 : 0.004));
  } else {                                        // its nose or its tail
    n = new THREE.Vector3(Math.sign(qp.x), 0, 0); glass = false;
    at.x = n.x * (s.L / 2 + 0.145);
  }
  const face = n.clone().transformDirection(g.matrixWorld);
  const cv = new THREE.Vector3(m ? m.vx : 0, 0, 0), rel = golf.v.clone().sub(cv), vn = rel.dot(face);
  if (vn >= 0) return false;
  rel.addScaledVector(face, -vn).multiplyScalar(0.7).addScaledVector(face, -vn * 0.3); golf.v.copy(rel.add(cv));   // off it: a dull bounce, some speed scrubbed off
  const hard = -vn;
  if (hard < 2.5) return true;                   // just a tap
  golfMark(g, at, n, glass);
  const where = m ? "a car on the road" : lot ? "a customer's car" : "a car in the lot";
  golfSnd(glass ? "glass" : "clank", b);
  if (m) {                                        // one going by: it swerves, or (through the windshield, or hard) off the road it goes
    if (m.hitBy === golf.hit) return true; m.hitBy = golf.hit;   // (once a shot: a near miss first doesn't count, see golfScares)
    golfSnd("screech", b);
    if (glass || hard > 9) { carsOut.crash(m); golfSnd("thud", g.position, 0.9); toast(`Hit ${where}! It's run off the road`); shiftScore(-10, "you"); logAct("Ran a car off the road with a golf ball", "bad", null, -10); }
    else { carsOut.swerve(m, Math.sign(g.position.z - b.z) || 1); golfSnd("horn", g.position); toast(`Bounced it off ${where}. It swerved, and leaned on the horn`); }
    return true;
  }
  if (!g.userData.alarm || g.userData.alarm.t > 10) { carsOut.alarm(g); golfSnd("alarm", g.position); }
  if (!golf.seen.has(g)) {
    golf.seen.add(g);
    toast(glass ? `Cracked the glass on ${where}. There goes the alarm` : `Dented ${where}. There goes the alarm`);
    if (lot) { shiftScore(-5, "you"); logAct("Dinged a customer's car with a golf ball", "bad", null, -5); }
  }
  return true;
}
let golfDentM = null, golfCrackM = null;
function golfMark(g, at, n, glass) {              // a ding in the paint, or a star in the glass, where it hit
  if ((g.userData.marks = (g.userData.marks || 0) + 1) > 8) return;
  const decal = (draw, size) => new THREE.MeshLambertMaterial({ map: makeTexture(draw, size, size), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  golfDentM ??= decal((c, W) => {                 // a shallow dimple: shadowed on one side, a glint on the other
    c.clearRect(0, 0, W, W);
    const d = c.createRadialGradient(W * 0.56, W * 0.56, 0, W / 2, W / 2, W / 2); d.addColorStop(0, "rgba(0,0,0,0.5)"); d.addColorStop(0.55, "rgba(0,0,0,0.22)"); d.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = d; c.fillRect(0, 0, W, W);
    const l = c.createRadialGradient(W * 0.38, W * 0.38, 0, W * 0.38, W * 0.38, W * 0.2); l.addColorStop(0, "rgba(255,255,255,0.45)"); l.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = l; c.fillRect(0, 0, W, W);
  }, 64);
  golfCrackM ??= decal((c, W) => {                // a star break: a crushed spot, cracks running out of it, a few rings across them
    c.clearRect(0, 0, W, W); c.strokeStyle = "rgba(225,235,245,0.85)"; c.lineCap = "round";
    const arms = [];
    for (let i = 0; i < 11; i++) {
      let a = i / 11 * Math.PI * 2 + Math.random() * 0.4, r = 0; const pts = [[W / 2, W / 2]];
      while (r < W * (0.3 + Math.random() * 0.18)) { a += (Math.random() - 0.5) * 0.35; r += 6 + Math.random() * 10; pts.push([W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r]); }
      c.lineWidth = 1.2 + Math.random(); c.beginPath(); pts.forEach(([x, y], k) => k ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); arms.push(pts);
    }
    c.lineWidth = 0.8;
    for (const ring of [0.25, 0.5, 0.8]) { c.beginPath(); arms.forEach((p, k) => { const [x, y] = p[Math.min(p.length - 1, Math.floor(p.length * ring))]; k ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.stroke(); }
    const s = c.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W * 0.06); s.addColorStop(0, "rgba(235,240,250,0.9)"); s.addColorStop(1, "rgba(235,240,250,0)"); c.fillStyle = s; c.fillRect(0, 0, W, W);
  }, 256);
  const size = glass ? 0.32 + Math.random() * 0.12 : 0.07 + Math.random() * 0.04;
  const d = new THREE.Mesh(new THREE.PlaneGeometry(size, size), glass ? golfCrackM : golfDentM);
  d.position.copy(at); d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n.clone().normalize()); d.rotateZ(Math.random() * 6.28);
  d.layers.set(EXTERIOR_LAYER); g.add(d);
}
function golfScares(b) {                          // close calls: a car coming up on it in the road swerves; people on the walk jump (and if it hits one...)
  for (const { g, m } of carsOut?.all() || []) {
    if (!m || golf.seen.has(m) || b.y > 2) continue;
    const ahead = (b.x - g.position.x) * Math.sign(m.v0);
    if (ahead > -1 && ahead < 8 && Math.abs(b.z - g.position.z) < 2.2) {
      golf.seen.add(m); carsOut.swerve(m, Math.sign(g.position.z - b.z) || 1); golfSnd("screech", g.position, 0.6); golfSnd("horn", g.position);
      toast("A car swerved round it, leaning on the horn");
    }
  }
  for (const c of [...walkers.map(w => w.c), ...custs.map(k => k.c)]) {
    const p = c?.group.position; if (!p || !c.group.visible || golf.seen.has(c) || b.y > 2.4) continue;
    const d = Math.hypot(b.x - p.x, b.z - p.z); if (d > 1.4) continue;
    golf.seen.add(c); c.setMood("shock"); c.stagger?.(Math.sign((b.x - p.x) || 1));
    if (d < 0.35 && b.y < 1.9) { golf.v.x *= -0.3; golf.v.z *= -0.3; golfSnd("thud", b, 0.4); toast("Beaned somebody with it. \"OW! Hey!\""); shiftScore(-10, "you"); logAct("Hit a passer-by with a golf ball", "bad", null, -10); }
    else toast("\"Hey! Watch it!\"");
  }
}
function golfSnd(kind, at, vol = 1) {             // the noises it makes out there: fainter the further off they are
  try {
    const ac = VaultAudio.ctx(); ac.resume();
    const t = ac.currentTime, out = ac.createGain(), d = camera.position.distanceTo(at);
    out.gain.value = vol / (1 + (d / 14) ** 2); out.connect(sfxOut(ac));
    const noise = len => { const b = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), x = b.getChannelData(0); for (let i = 0; i < x.length; i++) x[i] = Math.random() * 2 - 1; const s = ac.createBufferSource(); s.buffer = b; return s; };
    const env = (node, a, t0, t1) => { const g = ac.createGain(); g.gain.setValueAtTime(a, t0); g.gain.exponentialRampToValueAtTime(0.0005, t1); node.connect(g).connect(out); return g; };
    const tone = (type, f, a, t0, t1) => { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; env(o, a, t0, t1); o.start(t0); o.stop(t1); };
    if (kind === "clank") { for (const [f, a] of [[1150, 0.12], [1720, 0.08], [2630, 0.05], [420, 0.1]]) tone("sine", f, a, t, t + 0.35); const n = noise(0.05); env(n, 0.2, t, t + 0.05); n.start(t); }
    else if (kind === "glass") { const n = noise(0.4), f = ac.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 2500; n.connect(f); env(f, 0.25, t, t + 0.35); n.start(t); tone("sine", 3900, 0.05, t, t + 0.6); tone("sine", 5200, 0.03, t + 0.02, t + 0.5); }
    else if (kind === "thud") { tone("sine", 70, 0.4, t, t + 0.4); const n = noise(0.2), f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500; n.connect(f); env(f, 0.4, t, t + 0.25); n.start(t); }
    else if (kind === "screech") { const n = noise(1.3), f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 9; f.frequency.setValueAtTime(2300, t); f.frequency.linearRampToValueAtTime(1500, t + 1.2); n.connect(f); env(f, 0.5, t, t + 1.3); n.start(t); }
    else if (kind === "horn") { for (const f of [392, 494]) { const o = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain(); o.type = "square"; o.frequency.value = f; lp.type = "lowpass"; lp.frequency.value = 1400;
      g.gain.setValueAtTime(0, t); for (const [a, b] of [[0.05, 0.3], [0.42, 1.3]]) { g.gain.setValueAtTime(0.06, t + a); g.gain.setValueAtTime(0, t + b); } o.connect(lp).connect(g).connect(out); o.start(t); o.stop(t + 1.4); } }
    else if (kind === "rattle") { for (let k = 0, tt = t; k < 16; k++, tt += 0.05 + k * 0.006) tone("triangle", 900 + Math.random() * 900, 0.07 * (1 - k / 20), tt, tt + 0.04); tone("sine", 160, 0.12, t + 1.3, t + 1.5); }
    else if (kind === "alarm") {                  // the classic: a whoop, chirps, the two-tone, round again for ten seconds
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "sawtooth"; g.gain.value = 0.05; o.connect(g).connect(out); o.start(t); o.stop(t + 10);
      for (let c = 0; c < 10; c += 3.3) { o.frequency.setValueAtTime(600, t + c); o.frequency.linearRampToValueAtTime(1500, t + c + 0.9);
        for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(k % 2 ? 900 : 1300, t + c + 1 + k * 0.16); for (let k = 0; k < 6; k++) o.frequency.setValueAtTime(k % 2 ? 700 : 1000, t + c + 2 + k * 0.22); }
    }
    setTimeout(() => out.disconnect(), 11000);
  } catch {}
}
function golfHud() {
  const m = $("golfHud"), fill = golf.st === "power" ? golf.pow : golf.st === "back" ? golf.peak : 0;
  m.style.setProperty("--pow", `${(fill * 100).toFixed(1)}%`);
  m.style.setProperty("--line", `${((golf.st === "back" ? golf.line : 0) * 100).toFixed(1)}%`);
  m.classList.toggle("back", golf.st === "back");
  const c = golf.c, face = Math.abs(c) < 0.15 ? "center" : `${c > 0 ? "toe" : "heel"} ${Math.round(Math.abs(c) * 100)}%, ${c > 0 ? "higher" : "lower"}`;
  $("golfInfo").innerHTML = golf.st === "idle" ? `A / D — aim · W / S — strike: <b>${face}</b><br>Hold click — power · let go · click on the mark<br>E / right-click — done`
    : golf.st === "power" ? "Let go at the power you want" : golf.st === "back" ? "Click on the mark!" : "";
}
function roofClimb(dir) {                          // up (1) or down (-1) the closet ladder
  if (dir > 0 && roofHandsFull()) { toast("Hands full: you need them both for the ladder"); return; }
  roof.climb = { dir, t: 0, y0: camera.position.y, x0: camera.position.x, z0: camera.position.z };
  player.yaw = 0;                                   // facing the rungs (south), up or down
}
{ const under = floorHeightAt; floorHeightAt = (x, z) => pavedAt(x, z) ? LOT.y : under(x, z); }   // (the lot and the road sit a curb lower than the walk)
const PUDDLE_DARK = new THREE.Color(0x24282e), PUDDLE_GREY = new THREE.Color(0xb4b8bc);   // (a puddle: the sky, darkened by the water and what's under it)
const cineAt = new THREE.Vector3();
function cineTick(dt) {                           // the movie on the roof: the projector's picture on the sheet, washed out by daylight, and its beam after dark
  const C = roof.cine; if (!C) return;
  let k = 1;                                       // the tape's sound: up top it comes from the projector (loud by it, faint across the roof, nothing with it off)
  if (player.onRoof || roof.climb) { const d = camera.position.distanceTo(C.lens.getWorldPosition(cineAt)); k = C.on ? Math.min(1, Math.max(0.03, 3 / Math.max(d, 0.01)) ** 1.5) : 0; }
  video.volume = tvSet.volume / 100 * k;
  if (!roof.g.visible) return;
  const on = C.on, day = Math.max(0, Math.min(1, tod.level));
  roof.cineU.uProj.value = on ? 0.06 + 0.9 * (1 - day) ** 1.5 : 0;   // (in the sun it's barely there; after dark it's the picture)
  roof.cineU.uBlue.value = playing ? 0 : 1;
  const z = TVU.uTvZoneC.value, col = roof.cineBeamU.uCol.value;   // the beam takes the picture's colour (the TV light's 3x3 average)
  if (playing) { let r = 0, g = 0, b = 0; for (let i = 0; i < 27; i += 3) { r += z[i]; g += z[i + 1]; b += z[i + 2]; } const m = Math.max(r, g, b, 0.01); col.setRGB(0.55 + 0.45 * r / m, 0.55 + 0.45 * g / m, 0.55 + 0.45 * b / m); }
  else col.setRGB(0.5, 0.6, 1);
  roof.cineBeamU.uK.value = on ? 0.035 * (1 - day) ** 2 : 0; roof.cineBeamU.uT.value += dt; C.beam.visible = on && day < 0.9;
  C.lens.material.color.setHex(on ? (playing ? 0xfff6e0 : 0x8fa8ff) : 0x223040); C.led.material.color.setHex(on ? 0x2bff6a : 0xff7a1a);
  C.vled.material.color.setHex(playing ? (video.paused ? 0xffb020 : 0x3dff8a) : 0x0a1a10);
}
function roofTick(dt) {
  cineTick(dt);
  const R = roof, mo = shiftDate().getMonth(), h = shift.h;
  R.lidA += ((player.onRoof || R.climb ? 1.45 : 0) - R.lidA) * Math.min(1, dt * 2.5); R.lid.rotation.x = -R.lidA;
  if (R.bulb) R.bulb.color.setHex(tod.level < 0.5 ? 0xffe2a8 : 0x4a4a44);
  if (R.pizzaWin) R.pizzaWin.color.setHex(tod.level < 0.6 && h > 10 && h < 23.5 ? 0xffc77a : tod.level < 0.6 ? 0x1a1d22 : 0x3a4048);
  if (R.turbine) R.turbine.rotation.y += dt * (0.4 + 7 * (WX.wind || 0) + 4 * (WX.gust || 0));
  const cooling = mo >= 4 && mo <= 8 ? 1 : (mo === 3 || mo === 9) && h > 12 && h < 18 ? 1 : 0;
  for (const f of R.fans) {                          // the condensers cycle on and off, spinning up and coasting down
    const on = cooling && (clockT + f.phase) % 300 < 200;
    f.v += ((on ? 28 : 0) - f.v) * Math.min(1, dt * (on ? 0.8 : 0.35)); f.g.rotation.y += f.v * dt;
  }
  for (const u of R.units) { u.on = !!cooling && (clockT + u.phase) % 300 < 200; u.y = ROOF.y + 1.2; }
  if (R.sign) { const lit = tod.level < 0.55; R.sign.lit.visible = lit; R.sign.day.visible = !lit; }   // the sign comes on at dusk
  const snowed = WX.cover;
  if (R.puddles) { R.pond = Math.max(WX.wet, (R.pond || 0) - dt * 0.004); R.puddles.opacity = 0.7 * Math.min(1, R.pond * 1.4) * (1 - snowed); R.puddles.color.copy(tod.sky).lerp(PUDDLE_GREY, 0.45).multiplyScalar(0.62).lerp(PUDDLE_DARK, 0.3); }   // (they dry slower than the lot)
  if (R.grime) R.grime.opacity = 1 - 0.85 * snowed;
  if (R.shades) R.shades.opacity = 0.6 * (1 - 0.5 * snowed);
  const S = R.smoke;
  if (S) {                                           // Tony's oven, going while they're open (and banked overnight, a thin wisp)
    const open = h > 10 && h < 23.5, wind = wxFall.uni.uWind.value;
    S.acc += dt * (open ? 5 + 6 * Math.min(1, wind.length() / 4) : 0.8);   // (more of them in a wind, or the plume pulls apart into beads)
    while (S.acc >= 1) { S.acc--; if (S.p.length < 96) S.p.push({ x: S.at.x + (Math.random() - 0.5) * 0.1, y: S.at.y, z: S.at.z + (Math.random() - 0.5) * 0.1, age: 0, life: 6 + Math.random() * 5, s: 0.3 + Math.random() * 0.2, k: open ? 1 : 0.4, sx: (Math.random() - 0.5) * 0.2, sz: (Math.random() - 0.5) * 0.2 }); }
    const pos = S.geo.attributes.position.array, aA = S.geo.attributes.aA.array, aS = S.geo.attributes.aS.array;
    S.p = S.p.filter(p => (p.age += dt) < p.life);
    for (let i = 0; i < 96; i++) {
      const p = S.p[i];
      if (!p) { aA[i] = 0; continue; }
      const f = p.age / p.life, lift = 0.5 / (1 + p.age * 0.5);
      p.x += (wind.x * 0.6 + p.sx) * dt; p.z += (wind.y * 0.6 + p.sz) * dt; p.y += lift * dt;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      aS[i] = p.s + Math.sqrt(f) * 3.2; aA[i] = 0.32 * p.k * Math.min(1, p.age * 2.5) * (1 - f) * (1 - f);
    }
    S.geo.attributes.position.needsUpdate = S.geo.attributes.aA.needsUpdate = S.geo.attributes.aS.needsUpdate = true;
    const lv = tod.level; S.sm.uniforms.uCol.value.setRGB(0.18 + 0.62 * lv, 0.18 + 0.61 * lv, 0.19 + 0.6 * lv);
    S.sm.uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(camera.fov * Math.PI / 360));
  }
  if (!R.climb) return;
  const c = R.climb, DUR = 3.4; c.t = Math.min(DUR, c.t + dt);
  const k = c.t / DUR, e = k * k * (3 - 2 * k), step = 0.04 * Math.sin(k * Math.PI * 12);   // a rung at a time
  const lx = ROOF_LADDER.x, lz = ROOF_LADDER.z + 0.42, yLo = 1.65, yHi = ROOF.y + 1.65;
  if (c.dir > 0) {                                   // walk the step to the foot, then up and out
    const a = Math.min(1, k * 5); R.cam.set(c.x0 + (lx - c.x0) * a, yLo + (yHi + 0.15 - yLo) * e + step, c.z0 + (lz - c.z0) * a);
    if (k > 0.92) R.cam.lerp(new THREE.Vector3(ROOF_UP.x, yHi, ROOF_UP.z), (k - 0.92) / 0.08);
  } else {
    const a = Math.min(1, k * 5); R.cam.set(c.x0 + (lx - c.x0) * a, yHi + 0.15 + (yLo - yHi - 0.15) * e + step, c.z0 + (lz - c.z0) * a);
    if (k > 0.92) R.cam.lerp(new THREE.Vector3(ROOF_DOWN.x, yLo, ROOF_DOWN.z), (k - 0.92) / 0.08);
  }
  if (c.t >= DUR) {
    R.climb = null; player.onRoof = c.dir > 0;
    Object.assign(player, c.dir > 0 ? ROOF_UP : ROOF_DOWN);
    if (player.onRoof) toast("On the roof · E at the hatch to climb back down", true);
  }
}

