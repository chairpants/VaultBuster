// Touchscreen controls (phones / tablets). Phones have no pointer lock and no keyboard, so
// this fakes the lock (the store runs exactly as it does with a mouse captured) and turns
// touches into the same events the store already listens for: a left-thumb stick presses
// WASD (Shift when pushed all the way), dragging on the right looks around, a tap there
// clicks, and the buttons send their keys. At the register a KEYBOARD button brings up the
// phone's own keyboard and feeds what's typed to the terminal.
// Only on touch devices; ?touch=1 forces it on (testing on a desktop).
(() => {
  const forced = /[?&]touch=1\b/.test(location.search);
  if (!forced && !matchMedia("(hover: none) and (pointer: coarse)").matches) return;
  document.documentElement.classList.add("touch");   // (the title screen lists these controls instead of the keys)

  // ---- the fake pointer lock: "locked" = playing, exactly as with a mouse ----
  let lockEl = null;
  Object.defineProperty(Document.prototype, "pointerLockElement", { get: () => lockEl, configurable: true });
  Element.prototype.requestPointerLock = function () { lockEl = this; document.dispatchEvent(new Event("pointerlockchange")); sync(); return Promise.resolve(); };
  Document.prototype.exitPointerLock = function () { lockEl = null; document.dispatchEvent(new Event("pointerlockchange")); sync(); };
  const canvas = () => lockEl || document.querySelector("body > canvas") || document.querySelector("canvas");

  // ---- sending the store its events ----
  const keyOf = code => code.startsWith("Key") ? code.slice(3).toLowerCase() : code.startsWith("Digit") ? code.slice(5) : code === "Space" ? " " : code;
  const key = (type, code, k = keyOf(code)) => dispatchEvent(new KeyboardEvent(type, { code, key: k, bubbles: true, cancelable: true }));
  const tapKey = code => { key("keydown", code); key("keyup", code); };
  const mouse = (type, button) => canvas().dispatchEvent(new MouseEvent(type, { button, bubbles: true, cancelable: true }));
  const look = (dx, dy) => {                     // movementX/Y can't be set from the constructor everywhere: shadow them
    const e = new MouseEvent("mousemove", { bubbles: true });
    Object.defineProperty(e, "movementX", { value: dx }); Object.defineProperty(e, "movementY", { value: dy });
    dispatchEvent(e);
  };

  // ---- the overlay ----
  const css = document.createElement("style");
  css.textContent = `
    #tc, #tcPos { position: fixed; inset: 0; z-index: 30; display: none; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    #tc.on, #tcPos.on { display: block; }
    #tcPos { inset: auto 0 0 0; z-index: 60; }
    #tcMove { position: absolute; left: 0; top: 0; bottom: 0; width: 42%; }
    #tcLook { position: absolute; right: 0; top: 0; bottom: 0; width: 58%; }
    #tcStick { position: absolute; width: 120px; height: 120px; margin: -60px 0 0 -60px; border-radius: 50%; display: none;
      border: 2px solid #fff6; background: #0003; pointer-events: none; }
    #tcStick i { position: absolute; left: 50%; top: 50%; width: 52px; height: 52px; margin: -26px 0 0 -26px; border-radius: 50%; background: #fff8; }
    .tcb { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 50%;
      background: #001f5ccc; color: #ffd400; border: 2px solid #ffd400aa; font: bold 15px Arial, sans-serif; letter-spacing: 1px; }
    .tcb.big { width: 74px; height: 74px; font-size: 22px; } .tcb.mid { width: 56px; height: 56px; } .tcb.sm { width: 44px; height: 44px; font-size: 12px; border-radius: 10px; }
    .tcb.down { background: #ffd400; color: #001f5c; }
    #tcKeys { position: absolute; right: 12px; top: 64px; display: none; flex-wrap: wrap; gap: 6px; width: 196px; justify-content: flex-end; }
    #tcKeys.on { display: flex; } #tcKeys .tcb, #tcPos .tcb { position: static; }
    #tcPos .row { display: flex; gap: 8px; justify-content: center; padding: 8px; background: #000a; }
    #tcPos .tcb { width: auto; min-width: 56px; padding: 0 12px; height: 48px; border-radius: 10px; }
    #tcType { position: fixed; left: -100px; top: 0; width: 10px; height: 10px; opacity: 0; }`;
  document.head.appendChild(css);
  const root = document.createElement("div"); root.id = "tc";
  root.innerHTML = `<div id="tcMove"></div><div id="tcLook"></div><div id="tcStick"><i></i></div><div id="tcKeys"></div>`;
  const posBar = document.createElement("div"); posBar.id = "tcPos";
  posBar.innerHTML = `<div class="row"></div><input id="tcType" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false">`;
  document.body.append(root, posBar);

  // a button: down/up fire on touch start/end, so holding works (hold E on the standee, the stool...)
  function button(parent, label, cls, pos, down, up) {
    const b = document.createElement("div"); b.className = "tcb " + cls; b.textContent = label;
    if (pos) Object.assign(b.style, pos);
    b.addEventListener("touchstart", e => { e.preventDefault(); e.stopPropagation(); b.classList.add("down"); down?.(); }, { passive: false });
    const end = e => { e.preventDefault(); e.stopPropagation(); if (!b.classList.contains("down")) return; b.classList.remove("down"); up?.(); };
    b.addEventListener("touchend", end, { passive: false }); b.addEventListener("touchcancel", end, { passive: false });
    parent.appendChild(b); return b;
  }
  const hold = code => [() => key("keydown", code), () => key("keyup", code)];
  // right thumb: the actions
  button(root, "E", "big", { right: "24px", bottom: "110px" }, ...hold("KeyE"));
  button(root, "Q", "mid", { right: "112px", bottom: "150px" }, ...hold("KeyQ"));
  button(root, "GRAB", "mid", { right: "112px", bottom: "78px" }, () => mouse("mousedown", 0), () => mouse("mouseup", 0));
  button(root, "BACK", "mid", { right: "34px", bottom: "26px" }, () => mouse("mousedown", 2), () => mouse("mouseup", 2));
  button(root, "ITEM", "mid", { right: "180px", bottom: "26px" }, () => canvas().dispatchEvent(new WheelEvent("wheel", { deltaY: 100, bubbles: true })));
  let crouch = false;
  const cr = button(root, "DUCK", "mid", { right: "108px", bottom: "6px" }, () => { crouch = !crouch; key(crouch ? "keydown" : "keyup", "KeyC"); cr.style.outline = crouch ? "3px solid #fff" : ""; });
  // top right: the rest of the keyboard
  button(root, "☰", "sm", { right: "12px", top: "12px" }, () => document.exitPointerLock());
  button(root, "LOG", "sm", { right: "62px", top: "12px" }, () => tapKey("KeyJ"));
  button(root, "⛶", "sm", { right: "112px", top: "12px" }, () => tapKey("KeyF"));
  const keysPanel = root.querySelector("#tcKeys");
  button(root, "KEYS", "sm", { right: "162px", top: "12px" }, () => keysPanel.classList.toggle("on"));
  for (const d of "12345") button(keysPanel, d, "sm", null, () => tapKey("Digit" + d));          // shoplifter calls, the phone, Dana's job priorities
  for (const [l, c] of [["▲", "ArrowUp"], ["▼", "ArrowDown"], ["◀", "ArrowLeft"], ["▶", "ArrowRight"], ["⏎", "Enter"], ["ESC", "Escape"], ["⏯", "Space"], ["+1H", "KeyL"]])
    button(keysPanel, l, "sm", null, () => tapKey(c));

  // ---- left thumb: the stick (it appears wherever you put your thumb down) ----
  const stick = root.querySelector("#tcStick"), knob = stick.firstChild, R = 50;
  let stickId = null, sx = 0, sy = 0, held = new Set();
  const pressDirs = (dx, dy) => {
    const m = Math.hypot(dx, dy), want = new Set();
    if (m > 14) {
      const a = Math.atan2(dy, dx), oct = Math.round(a / (Math.PI / 4));   // 8 ways
      if ([-3, -2, -1].includes(oct)) want.add("KeyW"); if ([1, 2, 3].includes(oct)) want.add("KeyS");
      if ([-1, 0, 1].includes(oct)) want.add("KeyD"); if ([3, 4, -4, -3].includes(oct)) want.add("KeyA");
      if (m > R * 0.95) want.add("ShiftLeft");                                // all the way over: hustle
    }
    for (const c of held) if (!want.has(c)) key("keyup", c);
    for (const c of want) if (!held.has(c)) key("keydown", c);
    held = want;
  };
  const moveZone = root.querySelector("#tcMove");
  moveZone.addEventListener("touchstart", e => {
    e.preventDefault(); if (stickId !== null) return;
    const t = e.changedTouches[0]; stickId = t.identifier; sx = t.clientX; sy = t.clientY;
    Object.assign(stick.style, { display: "block", left: sx + "px", top: sy + "px" }); knob.style.transform = "";
  }, { passive: false });
  moveZone.addEventListener("touchmove", e => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === stickId) {
      let dx = t.clientX - sx, dy = t.clientY - sy; const m = Math.hypot(dx, dy);
      if (m > R) { dx *= R / m; dy *= R / m; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`; pressDirs(t.clientX - sx, t.clientY - sy);
    }
  }, { passive: false });
  const stickEnd = e => { for (const t of e.changedTouches) if (t.identifier === stickId) { stickId = null; stick.style.display = "none"; pressDirs(0, 0); } };
  moveZone.addEventListener("touchend", stickEnd); moveZone.addEventListener("touchcancel", stickEnd);

  // ---- right side: drag to look, tap to click ----
  const LOOK = 1.5;                              // touch px -> mouse px (a drag across the screen is about a half turn)
  const lookZone = root.querySelector("#tcLook"), lt = new Map();
  lookZone.addEventListener("touchstart", e => {
    e.preventDefault();
    for (const t of e.changedTouches) lt.set(t.identifier, { x: t.clientX, y: t.clientY, t0: performance.now(), dist: 0 });
  }, { passive: false });
  lookZone.addEventListener("touchmove", e => {
    e.preventDefault();
    for (const t of e.changedTouches) { const s = lt.get(t.identifier); if (!s) continue;
      const dx = t.clientX - s.x, dy = t.clientY - s.y; s.x = t.clientX; s.y = t.clientY; s.dist += Math.hypot(dx, dy);
      look(dx * LOOK, dy * LOOK); }
  }, { passive: false });
  const lookEnd = e => {
    for (const t of e.changedTouches) { const s = lt.get(t.identifier); lt.delete(t.identifier);
      if (s && e.type === "touchend" && s.dist < 12 && performance.now() - s.t0 < 300) { mouse("mousedown", 0); mouse("mouseup", 0); } }   // a tap: a click
  };
  lookZone.addEventListener("touchend", lookEnd); lookZone.addEventListener("touchcancel", lookEnd);

  // ---- at the register: the phone's keyboard, plus the keys it doesn't have ----
  const posRow = posBar.querySelector(".row"), type = posBar.querySelector("#tcType");
  const posKey = k => dispatchEvent(new KeyboardEvent("keydown", { key: k, code: k.length === 1 ? "" : k, bubbles: true, cancelable: true }));
  button(posRow, "KEYBOARD", "", null, () => { type.value = ""; type.focus(); });
  for (const [l, k] of [["▲", "ArrowUp"], ["▼", "ArrowDown"], ["⌫", "Backspace"], ["ENTER", "Enter"], ["ESC", "Escape"]]) button(posRow, l, "", null, () => posKey(k));
  type.addEventListener("keydown", e => {        // (Android sends "Unidentified" for letters: those come through "input" below)
    e.stopPropagation();
    if (["Enter", "Backspace"].includes(e.key)) { e.preventDefault(); posKey(e.key); }
  });
  type.addEventListener("input", () => { for (const ch of type.value) posKey(ch.toUpperCase()); type.value = ""; });

  // ---- what's showing: the controls while you're playing, the register bar while it's open ----
  const posOpen = () => { const p = document.getElementById("posTerm"); return !!p && !p.hidden; };
  function sync() {
    const pos = posOpen();
    root.classList.toggle("on", !!lockEl && !pos);
    posBar.classList.toggle("on", pos);
    if (!pos && document.activeElement === type) type.blur();
    if (!lockEl && held.size) pressDirs(0, 0);   // (paused mid-stride: let go of the keys)
  }
  setInterval(sync, 250);                         // the register opens and closes on its own schedule
  // paused for the register (it gave the "mouse" back): any touch on the store takes you back in
  addEventListener("touchstart", e => {
    if (!lockEl && !posOpen() && e.target === canvas() && document.getElementById("titleScreen")?.style.display === "none") canvas().requestPointerLock();
  }, { passive: true });
})();
