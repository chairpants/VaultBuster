// ---- and it plays: E (a quarter) steps you up to the machine, the view on its screen. A/D or the arrows move the
// cannon, Space fires (one shot on screen at a time), E or Esc walks away. Five rows of eleven march across and down,
// faster the fewer there are; they drop bombs; the bunkers crumble; the saucer crosses now and then. Three lives;
// a cleared wave brings the next one in lower; it's over when they get you or reach the bottom ----
const arcade = { on: false, g: null, from: null };
const SI = { W: 256, H: 192, top: 30, bunkerY: 148, playerY: 176, ground: 186 };
const siPts = { squid: 30, crab: 20, octo: 10 };
function siBeep(f, d = 0.06, type = "square", vol = 0.05, slide = 0) {
  try { const ac = VaultAudio.ctx(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.linearRampToValueAtTime(f + slide, t + d);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(sfxOut()); o.start(t); o.stop(t + d + 0.02); } catch {}
}
function siWave(g) {                              // a fresh formation (each wave starts a step lower, up to a point)
  g.inv = []; const kinds = ["squid", "crab", "crab", "octo", "octo"], y0 = SI.top + 8 + Math.min(4, g.wave) * 6;
  kinds.forEach((kind, r) => { for (let c = 0; c < 11; c++) g.inv.push({ kind, x: 24 + c * 16 + (kind === "squid" ? 2 : kind === "crab" ? 0.5 : 0), y: y0 + r * 14, w: kind === "squid" ? 8 * 1 : kind === "crab" ? 11 : 12, alive: true }); });
  g.dx = 2; g.stepT = 0; g.frame = 0; g.note = 0; g.bombs = []; g.shot = null; g.bombT = 1;
}
function siBunkers(g) {                           // four bunkers, each a grid of cells that bullets chip away
  g.bunk = [0, 1, 2, 3].map(i => { const x = 32 + i * 56, cells = new Uint8Array(22 * 16);
    for (let y = 0; y < 16; y++) for (let x2 = 0; x2 < 22; x2++) cells[y * 22 + x2] = (y < 3 && (x2 < 3 - y || x2 > 18 + y)) || (y > 10 && x2 > 6 && x2 < 15 && y > 10 + Math.min(x2 - 6, 15 - x2) * 0) ? 0 : 1;
    return { x, y: SI.bunkerY, cells }; });
}
function arcadeStart(i) {                        // a quarter in, and you're at the machine: its screen in front of you
  if (CUSTOMER) { if (cm.wallet < 0.25) return toast("It takes a quarter. You don't have one"); cm.wallet -= 0.25; cm.day.spent += 0.25; }
  const name = TONY_GAMES[i][0];
  arcade.i = i; arcade.g = name === "ASTEROIDS" ? asNew() : siNew();
  arcade.on = true; arcade.from = { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch };
  const z = 3.2 + i * 0.95; Object.assign(player, { x: TONY_IN.x0 + 1.4, z, yaw: Math.PI / 2, pitch: Math.atan2(1.42 - 1.65, 0.64) - 0.02 }); keys.clear();
  siBeep(880, 0.15, "square", 0.04, 440);
  toast(name === "ASTEROIDS" ? "A / D turn · W thrust · SPACE fire · E to walk away" : "A / D or ← → move · SPACE fire · E to walk away", true);
}
function arcadeStop() {
  if (!arcade.on) return;
  const g = arcade.g, i = arcade.i, name = TONY_GAMES[i][0]; arcade.on = false; Object.assign(player, arcade.from); keys.clear();
  if (g.score > (tony.scores[i] || 0)) { tony.scores[i] = g.score; toast(`${name}: ${g.score.toLocaleString()}. A new high score!`, true); }
  else toast(`${name}: ${g.score.toLocaleString()}. Game over, man`, true);
  if (CUSTOMER && g.score) cmLog(`Played ${name[0] + name.slice(1).toLowerCase()} at Tony's: ${g.score.toLocaleString()}`);
}
function siNew() {
  const g = { score: 0, lives: 3, wave: 0, px: SI.W / 2, dead: 0, over: 0, ufo: null, ufoT: 18 + Math.random() * 10, boom: [] };
  siWave(g); siBunkers(g); return g;
}
function siKey(e) {                               // -> true if the machine took the key
  if (!arcade.on) return false;
  if (["KeyE", "Escape", "KeyQ"].includes(e.code)) { if (!e.repeat) arcadeStop(); return true; }
  const g = arcade.g, as = TONY_GAMES[arcade.i][0] === "ASTEROIDS";
  if (e.code === "Space") { e.preventDefault(); if (!e.repeat) as ? asFire(g) : (!g.shot && !g.dead && !g.over && (g.shot = { x: g.px, y: SI.playerY - 4 }, siBeep(1200, 0.08, "square", 0.03, -800))); return true; }
  if (["KeyA", "KeyD", "KeyW", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.code)) { keys.add(e.code); return true; }
  return true;                                    // (everything else waits while you play)
}
function siTick(dt) {
  const g = arcade.g, alive = g.inv.filter(v => v.alive);
  if (g.over) { if ((g.over -= dt) <= 0) arcadeStop(); return; }
  if (g.dead) { g.dead -= dt; if (g.dead <= 0) { g.dead = 0; if (g.lives <= 0) { g.over = 3; siBeep(220, 0.8, "sawtooth", 0.05, -150); } } }
  else {                                          // the cannon
    const mv = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    g.px = Math.max(10, Math.min(SI.W - 10, g.px + mv * 70 * dt));
  }
  // the march: a step at a time, quicker as they thin out, the four-note bass with it
  g.stepT -= dt;
  if (g.stepT <= 0 && alive.length) {
    g.stepT = Math.max(0.03, 0.55 * alive.length / 55); g.frame ^= 1;
    const minX = Math.min(...alive.map(v => v.x)), maxX = Math.max(...alive.map(v => v.x + v.w));
    if ((g.dx > 0 && maxX + g.dx > SI.W - 6) || (g.dx < 0 && minX + g.dx < 6)) { g.dx = -g.dx; for (const v of alive) v.y += 6; } else for (const v of alive) v.x += g.dx;
    siBeep([98, 87, 78, 73][g.note++ % 4], 0.09, "square", 0.06);
    if (Math.max(...alive.map(v => v.y + 8)) >= SI.playerY - 4 && !g.over) { g.lives = 0; g.dead = 1.2; g.boom.push({ x: g.px, y: SI.playerY, t: 1.2, big: true }); siBeep(140, 0.6, "sawtooth", 0.06, -100); }
    for (const v of alive) for (const b of g.bunk) if (v.y + 8 > b.y) for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) { const cx = b.x + x, cy = b.y + y; if (cx >= v.x && cx < v.x + v.w && cy >= v.y && cy < v.y + 8) b.cells[y * 22 + x] = 0; }
  }
  if (!alive.length && !g.dead) { g.wave++; siWave(g); siBunkers(g); siBeep(660, 0.3, "triangle", 0.05, 330); }
  // their bombs: from the bottom one in a random column (toward the cannon, more often than not)
  if ((g.bombT -= dt) <= 0 && alive.length && !g.dead && g.bombs.length < 3) {
    g.bombT = 0.5 + Math.random() * 0.9;
    const cols = {}; for (const v of alive) { const k = Math.round(v.x / 16); if (!cols[k] || v.y > cols[k].y) cols[k] = v; }
    const shooters = Object.values(cols), near = shooters.filter(v => Math.abs(v.x + v.w / 2 - g.px) < 30);
    const v = (near.length && Math.random() < 0.5 ? near : shooters)[Math.floor(Math.random() * (near.length && Math.random() < 0.5 ? near.length : shooters.length))] || shooters[0];
    g.bombs.push({ x: v.x + v.w / 2, y: v.y + 8, t: 0 });
  }
  const chip = (x, y, r) => { for (const b of g.bunk) { if (x < b.x - 2 || x > b.x + 24 || y < b.y - 2 || y > b.y + 18) continue; const lx = Math.floor(x - b.x), ly = Math.floor(y - b.y);
    if (lx >= 0 && lx < 22 && ly >= 0 && ly < 16 && b.cells[ly * 22 + lx]) { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const X = lx + xx, Y = ly + yy; if (X >= 0 && X < 22 && Y >= 0 && Y < 16 && Math.random() < 0.8) b.cells[Y * 22 + X] = 0; } return true; } } return false; };
  for (const bm of [...g.bombs]) {
    bm.y += 70 * dt; bm.t += dt;
    if (chip(bm.x, bm.y + 3, 2) || bm.y > SI.ground) { g.bombs.splice(g.bombs.indexOf(bm), 1); continue; }
    if (!g.dead && Math.abs(bm.x - g.px) < 8 && bm.y + 3 > SI.playerY - 4 && bm.y < SI.playerY + 4) {   // hit: the cannon blows up
      g.bombs.splice(g.bombs.indexOf(bm), 1); g.lives--; g.dead = 1.4; g.bombs = []; g.boom.push({ x: g.px, y: SI.playerY, t: 1.4, big: true }); siBeep(160, 0.7, "sawtooth", 0.07, -120);
    }
  }
  if (g.shot) {                                   // your shot: into an invader, the saucer, a bunker, a bomb, or off the top
    const sh = g.shot; sh.y -= 230 * dt;
    const v = alive.find(v => sh.x >= v.x - 1 && sh.x <= v.x + v.w + 1 && sh.y <= v.y + 8 && sh.y + 4 >= v.y);
    const bomb = g.bombs.find(b => Math.abs(b.x - sh.x) < 3 && Math.abs(b.y - sh.y) < 5);
    if (v) { v.alive = false; g.score += siPts[v.kind]; g.boom.push({ x: v.x + v.w / 2, y: v.y + 4, t: 0.25 }); g.shot = null; siBeep(400, 0.12, "sawtooth", 0.05, -300); }
    else if (g.ufo && Math.abs(sh.x - g.ufo.x) < 9 && sh.y < 30) { const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)]; g.score += pts; g.boom.push({ x: g.ufo.x, y: 24, t: 1, pts }); g.ufo = null; g.shot = null; siBeep(900, 0.4, "square", 0.05, -700); }
    else if (bomb) { g.bombs.splice(g.bombs.indexOf(bomb), 1); g.shot = null; }
    else if (chip(sh.x, sh.y, 1) || sh.y < SI.top - 8) g.shot = null;
  }
  if (!g.ufo && (g.ufoT -= dt) <= 0) { const d = Math.random() < 0.5 ? 1 : -1; g.ufo = { x: d > 0 ? -12 : SI.W + 12, d }; g.ufoT = 20 + Math.random() * 15; }
  if (g.ufo) { g.ufo.x += g.ufo.d * 40 * dt; if (Math.floor(tony.t * 10) % 2) siBeep(600 + 200 * Math.sin(tony.t * 20), 0.05, "sine", 0.015); if (g.ufo.x < -16 || g.ufo.x > SI.W + 16) g.ufo = null; }
  for (const b of [...g.boom]) if ((b.t -= dt) <= 0) g.boom.splice(g.boom.indexOf(b), 1);
  siDraw(g);
}
function siDraw(g) {
  const s = tony.screens?.[0]; if (!s) return;
  const ctx = s.cv.getContext("2d"), W = SI.W, H = SI.H;
  ctx.fillStyle = "#05050c"; ctx.fillRect(0, 0, W, H);
  const px = (rows, x, y, k, c) => { ctx.fillStyle = c; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "1") ctx.fillRect(Math.round(x + i * k), Math.round(y + j * k), k, k); }); };
  ctx.font = "bold 10px Courier New"; ctx.fillStyle = "#ffffff"; ctx.textAlign = "left"; ctx.fillText(`SCORE<1> ${String(g.score).padStart(4, "0")}`, 6, 11);
  ctx.textAlign = "right"; ctx.fillText(`HI-SCORE ${String(Math.max(tony.scores[0] || 0, g.score)).padStart(4, "0")}`, W - 6, 11);
  for (const v of g.inv) if (v.alive) px(INVADER[v.kind][g.frame], v.x, v.y, 1, "#ffffff");
  if (g.ufo) { ctx.fillStyle = "#ff3b30"; ctx.fillRect(g.ufo.x - 8, 22, 16, 4); ctx.fillRect(g.ufo.x - 5, 19, 10, 3); ctx.fillRect(g.ufo.x - 2, 17, 4, 2); }
  ctx.fillStyle = "#39ff5a"; for (const b of g.bunk) for (let y = 0; y < 16; y++) for (let x = 0; x < 22; x++) if (b.cells[y * 22 + x]) ctx.fillRect(b.x + x, b.y + y, 1, 1);
  if (!g.dead || Math.floor(g.dead * 10) % 2) { ctx.fillStyle = "#39ff5a"; ctx.fillRect(Math.round(g.px) - 7, SI.playerY - 1, 14, 5); ctx.fillRect(Math.round(g.px) - 1, SI.playerY - 4, 2, 3); }
  ctx.fillStyle = "#ffffff"; if (g.shot) ctx.fillRect(Math.round(g.shot.x), Math.round(g.shot.y), 1, 4);
  for (const bm of g.bombs) for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(bm.x) + ((Math.floor(bm.t * 12) + k) % 2 ? 1 : -1), Math.round(bm.y) + k * 2, 1, 2);
  for (const b of g.boom) { ctx.fillStyle = b.big ? "#39ff5a" : "#ffffff"; if (b.pts) { ctx.fillStyle = "#ff3b30"; ctx.textAlign = "center"; ctx.fillText(String(b.pts), b.x, 26); continue; }
    for (let k = 0; k < (b.big ? 14 : 8); k++) { const a = k / (b.big ? 14 : 8) * 6.28; ctx.fillRect(Math.round(b.x + Math.cos(a) * (b.big ? 7 : 4)), Math.round(b.y + Math.sin(a) * (b.big ? 4 : 3)), 1, 1); } }
  ctx.fillStyle = "#39ff5a"; ctx.fillRect(0, SI.ground, W, 1);
  ctx.fillStyle = "#ffffff"; ctx.textAlign = "left"; ctx.fillText(String(Math.max(0, g.lives)), 6, H - 1);
  for (let i = 0; i < g.lives - 1; i++) { ctx.fillStyle = "#39ff5a"; ctx.fillRect(18 + i * 18, H - 5, 12, 4); ctx.fillRect(23 + i * 18, H - 7, 2, 2); }
  if (g.over) { ctx.fillStyle = "#ff3b30"; ctx.textAlign = "center"; ctx.font = "bold 16px Courier New"; ctx.fillText("GAME OVER", W / 2, H / 2); }
  s.tex.needsUpdate = true;
}
// ---- Asteroids: the ship in the middle, rocks drifting in from the edges, everything wrapping round the screen. Turn,
// thrust (it drifts: there's no brake), fire (four shots at once, at most). A big rock splits in two mediums, a medium
// in two smalls; 20 / 50 / 100. Three ships; after one's lost the next waits for a clear middle. The beat quickens
// as the screen clears; a cleared screen brings in one more rock than the last ----
const AS = { W: 256, H: 192, R: [0, 4, 8, 15] };
const asRock = (x, y, size) => { const n = 10, verts = Array.from({ length: n }, (_, k) => { const a = k / n * 6.28, r = AS.R[size] * (0.75 + Math.random() * 0.4); return [Math.cos(a) * r, Math.sin(a) * r]; });
  const sp = (0.3 + Math.random() * 0.5) * (4 - size) * 9, a = Math.random() * 6.28; return { x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, size, verts, rot: (Math.random() - 0.5) * 2, a: 0 }; };
