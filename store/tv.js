// ---------------- hold a tape up to look at it ----------------
let inspecting = false;                      // true = box held up in view, false = carried in hand
let coverZoom = 1;                           // mouse-wheel zoom on the held-up cover (1-6x), reset per pickup
function releaseFromHand() {                 // clears the hand WITHOUT touching the shelf (TV insert / returns drop-off)
  held = null; inspecting = false; handGroup.visible = false; $("holdingTag").style.display = "none";
}
function pickup(tape) {                      // from a shelf slot OR out of the returns bin — either way, into your hand
  const h = tape.fromReturns && holdAlertFor(tape); if (h) toast(`ALERT: ${memberName(h.member)} is waiting on this one: holds shelf`);
  setOnShelf(tape, false);                   // gone from the shelf while it's in your hand
  showTape(tape); inspecting = true;
}
function showTape(tape) {                    // the tape in your hand (fresh pickup, or back out of the inventory)
  held = tape; inspecting = false;
  $("holdingTag").style.display = "block"; $("holdingName").textContent = tapeName(tape);
  $("inspectTitle").textContent = tapeName(tape); $("inspectSec").textContent = tape.newRelease ? `New Releases · ${tape.category}` : tape.category;   // where it goes back
  // embedded shelf art shows instantly; the full-res TMDB version swaps in once
  // it loads (a plain <img> can load cross-origin even from file://). Offline
  // it just stays on the embedded one.
  const art = $("inspectArt"), hiPath = window.VAULT_ART_HI?.[tape.art];
  const mv = tape.category === "MonsterVision";
  const show = src => mv ? stickerize(src, s => { if (held === tape) art.src = s; }) : art.src = src;
  art.src = artUrl(tape.art); show(artUrl(tape.art)); coverZoom = 1; art.style.transform = "";
  if (hiPath) {
    const hi = new Image(); hi.crossOrigin = "anonymous";
    hi.onload = () => { if (held === tape) show(hi.src); };
    hi.src = "https://image.tmdb.org/t/p/w780" + hiPath;
  }
  handBody.material = tape.sideMat || mat.tapeBody;
  loadCoverTexture(tape, t => { handArt.material.map = t; handArt.material.needsUpdate = true; });
  handGroup.visible = true;
}
function putBack() {                         // back into its own shelf slot (aimed at it, or a just-looked-at tape via right-click)
  if (held) {
    shelveCheck(held); held.desens = false; setOnShelf(held, true);   // back on the shelf: tag re-armed
    gainXp("you", "int", held.fromReturns || held.strayFix ? 6 : 3);
    if (held.fromReturns) { held.fromReturns = false; shiftScore(5, "you"); logAct(`Reshelved ${held.title}`, "good", null, 5); }   // a return put away
    if (held.strayFix) { held.strayFix = false; shiftScore(10, "you"); logAct(`Put a misshelved ${held.title} back where it belongs`, "good", null, 10); if (CUSTOMER) cmHelped(held); }
  }
  releaseFromHand();
}

// ---------------- the store TV (plays archive.org streams) ----------------
const video = $("vid"); video.volume = tvSet.volume / 100;
applyTv();                               // saved picture settings (pixelated filter, sharpen kernel), now the texture and the video both exist
const metaCache = {};
const encodePath = p => (p && typeof p === 'string') ? p.split("/").map(encodeURIComponent).join("/") : p;     // same as VaultVision's viewer
function pickFile(meta, hint) {
  const files = meta?.files; if (!files) return null;
  // non-web containers (.mkv/.avi rips) usually have a same-named .mp4 derivative
  const needsDerivative = hint && !/\.(mp4|webm|ogv)$/i.test(hint);
  const derivative = needsDerivative && hint.replace(/\.[^./]+$/, ".mp4");
  return hint
    ? (needsDerivative && files.find(f => f.name === derivative)) || files.find(f => f.name === hint)
    : files.find(f => /\.mp4$/i.test(f.name)) ?? files.find(f => /\.(ogv|webm)$/i.test(f.name));
}
// tape case that lands on the coffee table once something's in the TV —
// automatic: it just shows whatever's currently playing, no pickup/putBack
const tableBoxGroup = new THREE.Group();
tableBoxGroup.position.set(0, 0.368, TV.z - 1.8); tableBoxGroup.rotation.z = -Math.PI / 2;  // lies flat, art facing up
const tableBody = new THREE.Mesh(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d), mat.tapeBody);
const tableArt = new THREE.Mesh(new THREE.PlaneGeometry(TAPE.d, TAPE.h), new THREE.MeshBasicMaterial({ color: 0x333333 }));
tableArt.rotation.y = -Math.PI / 2; tableArt.position.x = -TAPE.w / 2 - 0.001;
tableBoxGroup.add(tableBody, tableArt);
tableBoxGroup.visible = false;
scene.add(tableBoxGroup);
function showTableBox(tape) {
  tableBoxGroup.visible = true;
  tableBody.material = tape.sideMat || mat.tapeBody;
  loadCoverTexture(tape, t => { tableArt.material.map = t; tableArt.material.needsUpdate = true; });
}

