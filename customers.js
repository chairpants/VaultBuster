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
  let BOX, CYL, SPH;
  const mats = new Map();
  function geo() {
    if (BOX) return;
    BOX = new THREE.BoxGeometry(1, 1, 1);
    CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    SPH = new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);   // a dome (cap crown)
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

    // legs: hip -> thigh -> knee -> shin -> shoe
    const legs = [-1, 1].map(s => {
      const hip = pivot(body, s * 0.1, 0.9, 0);
      part(hip, BOX, pants, 0.15, 0.46, 0.17, 0, -0.23, 0);
      const knee = pivot(hip, 0, -0.45, 0);
      part(knee, BOX, o.pants === "shorts" ? skin : pants, 0.13, 0.42, 0.15, 0, -0.21, 0);
      part(knee, BOX, shoe, 0.15, 0.08, 0.27, 0, -0.41, 0.05);
      return { hip, knee };
    });
    part(body, BOX, pants, 0.36, 0.14, 0.21, 0, 0.93, 0);                         // seat of the pants
    const torso = part(body, BOX, torsoM, 0.42, 0.56, 0.24, 0, 1.27, 0);
    // arms: shoulder -> upper arm -> elbow -> forearm -> hand
    const arms = [-1, 1].map(s => {
      const sh = pivot(body, s * 0.28, 1.5, 0);
      part(sh, BOX, sleeveM, 0.12, 0.31, 0.13, 0, -0.14, 0);
      const el = pivot(sh, 0, -0.29, 0);
      part(el, BOX, o.longSleeves ? sleeveM : skin, 0.11, 0.27, 0.12, 0, -0.13, 0);
      const hand = part(el, BOX, skin, 0.1, 0.1, 0.1, 0, -0.31, 0);
      return { sh, el, hand };
    });
    part(body, CYL, skin, 0.1, 0.1, 0.1, 0, 1.6, 0);                              // neck

    // the TV head, kept at true size (not stretched with the body)
    const head = pivot(group, 0, 1.63 * H, 0);
    const { w: tw, h: th, d: td } = o.tv, caseM = solid(o.tv.color), dark = solid("#111214");
    part(head, BOX, caseM, tw, th, td, 0, th / 2, -0.02);
    part(head, BOX, dark, tw * 0.86, th * 0.8, 0.02, 0, th / 2, td / 2 - 0.01);                        // bezel
    part(head, BOX, caseM, tw * 0.62, th * 0.62, 0.1, 0, th / 2, -td / 2 - 0.05);                      // the tube's back hump
    const fc = document.createElement("canvas"); fc.width = FW; fc.height = FH;
    const ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(tw * 0.76, th * 0.68), new THREE.MeshBasicMaterial({ map: ftex }));
    screen.position.set(0, th / 2, td / 2 + 0.001); head.add(screen); parts.push(screen);
    if (o.tv.knobs) for (const y of [0.35, 0.6]) part(head, CYL, dark, 0.035, 0.02, 0.035, tw * 0.5 - 0.035, th * y, td / 2 - 0.02).rotation.x = Math.PI / 2;
    if (o.tv.antenna) for (const s of [-1, 1]) { const a = part(head, CYL, solid("#b8bcc2"), 0.008, 0.34, 0.008, s * 0.07, th + 0.15, -0.04); a.rotation.z = -s * 0.45; }
    if (o.hat) {                                                                  // a ball cap on a TV — forwards or backwards
      const hm = solid(o.hat.color), cap = pivot(head, 0, th, 0); cap.rotation.y = o.hat.back ? Math.PI : 0;
      part(cap, SPH, hm, tw * 0.62, 0.16, td * 0.8, 0, 0, -0.02);
      part(cap, BOX, hm, tw * 0.5, 0.015, 0.16, 0, 0.01, td * 0.4 + 0.06);
    }
    const tapes = [0, 1, 2].map(i => { const m = part(arms[1].el, BOX, solid("#151515"), 0.03, 0.19, 0.11, 0.035 * (i - 1), -0.36 - 0.012 * i, 0.07); m.visible = false; return m; });   // up to 3, side by side in one hand

    const face = { mood: "off", color: o.phosphor, since: 0, blink: false, next: 0, drawnAt: -1 };
    let t = 0, phase = 0, pose = "idle", look = null;   // look: head yaw (relative to the body) someone asked for, or null
    const g2 = fc.getContext("2d");
    drawFace(g2, face, 0); ftex.needsUpdate = true;
    const lerp = (obj, k, v, r) => { obj[k] += (v - obj[k]) * r; };

    return {
      group, screen, parts, outfit: o,
      get mood() { return face.mood; },
      setMood(m) { if (m !== face.mood) { face.mood = m; face.since = t; face.drawnAt = -1; } },
      setPose(p) { pose = p; },
      lookAt(yaw) { look = yaw == null ? null : Math.max(-1.45, Math.min(1.45, yaw)); },   // turn the head (radians, + = her left); null = back to normal
      holdTape(n) { tapes.forEach((m, i) => m.visible = i < +n); },   // how many (true = 1)
      tick(dt, speed = 0) {
        t += dt;
        // walk cycle: stride advances with ground speed, so feet don't skate
        if (speed > 0.01) phase += dt * speed * 6;
        const walking = speed > 0.01, sw = walking ? Math.sin(phase) : 0, r = Math.min(1, dt * 10), sit = pose === "sit";
        legs.forEach(({ hip, knee }, i) => {
          const s = i ? -sw : sw;
          if (sit) { lerp(hip.rotation, "x", -Math.PI / 2, r); lerp(knee.rotation, "x", Math.PI / 2, r); return; }   // thighs on the cushion, shins down
          lerp(hip.rotation, "x", -s * 0.38, r);
          lerp(knee.rotation, "x", walking ? Math.max(0, -Math.cos(phase + (i ? Math.PI : 0))) * 0.55 : 0, r);   // knee lifts as the leg swings through
        });
        const seatY = sit ? 0.5 - 0.9 * o.height : 0;            // hips down to cushion height
        const jolt = face.mood === "shock" && t - face.since < 0.35 ? Math.sin((t - face.since) / 0.35 * Math.PI) * 0.06 : 0;   // a little jump
        const bodyY = seatY + jolt + (walking ? Math.abs(Math.cos(phase)) * 0.035 : Math.sin(t * 1.6) * 0.004);
        body.position.y += (bodyY - body.position.y) * (Math.abs(bodyY - body.position.y) > 0.05 ? r : 1);   // eased sitting down / getting up, bob tracked directly
        const [L, R] = arms;
        let lx = walking ? sw * 0.4 : 0, rx = walking ? -sw * 0.4 : 0, le = -0.15, re = -0.15;
        if (pose === "reach") { rx = -1.45 - Math.sin(t * 3) * 0.05; re = -0.2; }
        if (pose === "hold") { rx = walking ? -0.35 : -0.45; re = -1.0; }
        if (sit) { lx = rx = face.mood === "shock" ? -1.1 : -0.45; le = re = face.mood === "shock" ? -0.9 : -0.8; }   // hands in the lap (up when startled)
        if (pose === "wait") { lx = -0.25; le = -1.2; if (!tapes[0].visible) { rx = -0.25; re = -1.25; } }   // hands up on the counter
        lerp(L.sh.rotation, "x", lx, r); lerp(R.sh.rotation, "x", rx, r);
        lerp(L.el.rotation, "x", le, r); lerp(R.el.rotation, "x", re, r);
        L.sh.rotation.z = 0.06; R.sh.rotation.z = -0.06;
        // head: browsing scans, impatience tilts, otherwise a slow idle drift
        const yaw = look != null ? look : face.mood === "browse" ? Math.sin(t * 1.3) * 0.25 : Math.sin(t * 0.4) * 0.05;
        lerp(head.rotation, "y", yaw, r * 0.6); lerp(head.rotation, "z", face.mood === "impatient" ? 0.12 : 0, r * 0.5);
        head.position.y = 1.63 * o.height + body.position.y;

        // face: blink now and then, redraw at ~15 fps while animating
        if (t > face.next) { face.blink = !face.blink; face.next = t + (face.blink ? 0.12 : 2 + Math.random() * 3); face.drawnAt = -1; }
        const animated = !["off", "neutral", "happy", "watch"].includes(face.mood) || t - face.since < 0.4;
        if (face.drawnAt < 0 || (animated && t - face.drawnAt > 1 / 15)) { drawFace(g2, face, t); ftex.needsUpdate = true; face.drawnAt = t; }
      },
      dispose() { ftex.dispose(); screen.geometry.dispose(); screen.material.dispose(); },
    };
  }

  return { randomOutfit, build };
})();
