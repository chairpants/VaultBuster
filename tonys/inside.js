// ---- inside Tony's (customer mode: in through its door): a black-and-white checkered floor, a few little tables, two
// arcade cabinets in the corner by the door, the counter across the room with the register and a pie under the heat
// lamp, and behind it a wall with a doorway and a wide hole through to the kitchen (the oven, the prep table), a menu
// board over the hole. Lit by itself (flat, unlit materials: no new lights in the scene). E at the counter for a slice,
// E at a cabinet for a game ----
function tonyInside(x0, x1, z0, z1) {
  const g = new THREE.Group(); scene.add(g);
  const M = c => new THREE.MeshBasicMaterial({ color: c });
  const B = (w, h, d, m, x, y, z, ry = 0, par = g) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === "number" ? M(m) : m); o.position.set(x, y, z); o.rotation.y = ry; par.add(o); return o; };
  const P = (w, h, m, x, y, z, ry = 0, par = g) => { const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.y = ry; par.add(o); return o; };
  const solidAt = (bx0, bx1, bz0, bz1, y1) => colliders.push({ x0: bx0, x1: bx1, z0: bz0, z1: bz1, y1 });
  const H = 3.0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, I = TONY_IN;
  // the floor, checkered (30 cm squares), and the ceiling with its fluorescent panels
  const chk = makeTexture((ctx, W2) => { const q = W2 / 2; ctx.fillStyle = "#f2f0ea"; ctx.fillRect(0, 0, W2, W2); ctx.fillStyle = "#151515"; ctx.fillRect(0, 0, q, q); ctx.fillRect(q, q, q, q); }, 64, 64);
  chk.wrapS = chk.wrapT = THREE.RepeatWrapping; chk.magFilter = THREE.NearestFilter; chk.repeat.set((x1 - x0) / 0.6, (z1 - z0) / 0.6);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ map: chk })); fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.02, cz); g.add(fl);   // (2 cm up: the grass runs on under the building)
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M(0xd9d4c6)); ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, H, cz); g.add(ceil);
  for (const [lx, lz] of [[15, 6], [18.8, 6], [15.2, 11.5], [18.6, 11.5]]) B(1.2, 0.04, 0.3, 0xfffbe8, lx, H - 0.025, lz);
  // two ceiling fans over the tables (they turn: see tonyTick)
  tony.fans = [[16.9, 2.9], [19.1, 2.9]].map(([fx, fz]) => { const f = new THREE.Group(); f.position.set(fx, H - 0.38, fz); g.add(f);
    B(0.03, 0.3, 0.03, 0x6b4a2a, fx, H - 0.17, fz); B(0.16, 0.1, 0.16, 0x6b4a2a, 0, 0, 0, 0, f);
    for (let k = 0; k < 4; k++) { const bl = B(0.62, 0.012, 0.13, 0x8a5a32, Math.cos(k * Math.PI / 2) * 0.36, -0.02, Math.sin(k * Math.PI / 2) * 0.36, -k * Math.PI / 2, f); bl.rotation.x = 0.08; }
    return f; });
  // neon in the windows, facing the walk (lit while they're open: see tonyTick)
  const neon = (draw, w, h, x, y) => { const t = makeTexture(draw, 256, Math.round(256 * h / w)); const m = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const o = P(w, h, m, x, y, z0 + 0.12, Math.PI); o.renderOrder = 3; return m; };
  tony.neon = [
    neon((ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.lineWidth = 6; ctx.strokeStyle = "#ff3b5c"; ctx.shadowColor = "#ff3b5c"; ctx.shadowBlur = 16; ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.font = "bold 70px Arial Rounded MT Bold, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#6fd3ff"; ctx.shadowColor = "#6fd3ff"; ctx.fillText("OPEN", w / 2, h / 2 + 4); }, 0.9, 0.42, 17.1, 1.8),
    neon((ctx, w, h) => { ctx.clearRect(0, 0, w, h); ctx.lineWidth = 7; ctx.lineJoin = "round"; ctx.shadowBlur = 18;
      ctx.strokeStyle = "#ffb02e"; ctx.shadowColor = "#ffb02e"; ctx.beginPath(); ctx.moveTo(w * 0.2, h * 0.2); ctx.lineTo(w * 0.8, h * 0.2); ctx.lineTo(w * 0.5, h * 0.88); ctx.closePath(); ctx.stroke();
      ctx.strokeStyle = "#ff3b30"; ctx.shadowColor = "#ff3b30"; for (const [px, py] of [[0.4, 0.35], [0.58, 0.38], [0.5, 0.58]]) { ctx.beginPath(); ctx.arc(w * px, h * py, w * 0.05, 0, 7); ctx.stroke(); } }, 0.6, 0.6, 14.2, 1.75),
  ];
  // the tables by the windows: red-and-white checked cloths, chrome posts, two chairs each
  const cloth = makeTexture((ctx, W2) => { const q = W2 / 8; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { ctx.fillStyle = (i + j) % 2 ? "#f4f1e6" : "#c8282f"; ctx.fillRect(i * q, j * q, q, q); } }, 64, 64);
  const clothM = [M(0xc8282f), M(0xc8282f), new THREE.MeshBasicMaterial({ map: cloth }), M(0xc8282f), M(0xc8282f), M(0xc8282f)];
  for (const [tx, tz] of [[16.9, 1.6], [19.1, 1.6], [16.9, 4.2], [19.1, 4.2]]) {
    B(0.84, 0.05, 0.84, clothM, tx, 0.75, tz); B(0.06, 0.72, 0.06, 0xb8bcc0, tx, 0.38, tz); B(0.5, 0.03, 0.5, 0x2a2a2a, tx, 0.035, tz);
    B(0.05, 0.12, 0.05, 0xd8d0b8, tx + 0.18, 0.84, tz - 0.12); B(0.05, 0.12, 0.05, 0xc8282f, tx + 0.26, 0.84, tz - 0.12);   // shakers: cheese, pepper flakes
    for (const s2 of [-1, 1]) { B(0.42, 0.05, 0.42, 0x1d1d1d, tx + s2 * 0.62, 0.45, tz); B(0.05, 0.45, 0.42, 0x1d1d1d, tx + s2 * 0.83, 0.7, tz); }
    solidAt(tx - 0.42, tx + 0.42, tz - 0.42, tz + 0.42, 0.78);
  }
  // photos on the east wall: the opening, the flag, the plaque
  const frame = (draw, w, h, z) => { const t = makeTexture(draw, 128, Math.round(128 * h / w)); B(0.03, h + 0.06, w + 0.06, 0x2b1d12, x1 - 0.03, 1.85, z); P(w, h, new THREE.MeshBasicMaterial({ map: t }), x1 - 0.05, 1.85, z, -Math.PI / 2); };
  frame((ctx, w, h) => { ctx.fillStyle = "#c9b48a"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#5a4630"; ctx.fillRect(10, 10, w - 20, h * 0.62); ctx.fillStyle = "#3a2a1a"; ctx.font = "bold 13px Georgia"; ctx.textAlign = "center"; ctx.fillText("GRAND OPENING", w / 2, h * 0.8); ctx.fillText("1979", w / 2, h * 0.93); }, 0.45, 0.55, 3.0);
  frame((ctx, w, h) => { for (const [i, c] of ["#1f8a3a", "#f4f1e6", "#c8282f"].entries()) { ctx.fillStyle = c; ctx.fillRect(i * w / 3, 0, w / 3 + 1, h); } }, 0.6, 0.4, 3.8);
  frame((ctx, w, h) => { ctx.fillStyle = "#6b4a2a"; ctx.fillRect(0, 0, w, h); ctx.fillStyle = "#d9b44a"; ctx.fillRect(8, 8, w - 16, h - 16); ctx.fillStyle = "#3a2a1a"; ctx.textAlign = "center"; ctx.font = "bold 14px Georgia"; ctx.fillText("BEST SLICE", w / 2, h * 0.42); ctx.fillText("IN TOWN", w / 2, h * 0.6); ctx.font = "12px Georgia"; ctx.fillText("1994", w / 2, h * 0.8); }, 0.42, 0.5, 4.6);
  // the game corner: two arcade cabinets against the west wall, facing into the room (their screens play: see tonyTick), a gumball machine
  const GAMES = TONY_GAMES;
  tony.screens = GAMES.map(([name, glow, body], i) => {
    const z = 3.2 + i * 0.95, cab = new THREE.Group(); cab.position.set(x0 + 0.4, 0, z); cab.rotation.y = Math.PI / 2; g.add(cab);
    const part = (w, h, d, c, x, y, zz, rx = 0) => { const o = B(w, h, d, c, x, y, zz, 0, cab); o.rotation.x = rx; return o; };
    part(0.72, 1.8, 0.7, new THREE.Color(body).getHex(), 0, 0.9, 0); part(0.74, 0.9, 0.04, 0x111111, 0, 0.45, 0.37);
    for (const sx of [-1, 1]) part(0.02, 1.82, 0.72, 0x111111, sx * 0.37, 0.91, 0);              // the side art's black edge
    part(0.7, 0.12, 0.3, 0x222222, 0, 1.0, 0.45, 0.25);                                              // the control panel
    for (const [bxx, c] of [[-0.15, 0xdddddd], [0.04, 0xffd400], [0.14, 0xff3b30]]) { const b = part(0.05, 0.03, 0.05, c, bxx, 1.09, 0.47); if (bxx < 0) b.scale.y = 3; }
    part(0.12, 0.08, 0.02, 0xffd400, 0, 0.62, 0.395);                                                // the coin door's light
    const cv = document.createElement("canvas"); cv.width = 256; cv.height = 192; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    const screen = P(0.56, 0.42, new THREE.MeshBasicMaterial({ map: tex }), 0, 1.42, 0.4, 0, cab); screen.rotation.x = -0.18;   // (4 cm out: tipped back, its top edge sank into the cabinet)
    const mq = makeTexture((ctx, W2, H2) => { ctx.fillStyle = body; ctx.fillRect(0, 0, W2, H2); ctx.fillStyle = glow; ctx.textAlign = "center"; ctx.textBaseline = "middle"; let fs = 30; ctx.font = `italic 900 ${fs}px Arial Black, Arial`; while (ctx.measureText(name).width > W2 - 16) ctx.font = `italic 900 ${fs -= 2}px Arial Black, Arial`; ctx.fillText(name, W2 / 2, H2 / 2); }, 256, 64);
    const marquee = P(0.7, 0.18, new THREE.MeshBasicMaterial({ map: mq }), 0, 1.72, 0.36, 0, cab);
    screen.userData.tony = `game${i}`; aimables.push(screen); marquee.userData.tony = `game${i}`; aimables.push(marquee);
    solidAt(x0, x0 + 0.8, z - 0.38, z + 0.38);
    return { cv, tex, name, glow, stars: Array.from({ length: 40 }, () => [Math.random() * 256, Math.random() * 192, 0.5 + Math.random() * 2]), t: 0 };
  });
  { const gx = x0 + 0.3, gz = 5.3; B(0.3, 0.7, 0.3, 0xb3202a, gx, 0.35, gz); B(0.22, 0.14, 0.22, 0x9a9ea2, gx, 0.77, gz);
    const glob = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdfeff7, transparent: true, opacity: 0.35, depthWrite: false })); glob.position.set(gx, 1.0, gz); g.add(glob);
    for (let k = 0; k < 28; k++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 0.13); if (v.y > 0.05) v.y *= 0.3;
      const gb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), M([0xff3b30, 0xffd400, 0x2ee6ff, 0x4cd964, 0xffffff][k % 5])); gb.position.set(gx + v.x, 0.95 + v.y, gz + v.z); g.add(gb); }
    solidAt(gx - 0.18, gx + 0.18, gz - 0.18, gz + 0.18); }
  // the counter: red front, white top; the register, the soda fountain, a pie under glass; a gap at the end to get behind it
  B(I.gapX - x0, 1.0, 0.6, 0xb3202a, (x0 + I.gapX) / 2, 0.5, I.counterZ + 0.3);
  B(I.gapX - x0, 0.06, 0.012, 0xf4f1e6, (x0 + I.gapX) / 2, 0.1, I.counterZ - 0.006);              // a white kick stripe along the bottom
  const top = B(I.gapX - x0 + 0.04, 0.05, 0.68, 0xf4f1e6, (x0 + I.gapX) / 2, 1.025, I.counterZ + 0.3); top.userData.tony = "order"; aimables.push(top);
  B(0.36, 0.22, 0.3, 0x2b2b2b, 15.2, 1.16, I.counterZ + 0.4); B(0.28, 0.1, 0.01, 0x5cff7a, 15.2, 1.22, I.counterZ + 0.245);   // the register, its readout
  B(0.5, 0.55, 0.35, 0xc9cdd2, 18.7, 1.33, I.counterZ + 0.4); for (const [k, c] of [0xc8282f, 0x2b5bd6, 0x4cd964].entries()) B(0.08, 0.06, 0.03, c, 18.55 + k * 0.15, 1.45, I.counterZ + 0.215);   // the soda fountain
  const warm = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 0.55), new THREE.MeshBasicMaterial({ color: 0xcfe8f0, transparent: true, opacity: 0.25, depthWrite: false })); warm.position.set(17.4, 1.23, I.counterZ + 0.34); g.add(warm);
  B(0.9, 0.02, 0.55, 0x9a9ea2, 17.4, 1.065, I.counterZ + 0.34);                                                                // its steel floor
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), M(0xd98a2b)); pie.position.set(17.4, 1.09, I.counterZ + 0.34); g.add(pie);
  for (let k = 0; k < 7; k++) { const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 8), M(0x9e1b22)); const a = k * 0.9; pep.position.set(17.4 + Math.cos(a) * 0.11, 1.111, I.counterZ + 0.34 + Math.sin(a) * 0.11); g.add(pep); }
  pie.userData.tony = "order"; aimables.push(pie);
  solidAt(x0, I.gapX, I.counterZ, I.counterZ + 0.64, 1.05);
  // the kitchen wall: a doorway at the east end, and a wide hole through to the kitchen with a steel shelf and a red valance
  const WZ = I.wallZ, [h0, h1] = I.hole, [d0, d1] = I.doorX;
  for (const [a, b, y0, y1, c] of [[x0, h0, 0, H, 0xeadfc4], [h1, d0, 0, H, 0xeadfc4], [d1, x1, 0, H, 0xeadfc4], [h0, h1, 0, 1.1, 0x9e1b22], [h0, h1, 2.15, H, 0xeadfc4], [d0, d1, 2.2, H, 0xeadfc4]])
    B(b - a, y1 - y0, 0.12, c, (a + b) / 2, (y0 + y1) / 2, WZ);
  B(h1 - h0 + 0.1, 0.04, 0.42, 0xc9cdd2, (h0 + h1) / 2, 1.12, WZ);                       // the pass-through shelf
  B(h1 - h0 + 0.1, 0.18, 0.03, 0xb3202a, (h0 + h1) / 2, 2.06, WZ - 0.09);                // the valance
  for (let k = 0; k < 3; k++) B(0.14, 0.06, 0.14, 0xffb02e, h0 + 0.8 + k * 1.2, 2.11, WZ + 0.12);   // heat lamps, over the shelf on the kitchen side
  for (const [a, b] of [[x0, h0], [h1, d0], [d1, x1]]) solidAt(a, b, WZ - 0.06, WZ + 0.06);
  solidAt(h0, h1, WZ - 0.06, WZ + 0.06, 1.1);
  const menu = makeTexture((ctx, W2, H2) => { ctx.fillStyle = "#151515"; ctx.fillRect(0, 0, W2, H2); ctx.fillStyle = "#ffd400"; ctx.textAlign = "center"; ctx.font = "italic 900 34px Arial Black, Arial"; ctx.fillText("TONY'S", W2 / 2, 38);
    ctx.textAlign = "left"; ctx.fillStyle = "#ffffff"; ctx.font = "bold 22px Arial";
    [["CHEESE SLICE", "1.25"], ["PEPPERONI SLICE", "1.50"], ["WHOLE PIE", "8.00"], ["GARLIC KNOTS", "2.00"], ["FOUNTAIN SODA", ".75"]].forEach(([n, pr], k) => { ctx.fillText(n, 24, 76 + k * 26); ctx.textAlign = "right"; ctx.fillText(pr, W2 - 24, 76 + k * 26); ctx.textAlign = "left"; }); }, 512, 216);
  P(2.4, 0.78, new THREE.MeshBasicMaterial({ map: menu }), (h0 + h1) / 2, 2.58, WZ - 0.075, Math.PI);
  // the kitchen: the oven against the back wall (its mouth glowing: see tonyTick), a steel prep table, the walk-in's door
  B(2.6, 1.6, 1.4, 0x7a3a28, 16.4, 0.8, z1 - 0.72); tony.mouth = B(2.0, 0.4, 0.04, 0xff8a2a, 16.4, 0.95, z1 - 1.44); B(2.7, 0.08, 1.5, 0x5a5a5a, 16.4, 1.64, z1 - 0.75);
  B(0.3, H - 1.68, 0.3, 0x8a8f94, 16.4, 1.68 + (H - 1.68) / 2, z1 - 0.75);                      // the flue up through the roof
  solidAt(15.1, 17.7, z1 - 1.45, z1);
  B(2.0, 0.05, 0.8, 0xc9cdd2, 15.0, 0.9, 11.2); for (const [lx, lz] of [[14.1, 10.9], [15.9, 10.9], [14.1, 11.5], [15.9, 11.5]]) B(0.05, 0.875, 0.05, 0xa9aeb3, lx, 0.4375, lz);
  for (let k = 0; k < 3; k++) B(0.6, 0.08, 0.4, 0xf2e6c8, 14.6 + k * 0.5, 0.97 + k * 0.09, 11.2);   // dough trays
  solidAt(14.0, 16.0, 10.8, 11.6);
  B(1.0, 2.1, 0.06, 0xb8bcc0, 19.9, 1.05, z1 - 0.04);                                           // the walk-in's door
  // Tony himself, behind the counter
  const c = tony.clerk = VaultCustomers.build({ ...VaultCustomers.randomOutfit(seeded(4417), false), hat: null });
  c.group.position.set(16.2, 0, I.counterZ + 1.0); c.group.rotation.y = Math.PI; c.setMood("neutral"); scene.add(c.group);
  c.parts.forEach(m => { m.userData.tony = "order"; aimables.push(m); });
}
// Space Invaders' attract mode on the cabinet: five rows of them (squid, crab, octopus), stepping across a pixel at a
// time with their legs flipping, down a row at each edge, over four green bunkers and the cannon; the score along the top
const INVADER = {
  squid: [["00011000", "00111100", "01111110", "11011011", "11111111", "00100100", "01011010", "10100101"], ["00011000", "00111100", "01111110", "11011011", "11111111", "01011010", "10000001", "01000010"]],
  crab: [["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"], ["00100000100", "10010001001", "10111111101", "11101110111", "11111111111", "01111111110", "00100000100", "01000000010"]],
  octo: [["000011110000", "011111111110", "111111111111", "111001100111", "111111111111", "000110011000", "001101101100", "110000000011"], ["000011110000", "011111111110", "111111111111", "111001100111", "111111111111", "001110011100", "011001100110", "001100001100"]],
};