let playing = null; // { tape, idx, eps }
async function playEpisode(idx, tape = playing?.tape) {
  if (!tape) return;
  const eps = tape.seasons[0].episodes;
  idx = Math.max(0, Math.min(eps.length - 1, idx));
  playing = { tape, idx, eps };
  tape.tapePos = { ep: idx, t: 0 };          // the tape winds forward as it plays (see the main loop)
  inspecting = false;                        // into the TV — box drops to your side
  const [iaId, epTitle] = eps[idx];
  const bits = epTitle.split(" - ");
  const code = /S\d+E\d+/i.test(bits[1] || "") ? bits[1] + " · " : "";
  const name = code ? bits.slice(2).join(" - ") : bits.slice(1).join(" - ") || epTitle;
  $("nowPlaying").style.display = "block";
  $("nowPlaying").textContent = `Loading: ${tape.title}…`;
  try {
    if (!metaCache[iaId]) metaCache[iaId] = await (await fetch(`https://archive.org/metadata/${iaId}`)).json();
    const fileName = pickFile(metaCache[iaId], eps[idx][2]);
    if (!fileName) throw new Error("no playable file on archive.org");
    const fileStr = typeof fileName === 'string' ? fileName : fileName.name;
    video.crossOrigin = "anonymous";
    video.src = `https://archive.org/cors/${iaId}/${encodePath(fileStr)}`;
    video.load();
    await video.play();

    miniScreens.forEach(m => m.material = videoMat); // every screen shows the tape
    tvLight.base = 1;
    $("nowPlaying").textContent = `Now Playing: ${tape.title} — ${code}${name}`;
    tvOsd(`PLAY ▶ ${code.replace(" · ", "")}`.trim(), 4);
  } catch (err) {
    $("nowPlaying").textContent = `⚠ ${err.message}`;
  }
}
function eject() {
  const tape = playing?.tape;
  video.pause(); video.removeAttribute("src"); video.load();
  playing = null; tvLight.base = 0;
  miniScreens.forEach(m => m.material = screensaverMat);   // back to the bouncing-logo screensaver
  $("nowPlaying").style.display = "none";
  tableBoxGroup.visible = false;
  if (tape) {                              // the tape comes back out into your hand, not the shelf
    if (invMakeRoom()) pickup(tape);         // whatever you were holding slides into the inventory
    else { returnBin.push(tape); refreshReturnsBin(); }   // hands full (9 items): it goes to Returns instead
  }
}
function togglePause() {
  if (!playing || !video.src) return;
  video.paused ? video.play().catch(() => {}) : video.pause();
  if (!video.paused) tvOsd("PLAY ▶", 2);
}
function stepEpisode(d) { if (playing) playEpisode(playing.idx + d, playing.tape); }
video.addEventListener("ended", () => stepEpisode(1));
function setLamp(l, on) {
  l.userData.on = on ? LAMP_ON : 0;
  l.intensity = l.userData.on;
  l.userData.shadeMat.emissiveIntensity = on ? SHADE_GLOW : 0;
  const b = l.userData.bulbMat; b.color.copy(on ? b.userData.onColor : b.userData.offColor);
  l.userData.pool.visible = on;
}
function onE() {
  if (scrub || ladder.fix || roof.climb) return;   // busy mopping / sweeping / up at a light / on the roof ladder
  if (CUSTOMER && !seated && !player.onRoof && cmE()) return;   // as a customer: the staff, the locked doors, the register (see cmE)
  if (golf.on) { if (golf.st === "idle") golfEnd(); return; }
  if (aimRoofLadder) { roofClimb(player.onRoof ? -1 : 1); return; }
  if (aimGolf) { golfStart(); return; }
  if (aimCine === "proj") { roof.cine.on = !roof.cine.on; return; }
  if (aimCine === "vcr") { vcrUse(); if (playing) roof.cine.on = true; return; }   // (a tape in: the projector comes on with it)
  if (player.onRoof && !seated && !aimCouch) return;   // (up there, past this: only the lawn chairs)
  if (ladder.on) { if (aimDead) ladder.fix = { d: aimDead, t: 0 }; else ladderDown(); return; }
  if (onStool) { stoolPush(); return; }
  if (aimStool && !stool.by) { stoolSit(); return; }
  if (seated) {                             // E always stands you up
    player.x = stoodAt.x; player.z = stoodAt.z; player.yaw = stoodAt.yaw; seated = false; return;
  }
  if (aimCouch) {
    stoodAt = { x: player.x, z: player.z, yaw: player.yaw };
    seatAt = aimSeatObj || SEATS.reduce((a, s) => Math.abs(s.x - aimSeatX) < Math.abs(a.x - aimSeatX) ? s : a);
    seated = true; player.yaw = (seatAt.ry || 0) + Math.PI; player.pitch = 0;   // looking the way the seat faces
    return;
  }
  if (cutout.carried) { cutoutPutDown(); return; }
  if (stool.carried) { stoolPutDown(); return; }
  if (ladder.state === "carried") { if (aimLadderHome) ladderStore(); else ladderPutDown(); return; }
  if (boxCarry.length) { if (aimCupboard) boxUnpack(); else if (aimBox) boxPick(aimBox); return; }   // arms full of boxes
  if (bagCarry.length) { if (aimChute) chuteDrop(); else if (aimBin) binBag(aimBin); else if (aimBag) bagPickUp(aimBag); else if (aimDoor) toggleDoor(aimDoor); else if (aimSwitch) flipSwitch(aimSwitch); return; }   // hands full of trash
  if (aimBin) { binBag(aimBin); return; }
  if (aimBag) { bagPickUp(aimBag); return; }
  if (aimChute) { chuteDrop(); return; }
  if (aimStray) { if (invMakeRoom()) { const s = aimStray; strayTake(s); s.copy.strayFix = true; showTape(s.copy); invSync(); } return; }
  if (aimBox) { boxPick(aimBox); return; }
  if (aimCupboard) { stockTake(aimCupboard); return; }
  if (aimStockSlot) { stockPlace(aimStockSlot); return; }
  if (aimMess) {
    const m = aimMess, need = MESS_TOOL[m.kind];
    if (!messCan(m)) { toast(`That needs the ${TOOLS[need].label}: it's in the janitor's closet`); return; }
    if (need) { scrubStart(m); return; }           // the mop / sweeper: worked over (toolTick), cleaned at the end
    messClean(m);
    if (has("you", "con", 10)) for (const o of messes.filter(o => messCan(o) && Math.hypot(o.x - m.x, o.z - m.z) < 3)) messClean(o);   // Neat Freak: sweep up around it too
    return;
  }
  if (aimTool) { if (toolHeld === aimTool) toolReturn(); else if (toolHeld) toast(`Put the ${TOOLS[toolHeld].label} back first`); else toolTake(aimTool); return; }
  if (aimLadder) { if (ladder.state === "stored") ladderPickUp(); else ladderClimb(); return; }
  if (aimDead) { toast(ladder.state === "placed" ? "Set the step ladder up under it and climb up" : "You'll need the step ladder: it's in the janitor's closet"); return; }
  if (postitHeld && (aimPhone || aimPostit || aimNotepad)) { postitPutBack(); return; }
  if (aimPostit) { postitCall(aimPostit); return; }   // (a tap; the keyboard's hold-or-tap goes through keyup)
  if (aimNotepad) { toast("Look up an overdue member on the register (messages) and it goes on a post-it by the phone", true); return; }
  if (aimPhone) { phoneAnswer(); return; }
  if (aimBoard) { boardOpen(); return; }
  if (aimToilet) { if (bath.flushT <= 0) { bath.flushT = 6; window.VaultAmbience?.flush(...bath.toiletAt); } return; }
  if (aimSink) { bath.tap = !bath.tap; bath.stream.visible = bath.tap; window.VaultAmbience?.water("tap", ...bath.sinkAt, bath.tap); return; }
  if (aimTowels) { toast(bath.tap ? "Turn the tap off first" : "You dry your hands", !bath.tap); if (!bath.tap) trashAdd(trashBins.restroom); return; }
  if (aimHolds && held && !inspecting) { holdPlace(held); return; }
  if (aimHolds && !held) { holdPull(); return; }
  if (aimCustomer) { custInteract(aimCustomer); return; }
  if (aimSwitch) { flipSwitch(aimSwitch); return; }
  if (aimEmp && afterClose() && !aimEmp.leaving && aimEmp.state !== "toExit") { sendHome(aimEmp); return; }   // closed: off you go
  if (aimEmp && aimEmp.state === "stoolSit") {   // they're on the stool: a shove, same as your own spins (keep it up and they get dizzy)
    stoolPush(); aimEmp.bored = 0; aimEmp.c.lookAt(null); aimEmp.c.setMood(aimEmp.dizzy > 0.5 ? "meh" : "love"); return;
  }
  if (aimEmp) { withEmp(aimEmp, empToggle); return; }
  if (aimExit && afterClose() && !custs.length) { clockOut(); return; }
  if (aimPrinter && co?.by === "player" && coAct("printer")) return;
  if (aimLock) { setFrontLock(!frontLock.locked); toast(frontLock.locked ? "Front doors locked — no new customers" : "Front doors unlocked — open for business", true); return; }   // stays in your arms if it won't fit there
  if ((aimPOS || aimDrawer) && co?.by === "player" && coAct("register")) return;   // mid-checkout: tap the card / ring it up
  if (aimPOS) { openPOS(); return; }
  if (aimRewinder) { rewinderUse(aimRewinder); return; }
  if (aimBell) { dingBell(); return; }
  if (aimDesens) { padUse(); return; }
  if (aimLamp) { setLamp(aimLamp, !aimLamp.userData.on); return; }   // E on an aimed lamp flips just that one
  if (aimFlap) { toggleFlap(); return; }
  if (aimDoor) { toggleDoor(aimDoor); return; }
  if (aimCooler) { coolerOpen = !coolerOpen; return; }
  if (aimTrash) {
    if (postitHeld) { postitToss(aimTrash); return; }
    if (heldSnack) dropSnack(true); else if (heldPopcorn) dropPopcorn(); else return;
    trashAdd(aimTrash, 1);
    if (aimTrash.id === "lobby") trashFlapT = 0.5; return;   // swing the flap
  }
  if (aimReturns && held) {                  // drop the tape in hand off (taking one out is a click, like a shelf)
    held.fromReturns = held.strayFix = false; returnBin.push(held); releaseFromHand(); refreshReturnsBin();
    return;
  }
  if (aimTV) { vcrUse(); return; }           // must actually be looking at the screen
  if (biteAnim > 0) return;                  // still mid-bite: finish chewing first
  if (heldPopcorn) eatPopcorn();             // nothing else aimed: E eats a handful (or the single piece)
  else if (heldSnack) consumeSnack();        // ...or a bite / sip of whatever snack or drink you're holding
}
function vcrUse() {                          // E on the TV or a VCR (the store's, the theater's, the roof's: one tape, every screen)
  if (held) {
    const tape = held, old = playing?.tape;
    playEpisode(tape.tapePos?.ep || 0, tape);   // it plays from wherever it's wound to (the episode — archive.org can't seek)
    releaseFromHand();                     // the tape leaves your hand...
    showTableBox(tape);                    // ...and its case lands on the coffee table
    if (old) {                             // swap: the tape that was in the VCR comes out into your inventory
      if (invMakeRoom()) showTape(old); else { returnBin.push(old); refreshReturnsBin(); }   // (9 items already: Returns)
    }
  }
  else if (playing) eject();
}
// TV light colors: every 150ms the screen canvas (already cropped,
// letterboxed and filtered — exactly what's on the glass) is shrunk to 24x18
// and averaged into the 3x3 zones the shader lights with; the main loop eases
// toward each sample so the room doesn't visibly step between them
const glowCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
glowCtx.canvas.width = 24; glowCtx.canvas.height = 18;
const tvTmp = new THREE.Color();
setInterval(() => {
  if (!tvLight.base) return;
  try {
    glowCtx.drawImage(videoCanvas, 0, 0, 24, 18);
    const d = glowCtx.getImageData(0, 0, 24, 18).data, sum = new Float32Array(27);
    for (let y = 0; y < 18; y++) for (let x = 0; x < 24; x++) {
      const z = ((y / 6 | 0) * 3 + (x / 8 | 0)) * 3, p = (y * 24 + x) * 4;
      sum[z] += d[p]; sum[z + 1] += d[p + 1]; sum[z + 2] += d[p + 2];
    }
    for (let z = 0; z < 27; z += 3) {           // pixels are sRGB; the shader works in linear
      tvTmp.setRGB(sum[z] / 12240, sum[z + 1] / 12240, sum[z + 2] / 12240, THREE.SRGBColorSpace);   // 48 px x 255
      tvZoneTarget[z] = tvTmp.r; tvZoneTarget[z + 1] = tvTmp.g; tvZoneTarget[z + 2] = tvTmp.b;
    }
  } catch { /* tainted frame: keep the last colors */ }
}, 150);

