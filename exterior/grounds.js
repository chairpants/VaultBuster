// ---- around the building: grass all round, a paved apron at its sides and back with the dumpster, the pizza place next door ----
// Called from the roof's block (store/roof.js), with the helpers of its it uses.
function buildGrounds({ lam, put, bx, cy, ext, dark }) {
  const ground = (x0, x1, z0, z1, m, y = 0) => { const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), m); g.rotation.x = -Math.PI / 2; g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); scene.add(g); ext(g); };
  for (const [x0, x1, z0, z1] of [[-250, -27.74, LOT.roadNear, 0], [31, 250, LOT.roadNear, 0], [-250, -27.74, -250, LOT.roadFar], [31, 250, -250, LOT.roadFar], [-27.74, 31, -250, -30.4],   // (out front: round the road, which runs on out of sight)
    [-250, -7.84, 0, 250], [11.1, 250, 0, 27.9], [12.7, 250, 27.9, 29.9], [11.1, 250, 29.9, 250],
    [-7.84, -7.07, 33.1, 46.6], [1.33, 11.1, 33.1, 46.6], [-7.84, 11.1, 46.6, 250]]) ground(x0, x1, z0, z1, mat.grass);
  for (const [x0, x1, z0, z1] of [[-11.84, -7.84, 0, 50.6], [-7.84, -7.07, 33.1, 46.6], [11.1, 13, 0, 14], [11.1, 16.7, 14, 27.9], [12.7, 16.7, 27.9, 29.9], [11.1, 16.7, 29.9, 37.1],
    [1.33, 11.1, 33.1, 37.1], [1.33, 5.33, 37.1, 50.6], [-11.84, 5.33, 46.6, 50.6]]) ground(x0, x1, z0, z1, mat.pavement, 0.004);
  {                                                // the dumpster, out back by the closet: two plastic lids, forklift pockets, a bit of rust
    const d = new THREE.Group(); d.position.set(14.4, 0, 31.6); d.rotation.y = -Math.PI / 2; scene.add(d);
    const green = lam(0x2e5a3a), lidM = lam(0x1b1d1f);
    put(new THREE.BoxGeometry(1.9, 1.1, 1.15), green, 0, 0.62, 0, d);
    for (const s of [-1, 1]) { const l = bx(0.93, 0.05, 1.25, lidM, s * 0.475, 1.2, 0.05, d); l.rotation.x = -0.08; }
    for (const s of [-1, 1]) bx(0.3, 0.12, 1.2, dark, s * 0.55, 0.07, 0, d);
    bx(1.95, 0.05, 0.06, lam(0x6a3a22), 0, 0.95, 0.58, d);
    ext(d); colliders.push({ x0: 13.8, x1: 15, z0: 30.6, z1: 32.6, y1: 1.3 });
  }
  {                                                // round the back, against the theater's east wall: somebody's cardboard bed (a place to lie low and pass the day)
    const b = new THREE.Group(); b.position.set(1.95, 0, 43.6); scene.add(b);
    const card = makeTexture((ctx, w2, h2) => { ctx.fillStyle = "#b08a5a"; ctx.fillRect(0, 0, w2, h2); ctx.strokeStyle = "#8a6a42"; ctx.lineWidth = 3; ctx.strokeRect(6, 6, w2 - 12, h2 - 12);
      ctx.beginPath(); ctx.moveTo(w2 / 2, 0); ctx.lineTo(w2 / 2, h2); ctx.stroke(); ctx.fillStyle = "#3a2a1a"; ctx.font = "bold 22px Arial"; ctx.fillText("THIS SIDE UP", 30, h2 * 0.3); ctx.fillText("↑ ↑", 60, h2 * 0.6);
      for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(60,40,20,${Math.random() * 0.15})`; ctx.fillRect(Math.random() * w2, Math.random() * h2, 6 + Math.random() * 20, 3 + Math.random() * 10); } }, 256, 128);
    const cm2 = lam(0xb08a5a); cm2.map = card;
    for (const [w2, d2, x, z, ry] of [[0.95, 2.0, 0, 0, 0.02], [0.8, 1.1, 0.12, 0.55, -0.08]]) { const o = bx(w2, 0.02, d2, cm2, x, 0.012 + (x ? 0.02 : 0), z, b); o.rotation.y = ry; }
    const blanket = bx(0.85, 0.12, 1.2, lam(0x5a6b3a), 0.05, 0.09, -0.15, b); blanket.rotation.set(0.04, 0.1, 0.03);
    const pillow = bx(0.5, 0.14, 0.32, lam(0x2c2f45), 0, 0.1, 0.78, b); pillow.rotation.y = 0.2;           // a rolled-up jacket for a pillow
    bx(0.4, 0.3, 0.32, lam(0x1f6fb5), -0.55, 0.15, 0.9, b);                                                      // a milk crate
    for (const [cx2, cz2] of [[0.6, -0.8], [0.68, -0.62]]) { const can = cy(0.033, 0.033, 0.12, lam(0xc8282f), cx2, 0.06, cz2, 10, b); can.rotation.z = cx2 > 0.65 ? Math.PI / 2 : 0; }
    ext(b);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 2.3), new THREE.MeshBasicMaterial()); hit.visible = false; hit.position.set(1.95, 0.25, 43.6); hit.userData.bed = true;
    scene.add(hit); aimables.push(hit);           // (what you aim at: the bed itself is on the exterior layer, which the aiming ray doesn't see)
  }
}
