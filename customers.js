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
//   randomOutfit(rnd = Math.random) -> outfit   (plain object: tweak any field)
//   build(outfit) -> customer {
//     group,              origin at the floor between the feet, facing +z
//     screen,             the face mesh (store.js marks it to glow)
//     parts,              every mesh, for aiming at
//     setMood(name),      neutral browse happy love meh wait impatient angry alarm thanks off on
//     setPose(name),      walk idle reach hold wait sit
//     lookAt(yaw|null),   turn the head relative to the body
//     holdTape(n),        how many tapes in hand, 0-3
//     reachTo(point|null, arm),  put a hand on a world point (eased); null lets go
//     tick(dt, speed),    animate; speed = m/s along the ground (0 = standing)
//     dispose(),          frees the face canvas texture (materials are shared: kept)
//   }
// }
window.VaultCustomers = (() => {
  // ---- wardrobe: every outfit is picked from these ----
  const SKIN = ["#f1c9a5", "#e3b48b", "#c98d62", "#9a6440", "#6b4128"];
  const PHOSPHOR = ["#7dff9a", "#8fe8ff", "#ffc86a", "#f2f2f2", "#ff9ce6"];
  const TOPS = ["tee", "tee", "flannel", "stripes", "windbreaker", "varsity", "sweater"];
  const BRIGHT = ["#1f7a8c", "#d1495b", "#edae49", "#00798c", "#6a4c93", "#2b9348", "#f25c54", "#3d5a80", "#e76f51", "#264653", "#8338ec", "#ff006e", "#118ab2"];
  const DULL = ["#3a3a3a", "#5b4636", "#2f4858", "#7d6b58", "#4a5d23", "#6d2e46", "#1d3557"];
  const PANTS = [["jeans", "#3b5b8c"], ["jeans", "#243650"], ["acid", "#8aa6c9"], ["khaki", "#b9a27a"], ["black", "#222428"], ["shorts", "#b9a27a"], ["shorts", "#3b5b8c"]];
  const SHOES = ["#eeeeee", "#eeeeee", "#1e1e1e", "#b3242c", "#2d4fa3"];
  const CASES = [["wood", "#6b4424"], ["black", "#1c1c1e"], ["beige", "#cfc6a8"], ["silver", "#9aa0a6"], ["red", "#a8262b"], ["white", "#e4e2dc"]];

  const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
  function randomOutfit(rnd = Math.random) {
    const top = pick(TOPS, rnd), [pants, pantsColor] = pick(PANTS, rnd), [tvKind, tvColor] = pick(CASES, rnd);
    return {
      skin: pick(SKIN, rnd), height: 0.93 + rnd() * 0.14, build: 0.9 + rnd() * 0.25,
      top, topA: pick(BRIGHT, rnd), topB: rnd() < 0.5 ? pick(DULL, rnd) : pick(BRIGHT, rnd),
      longSleeves: top !== "tee" || rnd() < 0.2,
      pants, pantsColor, shoes: pick(SHOES, rnd),
      hat: rnd() < 0.3 ? { color: pick(BRIGHT.concat(DULL), rnd), back: rnd() < 0.5 } : null,
      tv: { kind: tvKind, color: tvColor, w: 0.42 + rnd() * 0.12, h: 0.32 + rnd() * 0.08, d: 0.3 + rnd() * 0.12, antenna: rnd() < 0.4, knobs: rnd() < 0.6 },
      phosphor: pick(PHOSPHOR, rnd),
    };
  }

  // ---- shared geometry + a material cache keyed by what it looks like ----
  let BOX, CYL, SPH, BALL, SOFT, ROUND, CASE, TORSO, SHADOW, SHEEN, GRILLE;
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
    ROUND = roundBox(0.18);                        // shoes, hips
    CASE = roundBox(0.08, 3);                      // TV cabinets: molded plastic / veneer edges
    TORSO = roundBox(0.2, 4, 0.22);                // shoulders broader than the waist
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
  // the shirt/jacket: torso and sleeve materials for an outfit
  function topMats(o) {
    const { top, topA: a, topB: b } = o;
    const key = `${top}|${a}|${b}`;
    if (top === "flannel") {
      const m = patterned(key, (g, n) => {
        g.fillStyle = a; g.fillRect(0, 0, n, n);
        g.fillStyle = b; g.globalAlpha = 0.55;
        for (let i = 0; i < n; i += 16) { g.fillRect(i, 0, 7, n); g.fillRect(0, i, n, 7); }
        g.globalAlpha = 0.35; g.fillStyle = "#fff"; for (let i = 10; i < n; i += 16) { g.fillRect(i, 0, 1, n); g.fillRect(0, i, n, 1); }
      });
      return [m, m];
    }
    if (top === "stripes") {
      const m = patterned(key, (g, n) => { g.fillStyle = a; g.fillRect(0, 0, n, n); g.fillStyle = b; for (let y = 0; y < n; y += 12) g.fillRect(0, y, n, 5); });
      return [m, m];
    }
    if (top === "windbreaker") {                  // loud 90s color-block panels
      const m = patterned(key, (g, n) => {
        g.fillStyle = a; g.fillRect(0, 0, n, n);
        g.fillStyle = b; g.beginPath(); g.moveTo(0, n * 0.55); g.lineTo(n, n * 0.2); g.lineTo(n, n * 0.5); g.lineTo(0, n * 0.85); g.fill();
        g.fillStyle = "#f5f5f5"; g.beginPath(); g.moveTo(0, n * 0.85); g.lineTo(n, n * 0.5); g.lineTo(n, n * 0.6); g.lineTo(0, n * 0.95); g.fill();
      });
      return [m, m];
    }
    if (top === "varsity") {                      // body color, cream sleeves, a chenille letter
      const body = patterned(key, (g, n) => {
        g.fillStyle = a; g.fillRect(0, 0, n, n);
        g.fillStyle = "#f3ead3"; g.font = "bold 26px Georgia, serif"; g.textAlign = "center"; g.fillText("V", n * 0.7, n * 0.55);
        g.fillStyle = b; g.fillRect(0, n - 6, n, 6);
      });
      return [body, solid("#f3ead3")];
    }
    if (top === "sweater") {                      // solid with a zigzag band across the chest
      const m = patterned(key, (g, n) => {
        g.fillStyle = a; g.fillRect(0, 0, n, n);
        g.strokeStyle = b; g.lineWidth = 5; g.beginPath();
        for (let x = 0; x <= n; x += 8) g.lineTo(x, n * 0.35 + (x / 8 % 2 ? 6 : -6));
        g.stroke();
      });
      return [m, m];
    }
    if (top === "uniform") {                      // store polo: VaultBuster blue, yellow collar band, a name tag
      const body = patterned(`${key}|${o.nameTag}`, (g, n) => {
        g.fillStyle = a; g.fillRect(0, 0, n, n);
        g.fillStyle = b; g.fillRect(0, 0, n, 7);
        g.fillStyle = "#f4f4f4"; g.fillRect(n * 0.56, 16, 22, 9);
        g.fillStyle = "#1a1a1a"; g.font = "bold 7px Arial"; g.textAlign = "center"; g.fillText(o.nameTag || "", n * 0.56 + 11, 23);
      });
      return [body, solid(a)];
    }
    const tee = patterned(key, (g, n) => {         // tee: solid, with a small chest graphic
      g.fillStyle = a; g.fillRect(0, 0, n, n);
      g.fillStyle = b; g.beginPath(); g.arc(n * 0.5, n * 0.4, 9, 0, Math.PI * 2); g.fill();
    });
    return [tee, solid(a)];
  }
  function pantsMat(o) {
    if (o.pants !== "acid") return solid(o.pantsColor);
    return patterned(`acid|${o.pantsColor}`, (g, n) => {
      g.fillStyle = o.pantsColor; g.fillRect(0, 0, n, n);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.3})`; g.beginPath(); g.arc(Math.random() * n, Math.random() * n, 1 + Math.random() * 3, 0, 7); g.fill(); }
    });
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
    const skin = solid(o.skin), pants = pantsMat(o), shoe = solid(o.shoes), [torsoM, sleeveM] = topMats(o);
    const H = o.height, W = o.build;
    body.scale.set(W, H, 1);                          // taller/shorter, broader/slimmer: one scale, no new parts

    const collarM = o.top === "uniform" ? solid(o.topB) : sleeveM, sole = solid(o.shoes === "#eeeeee" ? "#d9d4c8" : "#f2f0ea");
    // legs: hip -> thigh -> knee -> shin -> sneaker (upper + a contrasting sole)
    const legs = [-1, 1].map(s => {
      const hip = pivot(body, s * 0.1, 0.9, 0);
      part(hip, SOFT, pants, 0.155, 0.5, 0.175, 0, -0.23, 0);
      const knee = pivot(hip, 0, -0.45, 0);
      part(knee, SOFT, o.pants === "shorts" ? skin : pants, 0.135, 0.46, 0.15, 0, -0.2, 0);
      if (o.pants === "shorts") part(knee, SOFT, pants, 0.15, 0.1, 0.165, 0, -0.02, 0);   // the hem, just past the knee
      part(knee, ROUND, shoe, 0.14, 0.085, 0.27, 0, -0.395, 0.045);
      part(knee, ROUND, sole, 0.15, 0.035, 0.285, 0, -0.43, 0.045);
      return { hip, knee };
    });
    part(body, ROUND, pants, 0.35, 0.16, 0.22, 0, 0.93, 0);                        // seat of the pants
    const upper = pivot(body, 0, 0.9, 0);                                           // the waist: everything above bends forward from here
    const torso = part(upper, TORSO, torsoM, 0.43, 0.56, 0.245, 0, 0.37, 0);
    part(upper, ROUND, solid("#2a2320"), 0.37, 0.035, 0.23, 0, 0.105, 0);           // belt
    part(upper, ROUND, solid("#b8a46a"), 0.04, 0.03, 0.02, 0, 0.105, 0.115);         // buckle
    // arms: shoulder -> upper arm -> elbow -> forearm -> hand
    const arms = [-1, 1].map(s => {
      const sh = pivot(upper, s * 0.28, 0.6, 0);
      part(sh, SOFT, sleeveM, 0.125, 0.33, 0.135, 0, -0.13, 0);
      const el = pivot(sh, 0, -0.29, 0);
      part(el, SOFT, o.longSleeves ? sleeveM : skin, 0.105, 0.29, 0.115, 0, -0.12, 0);
      if (o.longSleeves) part(el, SOFT, collarM, 0.115, 0.04, 0.125, 0, -0.255, 0);   // cuff
      else part(sh, SOFT, collarM, 0.135, 0.04, 0.145, 0, -0.28, 0);                  // short-sleeve hem band
      const hand = part(el, SOFT, skin, 0.1, 0.11, 0.08, 0, -0.32, 0.005);
      part(hand, SOFT, skin, 0.35, 0.5, 0.6, s * -0.55, 0.05, 0.25);                  // thumb, tucked in toward the body
      return { sh, el, hand };
    });
    part(upper, CYL, skin, 0.1, 0.09, 0.1, 0, 0.69, 0);                              // neck
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
    if (o.hat) {                                                                  // a ball cap on a TV — forwards or backwards
      const hm = solid(o.hat.color), cap = pivot(head, 0, th, 0); cap.rotation.y = o.hat.back ? Math.PI : 0;
      part(cap, SPH, hm, tw * 0.62, 0.16, td * 0.8, 0, 0, -0.02);
      part(cap, BOX, hm, tw * 0.5, 0.015, 0.16, 0, 0.01, td * 0.4 + 0.06);
    }
    const tapes = [0, 1, 2].map(i => { const m = part(arms[1].el, BOX, solid("#151515"), 0.03, 0.19, 0.11, 0.035 * (i - 1), -0.36 - 0.012 * i, 0.07); m.visible = false; return m; });   // up to 3, side by side in one hand

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * W, 0.55), SHADOW); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.006; group.add(shadow);
    const face = { mood: "off", color: o.phosphor, since: 0, blink: false, next: 0, drawnAt: -1 };
    const UPPER = 0.29, FORE = 0.32;                   // shoulder->elbow, elbow->hand (body-space, before the height/build scale)
    const reach = { target: new THREE.Vector3(), on: false, w: 0, arm: 1 }, st = { y: 0, nod: 0, lean: 0, crouch: 0, step: 0, ry: 0, rz: 0, rx: 0, ax0: 0, ae0: -0.12, ax1: 0, ae1: -0.12, h0: 0, h1: 0, k0: 0, k1: 0 };
    const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), qIK = new THREE.Quaternion();
    let t = 0, phase = 0, pose = "idle", look = null;   // look: head yaw (relative to the body) someone asked for, or null
    const g2 = fc.getContext("2d");
    drawFace(g2, face, 0); ftex.needsUpdate = true;
    const lerp = (obj, k, v, r) => { obj[k] += (v - obj[k]) * r; };

    return {
      group, screen, parts, outfit: o, glows: [screen, led],   // glows: what the store should mark to bloom
      get mood() { return face.mood; },
      setMood(m) { if (m !== face.mood) { face.mood = m; face.since = t; face.drawnAt = -1; } },
      setPose(p) { pose = p; },
      lookAt(yaw) { look = yaw == null ? null : Math.max(-1.45, Math.min(1.45, yaw)); },   // turn the head (radians, + = her left); null = back to normal
      holdTape(n) { tapes.forEach((m, i) => m.visible = i < +n); },   // how many (true = 1)
      // reach a hand to a point in the world (a tape slot, the returns slot, the
      // rewinder...) — eased in and out. arm: 1 = the tape hand (default), 0 = the other, "auto" = nearer
      reachTo(point, arm = 1) { if (point) { reach.target.copy(point); reach.on = true; reach.arm = arm; } else reach.on = false; },
      tick(dt, speed = 0) {
        t += dt;
        // walk cycle: stride advances with ground speed, so feet don't skate
        if (speed > 0.01) phase += dt * speed * 6;
        const walking = speed > 0.01, sw = walking ? Math.sin(phase) : 0, r = Math.min(1, dt * 10), sit = pose === "sit";
        const ease = (k, v, rate = r) => { st[k] += (v - st[k]) * rate; return st[k]; };   // eased pose channels (kept apart from the rig, so reaching can layer on top)
        reach.w += ((reach.on ? 1 : 0) - reach.w) * Math.min(1, dt * 5);
        const w = reach.w < 0.002 ? 0 : reach.w;
        // where the target sits relative to an unbent shoulder decides how much to bend at the waist / crouch / step in
        let ik = null;
        if (w) {
          group.updateMatrixWorld(true);
          const g = group.worldToLocal(tmp.copy(reach.target));
          const armI = reach.arm === "auto" ? (g.x > 0 ? 1 : 0) : reach.arm;
          const d = g.sub(tmp2.set((armI ? 0.28 : -0.28) * W, 1.5 * H, 0));
          ik = { armI, flat: Math.hypot(d.x, d.z), dy: d.y };
        }
        const low = ik ? Math.max(0, -ik.dy - 0.35) : 0, far = ik ? Math.max(0, ik.flat - 0.4) : 0;
        const lean = ease("lean", Math.min(1.0, far * 1.4 + low * 0.9), Math.min(1, dt * 5)) * w;   // bend at the waist toward it
        const crouch = ease("crouch", Math.max(0, Math.min(1, (low - 0.35) / 0.5)), Math.min(1, dt * 5)) * w;   // really low: bend the knees too
        const step = ease("step", Math.max(0, Math.min(0.15, far - 0.35)), Math.min(1, dt * 5)) * w;           // really far: a half step in
        legs.forEach(({ hip, knee }, i) => {
          const s = i ? -sw : sw;
          const hx = sit ? -Math.PI / 2 : -s * 0.38, kx = sit ? Math.PI / 2 : walking ? Math.max(0, -Math.cos(phase + (i ? Math.PI : 0))) * 0.55 : 0;   // knee lifts as the leg swings through
          hip.rotation.x = ease("h" + i, hx) - crouch * 1.05;
          knee.rotation.x = ease("k" + i, kx) + crouch * 1.9;
        });
        const seatY = sit ? 0.5 - 0.9 * o.height : 0;            // hips down to cushion height
        const jolt = face.mood === "shock" && t - face.since < 0.35 ? Math.sin((t - face.since) / 0.35 * Math.PI) * 0.06 : 0;   // a little jump
        const bodyY = seatY + jolt + (walking ? Math.abs(Math.cos(phase)) * 0.03 : 0);
        st.y += (bodyY - st.y) * (Math.abs(bodyY - st.y) > 0.05 ? r : 1);   // eased sitting down / getting up, bob tracked directly
        body.position.y = st.y - crouch * 0.4;
        body.position.z = step;
        upper.rotation.x = lean;
        torso.scale.y = 0.56 * (1 + Math.sin(t * 1.7) * 0.012); torso.scale.z = 0.245 * (1 + Math.sin(t * 1.7) * 0.02);   // breathing
        body.rotation.y = ease("ry", walking ? sw * 0.07 : 0);                                  // shoulders counter-twist the stride
        body.rotation.z = ease("rz", walking || sit ? 0 : Math.sin(t * 0.45) * 0.018, r * 0.3);  // idle weight shift, hip to hip
        body.rotation.x = ease("rx", walking ? Math.min(0.08, speed * 0.05) : 0, r * 0.5);   // lean into the walk
        let lx = walking ? sw * 0.4 : 0, rx = walking ? -sw * 0.4 : 0;
        let le = walking ? -0.2 - Math.max(0, -sw) * 0.35 : -0.12, re = walking ? -0.2 - Math.max(0, sw) * 0.35 : -0.12;   // elbows bend on the forward swing
        if (pose === "reach") { rx = -1.45 - Math.sin(t * 3) * 0.05; re = -0.2; }
        if (pose === "hold") { rx = walking ? -0.35 : -0.45; re = -1.0; }
        if (sit) { lx = rx = face.mood === "shock" ? -1.1 : -0.45; le = re = face.mood === "shock" ? -0.9 : -0.8; }   // hands in the lap (up when startled)
        if (pose === "wait") { lx = -0.25; le = -1.2; if (!tapes[0].visible) { rx = -0.25; re = -1.25; } }   // hands up on the counter
        const pose2 = [[ease("ax0", lx), ease("ae0", le)], [ease("ax1", rx), ease("ae1", re)]];
        arms.forEach(({ sh, el }, i) => { sh.rotation.set(pose2[i][0], 0, i ? -0.06 : 0.06); el.rotation.x = pose2[i][1]; });
        if (ik) {                                        // two-bone IK: elbow from the law of cosines, shoulder swung to aim the chain
          const { sh, el } = arms[ik.armI];
          upper.updateMatrixWorld(true);
          const d = upper.worldToLocal(tmp.copy(reach.target)).sub(sh.position), D = Math.max(0.12, Math.min(UPPER + FORE - 0.01, d.length()));
          const inner = Math.acos(Math.max(-1, Math.min(1, (UPPER * UPPER + FORE * FORE - D * D) / (2 * UPPER * FORE))));
          const e = -(Math.PI - inner);                          // negative = forearm folds forward
          const hand0 = tmp2.set(0, -UPPER - FORE * Math.cos(e), -FORE * Math.sin(e)).normalize();
          qIK.setFromUnitVectors(hand0, d.normalize());
          sh.quaternion.slerp(qIK, w);
          el.rotation.x += (e - el.rotation.x) * w;
        }
        // head: browsing scans, impatience tilts, otherwise a slow idle drift
        const yaw = look != null ? look : face.mood === "browse" ? Math.sin(t * 1.3) * 0.25 : Math.sin(t * 0.4) * 0.05;
        lerp(head.rotation, "y", yaw, r * 0.6); lerp(head.rotation, "z", face.mood === "impatient" ? 0.12 : 0, r * 0.5);
        head.rotation.x = ease("nod", walking ? Math.cos(phase * 2) * 0.025 : face.mood === "watch" ? -0.06 : 0)   // nods with the step; tips up at the screen
          + lean * 0.85;                                  // plus bowing with the upper body (added after easing, so it never feeds back)
        upper.updateMatrixWorld(true);                    // the head rides the top of the neck, wherever the waist has put it
        head.position.copy(group.worldToLocal(upper.localToWorld(tmp.set(0, 0.73, HEAD_Z / H))));

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
