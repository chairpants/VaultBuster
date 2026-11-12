// ---- the park across the road (EDGE.park, store/core.js): a clearing in the woods with the old town playground on it. The rocket (a caged climber
// three decks up, with a slide off the first), the monkey bars beside it, a merry-go-round, a seesaw, the swings, a picnic table, two benches and the
// park's sign by the walk. Painted red, teal and cream sometime in the sixties and again since. Worn to dirt wherever feet land ----
// Called from buildGrounds (exterior/grounds.js). All of it one mesh (outdoorKit, exterior/edges.js).
const PLAYGROUND = { rocket: [10, -31], round: [2.8, -27.2], seesaw: [-3.5, -31.5], swings: [20.6, -29.5], table: [-9.5, -35], benches: [[0, LOT.roadFar - 2.2], [15, -24.6]] };   // (the first bench: by the walk, under the park's lamp)
function buildPlayground({ lam, ext }) {
  const g = new THREE.Group(); scene.add(g);
  const K = outdoorKit(), KD = outdoorKit(), R = seeded(1961), P = PLAYGROUND;   // (KD: the worn dirt, its own mesh: it has the ground's shading, exterior/surfaces.js)
  const RED = 0xcf4a32, RED2 = 0xb93c28, TEAL = 0x2f8d98, TEAL2 = 0x26747e, CREAM = 0xe6d7ae, STEEL = 0x9ba0a2, DIRT = 0x8c6e4a, RUBBER = 0x1d1d1f, CHAIN = 0x74787b;
  const solid = (x0, x1, z0, z1, y1) => colliders.push({ x0, x1, z0, z1, y1 });
  const dirt = (x, z, rx, rz, ry = 0) => { const geo = new THREE.CircleGeometry(1, 22); geo.rotateX(-Math.PI / 2); geo.scale(rx, 1, rz); const p = geo.attributes.position;
    for (let i = 1; i < p.count; i++) { const k = 0.86 + R() * 0.2; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); }   // (a ragged edge: grass grows back in from the outside)
    KD.add(geo, DIRT, x, 0.012, z, 0, ry); };

  // ---- the rocket: four fins for legs, a cage of bars swelling out and drawn in to the nose, three decks inside round the mast, a ladder up through them ----
  { const [X, Z] = P.rocket;
    dirt(X + 1.2, Z, 5.2, 3.0);
    K.at(X, 0, Z, 0, () => {
      const prof = [[1.0, 1.02], [1.5, 1.2], [2.2, 1.34], [3.0, 1.38], [3.8, 1.3], [4.6, 1.1], [5.3, 0.82], [5.9, 0.5]];   // the cage: height, radius
      const rAt = y => { for (let i = 1; i < prof.length; i++) if (y <= prof[i][0]) { const [y0, r0] = prof[i - 1], [y1, r1] = prof[i]; return r0 + (r1 - r0) * (y - y0) / (y1 - y0); } return prof[prof.length - 1][1]; };
      const N = 20; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
        const gate = i === 0 || i === 1 || i === N - 1;             // (two bars short at the first deck: the way out onto the slide)
        for (let k = 1; k < prof.length; k++) { const [y0, r0] = prof[k - 1], [y1, r1] = prof[k]; if (gate && y0 >= 2.2 && y1 <= 3.8) continue; K.pipe(i % 2 ? CREAM : RED, [cs * r0, y0, sn * r0], [cs * r1, y1, sn * r1], 0.022, 5); } }
      for (const [y, c, t] of [[1.0, TEAL, 0.045], [2.2, RED2, 0.03], [3.0, CREAM, 0.024], [3.8, RED2, 0.03], [4.6, CREAM, 0.024], [5.3, RED2, 0.03], [5.9, TEAL, 0.04]]) K.add(new THREE.TorusGeometry(rAt(y), t, 6, 28), c, 0, y, 0, Math.PI / 2);
      for (const y of [2.2, 3.8, 5.3]) { const r = rAt(y) - 0.03; K.cyl(RED2, r, r, 0.05, 0, y, 0, 24); K.cyl(0x2a2a2c, 0.34, 0.34, 0.06, -0.55, y, 0.15, 12); }   // the decks, and the hole in each for the ladder
      K.cyl(RED, 0.06, 0.06, 6.0, 0, 3.0, 0, 8);                                                                         // the mast
      for (const s of [-0.2, 0.2]) K.pipe(STEEL, [-0.55, 0, 0.15 + s], [-0.55, 5.3, 0.15 + s], 0.018, 5);
      for (let y = 0.3; y < 5.3; y += 0.3) K.pipe(STEEL, [-0.55, y, -0.05], [-0.55, y, 0.35], 0.014, 5);
      { const nose = new THREE.ConeGeometry(0.5, 1.5, 20, 1, true); K.add(nose, CREAM, 0, 6.65, 0);                      // the nose: a cream cone, red stripes down it, a spike on top
        for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; K.pipe(RED, [Math.cos(a) * 0.5, 5.92, Math.sin(a) * 0.5], [Math.cos(a) * 0.03, 7.38, Math.sin(a) * 0.03], 0.02, 4); }
        K.cyl(STEEL, 0.008, 0.022, 0.7, 0, 7.72, 0, 6); }
      for (let i = 0; i < 4; i++) K.at(0, 0, 0, i * Math.PI / 2 + Math.PI / 4, () => {                                    // the fins it stands on
        const sh = new THREE.Shape([[1.0, 2.5], [1.38, 1.9], [2.05, 0], [1.72, 0], [1.2, 1.05], [1.0, 1.02]].map(([a, b]) => new THREE.Vector2(a, b)));
        const fin = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }); fin.translate(0, 0, -0.035); K.add(fin, TEAL);
        K.pipe(TEAL2, [1.02, 1.02, 0], [1.9, 0, 0], 0.035, 6); K.box(0x777a7c, 0.5, 0.05, 0.3, 1.88, 0.02, 0);
      });
      // the slide, off the first deck toward the road: a steel chute between teal rails, the last of it running out level
      const A = 0, top = [Math.cos(A) * 1.36, 2.2, Math.sin(A) * 1.36];
      K.at(top[0], 0, top[2], -A, () => {
        const run = 3.9, drop = 1.85, L = Math.hypot(run, drop), tilt = Math.atan2(drop, run);
        K.box(0xb9c2c6, L, 0.025, 0.5, run / 2, 2.2 - drop / 2, 0, 0, 0, -tilt);
        for (const s of [-0.27, 0.27]) K.box(TEAL, L, 0.17, 0.035, run / 2, 2.2 - drop / 2 + 0.07, s, 0, 0, -tilt);
        K.box(0xb9c2c6, 0.9, 0.025, 0.5, run + 0.44, 0.35, 0); for (const s of [-0.27, 0.27]) K.box(TEAL, 0.9, 0.13, 0.035, run + 0.44, 0.4, s);
        for (const s of [-0.24, 0.24]) { K.pipe(TEAL2, [run + 0.75, 0, s], [run + 0.75, 0.35, s], 0.025); K.pipe(TEAL2, [run * 0.5, 0, s], [run * 0.5, 2.2 - drop * 0.5, s], 0.025); }
        for (const s of [-0.27, 0.27]) { K.pipe(TEAL, [0, 2.2, s], [0, 3.05, s], 0.022); K.pipe(TEAL, [0, 3.05, s], [0.75, 2.62, s], 0.022); }   // something to hold sitting down at the top
      });
      // the monkey bars, off the other side: two rails out from the cage to a pair of posts
      for (const s of [-0.3, 0.3]) { K.pipe(TEAL, [-1.3, 2.25, s], [-4.6, 2.25, s], 0.026); K.pipe(TEAL, [-4.6, 0, s], [-4.6, 2.25, s], 0.03); }
      for (let x = -1.7; x > -4.55; x -= 0.36) K.pipe(STEEL, [x, 2.25, -0.3], [x, 2.25, 0.3], 0.016, 5);
      for (let y = 0.4; y < 2.2; y += 0.38) K.pipe(STEEL, [-4.6, y, -0.3], [-4.6, y, 0.3], 0.016, 5);
    });
    solid(X - 1.45, X + 1.45, Z - 1.45, Z + 1.45);
    for (let k = 0; k < 8; k++) { const d = 1.6 + k * 0.6, x = X + d, z = Z; solid(x - 0.3, x + 0.3, z - 0.3, z + 0.3, 2.3 - k * 0.27); }   // the slide: you can hop the low end
    solid(X - 4.7, X - 4.5, Z - 0.36, Z + 0.36);
  }

  // ---- the merry-go-round: a steel deck painted red in wedges, four hoops to hang on to, a hub polished by hands ----
  { const [X, Z] = P.round; dirt(X, Z, 2.5, 2.4);
    K.at(X, 0, Z, 0.3, () => {
      K.cyl(0x55585a, 0.16, 0.2, 0.38, 0, 0.19, 0, 12); K.cyl(RED2, 1.42, 1.42, 0.06, 0, 0.4, 0, 28); K.add(new THREE.TorusGeometry(1.42, 0.03, 6, 32), STEEL, 0, 0.4, 0, Math.PI / 2);
      for (let i = 0; i < 8; i++) if (i % 2) { const w = new THREE.CylinderGeometry(1.38, 1.38, 0.064, 6, 1, false, i * Math.PI / 4, Math.PI / 4); K.add(w, RED, 0, 0.4, 0); }
      K.cyl(STEEL, 0.05, 0.05, 0.7, 0, 0.78, 0, 10); K.cyl(STEEL, 0.09, 0.09, 0.04, 0, 1.14, 0, 12);
      for (let i = 0; i < 4; i++) K.at(0, 0, 0, i * Math.PI / 2, () => {
        const hoop = new THREE.TorusGeometry(0.36, 0.022, 6, 14, Math.PI); K.add(hoop, i % 2 ? TEAL : STEEL, 0.95, 0.83, 0, 0, Math.PI / 2);
        for (const s of [-0.36, 0.36]) K.pipe(i % 2 ? TEAL : STEEL, [0.95, 0.43, s], [0.95, 0.83, s], 0.022);
        K.pipe(STEEL, [0.05, 1.1, 0], [0.95, 1.19, 0], 0.016, 5);
      });
    });
    solid(X - 1.3, X + 1.3, Z - 1.3, Z + 1.3, 0.46);
  }

  // ---- the seesaw: a plank on a pipe stand, a handle and a seat at each end, one end always down ----
  { const [X, Z] = P.seesaw; dirt(X - 1.5, Z + 0.25, 0.8, 0.6); dirt(X + 1.5, Z - 0.25, 0.8, 0.6);
    K.at(X, 0, Z, 0.16, () => {
      for (const s of [-0.22, 0.22]) { K.pipe(RED, [-0.3, 0, s], [0, 0.62, s], 0.03); K.pipe(RED, [0.3, 0, s], [0, 0.62, s], 0.03); } K.pipe(STEEL, [0, 0.62, -0.28], [0, 0.62, 0.28], 0.028);
      const T = 0.2;                                 // (tipped: the west end on the ground)
      K.box(TEAL, 3.5, 0.045, 0.24, 0, 0.67, 0, 0, 0, T);
      for (const e of [-1, 1]) { const x = e * 1.45, y = 0.67 + Math.sin(T) * x * 1.0;
        K.box(RED, 0.42, 0.03, 0.26, x * Math.cos(T), y + 0.035, 0, 0, 0, T);
        const hx = e * 1.08 * Math.cos(T), hy = 0.67 + Math.sin(T) * e * 1.08; for (const s of [-0.1, 0.1]) K.pipe(STEEL, [hx, hy, s], [hx, hy + 0.26, s], 0.013, 5); K.pipe(STEEL, [hx, hy + 0.26, -0.1], [hx, hy + 0.26, 0.1], 0.013, 5); }
    });
    solid(X - 1.7, X + 1.7, Z - 0.42, Z + 0.42, 1.05);
  }

  // ---- the swings: an A-frame at each end, a top bar, two seats on chains, hanging straight ----
  { const [X, Z] = P.swings, H = 2.6, W = 1.9; dirt(X - 0.85, Z, 0.75, 1.5); dirt(X + 0.85, Z, 0.75, 1.6);
    K.at(X, 0, Z, -0.12, () => {
      for (const e of [-1, 1]) { for (const s of [-1, 1]) K.pipe(CREAM, [e * (W + 0.25), 0, s * 1.15], [e * W, H, 0], 0.04, 8); K.pipe(CREAM, [e * (W + 0.14), 1.2, -0.62], [e * (W + 0.14), 1.2, 0.62], 0.022); }
      K.pipe(TEAL, [-W - 0.12, H, 0], [W + 0.12, H, 0], 0.045, 8);
      for (const [x, sw] of [[-0.85, 0], [0.85, 0]]) { const L = H - 0.52, y = H - Math.cos(sw) * L, z = Math.sin(sw) * L;
        for (const s of [-0.21, 0.21]) { K.pipe(CHAIN, [x + s, H - 0.04, 0], [x + s, y + 0.02, z], 0.009, 4); K.cyl(STEEL, 0.02, 0.02, 0.05, x + s, H - 0.05, 0, 6); }
        K.box(RUBBER, 0.48, 0.03, 0.17, x, y, z, sw); }
    });
    for (const e of [-1, 1]) for (const s of [-1, 1]) { const lx = e * 2.15, lz = s * 1.15, c = Math.cos(-0.12), n = Math.sin(-0.12), x = X + lx * c + lz * n, z = Z - lx * n + lz * c; solid(x - 0.08, x + 0.08, z - 0.08, z + 0.08); }
  }

  // ---- a picnic table, red once; the second bench, facing the swings; the park's sign by the walk ----
  { const [X, Z] = P.table;
    K.at(X, 0, Z, 0.35, () => {
      for (let k = 0; k < 5; k++) K.box(k % 2 ? RED2 : RED, 1.85, 0.04, 0.142, 0, 0.75, -0.3 + k * 0.15);
      for (const s of [-1, 1]) { for (let k = 0; k < 2; k++) K.box(k ? RED : RED2, 1.85, 0.04, 0.142, 0, 0.45, s * (0.62 + k * 0.15)); }
      for (const e of [-0.7, 0.7]) { K.box(RED2, 0.05, 0.09, 1.6, e, 0.4, 0); K.box(RED2, 0.05, 0.09, 0.72, e, 0.7, 0);
        for (const s of [-1, 1]) K.box(RED2, 0.05, 0.8, 0.09, e + 0.05 * Math.sign(e), 0.365, s * 0.44, -s * 0.42); }   // the legs: an A under each end, feet out past the seats' inner edge
    });
    solid(X - 1.0, X + 1.0, Z - 0.95, Z + 0.95, 0.82);
    const GREEN = 0x2f5233;                        // the benches: slats on iron ends, both facing the playground
    for (const [BX, BZ] of P.benches) { K.at(BX, 0, BZ, 0, () => { for (let k = 0; k < 3; k++) K.box(GREEN, 1.5, 0.035, 0.11, 0, 0.44, -0.13 + k * 0.125); for (let k = 0; k < 2; k++) K.box(GREEN, 1.5, 0.1, 0.03, 0, 0.62 + k * 0.14, 0.2, 0.12);
      for (const e of [-0.62, 0.62]) { K.box(0x18191b, 0.05, 0.44, 0.05, e, 0.22, -0.14); K.box(0x18191b, 0.05, 0.86, 0.05, e, 0.43, 0.19, 0.1); K.box(0x18191b, 0.05, 0.04, 0.36, e, 0.42, 0.02); } });
    solid(BX - 0.78, BX + 0.78, BZ - 0.22, BZ + 0.28, 0.9); }
    const SX = -9, SZ = EDGE.far - 0.7;             // the sign: routed boards between two posts, the town's green
    for (const e of [-1, 1]) K.box(0x5b4327, 0.11, 1.7, 0.11, SX + e * 1.02, 0.85, SZ);
    K.box(0x244a36, 1.96, 0.72, 0.06, SX, 1.22, SZ);
    const s = weatheredSign("ROCKET PARK\nOPEN DAWN TO DARK", 1.86, 0.62, { fg: "#eadfb8", bg: "#244a36", seed: 61, bent: 0 }); s.position.set(SX, 1.22, SZ + 0.035); g.add(s);
    solid(SX - 1.1, SX + 1.1, SZ - 0.1, SZ + 0.1);
  }
  for (const [x, z, s] of EDGE.park.trees) solid(x - 0.1 * s, x + 0.1 * s, z - 0.1 * s, z + 0.1 * s);   // the shade trees' trunks

  g.add(K.mesh()); { const d = KD.mesh(); groundFx(d.material, "dirt"); WX_GROUND.push({ m: d.material, dry: new THREE.Color(0xffffff), wet: new THREE.Color(0x9a9690), snow: 1 }); g.add(d); }
  ext(g);
}
