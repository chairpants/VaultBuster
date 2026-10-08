// TV-head customers: blocky bodies with an old television for a head, the
// face drawn live on its screen. Classic script, like couch.js: THREE is only
// touched when build() runs (from store.js), by which point index.html has
// put it on window.
//
// Cheap per character: every part is the same shared unit box/cylinder,
// scaled; an outfit is just a bundle of colors/patterns, and each distinct
// color or pattern becomes one cached material shared by everyone wearing it.
// The only per-character allocations are the transforms and the face canvas.
//
// window.VaultCustomers = {
//   randomOutfit(rnd = Math.random, female?) -> outfit   (plain object: tweak any field;
//                       female: true gets a bust, sized by o.bust ~0.75-1.25, and a warmer screen color)
//   build(outfit) -> customer {
//     group,              origin at the floor between the feet, facing +z
//     screen,             the face mesh (store.js marks it to glow)
//     parts,              every mesh, for aiming at
//     setMood(name),      neutral browse happy love meh wait impatient angry alarm thanks shifty ask off on
//     setPose(name, opts), walk idle reach hold wait sit crouch; sit takes { hipY, tuck }:
//                         hip height (couch: 0.5) and extra knee bend to pull the feet back (a stool's footring)
//     lookAt(yaw|null),   turn the head relative to the body
//     holdTape(n),        how many tapes in hand, 0-3
//     holdProp(name),     "card" / "cash" / "receipt" / "form" / "umbrella" (open, held up overhead) in the other hand, or null
//     sigh(),             a one-off: shoulders lift and drop, the head sags (waiting in line)
//                         poses also: read (a tape held up to read the back), watch (a glance at the wristwatch), lean (forearms on the counter)
//     setPantsDown(bool), for sitting on the toilet: bare legs, pants round the ankles
//     holdItem(obj|null), something real in the other hand (a snack off the rack), sized to the world; null empties it
//     reachTo(point|null, arm, {lean}),  put a hand on a world point (eased); null lets go
//     reachAlso(point|null, arm),  the other hand too, arm only (both hands on a mop handle); null lets go
//     talk(bool),         conversational head motion
//     tick(dt, speed),    animate; speed = m/s along the ground (0 = standing)
//     walkLean,           true: tip forward into the walk (the player's own body turns it off)
//     dispose(),          frees the face canvas texture (materials are shared: kept)
//   }
// }
window.VaultCustomers = (() => {
  // ---- wardrobe: every outfit is picked from these ----
  // The 90s were loud: neon and jewel tones, color-blocking, prints, tie-dye, with some grunge flannel and denim
  // for balance. Boys and girls draw from their own racks (tops, bottoms, sleeves, trims, hats), so the cuts read
  // differently even in the same colors
  const SKIN = ["#f1c9a5", "#e3b48b", "#c98d62", "#9a6440", "#6b4128"];
  const PHOSPHOR_M = ["#7dff9a", "#8fe8ff", "#ffc86a", "#f2f2f2"];   // green, cyan, amber, white
  const PHOSPHOR_F = ["#ff9ce6", "#ff8fb1", "#c9a8ff", "#ffb58a"];   // pink, rose, lavender, peach
  const NEON = ["#ff2e88", "#00c2d1", "#7a3cff", "#9be22e", "#ffd23f", "#ff6b1a", "#1fd1a1", "#e01e5a", "#2d7dff", "#ff4fd8", "#00e5ff", "#c6ff00"];
  const JEWEL = ["#1f7a8c", "#6a4c93", "#2b9348", "#d1495b", "#118ab2", "#8338ec", "#b5179e", "#3a0ca3", "#f77f00", "#06d6a0"];
  const PASTEL = ["#ffb3d9", "#b5ead7", "#c7ceea", "#ffdac1", "#e2f0cb", "#a0e7e5", "#fbe7c6", "#d4a5ff"];
  const GRUNGE = ["#3a3a3a", "#5b4636", "#2f4858", "#7d6b58", "#4a5d23", "#6d2e46", "#1d3557", "#7a1f2b"];
  const DENIM = ["#3b5b8c", "#243650", "#4f73a8", "#1d2a44"];
  const RACK = {
    m: {
      tops: ["tee", "tee", "hoodie", "jersey", "windbreaker", "flannel", "rugby", "hawaiian", "varsity", "colorblock"],
      bottoms: [["baggy", DENIM], ["baggy", DENIM], ["acid", ["#8aa6c9", "#9fb6d4"]], ["cargo", ["#b9a27a", "#4b5320", "#222428", "#6b6f3a"]],
        ["track", ["#1d2a6b", "#222428", "#0b6e4f", "#7a1f2b", "#3a0ca3"]], ["khaki", ["#b9a27a"]], ["black", ["#222428"]]],
      shoes: ["#eeeeee", "#eeeeee", "#1e1e1e", "#b3242c", "#2d4fa3", "#ff6b1a", "#9be22e"],
    },
    f: {
      tops: ["babytee", "babytee", "crop", "tiedye", "memphis", "windbreaker", "cardigan", "overalls", "flannel", "colorblock"],
      bottoms: [["jeans", DENIM], ["acid", ["#8aa6c9", "#b8c9e0"]], ["leggings", [...NEON.slice(0, 6), "#1c1c1e", "#7a3cff"]], ["bike", ["#1c1c1e", "#ff2e88", "#00c2d1", "#9be22e"]],
        ["mini", ["plaid", "denim", "#1c1c1e", "#ff2e88", "#7a3cff"]], ["skirt", ["floral", "#6a4c93", "#d1495b", "#1f7a8c", "plaid"]]],
      shoes: ["#eeeeee", "#eeeeee", "#1e1e1e", "#ff9ce6", "#a0e7e5", "#d4a5ff", "#ffd23f"],
    },
  };
  const CASES = [["wood", "#6b4424"], ["black", "#1c1c1e"], ["beige", "#cfc6a8"], ["silver", "#9aa0a6"], ["red", "#a8262b"], ["white", "#e4e2dc"]];
  const SLEEVE = { tee: "baggy", jersey: "baggy", hawaiian: "baggy", colorblock: "short", babytee: "cap", crop: "cap", tiedye: "short", memphis: "short", overalls: "short" };   // the rest: long

  // how someone walks (outfit.gait): stride (and so cadence: a shorter stride steps quicker), bounce, arm swing,
  // shoulder roll, hip sway, slouch/lean, knee lift. "skip" is a kid's: a hop every other step
  const GAITS = {
    plain:   { stride: 1,    bob: 1,   arms: 1,   twist: 1,   sway: 0,     lean: 0,     knee: 1 },
    bouncy:  { stride: 1,    bob: 2.4, arms: 1.2, twist: 1,   sway: 0,     lean: 0,     knee: 1.3 },
    shuffle: { stride: 0.62, bob: 0.4, arms: 0.4, twist: 0.6, sway: 0,     lean: 0.07,  knee: 0.35 },
    swagger: { stride: 1.1,  bob: 1.2, arms: 1.5, twist: 3,   sway: 0.045, lean: -0.03, knee: 1 },
    brisk:   { stride: 1.15, bob: 0.9, arms: 1.4, twist: 1,   sway: 0,     lean: 0.05,  knee: 1.1 },
    stroll:  { stride: 0.85, bob: 0.8, arms: 0,   twist: 1.5, sway: 0.015, lean: -0.02, knee: 0.9, behind: true },   // hands clasped behind the back
    sway:    { stride: 0.95, bob: 1,   arms: 0.9, twist: 0.5, sway: 0.07,  lean: 0,     knee: 1 },
    stomp:   { stride: 1.05, bob: 1.7, arms: 1.1, twist: 1,   sway: 0.02,  lean: 0.03,  knee: 1.5 },
    skip:    { stride: 1.05, bob: 1.4, arms: 1.6, twist: 1,   sway: 0,     lean: 0,     knee: 1.8, hop: true },
  };
  const SHOULDER_X = 0.255, SHOULDER_X_F = 0.235;   // shoulder joints off center (body-space): the sleeves just overlap the torso (hers is narrower)
  const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
  // female: true / false, or left out to roll it. Her rack or his, then the colors
  function randomOutfit(rnd = Math.random, female) {
    const fem = female ?? rnd() < 0.5, R = RACK[fem ? "f" : "m"];
    const top = pick(R.tops, rnd), [pants, pcols] = pick(R.bottoms, rnd), [tvKind, tvColor] = pick(CASES, rnd);
    const loud = fem && rnd() < 0.35 ? PASTEL : rnd() < 0.6 ? NEON : JEWEL;
    const o = {
      skin: pick(SKIN, rnd), height: 0.93 + rnd() * 0.14, build: 0.9 + rnd() * 0.25,
      top, topA: pick(top === "flannel" ? GRUNGE.concat(JEWEL) : loud, rnd), topB: pick(rnd() < 0.3 ? GRUNGE : NEON.concat(JEWEL), rnd), topC: pick(NEON, rnd),
      sleeve: SLEEVE[top] || "long", graphic: Math.floor(rnd() * 4), number: 1 + Math.floor(rnd() * 98),
      pants, pantsColor: pick(pcols, rnd), pantsB: pick(NEON, rnd), shoes: pick(R.shoes, rnd), hightop: !fem && rnd() < 0.4,
      tights: fem && rnd() < 0.3 ? pick(["#1c1c1e", "#ff9ce6", "#7a3cff"], rnd) : null,
      hat: null,
      tv: { kind: tvKind, color: tvColor, w: 0.42 + rnd() * 0.12, h: 0.32 + rnd() * 0.08, d: 0.3 + rnd() * 0.12, antenna: rnd() < 0.4, knobs: rnd() < 0.6 },
      phosphor: pick(PHOSPHOR_M, rnd), female: fem,
      umbrella: pick(["#1c1c1e", "#1c1c1e", "#7a1f2b", "#1d3557", "#2b9348", "#ffd23f", "#ff2e88", "#3a3a3a"], rnd),
    };
    const h = rnd(), hc = pick(NEON.concat(JEWEL, GRUNGE), rnd);
    o.hat = fem ? (h < 0.18 ? { kind: "bow", color: hc } : h < 0.36 ? { kind: "band", color: hc } : h < 0.44 ? { kind: "bucket", color: hc } : null)
      : (h < 0.3 ? { kind: "cap", color: hc, back: rnd() < 0.5 } : h < 0.4 ? { kind: "bucket", color: hc } : null);
    if (top === "overalls") { o.pants = "jeans"; o.pantsColor = pick(DENIM, rnd); }   // the bib's legs
    o.longSleeves = o.sleeve === "long";
    if (fem) {
      o.phosphor = PHOSPHOR_F[PHOSPHOR_M.indexOf(o.phosphor)];   // same roll, her palette
      o.bust = 0.75 + (o.build - 0.9) * 2;          // 0.75..1.25, fuller on a broader build
    }
    return o;
  }

  // ---- shared geometry + a material cache keyed by what it looks like ----
  let UMB, BOX, CYL, SPH, BALL, SOFT, ROUND, CASE, TORSO, TORSO_F, SHADOW, SHEEN, GRILLE;
  const mats = new Map();
  // a unit box with its edges rounded off (r = corner radius, in unit-box
  // terms): each vertex is pulled onto a rounded shell around a smaller core.
  // Built once and shared, then scaled per part, so a limb reads as a soft
  // pill and a TV case as a molded cabinet — at no per-character cost
  function roundBox(r, seg = 4, taper = 0) {       // taper: how much narrower (x) the bottom is than the top
    const g = new THREE.BoxGeometry(1, 1, 1, seg, seg, seg), p = g.attributes.position, v = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      c.set(Math.max(-0.5 + r, Math.min(0.5 - r, v.x)), Math.max(-0.5 + r, Math.min(0.5 - r, v.y)), Math.max(-0.5 + r, Math.min(0.5 - r, v.z)));
      v.sub(c); if (v.lengthSq() > 0) v.setLength(r); v.add(c);
      if (taper) v.x *= 1 - taper * (0.5 - v.y);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); return g;
  }
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  function geo() {
    if (BOX) return;
    BOX = new THREE.BoxGeometry(1, 1, 1);
    CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14);
    SPH = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);   // a dome (cap crown)
    BALL = new THREE.SphereGeometry(0.5, 10, 8);
    SOFT = roundBox(0.3);                          // limbs, hands: very soft
    UMB = new THREE.ConeGeometry(0.56, 0.2, 10, 1, true);    // an umbrella canopy (open underneath)
    ROUND = roundBox(0.18);                        // shoes, hips
    CASE = roundBox(0.08, 3);                      // TV cabinets: molded plastic / veneer edges
    TORSO = roundBox(0.2, 4, 0.22);                // shoulders broader than the waist
    TORSO_F = roundBox(0.3, 5, 0.1);               // hers: rounder, sloping shoulders, less of a V
    // a soft contact shadow on the floor under each person (the store has no
    // real-time shadows; this is what keeps them from floating)
    SHADOW = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.55,
      map: canvasTex(64, 64, (g, w) => { const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); r.addColorStop(0, "rgba(0,0,0,.8)"); r.addColorStop(0.6, "rgba(0,0,0,.35)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, w, w); }) });
    // the CRT's glass: a faint curved reflection laid over the face
    SHEEN = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      map: canvasTex(128, 96, (g, w, h) => {
        const l = g.createLinearGradient(0, 0, w * 0.7, h); l.addColorStop(0, "rgba(255,255,255,.12)"); l.addColorStop(0.35, "rgba(255,255,255,.03)"); l.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = l; g.beginPath(); g.ellipse(w * 0.26, h * 0.18, w * 0.3, h * 0.16, -0.35, 0, 7); g.fill();
      }) });
    GRILLE = new THREE.MeshLambertMaterial({ map: canvasTex(64, 16, (g, w, h) => { g.fillStyle = "#15161a"; g.fillRect(0, 0, w, h); g.fillStyle = "#050506"; for (let x = 3; x < w; x += 5) g.fillRect(x, 3, 2, h - 6); }) });
  }
  const solid = color => mats.get(color) || mats.set(color, new THREE.MeshLambertMaterial({ color })).get(color);
  function patterned(key, draw) {                 // a 64px canvas pattern, drawn once per distinct look
    if (mats.has(key)) return mats.get(key);
    const c = document.createElement("canvas"); c.width = c.height = 64;
    draw(c.getContext("2d"), 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter;
    const m = new THREE.MeshLambertMaterial({ map: t }); mats.set(key, m); return m;
  }
  // the shirt/jacket -> { front, back, side, sleeve, trim, hood }. The torso takes a material per face, so what's
  // printed on the front (a name tag, a graphic, a number) stays on the front: the back gets its own (a jersey's big
  // number, overall straps), the sides and shoulders just the cloth
  function topMats(o) {
    const { top, topA: a, topB: b } = o, c = o.topC || "#ffffff", key = `${top}|${a}|${b}|${c}|${o.graphic ?? 0}|${o.number ?? 0}|${o.skin}`;
    const mk = (name, draw) => patterned(`${key}|${name}`, (g, n) => { draw(g, n); if (top === "crop") { g.fillStyle = o.skin; g.fillRect(0, n * 0.8, n, n * 0.2); } });   // (a crop top: a bare midriff all round)
    const flat = (fill, name = "cloth") => mk(name, fill);
    const res = (front, back, side, sleeve, trim, extra = {}) => ({ front, back: back || side, side, sleeve: sleeve || side, trim: trim || sleeve || side, ...extra });
    const fillA = (g, n) => { g.fillStyle = a; g.fillRect(0, 0, n, n); };
    const graphic = (g, n, col) => {              // a chest print: his (bolt, smiley, splatter, a wordmark), hers (heart, star, smiley, flower)
      const k = o.graphic ?? 0, cx = n * 0.5, cy = n * 0.42; g.fillStyle = col; g.strokeStyle = col;
      const star = (r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const t = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(t) * rr, cy + Math.sin(t) * rr); } g.fill(); };
      const smiley = () => { g.beginPath(); g.arc(cx, cy, 11, 0, 7); g.fill(); g.fillStyle = "#111"; g.fillRect(cx - 5, cy - 5, 3, 4); g.fillRect(cx + 2, cy - 5, 3, 4); g.lineWidth = 2; g.strokeStyle = "#111"; g.beginPath(); g.arc(cx, cy + 1, 6, 0.2, Math.PI - 0.2); g.stroke(); };
      if (o.female) {
        if (k === 0) { g.beginPath(); g.moveTo(cx, cy + 10); g.bezierCurveTo(cx - 16, cy - 2, cx - 6, cy - 14, cx, cy - 5); g.bezierCurveTo(cx + 6, cy - 14, cx + 16, cy - 2, cx, cy + 10); g.fill(); }
        else if (k === 1) star(12); else if (k === 2) smiley();
        else { for (let i = 0; i < 5; i++) { const t = i * 1.2566; g.beginPath(); g.arc(cx + Math.cos(t) * 6, cy + Math.sin(t) * 6, 5, 0, 7); g.fill(); } g.fillStyle = "#ffd23f"; g.beginPath(); g.arc(cx, cy, 4, 0, 7); g.fill(); }
      } else {
        if (k === 0) { g.beginPath(); g.moveTo(cx + 3, cy - 14); g.lineTo(cx - 8, cy + 2); g.lineTo(cx - 1, cy + 2); g.lineTo(cx - 4, cy + 14); g.lineTo(cx + 9, cy - 3); g.lineTo(cx + 2, cy - 3); g.fill(); }
        else if (k === 1) smiley();
        else if (k === 2) { for (let i = 0; i < 14; i++) { const t = i * 2.4, r = 3 + (i * 7 % 9); g.beginPath(); g.arc(cx + Math.cos(t) * r, cy + Math.sin(t) * r * 0.8, 2 + (i % 3), 0, 7); g.fill(); } }
        else { g.font = "bold 13px Impact, Arial Black, sans-serif"; g.textAlign = "center"; g.fillText("RAD", cx, cy + 5); g.fillRect(cx - 14, cy + 8, 28, 2); }
      }
    };
    switch (top) {
      case "uniform": {                           // store polo: VaultBuster blue, yellow collar band, a name tag on the front (if it has one)
        const tagHere = o.nameTag && !o.female;     // with a bust in the way, the tag's pinned on higher up instead (see build)
        const plain = patterned(`${top}|${a}|${b}|plain`, (g, n) => { fillA(g, n); g.fillStyle = b; g.fillRect(0, 0, n, 7); });
        const front = tagHere ? patterned(`${top}|${a}|${b}|${o.nameTag}`, (g, n) => {
          fillA(g, n); g.fillStyle = b; g.fillRect(0, 0, n, 7);
          g.fillStyle = "#f4f4f4"; g.fillRect(n * 0.56, 16, 22, 9);
          g.fillStyle = "#1a1a1a"; g.font = "bold 7px Arial"; g.textAlign = "center"; g.fillText(o.nameTag, n * 0.56 + 11, 23);
        }) : plain;
        return res(front, plain, plain, solid(a), solid(b));
      }
      case "flannel": {
        const m = flat((g, n) => {
          fillA(g, n); g.fillStyle = b; g.globalAlpha = 0.55;
          for (let i = 0; i < n; i += 16) { g.fillRect(i, 0, 7, n); g.fillRect(0, i, n, 7); }
          g.globalAlpha = 0.35; g.fillStyle = "#fff"; for (let i = 10; i < n; i += 16) { g.fillRect(i, 0, 1, n); g.fillRect(0, i, n, 1); } g.globalAlpha = 1;
        });
        const front = mk("front", (g, n) => {      // buttoned up the middle over a tee
          fillA(g, n); g.fillStyle = b; g.globalAlpha = 0.55; for (let i = 0; i < n; i += 16) { g.fillRect(i, 0, 7, n); g.fillRect(0, i, n, 7); } g.globalAlpha = 1;
          g.fillStyle = c; g.fillRect(n * 0.44, 0, n * 0.12, n * 0.3); g.fillStyle = "#222"; for (let y = 14; y < n; y += 12) g.fillRect(n * 0.5 - 1, y, 2, 2);
        });
        return res(front, m, m);
      }
      case "stripes": case "rugby": {             // wide bands, a white collar (rugby)
        const m = flat((g, n) => { fillA(g, n); g.fillStyle = b; for (let y = 0; y < n; y += 16) g.fillRect(0, y, n, 8); });
        return res(m, m, m, m, top === "rugby" ? solid("#f4f1e6") : m);
      }
      case "windbreaker": case "colorblock": {     // loud color-block panels, three colors and a white slash
        const m = flat((g, n) => {
          fillA(g, n);
          g.fillStyle = b; g.beginPath(); g.moveTo(0, n * 0.5); g.lineTo(n, n * 0.15); g.lineTo(n, n * 0.48); g.lineTo(0, n * 0.83); g.fill();
          g.fillStyle = "#f5f5f5"; g.beginPath(); g.moveTo(0, n * 0.83); g.lineTo(n, n * 0.48); g.lineTo(n, n * 0.56); g.lineTo(0, n * 0.91); g.fill();
          g.fillStyle = c; g.fillRect(0, n * 0.91, n, n * 0.09);
        });
        const front = top === "windbreaker" ? mk("front", (g, n) => { g.drawImage(m.map.image, 0, 0); g.fillStyle = "#d8d8d8"; g.fillRect(n * 0.49, 0, 2, n); }) : m;   // the zipper
        return res(front, m, m, top === "windbreaker" ? m : solid(b), solid(c));
      }
      case "varsity": {                           // body color, cream sleeves, a chenille letter on the front, a stripe at the hem
        const back = flat((g, n) => { fillA(g, n); g.fillStyle = b; g.fillRect(0, n - 6, n, 6); });
        const front = mk("front", (g, n) => { g.drawImage(back.map.image, 0, 0); g.fillStyle = "#f3ead3"; g.font = "bold 26px Georgia, serif"; g.textAlign = "center"; g.fillText("V", n * 0.7, n * 0.55); });
        return res(front, back, back, solid("#f3ead3"), solid(b));
      }
      case "sweater": case "cardigan": {          // a geometric 90s knit: zigzag bands (a cardigan: buttons down the front)
        const m = flat((g, n) => {
          fillA(g, n);
          for (const [y, col] of [[n * 0.3, b], [n * 0.5, c], [n * 0.7, b]]) { g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= n; x += 8) g.lineTo(x, y + (x / 8 % 2 ? 5 : -5)); g.stroke(); }
        });
        const front = top === "cardigan" ? mk("front", (g, n) => { g.drawImage(m.map.image, 0, 0); g.fillStyle = "#f4f1e6"; for (let y = 10; y < n; y += 12) { g.beginPath(); g.arc(n * 0.5, y, 2, 0, 7); g.fill(); } }) : m;
        return res(front, m, m, m, solid(b));
      }
      case "hoodie": {                            // a kangaroo pocket and drawstrings on the front, a hood behind
        const back = flat(fillA);
        const front = mk("front", (g, n) => {
          fillA(g, n); graphic(g, n, b);
          g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(n * 0.22, n * 0.66, n * 0.56, n * 0.26);
          g.fillStyle = "#f4f4f4"; g.fillRect(n * 0.42, 0, 2, n * 0.22); g.fillRect(n * 0.56, 0, 2, n * 0.2);
        });
        return res(front, back, back, back, solid(b), { hood: back });
      }
      case "jersey": {                            // a sports jersey: its number small on the front, big on the back, panels down the sides
        const N = String(o.number ?? 23), side = flat((g, n) => { fillA(g, n); g.fillStyle = b; g.fillRect(n * 0.3, 0, n * 0.4, n); });
        const num = (big) => (g, n) => {
          fillA(g, n); g.fillStyle = b; g.fillRect(0, 0, n, 5);
          g.fillStyle = "#f4f4f4"; g.strokeStyle = b; g.lineWidth = 2; g.textAlign = "center"; g.font = `bold ${big ? 34 : 18}px Impact, Arial Black, sans-serif`;
          g.strokeText(N, n * 0.5, big ? n * 0.66 : n * 0.5); g.fillText(N, n * 0.5, big ? n * 0.66 : n * 0.5);
        };
        return res(mk("front", num(false)), mk("back", num(true)), side, side, solid(b));
      }
      case "hawaiian": {                          // a loud print button-up: flowers and leaves, a placket down the front
        const m = flat((g, n) => {
          fillA(g, n);
          for (let i = 0; i < 7; i++) { const x = (i * 23) % n, y = (i * 37) % n; g.fillStyle = "#2b9348"; g.beginPath(); g.ellipse(x + 6, y + 4, 7, 3, 0.7, 0, 7); g.fill();
            g.fillStyle = i % 2 ? b : c; for (let k = 0; k < 5; k++) { const t = k * 1.2566; g.beginPath(); g.arc(x + Math.cos(t) * 4, y + Math.sin(t) * 4, 3.2, 0, 7); g.fill(); } g.fillStyle = "#fff59a"; g.fillRect(x - 1, y - 1, 2, 2); }
        });
        const front = mk("front", (g, n) => { g.drawImage(m.map.image, 0, 0); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(n * 0.49, 0, 2, n); });
        return res(front, m, m);
      }
      case "tiedye": {                            // rings swirling out from the middle, rainbow
        const cols = [a, b, c, "#ffd23f", "#00c2d1"];
        const m = flat((g, n) => { for (let r = n; r > 0; r -= 4) { g.fillStyle = cols[(r / 4) % cols.length | 0]; g.beginPath(); for (let t = 0; t <= 6.3; t += 0.2) { const rr = r * (1 + 0.15 * Math.sin(t * 5 + r * 0.2)); g.lineTo(n / 2 + Math.cos(t) * rr, n / 2 + Math.sin(t) * rr); } g.fill(); } });
        return res(m, m, m, solid(a));
      }
      case "memphis": {                           // Memphis print: squiggles, triangles and dots on a bright ground
        const m = flat((g, n) => {
          fillA(g, n);
          for (let i = 0; i < 9; i++) {
            const x = (i * 29) % n, y = (i * 17 + 7) % n, col = [b, c, "#111"][i % 3]; g.fillStyle = g.strokeStyle = col;
            if (i % 3 === 0) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 8, y + 2); g.lineTo(x + 3, y + 9); g.fill(); }
            else if (i % 3 === 1) { g.lineWidth = 2; g.beginPath(); for (let k = 0; k < 4; k++) g.quadraticCurveTo(x + k * 4 + 2, y + (k % 2 ? 4 : -4), x + k * 4 + 4, y); g.stroke(); }
            else { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
          }
        });
        return res(m, m, m, solid(b));
      }
      case "overalls": {                          // a denim bib and straps over a tee (the straps cross on the back)
        const den = o.pantsColor || "#3b5b8c";
        const front = patterned(`${key}|${den}|front`, (g, n) => {
          g.fillStyle = a; g.fillRect(0, 0, n, n);
          g.fillStyle = den; g.fillRect(n * 0.24, n * 0.3, n * 0.52, n); g.fillRect(0, n * 0.62, n, n);
          g.fillRect(n * 0.24, 0, 6, n * 0.3); g.fillRect(n * 0.76 - 6, 0, 6, n * 0.3);
          g.fillStyle = "#d9c27a"; g.fillRect(n * 0.24 + 1, n * 0.3, 4, 4); g.fillRect(n * 0.76 - 5, n * 0.3, 4, 4);
          g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(n * 0.38, n * 0.42, n * 0.24, n * 0.12);   // the bib pocket
        });
        const back = patterned(`${key}|${den}|back`, (g, n) => {
          g.fillStyle = a; g.fillRect(0, 0, n, n); g.fillStyle = den; g.fillRect(0, n * 0.62, n, n);
          g.strokeStyle = den; g.lineWidth = 6; g.beginPath(); g.moveTo(n * 0.24, 0); g.lineTo(n * 0.7, n * 0.64); g.moveTo(n * 0.76, 0); g.lineTo(n * 0.3, n * 0.64); g.stroke();
        });
        const side = patterned(`${key}|${den}|side`, (g, n) => { g.fillStyle = a; g.fillRect(0, 0, n, n); g.fillStyle = den; g.fillRect(0, n * 0.62, n, n); });
        return res(front, back, side, solid(a), solid(a));
      }
      default: {                                  // a tee (his, boxy) / a baby tee or crop top (hers, fitted): the print on the front only
        const back = flat(fillA), print = top === "tee" || top === "babytee" || top === "crop";
        const front = print && !(o.female && o.bust > 1.1) ? mk("front", (g, n) => { fillA(g, n); graphic(g, n, b); }) : back;   // (not under a full bust)
        return res(front, back, back, solid(a), solid(o.female ? b : a));
      }
    }
  }
  // the bottoms -> { legs: material or a per-face array (a track-pant stripe down the sides), seat, skirt }
  function pantsMat(o) {
    const k = o.pants, col = o.pantsColor;
    const plaid = (bg, l1, l2) => patterned(`plaid|${bg}`, (g, n) => { g.fillStyle = bg; g.fillRect(0, 0, n, n); g.globalAlpha = 0.6; g.fillStyle = l1; for (let i = 0; i < n; i += 16) { g.fillRect(i, 0, 5, n); g.fillRect(0, i, n, 5); } g.globalAlpha = 0.8; g.fillStyle = l2; for (let i = 9; i < n; i += 16) { g.fillRect(i, 0, 1, n); g.fillRect(0, i, n, 1); } g.globalAlpha = 1; });
    const fabric = c => c === "plaid" ? plaid("#e8c42a", "#1d1d1d", "#ffffff")   // the yellow plaid
      : c === "floral" ? patterned("floral", (g, n) => { g.fillStyle = "#2a1f3d"; g.fillRect(0, 0, n, n); for (let i = 0; i < 10; i++) { const x = (i * 27) % n, y = (i * 19) % n; g.fillStyle = ["#ff9ce6", "#ffd23f", "#ffffff"][i % 3]; for (let j = 0; j < 5; j++) { const t = j * 1.2566; g.beginPath(); g.arc(x + Math.cos(t) * 3, y + Math.sin(t) * 3, 2.2, 0, 7); g.fill(); } } })
      : c === "denim" ? solid("#4f73a8") : solid(c);
    if (k === "mini" || k === "skirt") { const m = fabric(col); return { legs: o.tights ? solid(o.tights) : null, seat: m, skirt: m }; }
    if (k === "acid") { const m = patterned(`acid|${col}`, (g, n) => {
      g.fillStyle = col; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + (i * 37 % 30) / 100})`; g.beginPath(); g.arc((i * 47) % n, (i * 29) % n, 1 + i % 3, 0, 7); g.fill(); }
    }); return { legs: m, seat: m }; }
    if (k === "track") {                          // a stripe down each outside seam
      const plain = solid(col), side = patterned(`track|${col}|${o.pantsB}`, (g, n) => { g.fillStyle = col; g.fillRect(0, 0, n, n); g.fillStyle = "#f4f4f4"; g.fillRect(n * 0.38, 0, 5, n); g.fillStyle = o.pantsB || "#ff2e88"; g.fillRect(n * 0.38 + 6, 0, 4, n); });
      return { legs: [side, side, plain, plain, plain, plain], seat: plain };
    }
    const m = solid(col); return { legs: m, seat: m };
  }
  // a skirt: a soft block flaring out toward the hem
  let SKIRT;
  function skirtGeo() {
    if (SKIRT) return SKIRT;
    SKIRT = roundBox(0.15, 4); const p = SKIRT.attributes.position;
    for (let i = 0; i < p.count; i++) { const f = 1 + 0.45 * (0.5 - p.getY(i)); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); }
    SKIRT.computeVertexNormals(); return SKIRT;
  }

  // ---- the face: a small canvas redrawn ~15 fps, only while it changes ----
  const FW = 160, FH = 120;
  function drawFace(g, f, t) {
    const { mood, color } = f, mt = t - f.since;       // mt: seconds in this mood
    const red = mood === "angry" || mood === "alarm";
    g.fillStyle = red ? "#2a0606" : "#06101a"; g.fillRect(0, 0, FW, FH);
    const glowC = red ? "#ff4a3a" : color;
    g.strokeStyle = g.fillStyle = glowC; g.lineWidth = 7; g.lineCap = g.lineJoin = "round";
    g.shadowColor = glowC; g.shadowBlur = 10;
    const eye = (x, y) => { g.beginPath(); g.ellipse(x, y, 9, f.blink ? 1.5 : 13, 0, 0, 7); g.fill(); };
    const eyes = (dx = 0, dy = 0) => { eye(55 + dx, 50 + dy); eye(105 + dx, 50 + dy); };
    const arc = (y, r, a0, a1) => { g.beginPath(); g.arc(80, y, r, a0, a1); g.stroke(); };
    const line = (...p) => { g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };
    const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.6, y - s * 0.2, x - s * 0.6, y - s * 1.3, x, y - s * 0.4); g.bezierCurveTo(x + s * 0.6, y - s * 1.3, x + s * 1.6, y - s * 0.2, x, y + s * 0.9); g.fill(); };
    const text = (s, y, px = 18) => { g.shadowBlur = 6; g.font = `bold ${px}px "Courier New", monospace`; g.textAlign = "center"; g.fillText(s, 80, y); };
    switch (mood) {
      case "off": break;
      case "on": {                                  // power-on: a bright line opening into the picture
        const k = Math.min(1, mt / 0.35);
        g.fillRect(FW / 2 - FW / 2 * Math.min(1, k * 2), FH / 2 - FH / 2 * k * k - 1.5, FW * Math.min(1, k * 2), FH * k * k + 3);
        break;
      }
      case "browse": eyes(Math.sin(t * 1.3) * 16, 4); line(68, 88, 92, 88); break;
      case "happy": line(40, 58, 52, 45, 64, 58); line(96, 58, 108, 45, 120, 58); arc(72, 26, 0.25 * Math.PI, 0.75 * Math.PI); break;
      case "love": { const s = 12 + Math.sin(t * 8) * 2.5; heart(55, 50, s); heart(105, 50, s); arc(70, 24, 0.25 * Math.PI, 0.75 * Math.PI); break; }
      case "wait": {                                 // a loading bar filling, looping
        eyes(0, -4); g.lineWidth = 3; g.strokeRect(30, 88, 100, 14);
        g.fillRect(33, 91, 94 * ((mt / 3) % 1), 8); break;
      }
      case "impatient": {                            // unset-VCR 12:00, blinking, and a flat unamused look
        line(42, 44, 68, 50); line(118, 44, 92, 50); eyes(0, 8); line(62, 96, 98, 96);
        if (Math.floor(t * 2) % 2) text("12:00", 24, 20);
        break;
      }
      case "angry": {
        line(38, 36, 70, 50); line(122, 36, 90, 50); eyes(0, 10);
        line(52, 100, 64, 92, 76, 100, 88, 92, 100, 100, 112, 92); break;
      }
      case "alarm": if (Math.floor(t * 4) % 2) { g.lineWidth = 12; line(80, 22, 80, 72); g.beginPath(); g.arc(80, 94, 7, 0, 7); g.fill(); } break;
      case "meh": {                                   // unimpressed: heavy lids, a crooked mouth
        eyes(0, 4); g.fillStyle = "#06101a"; g.shadowBlur = 0; g.fillRect(40, 30, 80, 22); g.fillStyle = glowC;
        line(40, 52, 70, 52); line(90, 52, 120, 52); line(64, 94, 96, 88); break;
      }
      case "watch": eyes(0, -8); arc(64, 22, 0.3 * Math.PI, 0.7 * Math.PI); break;   // eyes up on the screen, a small smile
      case "shock": {                                 // jump scare: wide eyes, open mouth
        g.lineWidth = 6; for (const x of [55, 105]) { g.beginPath(); g.arc(x, 46, 15, 0, 7); g.stroke(); g.beginPath(); g.arc(x, 46, 5, 0, 7); g.fill(); }
        g.beginPath(); g.ellipse(80, 94, 10, 13, 0, 0, 7); g.stroke(); break;
      }
      case "sleep": {                                 // dozed off: shut eyes, a drifting z
        line(42, 54, 68, 54); line(92, 54, 118, 54); line(70, 92, 90, 92);
        const k = (mt * 0.5) % 1; g.globalAlpha = 1 - k; text("z", 30 - k * 14, 22 + k * 10); g.globalAlpha = 1; break;
      }
      case "ask": eyes(0, -6); line(68, 92, 92, 92); { const b = Math.sin(t * 4) * 2; text("?", 30 + b, 30); } break;   // hopeful: looking up, a bobbing question mark
      case "shifty": eyes(Math.sin(t * 3.1) > 0 ? 16 : -16, 2); line(70, 92, 90, 90); break;   // eyes darting side to side, lips pressed
      case "thanks": line(40, 52, 52, 40, 64, 52); line(96, 52, 108, 40, 120, 52); text("THANK YOU", 96, 17); break;
      default: eyes(); line(66, 90, 94, 90);            // neutral
    }
    g.shadowBlur = 0;
    const statik = mt < 0.22 && mood !== "on" && mood !== "off" ? 1 - mt / 0.22 : 0;   // channel-change static between moods
    if (statik || mood === "angry") {
      const n = mood === "angry" ? 120 : 900 * statik;
      for (let i = 0; i < n; i++) { const v = Math.random() * 255 | 0; g.fillStyle = `rgba(${v},${v},${v},0.7)`; g.fillRect(Math.random() * FW, Math.random() * FH, 3, 2); }
    }
    g.fillStyle = "rgba(0,0,0,0.28)"; for (let y = 0; y < FH; y += 3) g.fillRect(0, y, FW, 1);   // scanlines
    const v = g.createRadialGradient(FW / 2, FH / 2, FH * 0.35, FW / 2, FH / 2, FW * 0.62);       // curved-glass vignette
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.65)"); g.fillStyle = v; g.fillRect(0, 0, FW, FH);
  }

  function build(o) {
    geo();
    const part = (parent, g, m, sx, sy, sz, x, y, z) => { const p = new THREE.Mesh(g, m); p.scale.set(sx, sy, sz); p.position.set(x, y, z); parent.add(p); parts.push(p); return p; };
    const pivot = (parent, x, y, z) => { const p = new THREE.Group(); p.position.set(x, y, z); parent.add(p); return p; };
    const parts = [];
    const group = new THREE.Group(), body = pivot(group, 0, 0, 0);
    const skin = solid(o.skin), P = pantsMat(o), shoe = solid(o.shoes), T = topMats(o), sleeveM = T.sleeve;
    const torsoM = [T.side, T.side, T.side, T.side, T.front, T.back];   // (box faces: +x -x +y -y, front, back)
    const H = o.height, W = o.build;
    body.scale.set(W, H, 1);                          // taller/shorter, broader/slimmer: one scale, no new parts

    const collarM = T.trim, sole = solid(o.shoes === "#eeeeee" ? "#d9d4c8" : "#f2f0ea");
    // legs: hip -> thigh -> knee -> shin -> sneaker (upper + a contrasting sole). The cut sets the widths and where
    // the cloth stops: his baggy jeans and long cargo shorts, her slim jeans, leggings, bike shorts, skirts
    const kind = o.pants, skirt = kind === "mini" || kind === "skirt";
    const CUT = { baggy: [0.175, 0.165], cargo: [0.17, 0.16], jeans: [0.145, 0.125], leggings: [0.135, 0.115], bike: [0.14, 0.12], acid: o.female ? [0.145, 0.125] : [0.16, 0.145] }[kind] || [0.155, 0.135];
    const shorts = kind === "shorts" || kind === "cargo" || kind === "bike";
    const legM = P.legs || skin;                     // (a skirt: bare legs, or tights)
    const trousers = [], bunched = [];                // (setPantsDown: the legs go bare, the pants gather at the ankles)
    const legs = [-1, 1].map(s => {
      const hip = pivot(body, s * 0.1, 0.9, 0);
      const thigh = part(hip, SOFT, legM, CUT[0], 0.5, CUT[0] + 0.02, 0, -0.23, 0); if (P.legs) trousers.push(thigh);
      const knee = pivot(hip, 0, -0.45, 0);
      const shin = part(knee, SOFT, shorts ? skin : legM, CUT[1], 0.46, CUT[1] + 0.015, 0, -0.2, 0); if (P.legs && !shorts) trousers.push(shin);
      if (kind === "shorts") trousers.push(part(knee, SOFT, legM, 0.15, 0.1, 0.165, 0, -0.02, 0));                  // the hem, just past the knee
      if (kind === "cargo") {                          // long and loose, to mid-shin, a pocket on each thigh
        trousers.push(part(knee, SOFT, legM, CUT[1] + 0.02, 0.2, CUT[1] + 0.035, 0, -0.07, 0));
        trousers.push(part(hip, ROUND, legM, 0.03, 0.12, 0.13, s * (CUT[0] / 2 + 0.008), -0.28, 0));
      }
      if (kind === "baggy") trousers.push(part(knee, SOFT, legM, CUT[1] + 0.03, 0.08, CUT[1] + 0.045, 0, -0.36, 0.01));   // pooled over the sneaker
      const b = part(knee, SOFT, P.legs || skin, 0.19, 0.1, 0.2, 0, -0.33, 0.01); b.visible = false; if (P.legs) bunched.push(b);   // around the ankle
      const hi = o.hightop;                            // his high-tops: up over the ankle
      part(knee, ROUND, shoe, o.female ? 0.13 : 0.14, hi ? 0.15 : 0.085, o.female ? 0.25 : 0.27, 0, hi ? -0.365 : -0.395, 0.045);
      part(knee, ROUND, sole, o.female ? 0.14 : 0.15, 0.035, o.female ? 0.265 : 0.285, 0, -0.43, 0.045);
      return { hip, knee };
    });
    const seat = part(body, ROUND, P.seat, 0.35, 0.16, 0.22, 0, 0.93, 0); if (!skirt) trousers.push(seat);          // seat of the pants
    if (skirt) {                                       // a mini (mid-thigh) or a skirt (to the knee), flaring out
      const len = kind === "mini" ? 0.24 : 0.42;
      part(body, skirtGeo(), P.skirt, 0.37, len, 0.25, 0, 0.99 - len / 2, 0.005);
    }
    const upper = pivot(body, 0, 0.9, 0);                                           // the waist: everything above bends forward from here
    const SX = o.female ? SHOULDER_X_F : SHOULDER_X, SY = o.female ? 0.585 : 0.6;   // her shoulders sit in and a touch lower, under the rounder top
    const torso = part(upper, o.female ? TORSO_F : TORSO, torsoM, o.female ? 0.4 : 0.43, 0.56, 0.245, 0, 0.37, 0);
    if (o.female && o.bust) {                          // a bust: two soft blocks set low on the chest, angled out, tucked in at the top
      // In the torso's own material, with its texture projected from the torso's front: every point
      // samples the bit of shirt right behind it, so a plaid keeps its scale and a print runs straight
      // across (each block mapping the whole pattern onto itself shrank plaids and miscolored prints)
      const b = o.bust, k = 0.9 + 0.1 * b, taper = 0.1, v = new THREE.Vector3();   // (TORSO_F's taper)
      for (const s of [-1, 1]) {
        const m = part(upper, SOFT, T.front, 0.145 * k, 0.15 * k, 0.15 * b, s * 0.074, 0.4, 0.08); m.rotation.set(-0.55, s * 0.25, 0); m.updateMatrix();
        const g = SOFT.clone(), pos = g.attributes.position, uv = g.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(m.matrix);          // into the torso's frame (both hang off the waist)
          const xu = (v.x - torso.position.x) / torso.scale.x, yu = (v.y - torso.position.y) / torso.scale.y;   // torso unit coords
          uv.setXY(i, xu / (1 - taper * (0.5 - yu)) + 0.5, yu + 0.5);    // the torso front's own mapping (u across, v up), undoing its taper
        }
        uv.needsUpdate = true; m.geometry = g;
      }
      if (o.nameTag) {                                 // name tag pinned high on the chest, above it
        const key = "tag|" + o.nameTag;
        if (!mats.has(key)) {
          const c = document.createElement("canvas"); c.width = 64; c.height = 24; const g = c.getContext("2d");
          g.fillStyle = "#f4f4f4"; g.fillRect(0, 0, 64, 24);
          g.fillStyle = "#1a1a1a"; g.font = "bold 15px Arial"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(o.nameTag, 32, 13);
          const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
          mats.set(key, new THREE.MeshLambertMaterial({ map: t }));
        }
        part(upper, BOX, mats.get(key), 0.085, 0.032, 0.004, 0.09, 0.553, 0.124);
      }
    }
    if (!["leggings", "bike", "mini", "skirt", "track"].includes(kind) && o.top !== "overalls") {   // a belt, where there are belt loops
      part(upper, ROUND, solid(o.female ? "#5a3a2a" : "#2a2320"), 0.37, 0.035, 0.23, 0, 0.105, 0);
      part(upper, ROUND, solid("#b8a46a"), 0.04, 0.03, 0.02, 0, 0.105, 0.115);
    }
    if (T.hood) part(upper, ROUND, T.hood, 0.3, 0.13, 0.13, 0, 0.66, -0.12);          // a hoodie's hood, down behind the neck
    // arms: shoulder -> upper arm -> elbow -> forearm -> hand. Tucked in so the
    // sleeve overlaps the torso's rounded edge instead of hanging off beside it
    const arms = [-1, 1].map(s => {
      const sh = pivot(upper, s * SX, SY, 0), sl = o.sleeve || (o.longSleeves ? "long" : "short");
      if (sl === "cap") {                              // her cap sleeve: just over the shoulder, the arm bare below it, a contrast trim
        part(sh, SOFT, skin, 0.11, 0.33, 0.12, 0, -0.13, 0);
        part(sh, SOFT, sleeveM, 0.13, 0.13, 0.14, 0, -0.03, 0);
        part(sh, SOFT, collarM, 0.135, 0.03, 0.145, 0, -0.1, 0);
      } else if (sl === "baggy") {                     // his boxy tee sleeve: wide, down to the elbow
        part(sh, SOFT, sleeveM, 0.145, 0.34, 0.155, 0, -0.14, 0);
      } else part(sh, SOFT, sleeveM, 0.125, 0.33, 0.135, 0, -0.13, 0);
      const el = pivot(sh, 0, -0.29, 0);
      part(el, SOFT, sl === "long" ? sleeveM : skin, 0.105, 0.29, 0.115, 0, -0.12, 0);
      if (sl === "long") part(el, SOFT, collarM, 0.115, 0.04, 0.125, 0, -0.255, 0);    // cuff
      else if (sl === "short") part(sh, SOFT, collarM, 0.135, 0.04, 0.145, 0, -0.28, 0);   // short-sleeve hem band
      const hand = part(el, SOFT, skin, 0.1, 0.11, 0.08, 0, -0.32, 0.005);
      part(hand, SOFT, skin, 0.35, 0.5, 0.6, s * -0.55, 0.05, 0.25);                  // thumb, tucked in toward the body
      return { sh, el, hand };
    });
    const neck = part(upper, CYL, skin, 0.1, 0.09, 0.1, 0, 0.69, 0);                // neck
    part(upper, CYL, collarM, 0.15, 0.04, 0.15, 0, 0.65, 0);                         // collar

    // the TV head, kept at true size (not stretched with the body)
    const HEAD_Z = 0.05;                              // TV sits a touch forward, over the neck rather than hanging back
    const head = pivot(group, 0, 1.63 * H, HEAD_Z);
    const { w: tw, h: th, d: td } = o.tv, caseM = solid(o.tv.color), dark = solid("#111214");
    const side = o.tv.knobs ? 0.09 : 0;                                            // a control strip down the right of the screen
    part(head, CASE, caseM, tw, th, td, 0, th / 2, -0.02);
    part(head, CASE, dark, tw * 0.84 - side, th * 0.8, 0.03, -side / 2, th / 2, td / 2 - 0.02);         // bezel, inset in the front
    part(head, CASE, caseM, tw * 0.64, th * 0.64, 0.12, 0, th * 0.52, -td / 2 - 0.06);                 // the tube's back hump
    part(head, CASE, caseM, tw * 0.34, th * 0.34, 0.06, 0, th * 0.52, -td / 2 - 0.14);                 // and the neck of the tube behind it
    part(head, ROUND, dark, tw * 0.5, 0.03, td * 0.6, 0, -0.005, -0.03);                                // swivel base it sits on
    // the screen: a gently bulged CRT face (its own geometry — sizes differ per set)
    const sw = tw * 0.74 - side, sh = th * 0.66, sg = new THREE.PlaneGeometry(sw, sh, 8, 6), sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) { const x = sp.getX(i) / (sw / 2), y = sp.getY(i) / (sh / 2); sp.setZ(i, 0.018 * (1 - x * x * 0.8) * (1 - y * y * 0.8)); }
    sg.computeVertexNormals();
    const fc = document.createElement("canvas"); fc.width = FW; fc.height = FH;
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ map: ftex }));
    screen.position.set(-side / 2, th / 2, td / 2 - 0.004); head.add(screen); parts.push(screen);
    const sheen = new THREE.Mesh(sg, SHEEN); sheen.position.copy(screen.position); sheen.position.z += 0.003; sheen.userData.clearToBloom = true; head.add(sheen);   // glass reflection (the store's bloom pass sees through it)
    const led = new THREE.Mesh(BALL, new THREE.MeshBasicMaterial({ color: 0xff3b2f })); led.scale.setScalar(0.012);
    led.position.set(tw / 2 - 0.035, th * 0.12, td / 2 - 0.01); head.add(led);                                     // power light
    if (o.tv.knobs) {
      for (const y of [0.62, 0.42]) part(head, CYL, solid("#2b2c30"), 0.04, 0.025, 0.04, tw / 2 - side / 2 - 0.015, th * y, td / 2 - 0.005).rotation.x = Math.PI / 2;
      part(head, BOX, GRILLE, side * 0.7, th * 0.16, 0.004, tw / 2 - side / 2 - 0.015, th * 0.22, td / 2 - 0.004);  // speaker grille
    } else part(head, BOX, GRILLE, tw * 0.4, 0.028, 0.004, 0, th * 0.08, td / 2 - 0.004);                          // a speaker slot under the screen
    if (o.tv.antenna) for (const s of [-1, 1]) {
      const a = pivot(head, s * 0.05, th, -0.05); a.rotation.z = -s * 0.45;
      part(a, CYL, solid("#b8bcc2"), 0.008, 0.36, 0.008, 0, 0.18, 0);
      part(a, BALL, solid("#d7dade"), 0.02, 0.02, 0.02, 0, 0.36, 0);                 // ball tip
      part(head, ROUND, dark, 0.05, 0.02, 0.05, s * 0.05, th + 0.005, -0.05);       // its base
    }
    if (o.hat) {                                                                  // on top of the TV: a ball cap (forwards or back), a bucket hat, a big bow, a headband
      const hm = solid(o.hat.color), k = o.hat.kind || "cap", cap = pivot(head, 0, th, 0); cap.rotation.y = o.hat.back ? Math.PI : 0;
      if (k === "cap") { part(cap, SPH, hm, tw * 0.62, 0.16, td * 0.8, 0, 0, -0.02); part(cap, BOX, hm, tw * 0.5, 0.015, 0.16, 0, 0.01, td * 0.4 + 0.06); }
      else if (k === "bucket") { part(cap, CYL, hm, tw * 0.62, 0.13, td * 0.78, 0, 0.065, -0.02); part(cap, CYL, hm, tw * 0.95, 0.012, td * 1.12, 0, 0.006, -0.02); }
      else if (k === "band") part(cap, CASE, hm, tw * 0.9, 0.022, 0.05, 0, 0.004, td * 0.12);   // across the top, front to back
      else {                                          // a bow up on one corner
        const bow = pivot(cap, tw * 0.25, 0.04, td * 0.2); bow.rotation.z = -0.25;
        for (const sx of [-1, 1]) part(bow, SOFT, hm, 0.09, 0.07, 0.03, sx * 0.05, 0, 0).rotation.z = sx * 0.35;
        part(bow, SOFT, hm, 0.035, 0.04, 0.035, 0, 0, 0.005);
      }
    }
    // the free hand's props at the counter: a membership card, or the cash they pay with
    const cardM = patterned("memberCard", (g, n) => { g.fillStyle = "#1b3fa0"; g.fillRect(0, 0, n, n); g.fillStyle = "#ffd400"; g.fillRect(0, n * 0.62, n, n * 0.14); g.fillStyle = "#fff"; g.fillRect(n * 0.08, n * 0.12, n * 0.5, n * 0.1); });
    const cashM = patterned("cash", (g, n) => { g.fillStyle = "#8fbf8a"; g.fillRect(0, 0, n, n); g.strokeStyle = "#3d6b3a"; g.lineWidth = 4; g.strokeRect(4, 4, n - 8, n - 8); g.fillStyle = "#3d6b3a"; g.beginPath(); g.arc(n / 2, n / 2, n * 0.18, 0, 7); g.fill(); });
    const props = { card: part(arms[0].el, BOX, cardM, 0.006, 0.054, 0.086, 0, -0.37, 0.05), cash: part(arms[0].el, BOX, cashM, 0.004, 0.066, 0.156, 0, -0.37, 0.07),
      receipt: part(arms[0].el, BOX, solid("#f4f1e6"), 0.003, 0.15, 0.056, 0, -0.4, 0.06),
      form: part(arms[0].el, BOX, solid("#fbfbf4"), 0.003, 0.21, 0.15, 0, -0.42, 0.08) };   // a filled-out membership form
    {                                                 // an umbrella: kept upright in the world whatever the arm does (see tick)
      const um = new THREE.Group(); um.position.set(0, -0.36, 0.05); arms[0].el.add(um);
      const uk = "umb|" + (o.umbrella || "#1c1c1e"), umC = mats.get(uk) || mats.set(uk, new THREE.MeshLambertMaterial({ color: o.umbrella || "#1c1c1e", side: THREE.DoubleSide })).get(uk);
      part(um, CYL, solid("#2a2a2a"), 0.012, 0.95, 0.012, 0, 0.47, 0);
      um.userData.canopy = part(um, UMB, umC, 1, 1, 1, 0, 0.92, 0);
      part(um, BALL, solid("#2a2a2a"), 0.025, 0.025, 0.025, 0, 1.06, 0);
      props.umbrella = um;
    }
    for (const m of Object.values(props)) m.visible = false;
    const item = new THREE.Group(); item.position.set(0, -0.4, 0.07); arms[0].el.add(item);   // holdItem's slot, in the same hand
    const tapes = [0, 1, 2].map(i => { const m = part(arms[1].el, BOX, solid("#151515"), 0.03, 0.19, 0.11, 0.035 * (i - 1), -0.36 - 0.012 * i, 0.07); m.visible = false; return m; });   // up to 3, side by side in one hand

    // snow settling on top of the TV (or the hat) and the shoulders: grown by setSnow (not in parts: nothing to aim at)
    const hatTop = o.hat ? ({ cap: 0.07, bucket: 0.13, band: 0.025 }[o.hat.kind || "cap"] || 0) : 0;
    const snowM = mats.get("snow") || mats.set("snow", new THREE.MeshLambertMaterial({ color: 0xf4f7fb, emissive: 0x3c4148 })).get("snow")   // (a little of its own light: fresh snow reads white even in the overcast);
    const snowHead = new THREE.Mesh(ROUND, snowM); snowHead.position.set(0, th + hatTop, -0.02); head.add(snowHead);
    const snowSh = [-1, 1].map(s => { const m = new THREE.Mesh(ROUND, snowM); m.position.set(s * SX * 0.62, 0.665, -0.01); upper.add(m); return m; });
    const setSnowK = k => {
      const on = k > 0.02; snowHead.visible = on; snowSh.forEach(m => m.visible = on); if (!on) return;
      snowHead.scale.set(tw * (0.6 + 0.3 * Math.min(1, k * 2)), 0.01 + 0.07 * k, td * (0.55 + 0.3 * Math.min(1, k * 2)));
      snowSh.forEach(m => m.scale.set(0.1 + 0.06 * k, 0.008 + 0.035 * k, 0.12 + 0.06 * k));
    };
    setSnowK(0);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * W, 0.55), SHADOW); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006; group.add(shadow);
    const face = { mood: "off", color: o.phosphor, since: 0, blink: false, next: 0, drawnAt: -1 };
    const UPPER = 0.29, FORE = 0.32;                   // shoulder->elbow, elbow->hand (body-space, before the height/build scale)
    let talking = false;
    const reach = { target: new THREE.Vector3(), on: false, w: 0, arm: 1, lean: true }, reach2 = { target: new THREE.Vector3(), on: false, w: 0, arm: 0 }, st = { y: 0, squat: 0, nod: 0, lean: 0, crouch: 0, step: 0, ry: 0, rz: 0, rx: 0, ax0: 0, ae0: -0.12, ax1: 0, ae1: -0.12, h0: 0, h1: 0, k0: 0, k1: 0, hu: 0, hd: 0 };
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), qIK = new THREE.Quaternion();
    let t = 0, phase = 0, pose = "idle", look = null, sitAt = {}, sighT = 0;   // look: head yaw (relative to the body) someone asked for, or null
    let gait = GAITS[o.gait] ? o.gait : "plain";
    // the weather on them (see setWind etc.) and one-off moves: shake (snow/water off at the door), slip (a wet floor),
    // feel (a palm out: is that rain?), stagger (shoved by a gust), flip (a gust turns the umbrella inside out)
    const env = { wx: 0, wz: 0, hunch: 0, shield: false, snow: 0 }, fx = { shake: 0, slip: 0, feel: 0, stagger: 0, sdir: 1, flip: 0 };
    const qTilt = new THREE.Quaternion(), eTilt = new THREE.Euler();
    const g2 = fc.getContext("2d");
    drawFace(g2, face, 0); ftex.needsUpdate = true;
    const lerp = (obj, k, v, r) => { obj[k] += (v - obj[k]) * r; };

    return {
      group, screen, parts, outfit: o, glows: [screen, led],   // glows: what the store should mark to bloom
      walkLean: true,                                           // tip forward into the stride (off for the player: the camera doesn't tip with it)
      rig: { legs, arms, head, upper, neck },                   // joints, for tools/tests (and the player's own body, which hides head + neck)
      get mood() { return face.mood; },
      setMood(m) { if (m !== face.mood) { face.mood = m; face.since = t; face.drawnAt = -1; } },
      setPose(p, opts = {}) { pose = p; sitAt = opts; },
      lookAt(yaw) { look = yaw == null ? null : Math.max(-1.45, Math.min(1.45, yaw)); },   // turn the head (radians, + = her left); null = back to normal
      holdTape(n) { tapes.forEach((m, i) => m.visible = i < +n); },   // how many (true = 1)
      holdProp(name) { for (const [k, m] of Object.entries(props)) m.visible = k === name; },
      get prop() { return Object.keys(props).find(k => props[k].visible) || null; },
      sigh() { sighT = 1.3; },   // "card" | "cash" | "receipt" | null, in the free (left) hand
      setPantsDown(on) {                                // (the toilet) legs and seat go to skin; the pants bunch at the ankles
        for (const m of trousers) { m.userData.pantsM ??= m.material; m.material = on ? skin : m.userData.pantsM; }
        for (const b of bunched) b.visible = on;
      },
      holdItem(obj) {                                   // obj comes in at world scale: undo the body's own scaling
        item.clear(); if (!obj) return;
        group.updateWorldMatrix(true, true); const k = item.getWorldScale(new THREE.Vector3());
        obj.scale.divide(k); item.add(obj);
      },
      // reach a hand to a point in the world (a tape slot, the returns slot, the
      // rewinder...) — eased in and out. arm: 1 = the tape hand (default), 0 = the other, "auto" = nearer
      // opts.lean: false = arm only (counter work: no bowing; out-of-reach just points the arm)
      reachTo(point, arm = 1, opts = {}) { if (point) { reach.target.copy(point); reach.on = true; reach.arm = arm; reach.lean = opts.lean !== false; } else reach.on = false; },
      reachAlso(point, arm = 0) { if (point) { reach2.target.copy(point); reach2.on = true; reach2.arm = arm; } else reach2.on = false; },
      talk(on) { talking = on; },                    // chatting across the counter: small nods and tilts
      get gait() { return gait; }, set gait(g) { gait = GAITS[g] ? g : "plain"; },
      setWind(wx, wz) { env.wx = wx; env.wz = wz; },  // the wind on them, world m/s (the way the air's going): they lean into it, and it leans on them
      setHunch(k) { env.hunch = k; },                // cold / wet: shoulders up, arms in, head down, shorter steps
      setShield(on) { env.shield = on; },            // a hand up over the head (caught in the rain, no umbrella)
      setSnow(k) { k = Math.max(0, Math.min(1, k)); if (Math.abs(k - env.snow) > 0.004 || (k === 0) !== (env.snow === 0)) { env.snow = k; setSnowK(k); } },   // 0..1 settled on the head and shoulders
      shake() { fx.shake = 1; }, slip() { fx.slip = 1.1; }, feelRain() { fx.feel = 1.8; },
      stagger(dir = 1) { if (fx.stagger <= 0) { fx.stagger = 0.9; fx.sdir = dir; } },   // dir: +1 shoved to their left, -1 to their right
      umbrellaFlip() { if (props.umbrella.visible && fx.flip <= 0) fx.flip = 1.6; },
      get busy() { return fx.slip > 0 || fx.shake > 0.3; },   // mid-slip / shaking off: the store holds them in place
      tick(dt, speed = 0) {
        t += dt;
        // walk cycle: stride advances with ground speed, so feet don't skate
        // the legs lead: step rate follows ground speed, but a faster walker also
        // lengthens their stride, so cadence climbs slower than speed (feet still plant)
        const G = GAITS[gait], run = Math.max(0, Math.min(1, (speed - 1.9) / 0.8));   // run: over ~2 m/s the walk turns into a run
        for (const k in fx) if (k !== "sdir" && fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt);
        // the wind in their own frame: x to their left, z the way they face (the way the air is going)
        const cy = Math.cos(group.rotation.y), sy = Math.sin(group.rotation.y), wl = env.wx * cy - env.wz * sy, wf = env.wx * sy + env.wz * cy;
        const head_ = Math.max(0, Math.min(1, -wf / 8)), tail = Math.max(0, Math.min(1, wf / 8)), hunch = env.hunch;   // into it / with it behind them
        const stride = (0.34 + 0.12 * Math.min(1, Math.max(0, speed - 1))) * (G.stride * (1 - run) + run) * (1 - 0.3 * hunch * (1 - run)) * (1 - 0.25 * head_) + 0.36 * run;   // radians of hip swing
        // cadence from the legs: the planted foot sweeps from LEG·sin(A) ahead of the hip to as far behind it over the
        // stance, at exactly the ground speed, so it stays put on the floor (no skating)
        const LEG = 0.9, A = stride * 1.2, stanceF = 0.6 - 0.22 * run, reachD = LEG * Math.sin(A);
        if (speed > 0.01) phase += dt * Math.PI * 2 * stanceF * speed / (2 * reachD);
        const walking = speed > 0.01, sw = walking ? Math.sin(phase) : 0, r = Math.min(1, dt * 10), sit = pose === "sit";
        const slipK = fx.slip > 0 ? Math.sin(fx.slip / 1.1 * Math.PI) : 0, shakeK = fx.shake > 0 ? Math.sin(fx.shake * Math.PI) : 0;
        const feelK = fx.feel > 0 ? Math.min(1, fx.feel * 2, (1.8 - fx.feel) * 3) : 0, stagK = fx.stagger > 0 ? Math.sin(fx.stagger / 0.9 * Math.PI) : 0;
        // upper body: the same rhythm, but trailing the legs by ~1/12 of a cycle and
        // eased, so arms swing through rather than snap, and the head stays level
        const swU = walking ? Math.sin(phase - 0.5) : 0, soft = Math.min(1, dt * 6);
        const ease = (k, v, rate = r) => { st[k] += (v - st[k]) * rate; return st[k]; };   // eased pose channels (kept apart from the rig, so reaching can layer on top)
        const squat = ease("squat", pose === "crouch" ? 1 : 0, Math.min(1, dt * 10));   // a deep knees-bent crouch: hips drop ~0.6 toward the heels
        reach.w += ((reach.on ? 1 : 0) - reach.w) * Math.min(1, dt * 5);
        reach2.w += ((reach2.on ? 1 : 0) - reach2.w) * Math.min(1, dt * 5);
        const w = reach.w < 0.002 ? 0 : reach.w;
        // where the target sits relative to an unbent shoulder decides how much to bend at the waist / crouch / step in
        let ik = null;
        if (w) {
          group.updateMatrixWorld(true);
          const g = group.worldToLocal(tmp.copy(reach.target));
          const armI = reach.arm === "auto" ? (g.x > 0 ? 1 : 0) : reach.arm;
          const d = g.sub(tmp2.set((armI ? SX : -SX) * W, 1.5 * H, 0));
          ik = { armI, flat: Math.hypot(d.x, d.z), dy: d.y };
        }
        const bend = ik && reach.lean;                   // may the body help? (shelves yes, counter work no)
        const low = bend ? Math.max(0, -ik.dy - 0.35) : 0, far = bend ? Math.max(0, ik.flat - 0.4) : 0;
        const lean = ease("lean", Math.min(1.0, far * 1.4 + low * 0.9), Math.min(1, dt * 5)) * w;   // bend at the waist toward it
        const crouch = ease("crouch", Math.max(0, Math.min(1, (low - 0.35) / 0.5)), Math.min(1, dt * 5)) * w;   // really low: bend the knees too
        const reachFar = ik ? Math.max(0, ik.flat - 0.4) : 0;   // a half step in is fine even when bowing isn't
        const step = ease("step", Math.max(0, Math.min(0.2, reachFar - (bend ? 0.35 : 0.2))), Math.min(1, dt * 5)) * w;   // really far: a half step in
        // the gait cycle, per leg (p: 0..1 from its heel strike): a stance of ~60% (less running) — heel strike, the knee
        // giving a little to take the weight, the body vaulting over the planted foot, heel off, toe off — then the swing:
        // hip and knee fold to clear the foot, it pendulums through, the knee straightening ahead of the next heel strike.
        // The two legs half a cycle apart, so there's always a foot down (double support at each changeover), walking
        const cyc = phase / (Math.PI * 2) - 0.25;
        const kneeK = (G.knee * (1 - run) + 1.6 * run) * (1 - 0.4 * hunch) * Math.min(1, 0.55 + 0.35 * speed);
        const knEnd = 0.55 * kneeK, thEnd = Math.asin(Math.max(-1, -reachD / (LEG * Math.cos(knEnd / 2)))) + knEnd / 2;   // the thigh at toe off, where the swing picks up
        const legAt = p => {                            // -> [thigh angle forward (rad), knee bend (rad), planted]
          if (p < stanceF) {                            // planted: the foot slides back under the hip at a steady rate (so it's still on the floor), the thigh solved for it
            const k = p / stanceF, kn = (0.32 * Math.exp(-(((k - 0.2) / 0.13) ** 2)) + 0.55 * Math.max(0, (k - 0.65) / 0.35) ** 2) * kneeK, c = Math.cos(kn / 2);   // the knee giving to take the weight, then heel off into toe off
            return [Math.asin(Math.max(-1, Math.min(1, reachD * (1 - 2 * k) / (LEG * c)))) + kn / 2, kn, 1];
          }
          const k = (p - stanceF) / (1 - stanceF);       // the swing: fold up, swing through, straighten (full extension at ~80%, then held for the strike)
          return [thEnd + (A - thEnd) * (1 - Math.cos(Math.PI * Math.min(1, k / 0.8))) / 2, (0.55 + 0.55 * Math.sin(Math.PI * Math.min(1, k / 0.75)) - 0.55 * Math.min(1, k / 0.75) ** 2) * kneeK, 0];
        };
        const gl = [legAt(((cyc % 1) + 1) % 1), legAt((((cyc + 0.5) % 1) + 1) % 1)];
        // the hips ride on the planted leg: as high as it reaches (vaulting over it), dropping as the legs spread (double support)
        let plant = -1; for (const [th, kn, on] of gl) if (on) plant = Math.max(plant, Math.cos(th - kn / 2) * Math.cos(kn / 2) - 1);
        const legBob = walking && plant > -1 ? plant * LEG * H : 0;
        legs.forEach(({ hip, knee }, i) => {
          const hx = sit ? -Math.PI / 2 : walking ? -gl[i][0] : 0, kx = sit ? Math.PI / 2 + (sitAt.tuck ?? 0) : walking ? gl[i][1] : 0;   // (thigh forward is -x)
          const lr = walking && !sit ? 1 : r;           // walking: exactly where the cycle puts them (easing lags, and the feet skate); eased into and out of it
          hip.rotation.x = ease("h" + i, hx - (i ? 0 : slipK * 0.6), lr) - crouch * 1.05 - squat * 1.6;   // (and a foot shoots out on a slip)
          knee.rotation.x = ease("k" + i, kx, lr) + crouch * 1.9 + squat * 2.4;
        });
        const seatY = sit ? (sitAt.hipY ?? 0.5) - 0.9 * o.height : 0;   // hips down to the seat
        const jolt = face.mood === "shock" && t - face.since < 0.35 ? Math.sin((t - face.since) / 0.35 * Math.PI) * 0.06 : 0;   // a little jump
        const bob = walking ? legBob + (run ? run * 0.03 * Math.abs(Math.sin(phase)) : 0) + (G.hop && !run ? Math.max(0, Math.sin(phase)) ** 2 * 0.06 : 0) : 0;   // on the planted leg (in a run's flight, up off it; a skip: a little hop off every other step)
        const bodyY = seatY + jolt + bob - slipK * 0.08;   // hips rise over each planted foot
        st.y += (bodyY - st.y) * (Math.abs(bodyY - st.y) > 0.05 ? r : 1);   // eased sitting down / getting up, bob tracked directly
        body.position.y = st.y - crouch * 0.4 - squat * 0.6;
        body.position.z = step;
        body.position.x = stagK * 0.12 * fx.sdir;         // a gust shoves them a step sideways
        const sg = sighT > 0 ? Math.sin((1 - (sighT -= dt) / 1.3) * Math.PI) : 0;    // a sigh: up, then a long sag
        upper.rotation.x = lean + (pose === "lean" ? 0.28 : 0) + Math.max(0, sg) * 0.08 + ease("hu", hunch * 0.16 + head_ * 0.12, Math.min(1, dt * 3)) + (walking ? G.lean : 0);   // hunched against it
        torso.scale.y = 0.56 * (1 + Math.sin(t * 1.7) * 0.012); torso.scale.z = 0.245 * (1 + Math.sin(t * 1.7) * 0.02);   // breathing
        const pelvis = ease("ry", walking ? (gl[0][0] - gl[1][0]) / (2 * A) * 0.08 * G.twist * (1 - 0.6 * run) : 0, soft);   // the pelvis turns with the leg going forward (more on a swagger)
        body.rotation.y = pelvis + shakeK * Math.sin(t * 38) * 0.16;   // (a shake: twisting it off)
        upper.rotation.y = -pelvis * 1.7;                // the shoulders counter it, with the arms
        const windZ = Math.max(-0.16, Math.min(0.16, wl * 0.022));                                // leaning into a crosswind (wind to their left: they lean right, into it)
        body.rotation.z = ease("rz", (walking || sit ? 0 : Math.sin(t * 0.45) * 0.018) + (walking ? G.sway * (1 - run) * Math.sin(phase) : 0) + (sit ? 0 : windZ), r * 0.3)   // idle weight shift, hip to hip; a hip sway; the wind
          - stagK * 0.2 * fx.sdir + slipK * Math.sin(t * 17) * 0.12;
        body.rotation.x = ease("rx", (walking && this.walkLean ? Math.min(0.08, speed * 0.05) + 0.17 * run : 0) + (sit ? 0 : head_ * 0.2 - tail * 0.05), r * 0.5) - slipK * 0.3;   // lean into the walk (and the run, and a headwind); back on their heels in a slip
        const aSw = 0.3 * (G.arms * (1 - run) + 2.3 * run) * (1 - 0.6 * hunch);
        let lx = walking ? swU * aSw : 0, rx = walking ? -swU * aSw : 0;                   // arms: smaller than the legs, trailing them
        let le = walking ? -0.22 - Math.max(0, -swU) * 0.22 : -0.12, re = walking ? -0.22 - Math.max(0, swU) * 0.22 : -0.12;   // elbows bend on the forward swing
        if (run) { le += (-1.45 - Math.max(0, -swU) * 0.25 - le) * run; re += (-1.45 - Math.max(0, swU) * 0.25 - re) * run; }   // running: elbows at right angles, pumping
        const free = !["hold", "reach", "wait", "lean", "read", "watch", "sit"].includes(pose) && !tapes[0].visible && !Object.values(props).some(m => m.visible);
        if (free && walking && G.behind && !run) { lx = rx = 0.42; le = re = -0.55; }   // a stroll: hands clasped behind
        if (free && hunch > 0.05) { const k = Math.min(1, hunch * 1.3) * (1 - run); lx += (-0.4 - lx) * k; rx += (-0.4 - rx) * k; le += (-1.6 - le) * k; re += (-1.6 - re) * k; }   // hugging themselves
        if (pose === "reach") { rx = -1.45 - Math.sin(t * 3) * 0.05; re = -0.2; }
        if (pose === "hold") { rx = walking ? -0.35 : -0.45; re = -1.0; }
        if (sit) { lx = rx = face.mood === "shock" ? -1.1 : -0.45; le = re = face.mood === "shock" ? -0.9 : -0.8; }   // hands in the lap (up when startled)
        if (pose === "wait") { lx = -0.25; le = -1.2; if (!tapes[0].visible) { rx = -0.25; re = -1.25; } }   // hands up on the counter
        if (pose === "lean") { lx = rx = -0.55; le = re = -1.05; }                  // forearms down on the counter, weight on them
        if (pose === "read") { rx = -1.05; re = -1.45; }                              // the tape up in front, turned to read the back
        if (pose === "watch") { lx = -0.45; le = -1.55; }                             // wrist up across the chest
        if (props.umbrella.visible) { lx = -0.35; le = -1.25; if (fx.flip > 0) { lx -= Math.sin(t * 22) * 0.3; le -= 0.3; } }   // the umbrella held up, the hand at the chest (wrestling it, inside out)
        else if (env.shield) { lx = -2.75; le = -0.95; }                              // a hand up over the head against the rain
        if (feelK) { rx += (-1.15 - rx) * feelK; re += (-0.3 - re) * feelK; }          // palm out: is that rain?
        if (shakeK) { const k = shakeK; lx += (-1.0 - lx) * k; le += (-1.75 + Math.sin(t * 24) * 0.25 - le) * k; }   // brushing it off the shoulders
        const ar = walking ? soft : r;                    // arms carry some momentum while walking; poses (reach, hold) still settle promptly
        const pose2 = [[ease("ax0", lx, ar), ease("ae0", le, ar)], [ease("ax1", rx, ar), ease("ae1", re, ar)]];
        const flail = Math.max(slipK, stagK * 0.6);        // arms out for balance
        arms.forEach(({ sh, el }, i) => { sh.rotation.set(pose2[i][0] - flail * 0.4, 0, (i ? -0.06 : 0.06) + flail * (i ? -1.2 : 1.2) * (1 + Math.sin(t * 15 + i) * 0.15)); el.rotation.x = pose2[i][1]; });
        const armIK = (armI, target, w) => {             // two-bone IK: elbow from the law of cosines, shoulder swung to aim the chain
          const { sh, el } = arms[armI];
          upper.updateMatrixWorld(true);
          const d = upper.worldToLocal(tmp.copy(target)).sub(sh.position), D = Math.max(0.12, Math.min(UPPER + FORE - 0.01, d.length()));
          const inner = Math.acos(Math.max(-1, Math.min(1, (UPPER * UPPER + FORE * FORE - D * D) / (2 * UPPER * FORE))));
          const e = -(Math.PI - inner);                          // negative = forearm folds forward
          const hand0 = tmp2.set(0, -UPPER - FORE * Math.cos(e), -FORE * Math.sin(e)).normalize();
          qIK.setFromUnitVectors(hand0, d.normalize());
          sh.quaternion.slerp(qIK, w);
          el.rotation.x += (e - el.rotation.x) * w;
        };
        if (ik) armIK(ik.armI, reach.target, w);
        if (reach2.w > 0.002 && !(ik && ik.armI === reach2.arm)) armIK(reach2.arm, reach2.target, reach2.w);
        // head: browsing scans, impatience tilts, otherwise a slow idle drift
        const yaw = look != null ? look : face.mood === "browse" ? Math.sin(t * 1.3) * 0.25 : face.mood === "shifty" ? Math.sin(t * 2.3) * 0.55 : Math.sin(t * 0.4) * 0.05;   // shifty: checking over both shoulders
        lerp(head.rotation, "y", yaw + (talking ? Math.sin(t * 0.9) * 0.06 : 0), r * 0.6);
        lerp(head.rotation, "z", face.mood === "impatient" ? 0.12 : talking ? Math.sin(t * 1.3) * 0.05 : 0, r * 0.5);
        head.rotation.x = ease("nod", walking ? Math.cos(phase * 2 - 0.8) * 0.008 : face.mood === "watch" ? -0.06 : talking ? Math.max(0, Math.sin(t * 2.4)) * 0.05 : 0, soft)   // talking: little agreeing nods   // eyes-level: only a whisper of nod, lagging the step; tips up at the screen
          + lean * 0.85                                   // plus bowing with the upper body (added after easing, so it never feeds back)
          + (pose === "read" ? 0.3 : pose === "watch" ? 0.35 : 0) + Math.max(0, sg) * 0.2   // looking down at it / sagging
          + ease("hd", hunch * 0.14 + head_ * 0.16 - feelK * 0.4 + (walking && G.lean > 0.06 ? 0.08 : 0), Math.min(1, dt * 3)) - slipK * 0.25;   // head down into the weather (a shuffler watches their feet); up at the sky; thrown back in a slip
        head.rotation.z += shakeK * Math.sin(t * 31) * 0.1;
        upper.updateMatrixWorld(true);                    // the head rides the top of the neck, wherever the waist has put it
        head.position.copy(group.worldToLocal(upper.localToWorld(tmp.set(0, 0.73, HEAD_Z / H))));
        if (props.umbrella.visible) {                     // straight up in the world, over the head
          const um = props.umbrella; um.parent.updateWorldMatrix(true, false);
          um.parent.getWorldQuaternion(qIK).invert(); um.quaternion.copy(qIK);
          const wob = Math.sin(t * 7.3) * 0.04 * Math.min(1, Math.hypot(env.wx, env.wz) / 6);   // angled into the wind, shaking in it
          eTilt.set(Math.max(-0.5, Math.min(0.5, -env.wz * 0.045)) + wob, 0, Math.max(-0.5, Math.min(0.5, env.wx * 0.045)) - wob); um.quaternion.multiply(qTilt.setFromEuler(eTilt));
          um.userData.canopy.scale.y = fx.flip > 0 ? -0.7 : 1;    // blown inside out
          um.parent.getWorldScale(tmp2); um.scale.set(1 / tmp2.x, 1 / tmp2.y, 1 / tmp2.z);
        }

        // face: blink now and then, redraw at ~15 fps while animating
        if (t > face.next) { face.blink = !face.blink; face.next = t + (face.blink ? 0.12 : 2 + Math.random() * 3); face.drawnAt = -1; }
        const animated = !["off", "neutral", "happy", "watch"].includes(face.mood) || t - face.since < 0.4;
        if (face.drawnAt < 0 || (animated && t - face.drawnAt > 1 / 15)) { drawFace(g2, face, t); ftex.needsUpdate = true; face.drawnAt = t; }
      },
      dispose() { ftex.dispose(); sg.dispose(); screen.material.dispose(); led.material.dispose(); shadow.geometry.dispose(); },
    };
  }

  return { randomOutfit, build };
})();