function asWave(g) {
  g.rocks = []; for (let k = 0; k < 4 + g.wave; k++) { const e = Math.random() < 0.5; g.rocks.push(asRock(e ? Math.random() * AS.W : (Math.random() < 0.5 ? 0 : AS.W), e ? (Math.random() < 0.5 ? 0 : AS.H) : Math.random() * AS.H, 3)); }
}
function asNew() {
  const g = { score: 0, lives: 3, wave: 0, ship: { x: AS.W / 2, y: AS.H / 2, a: -Math.PI / 2, vx: 0, vy: 0 }, shots: [], dead: 0, safe: 2, over: 0, beatT: 0, beat: 0, debris: [] };
  asWave(g); return g;
}
function asFire(g) {
  if (g.dead || g.over || g.shots.length >= 4) return;
  const s = g.ship; g.shots.push({ x: s.x + Math.cos(s.a) * 6, y: s.y + Math.sin(s.a) * 6, vx: s.vx + Math.cos(s.a) * 150, vy: s.vy + Math.sin(s.a) * 150, t: 0.9 });
  siBeep(1500, 0.06, "square", 0.025, -900);
}
const asWrap = o => { o.x = (o.x + AS.W) % AS.W; o.y = (o.y + AS.H) % AS.H; };
const asD2 = (a, b) => { let dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y); dx = Math.min(dx, AS.W - dx); dy = Math.min(dy, AS.H - dy); return dx * dx + dy * dy; };
function asTick(dt) {
  const g = arcade.g, s = g.ship;
  if (g.over) { if ((g.over -= dt) <= 0) arcadeStop(); asDraw(g); return; }
  if (g.dead) {                                   // waiting for the next ship: till its time's up and the middle's clear
    g.dead -= dt;
    if (g.dead <= 0) { if (g.lives <= 0) { g.over = 3; siBeep(200, 0.8, "sawtooth", 0.05, -120); }
      else if (g.rocks.every(r => asD2(r, { x: AS.W / 2, y: AS.H / 2 }) > 40 * 40)) { g.dead = 0; g.safe = 2; Object.assign(s, { x: AS.W / 2, y: AS.H / 2, a: -Math.PI / 2, vx: 0, vy: 0 }); } else g.dead = 0.1; }
  } else {
    const turn = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0), thrust = keys.has("KeyW") || keys.has("ArrowUp");
    s.a += turn * 4.2 * dt; s.thrust = thrust;
    if (thrust) { s.vx += Math.cos(s.a) * 120 * dt; s.vy += Math.sin(s.a) * 120 * dt; if (Math.random() < dt * 20) siBeep(60 + Math.random() * 30, 0.05, "sawtooth", 0.02); }
    const sp = Math.hypot(s.vx, s.vy), max = 140; if (sp > max) { s.vx *= max / sp; s.vy *= max / sp; }
    s.vx *= 1 - 0.35 * dt; s.vy *= 1 - 0.35 * dt; s.x += s.vx * dt; s.y += s.vy * dt; asWrap(s); g.safe = Math.max(0, g.safe - dt);
  }
  for (const r of g.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; r.a += r.rot * dt; asWrap(r); }
  for (const sh of [...g.shots]) { sh.x += sh.vx * dt; sh.y += sh.vy * dt; asWrap(sh); if ((sh.t -= dt) <= 0) { g.shots.splice(g.shots.indexOf(sh), 1); continue; }
    const r = g.rocks.find(r => asD2(r, sh) < AS.R[r.size] ** 2);
    if (r) { g.shots.splice(g.shots.indexOf(sh), 1); g.rocks.splice(g.rocks.indexOf(r), 1); g.score += [0, 100, 50, 20][r.size];
      if (r.size > 1) for (let k = 0; k < 2; k++) g.rocks.push(asRock(r.x, r.y, r.size - 1));
      for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, v = 20 + Math.random() * 40; g.debris.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.5 }); }
      siBeep([0, 900, 400, 160][r.size], 0.18, "sawtooth", 0.05, -80); } }
  if (!g.dead && !g.safe && !g.over) { const r = g.rocks.find(r => asD2(r, s) < (AS.R[r.size] + 4) ** 2);
    if (r) { g.lives--; g.dead = 1.8; for (let k = 0; k < 14; k++) { const a = Math.random() * 6.28, v = 10 + Math.random() * 50; g.debris.push({ x: s.x, y: s.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 1.2 }); } siBeep(120, 0.7, "sawtooth", 0.07, -80); } }
  for (const d of [...g.debris]) { d.x += d.vx * dt; d.y += d.vy * dt; if ((d.t -= dt) <= 0) g.debris.splice(g.debris.indexOf(d), 1); }
  if (!g.rocks.length) { g.wave++; asWave(g); }
  if ((g.beatT -= dt) <= 0) { g.beatT = Math.max(0.25, 0.9 * Math.min(1, g.rocks.length / 10)); siBeep(g.beat++ % 2 ? 55 : 62, 0.1, "square", 0.06); }   // thump... thump (quicker as it clears)
  asDraw(g);
}
function asDraw(g, attract) {
  const sc = tony.screens?.[1]; if (!sc) return;
  const ctx = sc.cv.getContext("2d"), W = AS.W, H = AS.H;
  ctx.fillStyle = "#03030a"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#e8f0ff"; ctx.fillStyle = "#e8f0ff"; ctx.lineWidth = 1;
  for (const r of g.rocks) { ctx.beginPath(); r.verts.forEach(([vx, vy], k) => { const c = Math.cos(r.a), sn = Math.sin(r.a), x = r.x + vx * c - vy * sn, y = r.y + vx * sn + vy * c; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); ctx.stroke(); }
  for (const sh of g.shots || []) ctx.fillRect(Math.round(sh.x), Math.round(sh.y), 1.5, 1.5);
  for (const d of g.debris || []) ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
  const s = g.ship;
  if (s && !g.dead && !g.over && (!g.safe || Math.floor(g.safe * 8) % 2)) {
    const pt = (r, a) => [s.x + Math.cos(s.a + a) * r, s.y + Math.sin(s.a + a) * r];
    ctx.beginPath(); ctx.moveTo(...pt(7, 0)); ctx.lineTo(...pt(6, 2.5)); ctx.lineTo(...pt(3, Math.PI)); ctx.lineTo(...pt(6, -2.5)); ctx.closePath(); ctx.stroke();
    if (s.thrust && Math.random() < 0.7) { ctx.beginPath(); ctx.moveTo(...pt(3.5, 2.6)); ctx.lineTo(...pt(8, Math.PI)); ctx.lineTo(...pt(3.5, -2.6)); ctx.stroke(); }
  }
  ctx.font = "bold 12px Courier New"; ctx.textAlign = "left"; ctx.fillText(String(g.score || 0).padStart(5, " "), 6, 14);
  ctx.textAlign = "center"; ctx.font = "bold 9px Courier New"; ctx.fillText(String(Math.max(tony.scores[1] || 0, g.score || 0, 10000)).padStart(5, "0"), W / 2, 12);
  for (let k = 0; k < (g.lives ?? 0) - (g.dead || !s ? 0 : 1); k++) { const x = 10 + k * 9, y = 24; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 3, y + 3); ctx.lineTo(x - 3, y + 3); ctx.closePath(); ctx.stroke(); }
  if (g.over) { ctx.font = "bold 16px Courier New"; ctx.fillText("GAME OVER", W / 2, H / 2); }
  if (attract) { ctx.font = "bold 20px Courier New"; ctx.fillText("ASTEROIDS", W / 2, H * 0.42); if (Math.floor(tony.t * 2) % 2) { ctx.font = "bold 12px Courier New"; ctx.fillText("INSERT COIN", W / 2, H * 0.62); } }
  sc.tex.needsUpdate = true;
}
function invadersFrame(ctx, s, W, H) {
  const px = (rows, x, y, k, c) => { ctx.fillStyle = c; rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "1") ctx.fillRect(x + i * k, y + j * k, k, k); }); };
  s.inv ||= { x: 20, y: 34, dx: 4, f: 0 };
  const v = s.inv, cols = 8, gap = 22; v.f ^= 1; v.x += v.dx;
  if (v.x < 6 || v.x + cols * gap > W - 6) { v.dx = -v.dx; v.x += v.dx; v.y += 6; if (v.y > 90) v.y = 34; }
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 11px Courier New"; ctx.textAlign = "left";
  ctx.fillText(`SCORE<1>  ${String(tony.scores[0] || 0).padStart(4, "0")}`, 8, 14); ctx.textAlign = "right"; ctx.fillText(`HI-SCORE  ${String(Math.max(tony.scores[0] || 0, 20000)).padStart(5, "0")}`, W - 8, 14);
  ["squid", "crab", "crab", "octo", "octo"].forEach((kind, r) => { for (let c = 0; c < cols; c++) px(INVADER[kind][v.f], v.x + c * gap + (kind === "squid" ? 2 : 0), v.y + r * 13, 1.4, "#ffffff"); });
  for (let b = 0; b < 4; b++) { ctx.fillStyle = "#39ff5a"; const bx = 22 + b * 60; ctx.fillRect(bx, H - 46, 26, 12); ctx.fillRect(bx + 3, H - 49, 20, 3); ctx.fillStyle = "#05050c"; ctx.fillRect(bx + 8, H - 38, 10, 4); }
  const cx = W / 2 + Math.sin(tony.t * 1.3) * 70; ctx.fillStyle = "#39ff5a"; ctx.fillRect(cx - 8, H - 22, 16, 5); ctx.fillRect(cx - 2, H - 26, 4, 4);
  ctx.fillRect(0, H - 12, W, 1);
  if (Math.floor(tony.t * 2) % 2) { ctx.fillStyle = "#ffffff"; ctx.textAlign = "center"; ctx.fillText("INSERT  COIN", W / 2, H - 2); }
}
function tonyTick(dt) {
  if (arcade.on) (TONY_GAMES[arcade.i][0] === "ASTEROIDS" ? asTick : siTick)(Math.min(dt, 0.05));                           // Tony, the fans, the neon, the oven's glow, and (anyone near) the games' attract screens
  tony.clerk?.tick(dt, 0);
  const near = Math.hypot(player.x - 17, player.z - 4) < 16; if (!near) return;
  tony.t = (tony.t || 0) + dt;
  for (const f of tony.fans || []) f.rotation.y += dt * 4;
  const open = tonyOpen(); for (const m of tony.neon || []) m.opacity = open ? 0.9 + 0.1 * Math.sin(tony.t * 31) * (Math.random() < 0.02 ? 4 : 0.2) : 0.12;
  tony.mouth?.material.color.setHSL(0.07, 1, open ? 0.5 + 0.06 * Math.sin(tony.t * 7) + 0.04 * Math.sin(tony.t * 17) : 0.25);
  for (const s of tony.screens || []) {
    if ((s.t -= dt) > 0) continue; s.t = 0.1;
    if (arcade.on && tony.screens.indexOf(s) === arcade.i) continue;   // (being played: the game draws it)
    if (s.name === "ASTEROIDS") { s.att ||= { rocks: [3, 3, 2, 2, 1, 1].map(z => asRock(Math.random() * AS.W, Math.random() * AS.H, z)), score: 0 }; for (const r of s.att.rocks) { r.x += r.vx * 0.1; r.y += r.vy * 0.1; r.a += r.rot * 0.1; asWrap(r); } asDraw(s.att, true); continue; }
    const ctx = s.cv.getContext("2d"), W2 = 256, H2 = 192; ctx.fillStyle = "#05050c"; ctx.fillRect(0, 0, W2, H2);
    if (s.name === "SPACE INVADERS") { invadersFrame(ctx, s, W2, H2); s.tex.needsUpdate = true; continue; }
    ctx.fillStyle = "#ffffff"; for (const st of s.stars) { st[1] = (st[1] + st[2] * 3) % H2; ctx.fillRect(st[0], st[1], st[2], st[2]); }
    ctx.textAlign = "center"; ctx.fillStyle = s.glow; ctx.font = "bold 22px Courier New"; ctx.fillText(s.name, W2 / 2, H2 * 0.42);
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Courier New"; if (Math.floor(tony.t * 2) % 2) ctx.fillText("INSERT COIN", W2 / 2, H2 * 0.72);
    ctx.fillText(`HI ${String(Math.max(tony.scores[tony.screens.indexOf(s)], 20000 + tony.screens.indexOf(s) * 7350)).padStart(6, "0")}`, W2 / 2, H2 * 0.14);
    s.tex.needsUpdate = true;
  }
}
function tonyE(what) {                            // E at Tony's: a slice at the counter, a game at a cabinet
  if (what === "order") {
    if (!tonyOpen()) return toast("Tony's is closed. 11 to 11, says the door");
    if (cm.wallet < 1.5) return toast(`A slice is $1.50. You've got ${cmMoney(cm.wallet)}`);
    cm.wallet -= 1.5; cm.day.spent += 1.5; tony.clerk?.setMood("happy");
    toast("Tony: \"Pepperoni, comin' up.\" Hot, greasy, perfect. You eat it standing at the counter", true); cmLog("A slice at Tony's", "", -1.5); return;
  }
  const i = +what.slice(4);
  return arcadeStart(i);                          // (both machines play: see arcadeStart)
}
