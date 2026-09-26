// VaultBuster — a first-person 90s video store. Tapes come from catalog.json
// (built from the VaultVision library by build.mjs) and play on the in-store
// CRT via archive.org streams, exactly like VaultVision's viewer does.
// Classic script (not a module) so it also runs from a file:// page;
// index.html's inline module sets window.THREE / window.mergeGeometries first.
const artUrl = a => (window.VAULT_ART && window.VAULT_ART[a]) || a;  // embedded covers when file://

// ---------------- palette / constants ----------------
const BLUE = 0x00349c, BLUE_DK = 0x001f5c, YELLOW = 0xffd400;
const STORE = { x: 11, z: 28, h: 3.6 };            // interior half-width / depth / height
const BAY = { len: 1.6, rows: 4, perRow: 11, depth: 0.55, top: 0.25, h: 2.0, boardY: [0.18, 0.63, 1.08, 1.53] };
// gondola side profile is a blunted wedge: vertical back (shared with the
// face behind), sloped front — depth at the floor, top at BAY.h
const frontAt = (y, spec = BAY) => spec.depth - (spec.depth - spec.top) * y / spec.h;
const LEAN = 10 * Math.PI / 180;                  // tapes tip back against each shelf's backing board
const CAP = BAY.rows * BAY.perRow;                 // 44 tapes per bay face (face-out covers)
const SHORT = { ...BAY, rows: 3, boardY: [0.18, 0.63, 1.08], h: 1.5 };   // center + kids gondolas: three rows, low enough to see across the store
const SLOT_W = 0.13, TAPE = { w: 0.032, h: 0.192, d: 0.105 }; // slot = cover + ≤1/4-tape spread
// Movies' side wall pulled in from the original symmetric ±STORE.x so its gap
// to the nearest shelf endcap (-4.76) matches TV Shows' gap to its wall
// (2.98, from its endcap at 8.02) — see the aisle-layout section for that math.
// Right/back/front-right stay at the original STORE.x scale.
const WALL_L = -7.74;
const WALL_SHIFT = WALL_L + STORE.x;       // how far the movie-side wall (and everything anchored to it) moves in, ~3.26
// back of house: a block built on behind the store's back wall at the TV Shows
// end — a hallway along the back wall, a breakroom and a restroom off it, and a
// (locked, for now) door at the hall's far end onto the space behind the lounge
const BOH = { x0: 2, z1: 33, hallZ: 29.8, splitX: 8.3, h: 2.7 };   // west wall, rear wall, hall/rooms wall, breakroom|restroom wall, ceiling height
const DOOR_W = 1.1, DOOR_H = 2.13;          // opening; tops out just under the store's blue wall stripe
const BOH_DOORS = { store: 9.7, breakroom: 5.0, restroom: 9.65, future: 28.9 };   // opening centers along their walls
const BOH_OPENING_W = 1.8;                  // the store → hall opening: wide and doorless, just a cased opening
// cooler stock, shelf by shelf (see the cooler): r/h in meters; glass = bottle
// color + opacity, label = [background, text]. Grabbing one hands you that unit.
const DRINK_PRODUCTS = [
  { name: "AQUA VAULT", kind: "Water", shape: "bottle", r: 0.033, h: 0.215, glass: 0xdff3ff, opacity: 0.35, cap: 0x2a7de1, label: ["#ffffff", "#2a7de1"] },
  { name: "VAULT COLA", kind: "Soda", shape: "bottle", r: 0.034, h: 0.23, glass: 0x2b120a, opacity: 0.95, cap: 0xd21f26, label: ["#d21f26", "#ffffff"] },
  { name: "LEMON FIZZ", kind: "Soda", shape: "bottle", r: 0.034, h: 0.23, glass: 0xc9f29a, opacity: 0.55, cap: 0x2e9e3a, label: ["#2e9e3a", "#fff36b"] },
  { name: "GOLD CROWN", kind: "Beer", shape: "longneck", r: 0.031, h: 0.235, glass: 0x5a2a0a, opacity: 0.93, cap: 0xc9a227, label: ["#f3e6c4", "#9c1c1c"] },
  { name: "VALLEY PILS", kind: "Beer", shape: "longneck", r: 0.031, h: 0.235, glass: 0x1f5a2a, opacity: 0.9, cap: 0xb8bcc2, label: ["#ffffff", "#1f5a2a"] },
  { name: "VOLT", kind: "Energy drink", shape: "can", r: 0.029, h: 0.157, label: ["#111111", "#7dff3a"] },
  { name: "RUSH", kind: "Energy drink", shape: "can", r: 0.029, h: 0.157, label: ["#1b4fd6", "#e6e9ee"] },
  { name: "VAULT COLA", kind: "Soda", shape: "can", r: 0.033, h: 0.122, label: ["#d21f26", "#ffffff"] },
  { name: "ORANGE BLAST", kind: "Soda", shape: "can", r: 0.033, h: 0.122, label: ["#ff7a00", "#ffffff"] },
  { name: "ROOT BEER", kind: "Soda", shape: "can", r: 0.033, h: 0.122, label: ["#5a2d14", "#f3d9a4"] },
];
// snack rack stock — each its own shape and size (meters); the rack lays them
// out in this order (see the snack center), and grabbing one hands you that item
const SNACK_PRODUCTS = [
  { name: "FRUIT POP", color: "#e76f51", shape: "bag", w: 0.17, h: 0.23, d: 0.07 },
  { name: "BLUE RAZZ", color: "#457b9d", shape: "bag", w: 0.14, h: 0.2, d: 0.06 },
  { name: "GRAPE ZAP", color: "#8e44ad", shape: "tube", w: 0.075, h: 0.21, d: 0.075 },
  { name: "LICORICE", color: "#b5172a", shape: "box", w: 0.055, h: 0.22, d: 0.03 },
  { name: "CHOC BOMB", color: "#6b3e26", shape: "box", w: 0.1, h: 0.14, d: 0.035 },
  { name: "RED HOTZ", color: "#e63946", shape: "box", w: 0.07, h: 0.1, d: 0.028 },
  { name: "STARBITES", color: "#f4a300", shape: "bar", w: 0.16, h: 0.045, d: 0.016 },
  { name: "MINT CHILL", color: "#2a9d8f", shape: "gum", w: 0.075, h: 0.028, d: 0.016 },
];
const ORDER = ["Comedy", "Action & Adventure", "Sci-Fi & Fantasy", "Horror", "Drama",
  "Family & Kids", "Holiday", "Music", "Animation", "Anime", "Kids & Educational",
  "Sitcoms", "Classic Sitcoms", "Drama & Adventure", "Horror & Anthology",
  "Sketch Comedy & Late Night", "Broadcast Blocks", "Reality TV"];

// ---------------- boot ----------------
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1b2b4d, 24, 60);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120);
camera.rotation.order = "YXZ";
const EXTERIOR_LAYER = 2;                  // exterior meshes + moonlight live only here, so interior lights never touch them
camera.layers.enable(EXTERIOR_LAYER);      // camera still needs to see layer 2, just doesn't light it any differently
let setExteriorDay;                        // (isDay) => ... — street lamps and lot lights on/off; wired up below, called from the time of day
let setSky = () => {};                     // (color) => ... — sky + backdrop
let exteriorTick = () => {};               // (dt) => ... — per-frame exterior animation (the lot lights warming up); wired up below
const exteriorClouds = [];                 // drifted a little each frame, see the main loop
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ---------------- TV light (shader side) ----------------
// The big screen lights the room as a 3x3 grid of colored patches (one per
// region of the picture), each with real cosine falloff at the screen and at
// the surface — so it reaches every wall and the ceiling, fading with
// distance, instead of a point light's few-feet bubble. Shadows come from a
// visibility volume baked once at startup against box proxies (see
// bakeTvVis): per voxel, how much of the screen's left/center/right third it
// can see. Patched into every Lambert/Phong material; the uniform objects
// are shared by reference, so one write per frame feeds every material.
const TVU = {
  uTvGain: { value: 0 }, uTvAmb: { value: new THREE.Color(0) }, uTvCell: { value: 0 },
  uTvZoneP: { value: new Float32Array(27) }, uTvZoneC: { value: new Float32Array(27) },
  uTvVis: { value: null }, uTvVolMin: { value: new THREE.Vector3() }, uTvVolSize: { value: new THREE.Vector3(1, 1, 1) },
  uTvRoom: { value: new THREE.Vector4() },   // room x0, x1, ceiling, screen-plane z (front wall is z 0)
  // room lighting (see ROOM_FRAG): switchable zones, daylight through the glass, and the outdoors
  uZone: { value: new THREE.Vector4(1, 1, 1, 1) },   // front, aisles, lounge switches (0..1, flicker-aware), daylight 0..1
  uBoh: { value: new THREE.Vector4(1, 1, 1, 0) },    // hall, break room, restroom switches
  uFloorBox: { value: new THREE.Vector4() },         // sales floor: x0, x1, z1 (back wall), ceiling
  uBohBox: { value: new THREE.Vector4() },           // back of house: x0, x1, hall|rooms z, z1
  uBohSplit: { value: new THREE.Vector2() },         // break room | restroom x, ceiling
  uInSky: { value: new THREE.Color() }, uInGround: { value: new THREE.Color() }, uInAmb: { value: new THREE.Color() },
  uInDirC: { value: new THREE.Color() }, uInDir: { value: new THREE.Vector3() },   // one room's worth of fluorescents
  uSunSky: { value: new THREE.Color() }, uSunGround: { value: new THREE.Color() }, uSunC: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() },
  uMoonSky: { value: new THREE.Color() }, uMoonGround: { value: new THREE.Color() }, uMoonC: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3() },
  uDayC: { value: new THREE.Color() }, uNightC: { value: new THREE.Color() },       // what comes in through the storefront glass by day / by night
};
// Room lighting, per fragment, by where it is (world space): no light objects,
// so it costs the same however many zones there are, and it stops dead at the
// walls — a switched-off break room is dark even with the store lit next door.
// The sales floor is three switch zones along z, blended over ~2 m where they
// meet; daylight falls in through the storefront glass and fades toward the
// back; outside the building it's sun, moon or somewhere in between
const ROOM_FRAG = `
{
  vec3 rN = inverseTransformDirection(normal, viewMatrix), P = vTvPos;
  vec3 fl = mix(uInGround, uInSky, 0.5 * rN.y + 0.5) + uInAmb + uInDirC * max(dot(rN, uInDir), 0.0);
  float day = uZone.w;
  vec3 rl;
  if (P.x > uFloorBox.x && P.x < uFloorBox.y && P.z > -0.05 && P.z < uFloorBox.z && P.y < uFloorBox.w) {
    float w1 = 1.0 - smoothstep(9.0, 11.0, P.z), w3 = smoothstep(18.0, 20.0, P.z), w2 = max(0.0, 1.0 - w1 - w3);
    float win = exp(-P.z / 9.0);                       // nearer the glass, the more of the outside there is
    float facing = 0.75 + 0.35 * max(-rN.z, 0.0) + 0.2 * max(rN.y, 0.0);   // faces turned toward the windows / up catch more
    rl = (uZone.x * w1 + uZone.y * w2 + uZone.z * w3) * fl
       + (day * uDayC + (1.0 - day) * uNightC) * (0.42 + 0.9 * win) * facing;
  } else if (P.x > uBohBox.x && P.x < uBohBox.y && P.z >= uFloorBox.z && P.z < uBohBox.w && P.y < uBohSplit.y + 0.05) {
    float lvl = P.z < uBohBox.z ? uBoh.x : (P.x < uBohSplit.x ? uBoh.y : uBoh.z);
    rl = (0.03 + 0.97 * lvl) * fl;                    // no windows back here: off is dark
  } else {
    vec3 sun = mix(uSunGround, uSunSky, 0.5 * rN.y + 0.5) + uSunC * max(dot(rN, uSunDir), 0.0);
    vec3 moon = mix(uMoonGround, uMoonSky, 0.5 * rN.y + 0.5) + uMoonC * max(dot(rN, uMoonDir), 0.0);
    rl = mix(moon, sun, day);
  }
  reflectedLight.indirectDiffuse += rl * BRDF_Lambert(diffuseColor.rgb);
}
`;
const TV_FRAG = `
if (uTvGain > 0.0 && vTvPos.x > uTvRoom.x && vTvPos.x < uTvRoom.y && vTvPos.y < uTvRoom.z && vTvPos.z > 0.0 && vTvPos.z < uTvRoom.w) {
  vec3 tvN = inverseTransformDirection(normal, viewMatrix);
  vec3 tvUvw = (vTvPos + tvN * uTvCell - uTvVolMin) / uTvVolSize;   // nudged off the surface so it doesn't read its own voxel
  vec3 tvV = all(greaterThan(tvUvw, vec3(0.0))) && all(lessThan(tvUvw, vec3(1.0))) ? texture(uTvVis, tvUvw).rgb : vec3(1.0);
  vec3 tvE = vec3(0.0);
  for (int k = 0; k < 9; k++) {
    vec3 L = uTvZoneP[k] - vTvPos; float d2 = dot(L, L); L *= inversesqrt(d2);
    // screen faces -z, so L.z is the emitter-side cosine; +0.1 softens the patch up close
    tvE += uTvZoneC[k] * (tvV[k % 3] * max(L.z, 0.0) * max(dot(tvN, L), 0.0) / (d2 + 0.1));
  }
  vec3 tvC = vTvPos - uTvZoneP[4];   // fake bounce: a dim screen-tinted fill so shadows aren't pitch black
  reflectedLight.directDiffuse += (uTvGain * tvE + uTvAmb / (1.0 + 0.04 * dot(tvC, tvC))) * BRDF_Lambert(diffuseColor.rgb);
}`;
for (const M of [THREE.MeshLambertMaterial, THREE.MeshPhongMaterial]) M.prototype.onBeforeCompile = shader => {
  Object.assign(shader.uniforms, TVU);
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying vec3 vTvPos;")
    .replace("#include <project_vertex>", `#include <project_vertex>
      vec4 tvWp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        tvWp = instanceMatrix * tvWp;
      #endif
      vTvPos = (modelMatrix * tvWp).xyz;`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>
      uniform float uTvGain, uTvCell; uniform vec3 uTvAmb, uTvVolMin, uTvVolSize; uniform vec4 uTvRoom;
      uniform vec3 uTvZoneP[9], uTvZoneC[9]; uniform highp sampler3D uTvVis; varying vec3 vTvPos;
      uniform vec4 uZone, uBoh, uFloorBox, uBohBox; uniform vec2 uBohSplit;
      uniform vec3 uInSky, uInGround, uInAmb, uInDirC, uInDir, uSunSky, uSunGround, uSunC, uSunDir, uMoonSky, uMoonGround, uMoonC, uMoonDir, uDayC, uNightC;`)
    .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + ROOM_FRAG + TV_FRAG);
};

const canvas = renderer.domElement;
const $ = id => document.getElementById(id);

// ---------------- selective bloom ----------------
// Only things explicitly marked with BLOOM_LAYER actually glow (CRT/TV
// screens, marquee bulbs, lamp shades) — genre signs, endcap tags and other
// unlit signage stay off this layer, so they never bloom no matter how bright
// their flat color is. Standard three.js selective-bloom recipe: render the
// scene once with everything NOT on the bloom layer blacked out and blur that,
// then render the real scene and additively composite the blurred glow on top.
const BLOOM_LAYER = 1;
const bloomLayer = new THREE.Layers(); bloomLayer.set(BLOOM_LAYER);
const darkMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
const hiddenMaterials = new Map();
function glow(obj) { obj.layers.enable(BLOOM_LAYER); return obj; }   // mark a mesh as a real light source

const renderScene = new RenderPass(scene, camera);
// subtle by default (lights on) — applyLighting() turns it up a bit for the dark
const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.28, 0.3, 0.4);
const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);
const mixPass = new ShaderPass(new THREE.ShaderMaterial({
  uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.renderTarget2.texture } },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }",
  fragmentShader: `varying vec2 vUv; uniform sampler2D baseTexture; uniform sampler2D bloomTexture;
    void main(){ gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv); }`,
}), "baseTexture");
mixPass.needsSwap = true;
const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScene);
finalComposer.addPass(mixPass);
finalComposer.addPass(new OutputPass());
const clearMaterial = new THREE.MeshBasicMaterial({ visible: false });   // see-through overlays (screen glass) mustn't black out the glow behind them
function renderWithBloom() {
  scene.traverse(o => {
    if (o.isMesh && !bloomLayer.test(o.layers)) { hiddenMaterials.set(o, o.material); o.material = o.userData.clearToBloom ? clearMaterial : darkMaterial; }
  });
  bloomComposer.render();
  hiddenMaterials.forEach((m, o) => o.material = m);
  hiddenMaterials.clear();
  finalComposer.render();
}

const catalog = window.VAULT_CATALOG || [];
// the saved store from last visit (see "save / restore" near the end) — read
// up front because the shelves need it while they're being stocked
const SAVE_KEY = "vaultbuster-save";
const SAVE_V = 3;                            // v1 keyed tapes by id (every season of a show shares it); v2 by catalog position (shifts when tapes are added)
const SAVE = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s?.v === SAVE_V ? s : null; } catch { return null; } })();
// a copy's stable id across reloads: "<tape id>#<season>:<n>", n = its place in
// [tape, ...tape.copies] (shelving is deterministic, so n holds every load).
// id + season is unique per tape; the id alone isn't (every season of a show shares it)
const titleOfCopy = c => Object.hasOwn(c, "copies") || Object.getPrototypeOf(c) === Object.prototype ? c : Object.getPrototypeOf(c);
const tapeKey = t => `${t.id}#${t.season ?? ""}`;
let byTapeKey = null;                        // tape key -> tape, built on first use
const copyKey = c => { const t = titleOfCopy(c); return `${tapeKey(t)}:${[t, ...(t.copies || [])].indexOf(c)}`; };
const copyByKey = k => { const i = k.lastIndexOf(":"), t = (byTapeKey ||= new Map(catalog.map(t => [tapeKey(t), t]))).get(k.slice(0, i)); return t && [t, ...(t.copies || [])][+k.slice(i + 1)]; };
// ---- be kind, rewind ----
// Every physical copy remembers where its tape is wound to: copy.tapePos =
// { ep, t } (episode index, seconds in), updated while it plays and kept
// through eject / inventory / returns / reloads. It goes back in the VCR at
// that episode. Shelving a tape that isn't rewound docks your pay
// (REWIND_FINE, set once pay exists) and the tape snaps back to the start.
const REWIND_FINE = 0;                       // $ docked per unrewound tape shelved — ponytail: 0 until pay is wired up
const payLedger = [];                        // { what, title, fine, at, ep, t } — penalties so far (saved)
const isRewound = c => !c.tapePos || (c.tapePos.ep === 0 && c.tapePos.t < 1);
// how far through the whole tape it's wound, 0..1: episodes played + the part
// of the current one (d = its length, recorded while it played; a movie-ish
// guess if it never got that far). Drives the inventory wind bar, and later
// how long a rewind takes / how big the pay dock is
function windFrac(c) {
  const p = c.tapePos; if (!p || isRewound(c)) return 0;
  const n = c.seasons[0].episodes.length, d = p.d || (n > 1 ? 1500 : 6000);
  return Math.min(1, (p.ep + Math.min(1, p.t / d)) / n);
}
function shelveCheck(c) {                    // called as a tape goes back on its shelf
  if (isRewound(c)) return;
  payLedger.push({ what: "unrewound", title: c.title, fine: REWIND_FINE, at: Date.now(), ...c.tapePos });
  c.tapePos = null;                          // instantly rewound
  toast(`Not rewound: ${c.title}${REWIND_FINE ? ` · -$${REWIND_FINE.toFixed(2)} pay` : ""} · be kind, rewind!`);
}
// set a tape's wind to a fraction of the whole tape (the inverse of windFrac)
function setWindFrac(c, f) {
  const n = c.seasons[0].episodes.length, d = c.tapePos?.d || (n > 1 ? 1500 : 6000);
  if (f <= 0) { c.tapePos = null; return; }
  const x = Math.min(1, f) * n, ep = Math.min(n - 1, Math.floor(x));
  c.tapePos = { ep, t: (x - ep) * d, d: c.tapePos?.d };
}
// the counter rewinder: E puts the tape in hand in; it winds back over up to
// REWIND_SECS (scaled by how far it's wound) with a motor whir, clunks when
// done, and E takes it out — early, it comes out only partly rewound
const REWIND_SECS = 10;
function rewinderLoad(tape) {
  Object.assign(rewinder, { tape, f0: windFrac(tape), t: 0, done: false });
  rewinder.dur = Math.max(1, rewinder.f0 * REWIND_SECS);
  rewinder.tapeMesh.material = tape.sideMat || mat.tapeBody; rewinder.tapeMesh.visible = true;
  if (rewinder.f0 > 0) rewinderSound(true); else rewinderFinish(false);
}
function rewinderFinish(clunk = true) {
  rewinder.done = true; rewinderSound(false); rewinder.led.material.color.set(0x2bff6a);
  if (clunk) try {                            // the eject thunk
    const ac = rewinder.ac ||= new AudioContext(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = "square"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.13);
  } catch {}
}
function rewinderSound(on) {
  if (!on) { rewinder.snd?.(); rewinder.snd = null; return; }
  rewinder.led.material.color.set(0xff3b1f);
  try {                                       // little motor: a soft hum, tape hiss, and the reel's rattle, speeding up a touch as the tape runs down
    const ac = rewinder.ac ||= new AudioContext(); ac.resume();
    const t = ac.currentTime, end = t + rewinder.dur, out = ac.createGain();
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(0.05, t + 0.2); out.connect(ac.destination);
    const hum = ac.createOscillator(), humF = ac.createBiquadFilter(), humG = ac.createGain();
    hum.type = "sawtooth"; hum.frequency.setValueAtTime(95, t); hum.frequency.linearRampToValueAtTime(125, end);
    humF.type = "lowpass"; humF.frequency.value = 260; humG.gain.value = 0.35;
    hum.connect(humF).connect(humG).connect(out);
    const noise = ac.createBufferSource(), buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noise.buffer = buf; noise.loop = true;
    const hiss = ac.createBiquadFilter(), rattle = ac.createGain(), lfo = ac.createOscillator(), depth = ac.createGain();
    hiss.type = "bandpass"; hiss.Q.value = 0.8; hiss.frequency.setValueAtTime(1400, t); hiss.frequency.linearRampToValueAtTime(1800, end);
    lfo.type = "square"; lfo.frequency.setValueAtTime(9, t); lfo.frequency.linearRampToValueAtTime(14, end);   // the reel's click-click, not a turbine
    rattle.gain.value = 0.35; depth.gain.value = 0.25; lfo.connect(depth).connect(rattle.gain);
    noise.connect(hiss).connect(rattle).connect(out);
    const src = [hum, noise, lfo]; src.forEach(o => o.start());
    rewinder.snd = () => { src.forEach(o => o.stop()); out.disconnect(); };
  } catch {}
}
function rewinderTick(dt) {
  if (!rewinder.tape || rewinder.done) return;
  rewinder.t += dt;
  const p = Math.min(1, rewinder.t / rewinder.dur);
  setWindFrac(rewinder.tape, rewinder.f0 * (1 - p));
  if (p >= 1) rewinderFinish();
}
function rewinderUse() {                      // E on the rewinder
  if (rewinder.tape) {                        // take it out (done, or early)
    if (!invMakeRoom()) { toast("Hands full"); return; }
    const t = rewinder.tape;
    rewinderSound(false); rewinder.tape = null; rewinder.tapeMesh.visible = false; rewinder.led.material.color.set(0x222222);
    showTape(t);
  } else if (held) { const t = held; releaseFromHand(); rewinderLoad(t); }
}
// the counter's service bell: a bright struck-metal ding (a few inharmonic partials, fast attack, long ring)
let bellAc = null;
function dingBell() {
  try {
    const ac = bellAc ||= new AudioContext(), t = ac.currentTime, out = ac.createGain();
    out.gain.value = 0.12; out.connect(ac.destination);
    for (const [f, a, d] of [[2210, 1, 1.6], [5980, 0.35, 0.7], [3470, 0.25, 1.1]]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f; g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d);
    }
  } catch {}
}
// security tags: every copy's is live until run across the counter's
// desensitizer (copy.desens = true), and live again once it's reshelved.
// The gates only alarm on a live tag.
let desensAc = null, desensFlash = 0;
function desensitize(c) {
  if (c.desens) { toast(`${c.title} is already desensitized`); return; }
  c.desens = true; desensFlash = 0.6;
  toast(`Desensitized: ${c.title}`, true);
  try {                                        // the pad's confirm beep-beep
    const ac = desensAc ||= new AudioContext(), t = ac.currentTime;
    for (const [dt, f] of [[0, 1760], [0.11, 2350]]) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = "square"; o.frequency.value = f;
      g.gain.setValueAtTime(0.04, t + dt); g.gain.setValueAtTime(0, t + dt + 0.08); o.connect(g).connect(ac.destination); o.start(t + dt); o.stop(t + dt + 0.09);
    }
  } catch {}
}
let toastTimer = 0;
function toast(text, good = false) {          // red = a problem; good = the store's blue, for confirmations
  const el = document.getElementById("toast"); if (!el) return;
  el.textContent = text; el.style.display = "block"; el.style.background = good ? "var(--bb-blue)" : "";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.display = "none"; }, 3500);
}
// video-store shelving: alphabetical ignoring a leading The/A/An, then seasons
// 1,2,3… with specials (season 0) and uncoded "Episodes" (-1) after the last
const shelfKey = t => t.title.replace(/^(the|an?)\s+/i, "");
const seasonRank = t => (t.season ?? 0) > 0 ? t.season : 1000 - (t.season ?? 0);
window.VAULT_MV?.split(catalog);             // MonsterVision: one broadcast-block tape -> a tape per film (monstervision.js)
// covers.js (fetch-covers.mjs): this season's TMDB poster, else the show's, else the old VaultVision art
// (mv-covers.js adds the MonsterVision films' posters the same way)
for (const t of catalog) {
  const A = window.VAULT_ART || {}, sk = `tmdb/${t.id}-s${t.season}.jpg`, k = `tmdb/${t.id}.jpg`;
  t.art = A[sk] ? sk : A[k] ? k : t.art;
}
catalog.sort((a, b) => shelfKey(a).localeCompare(shelfKey(b), undefined, { numeric: true, sensitivity: "base" })
  || a.id.localeCompare(b.id) || seasonRank(a) - seasonRank(b));
$("enterHint").textContent = "CLICK TO ENTER THE STORE";

// ---------------- canvas texture helpers ----------------
function makeTexture(draw, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (w > 256) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return t;
}
function textPlane(text, w, h, fg = "#ffd400", bg = "#00349c", font = "Arial Black", fs = 90) {
  const t = makeTexture((ctx, W, H) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 8; ctx.strokeRect(6, 6, W - 12, H - 12);
    ctx.fillStyle = fg; ctx.font = `italic 900 ${fs}px ${font}, Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    let f = fs; while (ctx.measureText(text).width > W - 60 && f > 20) { f -= 6; ctx.font = `italic 900 ${f}px ${font}, Arial`; }
    ctx.fillText(text, W / 2, H / 2 + 4);
  }, 1024, Math.round(1024 * h / w));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: t }));
}
function tagPlane(lines, w, lineH) {         // stacked bare white text, faint black outline
  const h = lines.length * lineH;
  const t = makeTexture((ctx, W, H) => {
    ctx.clearRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.fillStyle = "#fff";
    const rh = H / lines.length;
    lines.forEach((text, i) => {
      let f = Math.min(100, rh * 0.8); ctx.font = `bold ${f}px Arial Black, Arial`;
      while (ctx.measureText(text).width > W - 60 && f > 14) { f -= 6; ctx.font = `bold ${f}px Arial Black, Arial`; }
      ctx.lineWidth = Math.max(4, f / 8);
      const y = (i + 0.5) * rh;
      ctx.strokeText(text, W / 2, y); ctx.fillText(text, W / 2, y);
    });
  }, 1024, Math.round(1024 * h / w));
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshLambertMaterial({ map: t, transparent: true }));   // lit by the room, dims in lights-out
}

// carpet, ceiling tiles
const carpetTex = makeTexture((ctx, W, H) => {
  ctx.fillStyle = "#16357a"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() < 0.12 ? "#ffdd55" : (Math.random() < 0.5 ? "#1d4296" : "#0f2a66");
    ctx.globalAlpha = 0.25 + Math.random() * 0.5;
    ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
  }
}, 512, 512);
carpetTex.repeat.set(11, 14);
// drop ceiling: 1.8 x 0.9 m tiles (long side along x — the same size as
// the light fixtures) acoustic tiles, pinhole-dotted, in a solid T-bar grid.
// One canvas = 3.6 m square = 2 x 4 tiles (so the dots don't repeat every
// tile); frames sit on the canvas edges and between tiles, so repeats join into one grid.
// Callers align it to world coordinates (ceilGrid) so light panels can drop
// into real grid slots
const CEIL_TILE = { x: 1.8, z: 0.9 }, CEIL_REP = 3.6;   // tile size, canvas period (both axes)
const ceilTex = makeTexture((ctx, W, H) => {
  const f = 10;                                      // T-bar width, px
  ctx.fillStyle = "#dcd9d0"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 10400; i++) {                  // pinholes/fissures, a few bigger than others
    ctx.fillStyle = Math.random() < 0.5 ? "#b3afa4" : "#c4c0b6";
    const r = Math.random() < 0.85 ? 1.2 : 2;
    ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * H, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#f2f3f4";                          // T-bars: half on each canvas edge, full through the middle
  for (let i = 0; i <= 2; i++) ctx.fillRect(i * W / 2 - f / 2, 0, f, H);   // tile ends every 1.8 m
  for (let i = 0; i <= 4; i++) ctx.fillRect(0, i * H / 4 - f / 2, W, f);   // tile sides every 0.9 m
}, 1024, 1024);
// a ceiling plane spanning x0..x1, z0..z1 (rotated +90° about x, so u runs +x
// and v runs +z): offset so grid lines land on multiples of the tile size
function ceilGrid(tex, x0, x1, z0, z1) {
  tex.repeat.set((x1 - x0) / CEIL_REP, (z1 - z0) / CEIL_REP);
  tex.offset.set(x0 / CEIL_REP, z0 / CEIL_REP);
  return tex;
}

const mat = {
  carpet: new THREE.MeshLambertMaterial({ map: carpetTex }),
  ceil: new THREE.MeshLambertMaterial({ map: ceilTex }),
  wall: new THREE.MeshLambertMaterial({ color: 0xe8ecf2 }),
  stripe: new THREE.MeshLambertMaterial({ color: BLUE }),
  glass: new THREE.MeshLambertMaterial({ color: 0x0a1428, transparent: true, opacity: 0.75 }),
  frame: new THREE.MeshLambertMaterial({ color: 0xf4f4f4 }),
  board: new THREE.MeshLambertMaterial({ color: 0x9aa3ad }),
  upright: new THREE.MeshLambertMaterial({ color: 0x1c4dbb }),
  counter: new THREE.MeshLambertMaterial({ color: BLUE }),
  counterTop: new THREE.MeshLambertMaterial({ color: YELLOW }),
  dark: new THREE.MeshLambertMaterial({ color: 0x14161a }),
  wood: new THREE.MeshLambertMaterial({ color: 0x7a4a22 }),
  tapeBody: new THREE.MeshLambertMaterial({ color: 0x101318 }),
  backing: new THREE.MeshLambertMaterial({ color: 0xeef0f2 }),
  storefront: new THREE.MeshLambertMaterial({ color: 0x8fb8d8, transparent: true, opacity: 0.16 }), // big display glass — barely tinted, meant to be seen through
  mullion: new THREE.MeshLambertMaterial({ color: 0x2a2e35 }),
  sidewalk: new THREE.MeshLambertMaterial({ color: 0x9a9d9f }),
  sidewalkJoint: new THREE.MeshBasicMaterial({ color: 0x6f7274 }),
  pavement: new THREE.MeshLambertMaterial({ color: 0x55595e }),
  road: new THREE.MeshLambertMaterial({ color: 0x2b2d31 }),
  curb: new THREE.MeshLambertMaterial({ color: 0xb9bcc0 }),
  grass: new THREE.MeshLambertMaterial({ color: 0x3f7d3a }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x5b4327 }),
  leaves: new THREE.MeshLambertMaterial({ color: 0x2e6b34 }),
  leaves2: new THREE.MeshLambertMaterial({ color: 0x3a7d3f }),
  bench: new THREE.MeshLambertMaterial({ color: 0x2f5233 }),
  cloud: new THREE.MeshLambertMaterial({ color: 0xf2f4f6, emissive: 0x141b30, emissiveIntensity: 0.4 }), // dim emissive so they don't vanish to black under moonlight
  lineWhite: new THREE.MeshBasicMaterial({ color: 0xe8e8e8 }),
  lineYellow: new THREE.MeshBasicMaterial({ color: 0xe8c33c }),
  aluminum: new THREE.MeshLambertMaterial({ color: 0xc2c6cb }),
};
let panelMats = [];                        // ceiling panel groups, per switch zone — dark when switched off, flicker independently on warm-up
// the light switch zones: three along the sales floor, then the back of house rooms
const LIGHT_ZONES = ["front", "aisles", "lounge", "hall", "breakroom", "restroom"];
const ZONE_NAMES = { front: "front", aisles: "aisle", lounge: "lounge", hall: "back hall", breakroom: "break room", restroom: "restroom" };
const ZONE_LABELS = { front: "FRONT", aisles: "AISLES", lounge: "LOUNGE", hall: "HALL", breakroom: "LIGHTS", restroom: "LIGHTS" };   // printed on the plates
function lightZoneAt(x, z) {
  if (z > STORE.z) return z < BOH.hallZ ? "hall" : x < BOH.splitX ? "breakroom" : "restroom";
  return z < 10 ? "front" : z < 19 ? "aisles" : "lounge";
}
const allLights = [];                      // every light that lights-out kills (base intensity in userData.on)
const aimables = [];                       // E targets: TV screen, couch, lamps, returns counter, snack stand
const aimBlockers = [];                    // solid things you can't reach through: walls, the back of a snack rack
const lampPools = [];                      // side-lamp floor pools — drowned out whenever the overhead lights are on
const lamps = [];                          // the two side lamps — holding L toggles both together
const colliders = [];                      // axis-aligned floor boxes the player can't walk into — walls included
// the Dracula standee: where it stands (x, z, facing ry), its mesh group once
// the PNG has loaded, and its collider — one box, refit wherever it's set down
const cutout = { x: 0, z: 0, ry: 0, g: null, box: { y1: 1.85 }, carried: false };
// the front doors' deadbolt: locked = the sign reads CLOSED and no new customers come in
const frontLock = { locked: false, turn: null, signs: [] };
function cutoutFit(x, z, ry, b) {            // floor box around the board's solid middle + the strut's foot behind it, at any angle
  const c = Math.cos(ry), sn = Math.sin(ry), xs = [], zs = [];
  for (const [lx, lz] of [[-0.4, 0.05], [0.4, 0.05], [-0.4, -0.45], [0.4, -0.45]]) { xs.push(x + lx * c + lz * sn); zs.push(z - lx * sn + lz * c); }
  return Object.assign(b, { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) });
}
const doors = [];                          // hinged interior doors (see makeDoor) — E swings them

// ---------------- store shell ----------------
function box(w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); scene.add(b); return b;
}
function solid(w, h, d, m, x, y, z) { colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, y0: y - h / 2, y1: y + h / 2 }); return box(w, h, d, m, x, y, z); }
// a straight wall from a0 to a1 along x (alongX) or z, centered on `at`, with
// DOOR_H-tall openings at each of `gaps` — a center (door-wide) or { c, w }. Walls are real colliders,
// padded so the player stops 0.5 m from a wall's centerline
const WALL_T = 0.2, WALL_PAD = 0.08;
function wall(a0, a1, at, alongX, h, m, gaps = []) {
  const seg = (b0, b1, y0, y1) => {
    const len = b1 - b0, c = (b0 + b1) / 2, y = (y0 + y1) / 2;
    aimBlockers.push(alongX ? box(len, y1 - y0, WALL_T, m, c, y, at) : box(WALL_T, y1 - y0, len, m, at, y, c));
    if (y0 > 0) return;                       // headers over doors don't block the floor
    const t = WALL_T / 2 + WALL_PAD;
    colliders.push(alongX ? { x0: b0, x1: b1, z0: at - t, z1: at + t, y1: h } : { x0: at - t, x1: at + t, z0: b0, z1: b1, y1: h });
  };
  let a = a0;
  for (const { c, w } of gaps.map(g => typeof g === "number" ? { c: g, w: DOOR_W } : g).sort((p, q) => p.c - q.c)) {
    seg(a, c - w / 2, 0, h);
    seg(c - w / 2, c + w / 2, DOOR_H, h);
    a = c + w / 2;
  }
  seg(a, a1, 0, h);
}
// jamb + head trim around a wall() opening of width W, both faces
// Each piece reaches 5 mm into the opening, so none of its faces sits in the
// same plane as the wall's own cut faces (coplanar faces flicker)
function casing(at, c, alongX, W) {
  const trim = (w, h, x, y) => { if (alongX) box(w, h, WALL_T + 0.04, mat.frame, c + x, y, at); else box(WALL_T + 0.04, h, w, mat.frame, at, y, c + x); };
  const IN = 0.005;
  trim(0.06 + IN, DOOR_H + 0.06, -W / 2 - 0.03 + IN / 2, (DOOR_H + 0.06) / 2);
  trim(0.06 + IN, DOOR_H + 0.06, W / 2 + 0.03 - IN / 2, (DOOR_H + 0.06) / 2);
  trim(W + 0.12, 0.06 + IN, 0, DOOR_H + 0.03 - IN / 2);
}
// A hinged door in a wall() opening. hinge: which end of the opening (-1/+1,
// along the wall) it hangs from; swing: which side (world -1/+1 on the axis
// across the wall) it opens toward; signs: [{ text, side }] plates, side = the
// world side of the wall the plate faces. Closed, it blocks the opening;
// open, it stands ~90° into the room and blocks just its own leaf
function makeDoor({ at, c, alongX, hinge, swing, locked = false, leafMat, signs = [] }) {
  const W = DOOR_W, base = alongX ? 0 : -Math.PI / 2;   // leaf is built along local x; local +z is world +z (alongX) or world -x
  const toLocal = side => alongX ? side : -side;
  const pivot = new THREE.Group();
  if (alongX) pivot.position.set(c + hinge * W / 2, 0, at); else pivot.position.set(at, 0, c + hinge * W / 2);
  pivot.rotation.y = base; scene.add(pivot);
  const lx = -hinge * W / 2;                    // leaf center, pivot-local
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, DOOR_H - 0.02, 0.045), leafMat);
  leaf.position.set(lx, DOOR_H / 2, 0); pivot.add(leaf);
  const hx = -hinge * (W - 0.12);               // hardware sits at the latch edge
  for (const f of [-1, 1]) {
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), mat.aluminum);
    rose.rotation.x = Math.PI / 2; rose.position.set(hx, 0.98, f * 0.028); pivot.add(rose);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.022), mat.aluminum);
    lever.position.set(hx + hinge * 0.05, 0.98, f * 0.045); pivot.add(lever);
  }
  for (const { text, side } of signs) {
    const sg = textPlane(text, 0.42, 0.12, "#fff", "#2a2e35", "Arial", 70);
    sg.material = new THREE.MeshLambertMaterial({ map: sg.material.map });   // lit by the room like the other signs
    const f = toLocal(side);
    sg.position.set(lx, 1.52, f * 0.028); if (f < 0) sg.rotation.y = Math.PI; pivot.add(sg);   // 5 mm proud of the leaf face
  }
  casing(at, c, alongX, W);
  const t = WALL_T / 2 + WALL_PAD, hp = c + hinge * W / 2, sw = swing * W;
  const shut = alongX ? { x0: c - W / 2, x1: c + W / 2, z0: at - t, z1: at + t } : { x0: at - t, x1: at + t, z0: c - W / 2, z1: c + W / 2 };
  const openBox = alongX ? { x0: hp - 0.03, x1: hp + 0.03, z0: Math.min(at, at + sw), z1: Math.max(at, at + sw) }
                         : { x0: Math.min(at, at + sw), x1: Math.max(at, at + sw), z0: hp - 0.03, z1: hp + 0.03 };
  // local z the leaf's free edge heads toward = toLocal(swing); rotating by a
  // moves it to local z = hinge * sin(a) * W/2, so the sign of a follows
  const d = { pivot, base, a: 0, openA: Math.PI / 2 * hinge * toLocal(swing), open: false, locked, rattle: 0, shut, openBox };
  colliders.push(shut);
  leaf.userData.door = d; aimables.push(leaf);
  doors.push(d);
  return d;
}
{
  // interior footprint is asymmetric: movies' side wall (XL) is pulled in from
  // the original -STORE.x; the right/back/front-right stay at the original scale
  const XL = WALL_L, XR = STORE.x, XC = (XL + XR) / 2, XW = XR - XL;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(XW, STORE.z), mat.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, STORE.z / 2); scene.add(floor);
  ceilGrid(ceilTex, XL, XR, 0, STORE.z);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(XW, STORE.z), mat.ceil);
  ceil.rotation.x = Math.PI / 2; ceil.position.set(XC, STORE.h, STORE.z / 2); scene.add(ceil);

  // walls (front wall is mostly glass on either side of the doors, like a
  // real video-store front — low bulkhead, tall storefront glass, header band)
  const Z = STORE.z, H = STORE.h, T = 0.2, KICK = 0.4, HEAD = 2.7;
  const storefront = (x0, x1, z) => {
    const w = x1 - x0, cx = (x0 + x1) / 2;
    box(w, KICK, T, mat.wall, cx, KICK / 2, z);                             // bulkhead
    box(w - 0.06, HEAD - KICK - 0.06, 0.05, mat.storefront, cx, (KICK + HEAD) / 2, z);
    box(w, H - HEAD, T, mat.wall, cx, HEAD + (H - HEAD) / 2, z);            // header
    const segs = Math.max(1, Math.round(w / 2.6));                          // mullions every ~2.6m
    for (let i = 1; i < segs; i++) box(0.06, HEAD - KICK, 0.08, mat.mullion, x0 + i * (w / segs), (KICK + HEAD) / 2, z);
  };
  storefront(XL - 1, -1.8, 0);                                              // front-left (overlaps 1m past XL, hidden)
  storefront(1.8, XR, 0);                                                   // front-right
  box(3.6, H - 2.6, T, mat.wall, 0, 2.6 + (H - 2.6) / 2, 0);                 // above doors
  wall(XL - T / 2, XR + T / 2, Z, true, H, mat.wall, [{ c: BOH_DOORS.store, w: BOH_OPENING_W }]);   // back, with the open way through to the back hall
  wall(0, Z, XL, false, H, mat.wall);                                       // left
  wall(0, Z, XR, false, H, mat.wall);                                       // right
  colliders.push({ x0: XL, x1: XR, z0: -T / 2, z1: T / 2 + WALL_PAD });     // front: glass + closed doors, all solid
  // blue stripe around the walls at eye height — back and sides only; the
  // front is glass now, and a stripe there ran straight across the windows
  [[XC, 2.25, Z - T / 2 - 0.012, XW, 0],
   [XL + T + 0.01, 2.25, Z / 2, T, Z], [XR - T - 0.01, 2.25, Z / 2, T, Z]]
    .forEach(([x, y, z, w, d]) => box(w, 0.22, d, mat.stripe, x, y, z));

  // entrance: aluminum-framed double door, closed — large top & bottom
  // glass lites split by a mid rail, vertical push/pull bars on the
  // meeting edge (real storefront doors swing open there, hinged outboard)
  box(0.12, 2.7, 0.35, mat.frame, -1.86, 1.35, 0.1); box(0.12, 2.7, 0.35, mat.frame, 1.86, 1.35, 0.1); // outer jambs
  box(3.84, 0.12, 0.35, mat.frame, 0, 2.66, 0.1);                                                      // header
  {
    const DW = 1.7, DH = 2.56, DZ = 0.1, DD = 0.06;      // leaf width/height, wall-relative z, rail depth
    const STILE = 0.22, TOPR = 0.12, BOTR = 0.26, MIDR = 0.1, MIDY = DH * 0.54;
    box(0.1, DH, 0.3, mat.aluminum, 0, DH / 2, DZ);      // center astragal, where the two leaves meet
    const door = (cx, handleIn) => {                     // handleIn: which edge (toward center) gets the pull bar
      const gx0 = cx - DW / 2, gx1 = cx + DW / 2;
      box(DW, TOPR, DD, mat.aluminum, cx, DH - TOPR / 2, DZ);           // top rail
      box(DW, MIDR, DD, mat.aluminum, cx, MIDY, DZ);                    // mid rail
      box(DW, BOTR, DD, mat.aluminum, cx, BOTR / 2, DZ);                // bottom (kick) rail
      box(STILE, DH, DD, mat.aluminum, gx0 + STILE / 2, DH / 2, DZ);    // stiles
      box(STILE, DH, DD, mat.aluminum, gx1 - STILE / 2, DH / 2, DZ);
      const lw = DW - STILE * 2;
      const topY0 = MIDY + MIDR / 2, topY1 = DH - TOPR, botY0 = BOTR, botY1 = MIDY - MIDR / 2;
      box(lw, topY1 - topY0, 0.04, mat.storefront, cx, (topY0 + topY1) / 2, DZ);   // large top lite
      box(lw, botY1 - botY0, 0.04, mat.storefront, cx, (botY0 + botY1) / 2, DZ);   // large bottom lite
      const barLen = 0.9, barY = DH * 0.42, barX = handleIn > 0 ? gx1 - 0.16 : gx0 + 0.16, barZ = DZ + DD / 2 + 0.05;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, barLen, 10), mat.aluminum);
      bar.position.set(barX, barY, barZ); scene.add(bar);
      for (const dy of [-barLen / 2 + 0.1, barLen / 2 - 0.1]) {          // standoff brackets, bar → door face
        const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), mat.aluminum);
        bracket.rotation.x = Math.PI / 2;
        bracket.position.set(barX, barY + dy, DZ + DD / 2 + 0.025); scene.add(bracket);
      }
    };
    door(-0.9, 1); door(0.9, -1);
    // deadbolt on the inside of the astragal: a brass plate and a thumb turn
    // (upright = unlocked, flat = locked), and a flip sign hung in the right leaf's glass
    const plate = box(0.07, 0.17, 0.014, mat.aluminum, 0, 1.12, DZ + 0.157);
    const turn = frontLock.turn = box(0.022, 0.075, 0.03, mat.frame, 0, 1.15, DZ + 0.178);
    for (const m of [plate, turn]) { m.userData.frontLock = true; aimables.push(m); }
    for (const [text, fg, bg, open] of [["COME IN — WE'RE OPEN", "#fff", "#1c7c3c", true], ["SORRY — WE'RE CLOSED", "#fff", "#b3202a", false]])
      for (const face of [1, -1]) {                  // both faces: in toward the store, out toward the lot
        const sg = textPlane(text, 0.5, 0.2, fg, bg, "Arial Black", 70);
        sg.position.set(0.9, 1.95, DZ + face * 0.025); if (face < 0) sg.rotation.y = Math.PI;
        sg.visible = open; sg.userData.open = open; scene.add(sg); frontLock.signs.push(sg);
      }
  }

  // back of house: hallway along the back wall, breakroom + restroom off it.
  // Lower drop ceiling than the sales floor, plain walls, no stripe
  const BX0 = BOH.x0, BZ0 = Z, BZ1 = BOH.z1, BH = BOH.h, HZ = BOH.hallZ, SX = BOH.splitX;
  wall(HZ, BZ1 + T / 2, BX0, false, BH, mat.wall);                          // west, rooms part
  wall(BZ0, HZ, BX0, false, BH, mat.wall, [BOH_DOORS.future]);              // west, hall part: the future door
  wall(BZ0, BZ1 + T / 2, XR, false, BH, mat.wall);                          // east
  wall(BX0, XR, BZ1, true, BH, mat.wall);                                   // rear
  wall(BX0, XR, HZ, true, BH, mat.wall, [BOH_DOORS.breakroom, BOH_DOORS.restroom]);   // hall | rooms
  wall(HZ, BZ1, SX, false, BH, mat.wall);                                   // breakroom | restroom
  const vctTex = makeTexture((ctx, W, H) => {   // speckled vinyl composition tile, 8 x 8 30 cm squares per repeat
    const n = 8, s = W / n, cols = ["#d8d2c3", "#cec7b5", "#e1dccf", "#c9c3b4"];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = cols[Math.floor(Math.random() * cols.length)]; ctx.fillRect(x * s, y * s, s, s); }
    for (let i = 0; i < 2200; i++) { ctx.fillStyle = Math.random() < 0.5 ? "rgba(90,80,60,.35)" : "rgba(255,255,255,.4)"; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = 2;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, H); ctx.moveTo(0, i * s); ctx.lineTo(W, i * s); ctx.stroke(); }
  }, 512, 512);
  const bathTex = makeTexture((ctx, W, H) => {  // small white square tile, grey grout, 16 x 16 5 cm tiles per repeat
    const n = 16, s = W / n;
    ctx.fillStyle = "#9ea3a8"; ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { ctx.fillStyle = Math.random() < 0.06 ? "#e4e8ec" : "#f3f5f7"; ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4); }
  }, 512, 512);
  const floorPatch = (tex, tileM, x0, x1, z0, z1) => {
    const t = tex.clone(); t.needsUpdate = true; t.repeat.set((x1 - x0) / tileM, (z1 - z0) / tileM);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshLambertMaterial({ map: t }));
    f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0.002, (z0 + z1) / 2); scene.add(f);
  };
  floorPatch(vctTex, 2.4, BX0, XR, BZ0, HZ);                                // hall — starts right where the store's carpet ends, mid-opening
  floorPatch(vctTex, 2.4, BX0, SX, HZ, BZ1);                                // breakroom
  floorPatch(bathTex, 0.8, SX, XR, HZ, BZ1);                                // restroom
  const bohCeilTex = ceilGrid(ceilTex.clone(), BX0, XR, BZ0, BZ1); bohCeilTex.needsUpdate = true;
  const bohCeil = new THREE.Mesh(new THREE.PlaneGeometry(XR - BX0, BZ1 - BZ0), new THREE.MeshLambertMaterial({ map: bohCeilTex }));
  bohCeil.rotation.x = Math.PI / 2; bohCeil.position.set((BX0 + XR) / 2, BH, (BZ0 + BZ1) / 2); scene.add(bohCeil);

  // the sales floor opens straight into the hall; the rooms get painted doors, the future door is steel
  casing(Z, BOH_DOORS.store, true, BOH_OPENING_W);
  const steel = new THREE.MeshLambertMaterial({ color: 0x8e959d });
  const painted = new THREE.MeshLambertMaterial({ color: 0xd9d4c7 });
  makeDoor({ at: HZ, c: BOH_DOORS.breakroom, alongX: true, hinge: 1, swing: 1, leafMat: painted,
    signs: [{ text: "BREAK ROOM", side: -1 }] });
  makeDoor({ at: HZ, c: BOH_DOORS.restroom, alongX: true, hinge: 1, swing: 1, leafMat: painted,
    signs: [{ text: "RESTROOM", side: -1 }] });
  makeDoor({ at: BX0, c: BOH_DOORS.future, alongX: false, hinge: 1, swing: -1, locked: true, leafMat: steel });
  const rr = textPlane("RESTROOMS", 1.0, 0.24, "#fff", "#00349c");         // over the store-side doorway, above the stripe
  rr.material = new THREE.MeshLambertMaterial({ map: rr.material.map });
  rr.position.set(BOH_DOORS.store, DOOR_H + 0.62, Z - T / 2 - 0.02); rr.rotation.y = Math.PI; scene.add(rr);

  // ---- break room (interior x BX0+0.1..SX-0.1, z HZ+0.1..BZ1-0.1) ----
  // lockers on the west wall, a table + chairs mid-room, a kitchenette along
  // the back wall with the fridge in the corner. The door swings in over
  // x 4.45-5.55 up to ~z 30.9, so that strip stays clear.
  {
    const x0 = BX0 + 0.1, x1 = SX - 0.1, z0 = HZ + 0.1, z1 = BZ1 - 0.1;
    const put = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
    const bx = (w, h, d, m, x, y, z) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const lockerMat = new THREE.MeshLambertMaterial({ color: 0x5f7fa3 }), lockerDk = new THREE.MeshLambertMaterial({ color: 0x3c526b });
    const white = new THREE.MeshLambertMaterial({ color: 0xeeeeea }), laminate = new THREE.MeshLambertMaterial({ color: 0xd9cfb4 });
    const cabinet = new THREE.MeshLambertMaterial({ color: 0x8a6a45 }), chrome = new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 90 });
    const blackP = new THREE.MeshPhongMaterial({ color: 0x1b1b1d, specular: 0x444444, shininess: 40 });

    // lockers: four tall steel lockers facing +x, door seams, vents, handles
    const LD = 0.45, LW = 0.38, LH = 1.8, lz0 = z0 + 0.35;
    for (let i = 0; i < 4; i++) {
      const z = lz0 + LW / 2 + i * LW;
      bx(LD, LH, LW - 0.01, lockerMat, x0 + LD / 2, LH / 2, z);
      bx(0.005, LH - 0.08, 0.004, lockerDk, x0 + LD + 0.002, LH / 2, z + LW / 2 - 0.02);          // door seam
      for (let v = 0; v < 3; v++) bx(0.004, 0.012, LW * 0.55, lockerDk, x0 + LD + 0.002, LH - 0.2 - v * 0.03, z);   // vents
      bx(0.02, 0.1, 0.025, chrome, x0 + LD + 0.01, 1.0, z + LW / 2 - 0.07);                        // latch handle
    }
    colliders.push({ x0, x1: x0 + LD, z0: lz0, z1: lz0 + 4 * LW, y1: LH });

    // table (laminate top, chrome legs) and four molded chairs
    const tx = 3.9, tz = 31.75, TW = 1.2, TD = 0.8, TH = 0.74;
    bx(TW, 0.03, TD, laminate, tx, TH - 0.015, tz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.CylinderGeometry(0.018, 0.018, TH - 0.03, 8), chrome, tx + sx * (TW / 2 - 0.08), (TH - 0.03) / 2, tz + sz * (TD / 2 - 0.08));
    colliders.push({ x0: tx - TW / 2, x1: tx + TW / 2, z0: tz - TD / 2, z1: tz + TD / 2, y1: TH });
    const chairMat = new THREE.MeshLambertMaterial({ color: 0xc0501e });
    const chair = (x, z, ry) => {
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
      const add = (geo, m, px, py, pz, rx = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); o.rotation.x = rx; g.add(o); };
      add(new THREE.BoxGeometry(0.42, 0.03, 0.42), chairMat, 0, 0.45, 0);                  // seat
      add(new THREE.BoxGeometry(0.42, 0.36, 0.03), chairMat, 0, 0.67, -0.2, -0.12);        // back, leaning back
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6), chrome, sx * 0.18, 0.225, sz * 0.18);
    };
    chair(tx - 0.3, tz - TD / 2 - 0.3, 0); chair(tx + 0.3, tz - TD / 2 - 0.25, 0.15);   // hall side, one pushed out a bit
    chair(tx, tz + TD / 2 + 0.3, Math.PI);                                               // back-wall side
    chair(tx + TW / 2 + 0.32, tz + 0.05, -Math.PI / 2 + 0.2);                            // end, turned in

    // kitchenette: base cabinets + counter + sink along the back wall, upper cabinets above
    const kx0 = 5.55, kx1 = x1 - 0.72, CD = 0.6, CH = 0.9, kz = z1 - CD / 2;
    const kw = kx1 - kx0, kc = (kx0 + kx1) / 2;
    bx(kw, CH - 0.04, CD - 0.02, cabinet, kc, (CH - 0.04) / 2, kz + 0.01);
    bx(kw + 0.02, 0.04, CD + 0.02, laminate, kc, CH - 0.02, kz);
    for (let i = 1; i < 3; i++) bx(0.006, CH - 0.14, 0.004, lockerDk, kx0 + i * kw / 3, (CH - 0.04) / 2, kz - CD / 2 + 0.005);   // cabinet door gaps
    const sinkX = kx0 + kw * 0.55;
    bx(0.42, 0.012, 0.36, chrome, sinkX, CH + 0.001, kz - 0.02);                              // basin rim (reads as a sunk sink)
    bx(0.36, 0.01, 0.3, new THREE.MeshLambertMaterial({ color: 0x6d7278 }), sinkX, CH + 0.004, kz - 0.02);
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 8), chrome, sinkX, CH + 0.13, z1 - 0.1);   // faucet riser
    bx(0.02, 0.02, 0.16, chrome, sinkX, CH + 0.25, z1 - 0.17);                                     // spout
    const UD = 0.33, uy0 = 1.45, uy1 = 2.15;
    bx(kw, uy1 - uy0, UD, cabinet, kc, (uy0 + uy1) / 2, z1 - UD / 2);
    for (let i = 1; i < 3; i++) bx(0.006, uy1 - uy0 - 0.06, 0.004, lockerDk, kx0 + i * kw / 3, (uy0 + uy1) / 2, z1 - UD - 0.002);
    colliders.push({ x0: kx0, x1: kx1, z0: z1 - CD, z1, y1: CH });
    // microwave + coffee maker (with a half-full pot) on the counter
    bx(0.48, 0.28, 0.36, white, kx1 - 0.3, CH + 0.14, kz);
    bx(0.3, 0.2, 0.01, blackP, kx1 - 0.34, CH + 0.15, kz - 0.181);                             // door glass
    bx(0.22, 0.34, 0.24, blackP, kx0 + 0.2, CH + 0.17, kz + 0.02);
    put(new THREE.CylinderGeometry(0.07, 0.075, 0.14, 16), new THREE.MeshPhongMaterial({ color: 0x3a1f0e, transparent: true, opacity: 0.8, shininess: 80 }), kx0 + 0.2, CH + 0.08, kz - 0.09);

    // fridge in the corner
    const fx = x1 - 0.34, FH = 1.72;
    bx(0.66, FH, 0.68, white, fx, FH / 2, z1 - 0.34);
    bx(0.66, 0.006, 0.004, lockerDk, fx, FH * 0.68, z1 - 0.683);                               // freezer / fridge split
    for (const [y, h] of [[FH * 0.84, 0.28], [FH * 0.45, 0.5]]) bx(0.025, h, 0.03, chrome, fx - 0.26, y, z1 - 0.7);   // handles
    colliders.push({ x0: fx - 0.33, x1: fx + 0.33, z0: z1 - 0.68, z1, y1: FH });

    // trash can by the counter
    put(new THREE.CylinderGeometry(0.17, 0.15, 0.55, 18), new THREE.MeshLambertMaterial({ color: 0x3b4a5a }), kx0 - 0.28, 0.275, z1 - 0.3);

    // bulletin board on the hall wall (inside face), pinned notices + a schedule
    const board = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#a9794a"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 900; i++) { ctx.fillStyle = Math.random() < 0.5 ? "#8e6238" : "#bf8d5a"; ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3); }
      const note = (x, y, w, h, bg, lines, rot) => {
        ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.rotate(rot); ctx.fillStyle = bg; ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.fillStyle = "#222"; ctx.font = "bold 15px Arial"; lines.forEach((l, i) => ctx.fillText(l, -w / 2 + 8, -h / 2 + 22 + i * 19));
        ctx.fillStyle = "#c22"; ctx.beginPath(); ctx.arc(0, -h / 2 + 6, 5, 0, 7); ctx.fill(); ctx.restore();
      };
      note(24, 20, 230, 190, "#fff", ["SCHEDULE - WEEK OF", "MON  MIKE / DANA", "TUE  DANA / RAY", "WED  MIKE / TINA", "THU  RAY / TINA", "FRI  ALL HANDS", "SAT  MIKE / DANA", "SUN  CLOSED 9PM"], -0.02);
      note(280, 26, 180, 110, "#fff59a", ["BE KIND, REWIND", "CHECK EVERY", "RETURN!!"], 0.05);
      note(290, 150, 170, 90, "#bfe3ff", ["LOST: BLUE", "LUNCHBOX - DANA"], -0.04);
      note(40, 222, 200, 30, "#ffd0d0", ["NEW RELEASE WALL FRI"], 0.03);
    }, 512, 280);
    const bb = put(new THREE.PlaneGeometry(1.2, 0.66), new THREE.MeshLambertMaterial({ map: board }), 3.1, 1.5, z0 + 0.006);
    bx(1.26, 0.72, 0.02, cabinet, 3.1, 1.5, z0 - 0.004);                                       // frame

    // wall clock over the table + employee of the month on the back wall
    const clock = makeTexture((ctx, W) => {
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 4, 0, 7); ctx.fill();
      ctx.lineWidth = 8; ctx.strokeStyle = "#222"; ctx.stroke();
      ctx.fillStyle = "#222"; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; ctx.fillRect(W / 2 + Math.sin(a) * W * 0.4 - 3, W / 2 - Math.cos(a) * W * 0.4 - 3, 6, 6); }
      ctx.lineCap = "round"; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(W / 2, W / 2); ctx.lineTo(W / 2 + W * 0.18, W / 2 - W * 0.12); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(W / 2, W / 2); ctx.lineTo(W / 2 - W * 0.05, W / 2 - W * 0.33); ctx.stroke();
    }, 256, 256);
    put(new THREE.CircleGeometry(0.16, 32), new THREE.MeshLambertMaterial({ map: clock }), tx, 2.05, z1 - 0.006, Math.PI);
    const eotm = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#00349c"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#ffd400"; ctx.font = "bold 22px Arial Black, Arial"; ctx.textAlign = "center";
      ctx.fillText("EMPLOYEE", W / 2, 34); ctx.fillText("OF THE MONTH", W / 2, 60);
      ctx.fillStyle = "#ddd"; ctx.fillRect(W / 2 - 60, 76, 120, 140);                            // photo
      ctx.fillStyle = "#c9a07a"; ctx.beginPath(); ctx.arc(W / 2, 128, 34, 0, 7); ctx.fill(); ctx.fillRect(W / 2 - 46, 168, 92, 48);
      ctx.fillStyle = "#fff"; ctx.font = "bold 20px Arial"; ctx.fillText("DANA", W / 2, 246);
    }, 256, 270);
    put(new THREE.PlaneGeometry(0.4, 0.42), new THREE.MeshLambertMaterial({ map: eotm }), 2.75, 1.55, z1 - 0.006, Math.PI);
  }

  // ---- restroom (interior x SX+0.1..XR-0.1, z HZ+0.1..BZ1-0.1) ----
  // toilet on the back wall, wall-hung sink + mirror on the west wall. The
  // door swings in over x 9.1-10.2 up to ~z 30.9.
  {
    const x0 = SX + 0.1, x1 = XR - 0.1, z1 = BZ1 - 0.1;
    const put = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
    const bx = (w, h, d, m, x, y, z) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z);
    const china = new THREE.MeshPhongMaterial({ color: 0xf6f6f2, specular: 0x666666, shininess: 60 });
    const chrome = new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 90 });
    const grey = new THREE.MeshLambertMaterial({ color: 0x8c9196 });

    // toilet: tank on the wall, lathe bowl, seat ring + lid up against the tank
    const tx = 10.25;
    bx(0.46, 0.36, 0.18, china, tx, 0.62, z1 - 0.09);                                         // tank
    bx(0.48, 0.03, 0.2, china, tx, 0.815, z1 - 0.09);                                         // tank lid
    bx(0.06, 0.015, 0.02, chrome, tx - 0.15, 0.72, z1 - 0.185);                               // flush lever
    const bowl = put(new THREE.LatheGeometry([[0.1, 0], [0.13, 0.05], [0.16, 0.2], [0.2, 0.38], [0.19, 0.4]].map(([r, y]) => new THREE.Vector2(r, y)), 24), china, tx, 0, z1 - 0.42);
    bowl.scale.set(1, 1, 1.25);
    const seat = put(new THREE.TorusGeometry(0.17, 0.025, 8, 28), china, tx, 0.41, z1 - 0.42); seat.rotation.x = Math.PI / 2; seat.scale.set(1, 1.25, 1);
    const lid = bx(0.38, 0.44, 0.02, china, tx, 0.62, z1 - 0.2); lid.rotation.x = -0.12;     // up, leaning on the tank
    colliders.push({ x0: tx - 0.25, x1: tx + 0.25, z0: z1 - 0.7, z1, y1: 0.85 });
    // paper roll on the east wall
    const roll = put(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 18), new THREE.MeshLambertMaterial({ color: 0xfafafa }), x1 - 0.08, 0.72, z1 - 0.55);
    roll.rotation.x = Math.PI / 2;
    bx(0.02, 0.02, 0.16, chrome, x1 - 0.02, 0.72, z1 - 0.55);

    // wall-hung sink on the west wall (faces +x), mirror, soap, towels, bin
    const sz = 31.75;
    bx(0.42, 0.14, 0.5, china, x0 + 0.21, 0.8, sz);                                           // basin
    bx(0.3, 0.02, 0.36, new THREE.MeshLambertMaterial({ color: 0xc4c8cc }), x0 + 0.23, 0.872, sz);   // bowl hollow
    put(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), chrome, x0 + 0.05, 0.94, sz);        // faucet
    bx(0.12, 0.02, 0.02, chrome, x0 + 0.11, 1.01, sz);
    colliders.push({ x0, x1: x0 + 0.45, z0: sz - 0.27, z1: sz + 0.27, y1: 0.9 });
    const mirror = put(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshPhongMaterial({ color: 0x9fb0bf, specular: 0xffffff, shininess: 120 }), x0 + 0.006, 1.45, sz, Math.PI / 2);
    bx(0.02, 0.74, 0.54, chrome, x0 + 0.002, 1.45, sz);                                        // mirror frame (behind the glass)
    bx(0.08, 0.16, 0.08, grey, x0 + 0.04, 1.12, sz + 0.34);                                    // soap dispenser
    bx(0.12, 0.34, 0.3, grey, x0 + 0.06, 1.35, sz - 0.62);                                     // paper towels
    put(new THREE.CylinderGeometry(0.15, 0.13, 0.5, 18), grey, x0 + 0.2, 0.25, sz - 0.62);     // bin under them
    const wash = textPlane("EMPLOYEES MUST WASH HANDS", 0.42, 0.1, "#fff", "#1a1d22", "Arial", 64);
    wash.material = new THREE.MeshLambertMaterial({ map: wash.material.map });
    wash.position.set(x0 + 0.006, 1.9, sz); wash.rotation.y = Math.PI / 2; scene.add(wash);
  }

  // fluorescent troffers: fixtures taking the place of one ceiling
  // tile each (snapped into its slot). Mostly one glowing white rectangle —
  // the diffuser — with the two tubes behind it only faintly brighter bands.
  // Merged per group, emissive — a handful of independently-lit groups so
  // warm-up flicker (see setZone) can hit some fixtures and not others,
  // like real fluorescents restriking
  const PANEL_GROUPS = 3;                         // flicker groups per switch zone
  const panelBuckets = new Map();                 // "zone:group" -> geometries
  const diffuserTex = makeTexture((ctx, W, H) => {
    ctx.fillStyle = "#e3e8ef"; ctx.fillRect(0, 0, W, H);
    for (const cy of [H * 0.3, H * 0.7]) {                                          // the two tubes, soft through the diffuser
      const g = ctx.createLinearGradient(0, cy - H * 0.14, 0, cy + H * 0.14);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, cy - H * 0.14, W, H * 0.28);
    }
  }, 128, 64);
  const troffer = (x, z, y) => {
    x = Math.round((x - CEIL_TILE.x / 2) / CEIL_TILE.x) * CEIL_TILE.x + CEIL_TILE.x / 2;   // centered in a tile slot
    z = Math.round((z - CEIL_TILE.z / 2) / CEIL_TILE.z) * CEIL_TILE.z + CEIL_TILE.z / 2;
    const p = new THREE.PlaneGeometry(CEIL_TILE.x - 0.02, CEIL_TILE.z - 0.02); p.rotateX(Math.PI / 2); p.translate(x, y - 0.02, z);
    const key = `${lightZoneAt(x, z)}:${Math.floor(Math.random() * PANEL_GROUPS)}`;
    if (!panelBuckets.has(key)) panelBuckets.set(key, []);
    panelBuckets.get(key).push(p);
  };
  // every other tile slot across, every fourth along — a tile or more of
  // plain ceiling on every side, so no two fixtures ever touch
  for (let x = -9.9; x <= STORE.x - 1; x += 2 * CEIL_TILE.x) for (let z = 3.15; z <= STORE.z - 1; z += 4 * CEIL_TILE.z) {
    if (x - CEIL_TILE.x / 2 < XL + 0.3) continue;   // don't float panels past the pulled-in movie-side wall
    troffer(x, z, STORE.h);
  }
  for (const [x, z] of [[4.5, 29.25], [8.1, 29.25], [4.5, 31.05], [9.9, 31.05]]) troffer(x, z, BOH.h);   // back of house: hall x2, breakroom, restroom
  panelMats = [...panelBuckets].map(([key, bucket]) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xf8fbff, map: diffuserTex });
    m.userData.zone = key.split(":")[0];
    scene.add(new THREE.Mesh(mergeGeometries(bucket), m));
    return m;
  });

  // lighting: the overhead rig (hemisphere + ambient + a key light) now lives
  // in the room shader, one copy per switch zone — see ROOM_FRAG / TVU
  const lin = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  TVU.uInSky.value.copy(lin(0xdfe8ff, 1.15)); TVU.uInGround.value.copy(lin(0x223355, 1.15));
  TVU.uInAmb.value.copy(lin(0xffffff, 0.32)); TVU.uInDirC.value.copy(lin(0xffffff, 0.55)); TVU.uInDir.value.set(3, 10, -6).normalize();
  TVU.uFloorBox.value.set(XL - 0.05, XR + 0.05, Z, H + 0.05);
  TVU.uBohBox.value.set(BOH.x0, XR + 0.05, BOH.hallZ, BOH.z1 + 0.05); TVU.uBohSplit.value.set(BOH.splitX, BOH.h);
  const lobby = new THREE.PointLight(0xfff2cc, 0.7, 14, 2); lobby.position.set(0.9, 2.4, 3.15);   // under the entry troffer, low enough not to burn a hot spot into the tiles
  lobby.userData.on = lobby.intensity; lobby.userData.zone = "front"; allLights.push(lobby); scene.add(lobby);
}

// ---------------- exterior (glimpsed through the storefront glass) ----------------
// Purely a backdrop — outside the walls the player can't reach, just what's
// visible through the doors and the storefront glass. Everything here lives
// on EXTERIOR_LAYER only, lit exclusively by the moonlight rig below — the
// interior's fluorescents/lamps/screens (all on the default layer) never
// touch it, and it never touches them, regardless of whether the store
// lights are on or off. It's always night out there, moonlit midnight blue.
const DAY_SKY = 0x4f8fd6, MOON_SKY = 0x0e1a38;
scene.background = new THREE.Color(DAY_SKY);   // matches the default lights-on (daytime) state at boot
{
  const ea = m => { m.layers.set(EXTERIOR_LAYER); scene.add(m); return m; };   // exterior-only add
  const eb = (w, h, d, m, x, y, z) => {                                       // exterior-only box (mirrors box(), above)
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z); return ea(b);
  };
  const x0 = WALL_L - 20, x1 = STORE.x + 20, w = x1 - x0, cx = (x0 + x1) / 2;   // well past the building on both sides
  const SIDEWALK = 1.8;                                  // right outside the doors, before the lot starts
  const driveTo = -SIDEWALK - 3.5, lotFar = -SIDEWALK - 8, roadFar = -SIDEWALK - 12,
    grassFar = -SIDEWALK - 22, treesNear = -SIDEWALK - 15.5, treesFar = -SIDEWALK - 23.5;
  const ground = (zNear, zFar, m) => {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(w, zNear - zFar), m);
    g.rotation.x = -Math.PI / 2; g.position.set(cx, 0, (zNear + zFar) / 2); ea(g);
  };
  ground(0, -SIDEWALK, mat.sidewalk);                    // sidewalk right outside the doors
  for (let x = x0 + 1; x < x1; x += 2) {                  // expansion joints
    const joint = new THREE.Mesh(new THREE.PlaneGeometry(0.03, SIDEWALK), mat.sidewalkJoint);
    joint.rotation.x = -Math.PI / 2; joint.position.set(x, 0.002, -SIDEWALK / 2); ea(joint);
  }
  ground(-SIDEWALK, lotFar, mat.pavement);              // small parking lot: drive aisle first, stalls at the back
  for (let x = x0 + 1.3; x < x1; x += 2.6) {              // painted stall lines, the full width of the lot
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, driveTo - lotFar - 0.4), mat.lineWhite);
    line.rotation.x = -Math.PI / 2; line.position.set(x, 0.002, (driveTo + lotFar) / 2); ea(line);
  }

  // three parked cars, deliberately different body styles — nosed in toward
  // the road, so the store looks at their tails. Kept off to the sides of the
  // building rather than right in front of the doors.
  const stallX = k => x0 + 2.6 * (k + 1);               // center of stall k, between the painted lines above
  const stallZ = (driveTo + lotFar) / 2;
  // Each car is a side-profile silhouette (hood, windshield, roof, rear
  // glass/deck, with real wheel-arch cutouts) extruded across its width with
  // a bevel for soft rounded edges, plus a glass greenhouse extruded a hair
  // wider so it reads as the window band. Built in a local frame where +x is
  // the nose and z is across the width, then turned so the nose faces the road.
  const carGlass = new THREE.MeshPhongMaterial({ color: 0x1b2533, specular: 0x8899aa, shininess: 90 });
  const carTire = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const carTrim = new THREE.MeshLambertMaterial({ color: 0x232325 });
  const chrome = new THREE.MeshPhongMaterial({ color: 0xc8ccd2, specular: 0xffffff, shininess: 100 });
  const tailLamp = new THREE.MeshPhongMaterial({ color: 0x9a1616, specular: 0x552222, shininess: 60 });
  const headLamp = new THREE.MeshPhongMaterial({ color: 0xe8e4cc, specular: 0xffffff, shininess: 80 });
  const BEV = 0.04, BEVT = 0.06, YB = 0.25, ARCH = 0.5, TIRE = 0.33;
  const car = (x, z, yaw, s) => {
    const { L, W, color, noseY, hoodY, cowlX, wsTopX, roofY, rTopX, rBotX, rBotY, rearY, wheels } = s;
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = Math.PI / 2 + yaw; scene.add(g);
    const part = (geo, m, px, py, pz) => {
      const p = new THREE.Mesh(geo, m); p.position.set(px, py, pz); p.layers.set(EXTERIOR_LAYER); g.add(p); return p;
    };
    const paint = new THREE.MeshPhongMaterial({ color, specular: 0x444444, shininess: 55 });
    const extrude = (shape, depth, m, bevel) => {
      const geo = new THREE.ExtrudeGeometry(shape, bevel
        ? { depth, bevelEnabled: true, bevelSize: BEV, bevelThickness: BEVT, bevelSegments: 3, curveSegments: 12 }
        : { depth, bevelEnabled: false, curveSegments: 12 });
      geo.translate(0, 0, -depth / 2);
      return part(geo, m, 0, 0, 0);
    };

    // body silhouette: bottom edge rear→front with an arch over each wheel, then the top line front→rear
    const body = new THREE.Shape();
    body.moveTo(-L / 2, YB);
    for (const wx of wheels) { body.lineTo(wx - ARCH, YB); body.absarc(wx, YB, ARCH, Math.PI, 0, true); }
    body.lineTo(L / 2, YB);
    const top = [[L / 2 + 0.02, noseY], [L / 2 - 0.2, hoodY - 0.03], [cowlX, hoodY], [wsTopX, roofY], [rTopX, roofY], [rBotX, rBotY]];
    if (s.bedTop) top.push([-L / 2 + 0.05, s.bedTop], [-L / 2 - 0.02, s.bedTop - 0.06]);
    else {
      if (rBotX > -L / 2 + 0.2) top.push([-L / 2 + 0.15, rBotY - 0.02]);
      top.push([-L / 2 - 0.02, rearY]);
    }
    top.forEach(([px, py]) => body.lineTo(px, py));
    body.lineTo(-L / 2, YB);
    extrude(body, W - 2 * BEVT, paint, true);

    // greenhouse: follows the windshield and rear glass, pushed outward past the
    // body's bevel so it shows on the slopes, stopping just under the roof line
    const gTop = roofY - 0.07, out = 0.055;
    const along = (ax, ay, bx, by, y) => ax + (bx - ax) * (y - ay) / (by - ay);
    const shiftFor = (ax, ay, bx, by) => out * Math.hypot(bx - ax, by - ay) / Math.abs(by - ay);
    const fShift = shiftFor(cowlX, hoodY, wsTopX, roofY);
    const rShift = s.rearInset ?? -shiftFor(rTopX, roofY, rBotX, rBotY);
    const glass = new THREE.Shape();
    glass.moveTo(cowlX + fShift, hoodY);
    glass.lineTo(along(cowlX, hoodY, wsTopX, roofY, gTop) + fShift, gTop);
    glass.lineTo(along(rTopX, roofY, rBotX, rBotY, gTop) + rShift, gTop);
    glass.lineTo(rBotX + rShift, s.bedTop ? hoodY : rBotY);
    glass.lineTo(cowlX + fShift, hoodY);
    extrude(glass, W + 0.02, carGlass, false);
    for (const px of s.pillars || []) part(new THREE.BoxGeometry(0.09, gTop - hoodY + 0.02, W + 0.04), paint, px, (gTop + hoodY) / 2, 0);

    if (s.bedTop) {                                      // pickup cab: rounded rear window on the back of the cab, above the bed
      const rw = W - 0.4, y0 = s.bedTop + 0.14, y1 = roofY - 0.12, rh = y1 - y0, rr = 0.05;
      const pane = new THREE.Shape();
      pane.moveTo(-rw / 2 + rr, 0); pane.lineTo(rw / 2 - rr, 0); pane.quadraticCurveTo(rw / 2, 0, rw / 2, rr);
      pane.lineTo(rw / 2, rh - rr); pane.quadraticCurveTo(rw / 2, rh, rw / 2 - rr, rh);
      pane.lineTo(-rw / 2 + rr, rh); pane.quadraticCurveTo(-rw / 2, rh, -rw / 2, rh - rr);
      pane.lineTo(-rw / 2, rr); pane.quadraticCurveTo(-rw / 2, 0, -rw / 2 + rr, 0);
      const geo = new THREE.ExtrudeGeometry(pane, { depth: 0.02, bevelEnabled: false, curveSegments: 6 });
      geo.translate(0, -rh / 2, -0.01); geo.rotateY(Math.PI / 2);           // face it out the back of the cab (-x)
      const ym = (y0 + y1) / 2;
      const win = part(geo, carGlass, along(rTopX, roofY, rBotX, rBotY, ym) - BEV - 0.012, ym, 0);
      win.rotation.z = -Math.atan2(rTopX - rBotX, roofY - rBotY);            // match the cab back's slight lean
    }

    if (s.bedTop) part(new THREE.BoxGeometry((rBotX - 0.12) - (-L / 2 + 0.05), 0.012, W - 0.2), carTrim,     // bed opening
      (-L / 2 + 0.05 + rBotX - 0.12) / 2, s.bedTop + BEV + 0.006, 0);
    if (s.wood) part(new THREE.BoxGeometry(L - 0.9, 0.16, W + 0.03), s.wood, -0.1, 0.8, 0);             // wagon woodgrain side panel

    const trim = s.chromeBumpers ? chrome : carTrim;
    for (const ex of [-1, 1]) part(new THREE.BoxGeometry(0.12, 0.15, W + 0.04), trim, ex * (L / 2 + 0.08), 0.36, 0);   // bumpers
    part(new THREE.BoxGeometry(0.02, 0.14, W * 0.42), carTrim, L / 2 + 0.075, noseY - 0.15, 0);                       // grille
    const tailY = (s.bedTop ?? rearY) - 0.14;
    for (const sz of [-1, 1]) {
      part(new THREE.BoxGeometry(0.04, 0.11, 0.3), headLamp, L / 2 + 0.07, noseY - 0.1, sz * (W / 2 - 0.3));
      part(new THREE.BoxGeometry(0.04, 0.12, 0.34), tailLamp, -L / 2 - 0.07, tailY, sz * (W / 2 - 0.26));
      part(new THREE.BoxGeometry(0.12, 0.08, 0.1), paint, cowlX - 0.12, hoodY + 0.1, sz * (W / 2 + 0.05));            // mirrors
      for (const wx of wheels) {
        const tire = part(new THREE.CylinderGeometry(TIRE, TIRE, 0.24, 18), carTire, wx, TIRE, sz * (W / 2 - 0.13));
        tire.rotation.x = Math.PI / 2;
        const hub = part(new THREE.CylinderGeometry(0.19, 0.19, 0.25, 14), chrome, wx, TIRE, sz * (W / 2 - 0.13));
        hub.rotation.x = Math.PI / 2;
      }
    }
  };
  car(stallX(3), stallZ + 0.15, 0.03, {                         // maroon sedan: long hood, fastback-ish rear glass, short trunk
    L: 4.1, W: 1.75, color: 0x8e1b1b, noseY: 0.72, hoodY: 0.92, cowlX: 0.75, wsTopX: 0.05, roofY: 1.38,
    rTopX: -0.85, rBotX: -1.35, rBotY: 0.98, rearY: 0.78, wheels: [-1.25, 1.25], pillars: [-0.35] });
  car(stallX(5), stallZ + 0.15, -0.05, {                        // teal station wagon: roof runs to the tail, woodgrain sides
    L: 4.1, W: 1.72, color: 0x2e7d7a, noseY: 0.72, hoodY: 0.92, cowlX: 0.9, wsTopX: 0.25, roofY: 1.4,
    rTopX: -1.8, rBotX: -1.97, rBotY: 0.95, rearY: 0.9, wheels: [-1.28, 1.28], pillars: [-0.2, -1.05],
    wood: new THREE.MeshLambertMaterial({ color: 0x7a5230 }) });
  car(stallX(16), stallZ + 0.15, 0.02, {                        // cream pickup: tall cab, open bed, chrome bumpers
    L: 4.1, W: 1.82, color: 0xd8c79a, noseY: 0.82, hoodY: 1.0, cowlX: 0.95, wsTopX: 0.35, roofY: 1.55,
    rTopX: -0.5, rBotX: -0.53, rBotY: 1.02, bedTop: 1.02, rearInset: 0.1, wheels: [-1.3, 1.3], chromeBumpers: true });

  eb(w, 0.12, 0.15, mat.curb, cx, 0.06, lotFar);
  ground(lotFar, roadFar, mat.road);                     // the road behind the lot
  for (let x = x0 + 0.8; x < x1; x += 1.7) {              // dashed centerline
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.12), mat.lineYellow);
    dash.rotation.x = -Math.PI / 2; dash.position.set(x, 0.002, (lotFar + roadFar) / 2); ea(dash);
  }
  ground(roadFar, grassFar, mat.grass);                  // a much deeper stretch of grass on the far side
  const benchZ = roadFar - 2.2;                          // a bench facing back toward the store, just past the road
  eb(1.3, 0.05, 0.4, mat.bench, 0, 0.42, benchZ);
  eb(1.3, 0.4, 0.05, mat.bench, 0, 0.62, benchZ + 0.18);
  for (const lx of [-0.55, 0.55]) eb(0.06, 0.42, 0.06, mat.dark, lx, 0.21, benchZ);

  // night lighting — these only come on when setExteriorDay flips to night.
  // Each entry remembers its "on" value; lenses also join the bloom layer so
  // they glow, but stay dark (and don't bloom) by day.
  const nightLights = [], nightGlows = [];
  const ecyl = (rt, rb, h, m, x, y, z, seg = 12) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); c.position.set(x, y, z); return ea(c);
  };
  const glowMat = (color, emissive, on) => {
    const m = new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 0 }); m.userData.on = on; nightGlows.push(m); return m;
  };
  const nightLight = (l, on) => { l.intensity = 0; l.userData.on = on; l.layers.set(EXTERIOR_LAYER); scene.add(l); nightLights.push(l); return l; };

  // parking-lot street lights: cobra-head fixtures on tall poles at the head
  // of the stalls, arms reaching out over the cars, sodium orange pooling
  // straight down. Every 5 stalls (13m), each standing in an empty stall —
  // stall 4 sits right between the sedan and the wagon, so both get lit.
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x3b3f45, specular: 0x222222, shininess: 30 });
  // They don't snap on at dusk: each strikes a moment after night falls
  // (staggered) and warms up like a real sodium lamp — a dim red-orange glow
  // building to full orange over a few seconds. See exteriorTick below.
  const sodium = [];                     // { lens, spot, delay }
  const streetLamp = (x, z) => {
    const sodiumLens = new THREE.MeshLambertMaterial({ color: 0x3a2e1c, emissive: 0xffae4a, emissiveIntensity: 0 });   // its own, so each warms up on its own clock
    const armLen = 1.6, hy = 6.0, hz = z + armLen + 0.25;
    ecyl(0.26, 0.3, 0.5, mat.sidewalk, x, 0.25, z, 14);                     // concrete footing
    ecyl(0.06, 0.08, 5.6, poleMat, x, 0.5 + 2.8, z, 10);                    // pole
    eb(0.08, 0.08, armLen, poleMat, x, hy, z + armLen / 2);                 // arm out over the stalls
    eb(0.46, 0.16, 0.8, poleMat, x, hy - 0.02, hz);                         // head housing
    eb(0.36, 0.02, 0.62, sodiumLens, x, hy - 0.11, hz).layers.enable(BLOOM_LAYER);
    const spot = new THREE.SpotLight(0xffae4a, 0, 18, 0.72, 0.55, 1.5);   // tall pole: needs a lot of candela (72 at full) to read on dark asphalt
    spot.layers.set(EXTERIOR_LAYER); scene.add(spot);
    spot.position.set(x, hy - 0.15, hz);
    spot.target.position.set(x, 0, hz); scene.add(spot.target);
    sodium.push({ lens: sodiumLens, spot, delay: 0 });
  };
  for (const k of [4, 9, 14, 19]) streetLamp(stallX(k), lotFar + 0.35);

  // ornamental park lamp beside the bench: black wrought iron, stepped
  // octagonal base, slim shaft with a collar, flared lantern with a pyramid
  // cap and finial — softer and warmer than the sodium lot lights
  const iron = new THREE.MeshPhongMaterial({ color: 0x121212, specular: 0x333333, shininess: 40 });
  const lanternGlass = glowMat(0x4a3a1c, 0xffcf7a, 1.3);
  {
    const px = 1.2, pz = benchZ;
    ecyl(0.2, 0.24, 0.12, iron, px, 0.06, pz, 8);                           // plinth
    ecyl(0.12, 0.16, 0.4, iron, px, 0.32, pz, 8);                           // tapered base
    ecyl(0.14, 0.14, 0.04, iron, px, 0.54, pz, 12);                         // collar
    ecyl(0.045, 0.06, 2.3, iron, px, 1.7, pz, 10);                          // shaft
    ecyl(0.08, 0.08, 0.05, iron, px, 1.4, pz, 12);                          // decorative ring
    ecyl(0.09, 0.05, 0.14, iron, px, 2.92, pz, 8);                          // lantern cradle
    const glass = ecyl(0.17, 0.12, 0.38, lanternGlass, px, 3.18, pz, 4);    // flared four-sided lantern
    glass.rotation.y = Math.PI / 4; glass.layers.enable(BLOOM_LAYER);
    const cap = ea(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 4), iron));
    cap.position.set(px, 3.47, pz); cap.rotation.y = Math.PI / 4;
    const finial = ea(new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), iron)); finial.position.set(px, 3.6, pz);
    nightLight(new THREE.PointLight(0xffcf7a, 0, 10, 1.5), 14).position.set(px, 3.15, pz);
  }

  // two nicer tree shapes — a layered pine (stacked tapering cones) and a
  // round broadleaf (a cluster of lumpy icosahedra so the canopy isn't a
  // perfect sphere) — over a few staggered rows so the treeline reads as
  // an actual thicket, not a single thin row of cutouts
  const pine = (x, z, s, leafMat) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * s, 0.12 * s, 1.0 * s, 6), mat.trunk);
    trunk.position.set(x, 0.5 * s, z); ea(trunk);
    [[0.8, 1.3, 0.8], [1.55, 1.05, 0.62], [2.2, 0.8, 0.44]].forEach(([y0, h, r]) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r * s, h * s, 8), leafMat);
      cone.position.set(x, (y0 + h / 2) * s, z); ea(cone);
    });
  };
  const round = (x, z, s, leafMat) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * s, 0.13 * s, 1.1 * s, 6), mat.trunk);
    trunk.position.set(x, 0.55 * s, z); ea(trunk);
    [[0, 1.7, 0.62], [0.34, 1.5, 0.5], [-0.32, 1.55, 0.48], [0.04, 1.98, 0.46]].forEach(([ox, y, r]) => {
      const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), leafMat);
      puff.position.set(x + ox * s, y * s, z + (Math.random() - 0.5) * 0.3 * s); ea(puff);
    });
  };
  const rows = [treesNear, (treesNear + treesFar) / 2, treesFar];
  for (const rz of rows) {
    const spacing = 1.9 + Math.random() * 0.4;
    const n = Math.round(w / spacing);
    for (let i = 0; i < n; i++) {
      const x = x0 + (i + 0.5) * (w / n) + (Math.random() - 0.5) * 0.7;
      const z = rz + (Math.random() - 0.5) * 1.6;
      const s = 0.8 + Math.random() * 0.6;
      const leafMat = Math.random() < 0.5 ? mat.leaves : mat.leaves2;
      (Math.random() < 0.6 ? pine : round)(x, z, s, leafMat);
    }
  }
  // fills any gaps above/between the trees. Unlit and exempt from fog: the
  // scene background itself is never fogged, so a fogged plane read as a
  // slightly different blue and its corners showed against the open sky
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(w + 40, 26),
    new THREE.MeshBasicMaterial({ color: DAY_SKY, fog: false }));
  backdrop.position.set(cx, 10, treesFar - 3); ea(backdrop);

  // subtle clouds — small clusters of flattened, lumpy icosahedra (not
  // perfect spheres) hanging high over the lot; they're lit by whichever
  // rig is active below, so they read bright and warm by day and dim,
  // cool, and barely-there by night for free, without swapping materials
  const cloud = (x, y, z, s) => {
    const g = new THREE.Group(); g.position.set(x, y, z); scene.add(g);
    [[0, 0, 0, 0.9], [0.7, 0.05, 0.1, 0.7], [-0.65, 0.02, -0.05, 0.65], [0.2, 0.25, 0.15, 0.55], [-0.3, 0.2, -0.1, 0.5]]
      .forEach(([ox, oy, oz, r]) => {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(r * s, 0), mat.cloud);
        puff.position.set(ox * s, oy * s, oz * s); puff.scale.y = 0.55; puff.layers.set(EXTERIOR_LAYER); g.add(puff);
      });
    exteriorClouds.push(g);
  };
  [[-15, 14, -8], [10, 16, -14], [-25, 15, -20], [20, 13, -6], [0, 17, -18], [-8, 15, -24], [28, 14, -16]]
    .forEach(([px, py, pz]) => cloud(px + (Math.random() - 0.5) * 4, py + (Math.random() - 0.5) * 2, pz + (Math.random() - 0.5) * 4, 2.5 + Math.random() * 1.5));

  // day/night rig — its own layer, so it's the only thing illuminating the
  // above, and never touches (or is touched by) the interior's fluorescents.
  // Warm sun by day, cool pale-blue moon by night; the time of day (L) picks
  // which one's live, in sync with the store's own lights toggle.
  // (three.js doesn't limit lights by layer, so real sun/moon lights used to
  // light the inside of the store too; the room shader does them instead,
  // outside the building only — the interior gets daylight through the glass)
  const lin = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
  TVU.uSunSky.value.copy(lin(0xaed4f5, 0.75)); TVU.uSunGround.value.copy(lin(0x4c6a3c, 0.75)); TVU.uSunC.value.copy(lin(0xfff3d9, 0.95)); TVU.uSunDir.value.set(12, 30, -8).normalize();
  TVU.uMoonSky.value.copy(lin(0x2c3d68, 0.55)); TVU.uMoonGround.value.copy(lin(0x05070f, 0.55)); TVU.uMoonC.value.copy(lin(0xaec2e8, 0.5)); TVU.uMoonDir.value.set(-14, 26, -10).normalize();
  setSky = c => { scene.background.copy(c); backdrop.material.color.copy(c); };
  let wasDay = null;
  setExteriorDay = isDay => {
    if (isDay === wasDay) return; wasDay = isDay;
    for (const l of nightLights) l.intensity = isDay ? 0 : l.userData.on;         // park lamp: night only, straight on
    for (const m of nightGlows) m.emissiveIntensity = isDay ? 0 : m.userData.on;
    for (const s of sodium) { s.spot.intensity = 0; s.lens.emissiveIntensity = 0; s.delay = 1.2 + Math.random() * 1.3; }   // lot lights: off, then warm up
    sodiumT = isDay ? null : 0;
  };
  let sodiumT = null;                          // seconds since night fell while the lot lights warm up; null = settled
  const SODIUM_WARM = 5, cold = new THREE.Color(0xff4d1a), warm = new THREE.Color(0xffae4a);
  exteriorTick = dt => {
    if (sodiumT === null) return;
    sodiumT += dt;
    let done = true;
    for (const s of sodium) {
      const k = Math.min(1, Math.max(0, (sodiumT - s.delay) / SODIUM_WARM));
      if (k < 1) done = false;
      if (k <= 0) continue;                    // not struck yet
      const strike = k < 0.06 && Math.random() < 0.35 ? 0.3 : 1;   // a little sputter as it strikes
      s.spot.intensity = 72 * k * k * strike;  // slow start, then climbs to full
      s.lens.emissiveIntensity = 1.6 * (0.12 + 0.88 * k) * strike;
      s.spot.color.copy(cold).lerp(warm, k); s.lens.emissive.copy(cold).lerp(warm, k);
    }
    if (done) sodiumT = null;
  };
  setExteriorDay(true);          // matches lightsOut's default (false) — moon/moonFill start off, not double-lit with the sun
}

// ---------------- lobby + back wall dressing ----------------
let cashDrawer = null, drawerOpen = 0;          // the register's till; drawerOpen eases 0..1 (see the main loop)
let returnSlotMesh;                          // the E target for the returns counter, set below
let refreshReturnsBin = () => {};            // redraws the tapes sitting in the returns counter — set with the counter below
let flapPivot, flapGate, flapCollider;        // the counter pass-through: lift-up leaf + swinging half gate, set below
let posScreen;                                // the register monitor's glass (pos.js mirrors its terminal onto it)
// the counter's VHS rewinder (model built with the register, logic near the
// rewind policy): tape = the copy inside, f0/dur/t = rewind progress
const rewinder = { tape: null, f0: 0, dur: 0, t: 0, done: false, tapeMesh: null, led: null, snd: null };
let gateLed;                                  // the security gates' status LED material
let desensLed;                                // the desensitizer pad's LED (flashes green when a tag is killed)
const GATE_Z = 4.0;                           // security gate line across the entry lane (|x| < 2)
{
  // ---- the employee counter: one L around the register nook ----
  // North run (the checkout) faces the store along z 3.65-4.35; the east run
  // faces the entry lane along x -2.6..-1.9 and runs solid all the way to the
  // front wall — no way in from the doors. The way in is a lift-up pass-through
  // at the west end, by the soda cooler (see the flap below).
  // Both runs share one builder, in a local frame: the run goes along +x from
  // 0..len, the customer face is +z, the employee face -z, the worktop's top
  // at y 1.08 (the register and rewinder sit on it). Customer side: recessed
  // toe kick, blue panels with chrome bands + dividers, a raised transaction
  // ledge. Employee side: cabinet doors, or an open cubby where asked.
  const RX = -2.25;                            // east run centerline
  const CD = 0.7, TOP = 1.08, KICK = 0.1;      // counter depth, worktop height, toe kick
  const FLAP_X0 = WALL_L + 0.1, FLAP_X1 = -6.0; // pass-through gap (wall to the checkout's west end) — wide enough to get round the cooler
  const chromeC = new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 90 });
  const blueDk = new THREE.MeshLambertMaterial({ color: 0x1d3a8a }), cubbyMat = new THREE.MeshLambertMaterial({ color: 0x0e1426 });
  // corner pieces meet on a 45° miter: a run whose end turns the corner
  // (miterEnd: turning at len; miterStart: coming off another run at 0) has
  // its worktop / ledge ends cut along the diagonal through the two runs'
  // shared outer corner, so the matching piece on the other run meets it edge
  // to edge. A piece's plan is a prism between z_in..z_out whose end x
  // follows that diagonal: end(z) = len + (z - CD/2), start(z) = -CD - (z - CD/2)
  function prism(pts, y0, y1, m) {             // pts: plan outline [[x, z], ...]; extruded y0..y1
    const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z)));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); geo.translate(0, y1, 0);   // shape y -> world z, extrusion -> down from y1
    return new THREE.Mesh(geo, m);
  }
  function counterRun(len, { cubbies = [], miterStart = false, miterEnd = false, endTrim = false, logo = null, drawer = null } = {}) {   // drawer: [x0, x1] a drawer front sits over
    const g = new THREE.Group(); scene.add(g);
    const add = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); g.add(o); return o; };
    const BH = TOP - 0.04 - KICK, by = KICK + BH / 2;                         // body height / center
    add(len, KICK, CD - 0.12, mat.dark, len / 2, KICK / 2, 0);               // toe kick, recessed both sides
    // body: solid except where a cubby opens on the employee side
    let x = 0;
    for (const c of [...cubbies].sort((a, b) => a.x0 - b.x0).concat([{ x0: len, x1: len }])) {
      if (c.x0 > x) add(c.x0 - x, BH, CD - 0.02, mat.counter, (x + c.x0) / 2, by, 0);
      if (c.x1 > c.x0) {                                                      // the cubby: customer-side wall, slab above, floor, dark inside
        const w = c.x1 - c.x0, cx = (c.x0 + c.x1) / 2, back = 0.2;
        add(w, BH, back, mat.counter, cx, by, CD / 2 - 0.01 - back / 2);
        add(w, TOP - 0.04 - c.y1, CD - 0.02, mat.counter, cx, (c.y1 + TOP - 0.04) / 2, 0);
        add(w, c.y0 - KICK, CD - 0.02, mat.counter, cx, (KICK + c.y0) / 2, 0);
        add(w, c.y1 - c.y0, 0.01, cubbyMat, cx, (c.y0 + c.y1) / 2, CD / 2 - 0.01 - back - 0.005);
      }
      x = c.x1;
    }
    const x0 = z => miterStart ? -CD - (z - CD / 2) : -0.02, x1 = z => miterEnd ? len + (z - CD / 2) : len + 0.02;
    const slab = (zIn, zOut, y0, y1, m) => g.add(prism([[x0(zIn), zIn], [x1(zIn), zIn], [x1(zOut), zOut], [x0(zOut), zOut]], y0, y1, m));
    slab(-CD / 2 - 0.03, CD / 2 + 0.03, TOP - 0.04, TOP, mat.counterTop);                    // worktop
    slab(CD / 2 + 0.03, CD / 2 + 0.042, TOP - 0.0375, TOP - 0.0025, chromeC);                // chrome nosing
    // raised transaction ledge along the customer edge: riser, top, chrome nosing
    slab(CD / 2 - 0.15, CD / 2 - 0.11, TOP, TOP + 0.14, mat.counter);
    slab(CD / 2 - 0.14, CD / 2 + 0.08, TOP + 0.14, TOP + 0.17, mat.counterTop);
    slab(CD / 2 + 0.08, CD / 2 + 0.09, TOP + 0.14, TOP + 0.17, chromeC);
    // customer face: chrome bands and a yellow pinstripe
    const fz = CD / 2 - 0.004;
    for (const y of [KICK + 0.12, TOP - 0.16]) add(len, 0.02, 0.012, chromeC, len / 2, y, fz + 0.006);
    add(len, 0.025, 0.008, mat.counterTop, len / 2, TOP - 0.2, fz + 0.004);
    if (endTrim) {                                                            // customer-facing end at len (the lane corner)
      for (const y of [KICK + 0.12, TOP - 0.16]) add(0.012, 0.02, CD, chromeC, len + 0.006, y, 0);
      add(0.03, TOP - 0.045 - KICK, 0.03, chromeC, len, (KICK + TOP - 0.045) / 2, CD / 2);   // corner guard, stops just under the worktop
    }
    if (logo) {
      const t = textPlane(logo, Math.min(2.6, len * 0.6), 0.34, "#ffd400", "#00349c");
      t.material = new THREE.MeshLambertMaterial({ map: t.material.map }); t.position.set(len / 2, 0.52, fz + 0.012); g.add(t);
    }
    // employee side: cabinet doors (skipping cubbies), chrome pulls
    const doorsAt = [];
    for (let d = 0.05; d + 0.5 <= len - 0.05; d += 0.52) if (!cubbies.some(c => d + 0.5 > c.x0 && d < c.x1)) doorsAt.push(d);
    for (const d of doorsAt) {                 // doors under a drawer stop short of it
      const under = drawer && d + 0.5 > drawer[0] && d < drawer[1], top = under ? TOP - 0.23 : by + 0.02 + (BH - 0.12) / 2, bot = by + 0.02 - (BH - 0.12) / 2;
      add(0.49, top - bot, 0.015, blueDk, d + 0.25, (top + bot) / 2, -CD / 2 + 0.002);
      add(0.012, 0.12, 0.02, chromeC, d + 0.43, top - 0.14, -CD / 2 - 0.01);
    }
    return g;
  }
  // north run: flap edge -> the lane corner (the corner block belongs to it)
  const nLen = (RX + CD / 2) - FLAP_X1;
  const north = counterRun(nLen, { endTrim: true, miterEnd: true, logo: "VAULTBUSTER VIDEO", drawer: [-5.45 - 0.23 - FLAP_X1, -5.45 + 0.23 - FLAP_X1] });   // the cash drawer under the register   // mitered into the east run at the lane corner
  north.position.set(FLAP_X1, 0, 4);
  colliders.push({ x0: FLAP_X1, x1: RX + CD / 2, z0: 4 - CD / 2, z1: 4 + CD / 2 + 0.08, y1: TOP + 0.17 });
  // east run: from the corner down to the front wall, customer face to the lane;
  // a cubby near the corner holds the returns tote (the drop slot's on the lane face)
  const FRONT = 0.1, eLen = (4 - CD / 2) - FRONT, RET = 1.05;               // RET: slot/tote position along the run
  const east = counterRun(eLen, { cubbies: [{ x0: RET - 0.42, x1: RET + 0.42, y0: 0.14, y1: 0.66 }], miterStart: true });
  east.position.set(RX, 0, 4 - CD / 2); east.rotation.y = Math.PI / 2;      // local +x runs south (world -z), customer face east
  colliders.push({ x0: RX - CD / 2, x1: RX + CD / 2 + 0.08, z0: FRONT, z1: 4 - CD / 2, y1: TOP + 0.17 });
  // register: a beige CRT point-of-sale terminal with keyboard + mouse, where
  // the old black box stood — facing the employee side (toward the doors' wall)
  {
    const pos = new THREE.Group(); pos.position.set(-5.45, 1.08, 4); pos.rotation.y = Math.PI; scene.add(pos);   // local +z = employee side
    const beige = new THREE.MeshLambertMaterial({ color: 0xd8d0bc }), beigeDk = new THREE.MeshLambertMaterial({ color: 0xbdb49e });
    const add = (geo, m, x, y, z, parent = pos) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    // monitor: swivel base, neck, bezel box, tapered CRT back, recessed screen
    add(new THREE.CylinderGeometry(0.13, 0.15, 0.025, 24), beigeDk, 0, 0.0125, -0.05);
    add(new THREE.BoxGeometry(0.1, 0.05, 0.1), beigeDk, 0, 0.05, -0.05);
    const mon = new THREE.Group(); mon.position.set(0, 0.26, -0.05); mon.rotation.x = -0.06; pos.add(mon);   // tipped back a touch
    add(new THREE.BoxGeometry(0.4, 0.34, 0.06), beige, 0, 0, 0.1, mon);                                     // front bezel
    const back = add(new THREE.CylinderGeometry(0.2, 0.12, 0.28, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), beigeDk, 0, 0.005, -0.07, mon);
    back.scale.set(1.25, 1, 1);                                                                             // squared-off tube housing, wider than tall — wide at the bezel, tapering to the back
    const scr = makeTexture((ctx, w, h) => {                                                                // green POS screen
      ctx.fillStyle = "#031a0b"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#39ff7a"; ctx.font = "bold 22px 'Courier New', monospace"; ctx.textBaseline = "top";
      const lines = ["VAULTBUSTER POS  v2.3", "--------------------", "RENTAL / RETURN", "", "MEMBER #: ______", "TITLE  : ______", "DUE    : 3 NIGHTS", "", "F1 RENT  F2 RETURN", "F3 LATE FEES"];
      lines.forEach((l, i) => ctx.fillText(l, 16, 14 + i * 24));
      ctx.fillRect(16 + 9 * 13.2, 14 + 4 * 24, 12, 20);                                                  // block cursor
      const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);                  // CRT falloff
      g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }, 320, 256);
    add(new THREE.BoxGeometry(0.32, 0.25, 0.01), new THREE.MeshLambertMaterial({ color: 0x0c0f0c }), 0, 0.01, 0.128, mon);   // screen recess
    posScreen = glow(add(new THREE.PlaneGeometry(0.3, 0.235), new THREE.MeshBasicMaterial({ map: scr }), 0, 0.01, 0.1335, mon));   // pos.js takes this over once it's up
    add(new THREE.BoxGeometry(0.012, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: 0x39ff7a }), 0.16, -0.15, 0.132, mon);   // power LED
    // keyboard: beige slab, raised back edge, key grid on top
    const keys = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#cfc7b2"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#e9e3d3"; ctx.strokeStyle = "#8e866f"; ctx.lineWidth = 1;
      const rows = 6, kh = h / (rows + 0.6);
      for (let r = 0; r < rows; r++) {
        const n = r === 5 ? 1 : 15, kw = r === 5 ? w * 0.45 : (w * 0.74) / 15;
        for (let k = 0; k < n; k++) { const x = r === 5 ? w * 0.22 : 8 + k * kw; ctx.fillRect(x, 6 + r * kh, kw - 3, kh - 3); ctx.strokeRect(x, 6 + r * kh, kw - 3, kh - 3); }
      }
      for (let r = 1; r < 6; r++) for (let k = 0; k < 4; k++) { const x = w * 0.8 + k * (w * 0.19 / 4); ctx.fillRect(x, 6 + r * (h / 6.6), w * 0.04, h / 6.6 - 3); }   // number pad
    }, 512, 176);
    const kb = add(new THREE.BoxGeometry(0.44, 0.025, 0.16), [beige, beige, new THREE.MeshLambertMaterial({ map: keys }), beige, beige, beige], 0, 0.02, 0.2);
    kb.rotation.x = 0.07;                                                                                   // raised at the back
    // mouse on a pad, cord running back to the monitor
    add(new THREE.BoxGeometry(0.2, 0.004, 0.17), new THREE.MeshLambertMaterial({ color: 0x1f3f86 }), 0.33, 0.002, 0.2);
    const mouse = add(new THREE.SphereGeometry(0.035, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), beige, 0.33, 0.004, 0.21);
    mouse.scale.set(0.85, 0.7, 1.35);
    add(new THREE.BoxGeometry(0.002, 0.003, 0.018), beigeDk, 0.33, 0.028, 0.185);                          // button split
    const cord = add(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 6).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x9a927d }), 0.26, 0.004, 0.03);
    cord.rotation.y = 0.55;
    pos.traverse(o => { if (o.isMesh) { o.userData.pos = true; aimables.push(o); } });   // E anywhere on it logs in
  }
  // tape rewinder: the classic little sports-car shaped one. Faces the
  // employee side like the register; a loaded tape rides in its open roof
  {
    const g = new THREE.Group(); g.position.set(-4.5, 1.08, 3.95); g.rotation.y = Math.PI; scene.add(g);
    const red = new THREE.MeshPhongMaterial({ color: 0xc41e1e, specular: 0xffffff, shininess: 80 });
    const blackP = new THREE.MeshPhongMaterial({ color: 0x151515, specular: 0x555555, shininess: 50 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    add(new THREE.BoxGeometry(0.34, 0.06, 0.15), red, 0, 0.04, 0);                          // body
    const nose = add(new THREE.BoxGeometry(0.1, 0.04, 0.15), red, 0.19, 0.03, 0); nose.rotation.z = -0.35;   // sloped hood
    add(new THREE.BoxGeometry(0.22, 0.035, 0.14), blackP, -0.02, 0.085, 0);                 // tinted "cabin" = the lid, open at the roof
    for (const x of [-0.11, 0.12]) for (const z of [-0.075, 0.075]) {
      const w = add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), blackP, x, 0.03, z); w.rotation.x = Math.PI / 2;
    }
    for (const z of [-0.045, 0.045]) add(new THREE.BoxGeometry(0.01, 0.015, 0.03), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }), 0.235, 0.045, z);   // headlights
    rewinder.led = add(new THREE.BoxGeometry(0.012, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: 0x222222 }), -0.02, 0.06, 0.077);   // status LED on the side
    glow(rewinder.led);
    rewinder.tapeMesh = add(new THREE.BoxGeometry(TAPE.h, TAPE.w, TAPE.d), mat.tapeBody, -0.02, 0.1 + TAPE.w / 2, 0);   // lies flat in the roof
    rewinder.tapeMesh.rotation.y = Math.PI / 2; rewinder.tapeMesh.visible = false;
    g.traverse(o => { if (o.isMesh) { o.userData.rewinder = true; aimables.push(o); } });
  }

  // ---- returns: a stainless drop slot on the lane face, into a tote in the cubby behind ----
  const RZ = 4 - CD / 2 - RET;                 // world z of the slot / tote
  const steelC = new THREE.MeshPhongMaterial({ color: 0xaab2ba, specular: 0xffffff, shininess: 70 });
  box(0.012, 0.3, 0.5, steelC, RX + CD / 2 + 0.006, 0.82, RZ);                                   // drop plate
  box(0.008, 0.05, 0.38, mat.dark, RX + CD / 2 + 0.014, 0.86, RZ);                                // the slot
  returnSlotMesh = box(0.02, 0.07, 0.4, chromeC, RX + CD / 2 + 0.02, 0.9, RZ);                     // its hinged lip — the E target from the lane
  returnSlotMesh.userData.returns = true; aimables.push(returnSlotMesh);
  const drop = textPlane("DROP TAPES HERE", 0.44, 0.07, "#1a1d22", "#e8ecf0", "Arial", 64);
  drop.material = new THREE.MeshLambertMaterial({ map: drop.material.map });
  drop.position.set(RX + CD / 2 + 0.013, 0.73, RZ); drop.rotation.y = Math.PI / 2; scene.add(drop);
  const rb = textPlane("RETURNS", 0.84, 0.24, "#001f5c", "#ffd400");                             // on the blue face, under the slot
  rb.material = new THREE.MeshLambertMaterial({ map: rb.material.map }); rb.position.set(RX + CD / 2 + 0.012, 0.42, RZ); rb.rotation.y = Math.PI / 2;
  scene.add(rb);
  // the tote in the cubby (open on the employee side, x = RX - CD/2)
  const toteMat = new THREE.MeshLambertMaterial({ color: 0x2456b8 });
  const TW = 0.74, TD = 0.38, TH = 0.3, tx = RX - 0.1, ty = 0.15;   // x RX-0.29..RX+0.09: clear of the cubby's back wall
  box(TD, 0.02, TW, toteMat, tx, ty + 0.01, RZ);
  for (const s of [-1, 1]) box(TD, TH, 0.02, toteMat, tx, ty + TH / 2, RZ + s * (TW / 2 - 0.01));
  for (const s of [-1, 1]) box(0.02, TH, TW, toteMat, tx + s * (TD / 2 - 0.01), ty + TH / 2, RZ);
  const grab = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.52),                               // the cubby's open side: click target from behind the counter
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  grab.position.set(RX - CD / 2 - 0.005, 0.4, RZ); grab.rotation.y = -Math.PI / 2; scene.add(grab);
  grab.userData.returns = true; aimables.push(grab);
  const binGroup = new THREE.Group(); scene.add(binGroup);
  refreshReturnsBin = () => {                  // returned tapes lying in the tote, loose piles
    binGroup.clear();
    returnBin.slice(-12).forEach((t, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(TAPE.h, TAPE.w, TAPE.d), t.sideMat || mat.tapeBody);
      const pile = i % 3, level = Math.floor(i / 3);
      m.position.set(tx + (level % 2) * 0.03 - 0.015, ty + 0.02 + TAPE.w / 2 + level * TAPE.w, RZ - 0.22 + pile * 0.22);
      m.rotation.y = Math.PI / 2 + ((i * 0.37) % 0.5 - 0.25); binGroup.add(m);
    });
  };
  const hours = textPlane("OPEN 10A-12A DAILY", 0.9, 0.22, "#001f5c", "#fff");  // tented placard, first thing you see coming in
  hours.position.set(RX - 0.05, TOP + 0.11, FRONT + 0.3); hours.rotation.x = -0.3; hours.rotation.y = Math.PI; scene.add(hours);

  // ---- the pass-through, by the soda cooler: a lift-up countertop leaf
  // hinged at the wall plus a swinging half gate under it, both animated
  // together (see the main loop). Closed = flush with the counter.
  const FW = FLAP_X1 - FLAP_X0;
  flapPivot = new THREE.Group(); flapPivot.position.set(FLAP_X0, TOP - 0.04, 4); scene.add(flapPivot);
  const flapMesh = new THREE.Mesh(new THREE.BoxGeometry(FW - 0.01, 0.04, CD + 0.06), mat.counterTop);
  flapMesh.position.set(FW / 2, 0.02, 0); flapPivot.add(flapMesh);
  const flapEdge = new THREE.Mesh(new THREE.BoxGeometry(FW - 0.01, 0.035, 0.012), chromeC);
  flapEdge.position.set(FW / 2, 0.02, CD / 2 + 0.036); flapPivot.add(flapEdge);
  for (const hz of [-0.25, 0.25]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 10), chromeC); h.rotation.x = Math.PI / 2; h.position.set(0.01, 0.0, hz); flapPivot.add(h); }   // hinge knuckles
  flapGate = new THREE.Group(); flapGate.position.set(FLAP_X0 + 0.02, 0, 4); scene.add(flapGate);
  const gw = FW - 0.06;
  const gate = new THREE.Mesh(new THREE.BoxGeometry(gw, TOP - 0.1 - KICK, 0.04), mat.counter); gate.position.set(gw / 2, KICK + (TOP - 0.1 - KICK) / 2, 0); flapGate.add(gate);
  const gRail = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.03, 0.05), mat.counterTop); gRail.position.set(gw / 2, TOP - 0.1, 0); flapGate.add(gRail);
  for (const y of [KICK + 0.12, TOP - 0.2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.02, 0.05), chromeC); b.position.set(gw / 2, y, 0); flapGate.add(b); }
  const kickPlate = new THREE.Mesh(new THREE.BoxGeometry(gw, 0.16, 0.046), steelC); kickPlate.position.set(gw / 2, KICK + 0.08, 0); flapGate.add(kickPlate);
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.07), chromeC); pull.position.set(gw - 0.08, TOP - 0.34, 0); flapGate.add(pull);
  for (const m of [flapMesh, flapEdge, gate, gRail, pull]) { m.userData.flap = flapPivot; aimables.push(m); }
  flapCollider = { x0: FLAP_X0, x1: FLAP_X1, z0: 4 - CD / 2, z1: 4 + CD / 2 };
  colliders.push(flapCollider);                // starts closed/blocked; toggleFlap() adds/removes this

  // ---- on the counter ----
  const put = (geo, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const beigeP = new THREE.MeshLambertMaterial({ color: 0xd8d0bc }), blackC = new THREE.MeshPhongMaterial({ color: 0x151515, specular: 0x555555, shininess: 50 });
  // receipt printer beside the register, paper curling out the top
  put(new THREE.BoxGeometry(0.16, 0.12, 0.2), beigeP, -5.0, TOP + 0.06, 3.98);
  put(new THREE.BoxGeometry(0.1, 0.006, 0.05), blackC, -5.0, TOP + 0.123, 3.93);
  const paper = put(new THREE.CylinderGeometry(0.05, 0.05, 0.075, 16, 1, true, 0, Math.PI * 0.8), new THREE.MeshLambertMaterial({ color: 0xfbfbf6, side: THREE.DoubleSide }), -5.0, TOP + 0.15, 3.9);
  paper.rotation.z = Math.PI / 2;
  // security-tag deactivator pad (the "desensitizer"): tapes run across it before they leave
  const padMesh = put(new THREE.BoxGeometry(0.28, 0.025, 0.2), blackC, -3.95, TOP + 0.0125, 3.92);
  desensLed = glow(put(new THREE.BoxGeometry(0.012, 0.006, 0.012), new THREE.MeshBasicMaterial({ color: 0xff3020 }), -3.83, TOP + 0.028, 3.84));
  padMesh.userData.desens = true; aimables.push(padMesh);
  const deac = textPlane("DESENSITIZE", 0.2, 0.04, "#ddd", "#151515", "Arial", 60);
  deac.material = new THREE.MeshLambertMaterial({ map: deac.material.map }); deac.position.set(-3.97, TOP + 0.026, 3.92); deac.rotation.x = -Math.PI / 2; deac.rotation.z = Math.PI; scene.add(deac);
  // cash drawer under the register, on the employee face: slides out (toward
  // the clerk) when a sale's rung up, a till of bills and coins inside
  {
    const dz = 4 - CD / 2 - 0.01;
    cashDrawer = new THREE.Group(); cashDrawer.position.set(-5.45, TOP - 0.13, dz); scene.add(cashDrawer);
    const front = put(new THREE.BoxGeometry(0.46, 0.13, 0.02), beigeP, 0, 0, 0, cashDrawer);
    const pull = put(new THREE.BoxGeometry(0.12, 0.015, 0.02), chromeC, 0, 0, -0.012, cashDrawer);
    put(new THREE.BoxGeometry(0.42, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2a2e }), 0, -0.01, 0.16, cashDrawer);   // the till tray behind the front
    ["#8fbf8a", "#8fbf8a", "#9fc79a", "#8fbf8a", "#b9b9b0"].forEach((c, i) => put(new THREE.BoxGeometry(0.066, 0.01, 0.13), new THREE.MeshLambertMaterial({ color: c }), -0.16 + i * 0.08, 0.035, 0.18, cashDrawer));   // bills / coins
    for (const m of [front, pull]) { m.userData.drawer = true; aimables.push(m); }
  }
  // service bell on the ledge — E / click to ding it
  const LEDGE_Y = TOP + 0.17, LZ = 4 + CD / 2 - 0.03;
  const bell = new THREE.Group(); bell.position.set(-3.1, LEDGE_Y, LZ); scene.add(bell);
  put(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 20), blackC, 0, 0.01, 0, bell);
  put(new THREE.SphereGeometry(0.042, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), chromeC, 0, 0.02, 0, bell);
  put(new THREE.CylinderGeometry(0.004, 0.004, 0.025, 8), chromeC, 0, 0.07, 0, bell);
  put(new THREE.SphereGeometry(0.009, 10, 8), chromeC, 0, 0.083, 0, bell);
  bell.traverse(o => { if (o.isMesh) { o.userData.bell = true; aimables.push(o); } });
  // pen cup + "become a member" forms in an acrylic holder
  put(new THREE.CylinderGeometry(0.03, 0.028, 0.09, 14), new THREE.MeshLambertMaterial({ color: 0x1f3f86 }), -3.7, LEDGE_Y + 0.045, LZ);
  [[-0.012, 0.2, 0xc41e1e], [0.01, -0.15, 0x111111], [0, 0.05, 0x1f55c4]].forEach(([dx, tilt, c]) => {
    const pen = put(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 6), new THREE.MeshLambertMaterial({ color: c }), -3.7 + dx, LEDGE_Y + 0.1, LZ); pen.rotation.z = tilt;
  });
  const forms = makeTexture((ctx, W, H) => {
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H); ctx.fillStyle = "#00349c"; ctx.fillRect(0, 0, W, 60);
    ctx.fillStyle = "#ffd400"; ctx.font = "bold 30px Arial Black, Arial"; ctx.textAlign = "center"; ctx.fillText("BECOME A MEMBER", W / 2, 42);
    ctx.fillStyle = "#333"; ctx.font = "18px Arial"; ctx.textAlign = "left";
    ["NAME ________________", "ADDRESS _____________", "PHONE _______________", "DRIVER LIC # ________", "", "FREE RENTAL WITH SIGNUP!"].forEach((l, i) => ctx.fillText(l, 20, 100 + i * 34));
  }, 320, 320);
  const holder = new THREE.Group(); holder.position.set(-4.0, LEDGE_Y, LZ); holder.rotation.y = 0; scene.add(holder);
  const acrylicC = new THREE.MeshPhongMaterial({ color: 0xdbe8f0, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.35, depthWrite: false });
  put(new THREE.BoxGeometry(0.2, 0.2, 0.004), acrylicC, 0, 0.1, 0.04, holder).rotation.x = -0.25;
  const form = put(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshLambertMaterial({ map: forms }), 0, 0.1, 0.035, holder); form.rotation.x = -0.25;
  // hanging CHECKOUT sign over the checkout run, two panels back to back on cables
  {
    const sx = -4.2, sy = 2.75, tex = textPlane("CHECKOUT", 1.6, 0.4).material.map, m = new THREE.MeshLambertMaterial({ map: tex });
    const f = put(new THREE.PlaneGeometry(1.6, 0.4), m, sx, sy, 4.005); const b = put(new THREE.PlaneGeometry(1.6, 0.4), m, sx, sy, 3.995); b.rotation.y = Math.PI;
    for (const cx of [sx - 0.6, sx + 0.6]) put(new THREE.CylinderGeometry(0.006, 0.006, STORE.h - sy - 0.2), mat.dark, cx, (STORE.h + sy + 0.2) / 2, 4);
  }

  // ---- back cabinet under the front window: phone, paper bags, reserved holds ----
  {
    const bx0 = -6.9, bx1 = -3.4, bz = FRONT + 0.25, BHt = 0.82;
    box(bx1 - bx0, BHt - 0.03, 0.46, mat.counter, (bx0 + bx1) / 2, (BHt - 0.03) / 2, bz);
    box(bx1 - bx0 + 0.02, 0.03, 0.5, mat.counterTop, (bx0 + bx1) / 2, BHt - 0.015, bz);
    for (let d = bx0 + 0.05; d + 0.5 <= bx1; d += 0.52) {
      box(0.49, BHt - 0.14, 0.015, blueDk, d + 0.25, (BHt - 0.03) / 2 + 0.02, bz + 0.232);
      box(0.012, 0.12, 0.02, chromeC, d + 0.43, BHt - 0.2, bz + 0.245);
    }
    colliders.push({ x0: bx0, x1: bx1, z0: FRONT, z1: bz + 0.25, y1: BHt });
    // multi-line desk phone
    const ph = new THREE.Group(); ph.position.set(-6.4, BHt, bz); ph.rotation.y = Math.PI; scene.add(ph);
    const base = put(new THREE.BoxGeometry(0.22, 0.06, 0.2), beigeP, 0, 0.03, 0, ph); base.rotation.x = -0.15;
    put(new THREE.BoxGeometry(0.22, 0.04, 0.06), beigeP, 0, 0.085, -0.06, ph);                 // handset
    for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(0.018, 0.006, 0.014), i < 2 ? new THREE.MeshBasicMaterial({ color: 0xff4020 }) : blackC, -0.06 + (i % 3) * 0.03, 0.065, 0.04 + Math.floor(i / 3) * 0.025, ph);
    // stack of brown paper bags
    const kraft = new THREE.MeshLambertMaterial({ color: 0xa8804f });
    for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(0.3, 0.008, 0.2), kraft, -5.6 + (i % 2) * 0.01, BHt + 0.004 + i * 0.008, bz);
    // reserved holds: a few tapes rubber-banded with a slip on top
    const slip = new THREE.MeshLambertMaterial({ color: 0xfff59a });
    [0x8c2a1e, 0x1f3f86, 0x2f6b3a, 0xd8c9a0, 0x3a3a3a].forEach((c, i) => put(new THREE.BoxGeometry(TAPE.h, TAPE.w, TAPE.d), new THREE.MeshLambertMaterial({ color: c }), -4.4 + (i % 2) * 0.01, BHt + TAPE.w / 2 + i * TAPE.w, bz));
    put(new THREE.BoxGeometry(0.1, 0.002, 0.07), slip, -4.4, BHt + 5 * TAPE.w + 0.001, bz);
  }

  const kind = textPlane("BE KIND, REWIND", 1.6, 0.55); kind.position.set(0, 3.1, 0.16);
  kind.material = new THREE.MeshLambertMaterial({ map: kind.material.map }); // lit by the room, no unlit glow in the dark
  scene.add(kind);

  // mural stays centered on the corridor/TV-lounge axis (x=0), not the now-
  // asymmetric wall's own center — that's the sightline it's actually built for
  const logo = textPlane("VAULTBUSTER", 6, 1.2, "#ffd400", "#00349c");        // back-wall mural
  logo.position.set(0, 3.0, STORE.z - 0.15); logo.rotation.y = Math.PI;      // up where the couch can see it
  logo.material = new THREE.MeshLambertMaterial({ map: logo.material.map }); // lit by the room, dims in lights-out
  scene.add(logo);
  const tag = textPlane("WOW! WHAT A SELECTION.", 3.2, 0.4, "#fff", "#001f5c");
  tag.position.set(0, 2.1, STORE.z - 0.15); tag.rotation.y = Math.PI;   // above the TV cabinet, under the mural — the lounge sits against this wall
  tag.material = new THREE.MeshLambertMaterial({ map: tag.material.map }); // lit by the room, no unlit glow in the dark
  scene.add(tag);
}

// ---------------- entry lane: barrier rail + security gates ----------------
// The counters line the west side of the path in from the doors; a steel rail
// mirrors them on the east side, and anti-theft gate pedestals (the "metal
// detector") span the lane past the RETURNS counter. Three pedestals make two ~1.2m lanes;
// the gaps at the counter and at the rail (~0.45-0.5m) are narrower than the
// player (0.64m), so walking in means walking through a gate.
{
  const steel = new THREE.MeshPhongMaterial({ color: 0xb9bec4, specular: 0xffffff, shininess: 80 });
  const BX = 1.95, Z0 = 0.15, Z1 = 4.35;       // rail line: front wall -> level with the checkout's customer edge
  const n = Math.round((Z1 - Z0) / 1.05);
  for (let i = 0; i <= n; i++) {
    const z = Z0 + i * (Z1 - Z0) / n;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 1.0, 14), steel); post.position.set(BX, 0.5, z); scene.add(post);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.025, 16), steel); foot.position.set(BX, 0.0125, z); scene.add(foot);
  }
  for (const y of [0.5, 0.99]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, Z1 - Z0, 14).rotateX(Math.PI / 2), steel);
    rail.position.set(BX, y, (Z0 + Z1) / 2); scene.add(rail);
  }
  colliders.push({ x0: BX - 0.05, x1: BX + 0.05, z0: Z0, z1: Z1 });

  const GZ = GATE_Z;                           // gate line: past the RETURNS counter, level with the checkout corner and the rail's far end
  const grey = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const acrylic = new THREE.MeshPhongMaterial({ color: 0xdbe8f0, specular: 0xffffff, shininess: 90, transparent: true, opacity: 0.3, depthWrite: false });
  const led = gateLed = new THREE.MeshBasicMaterial({ color: 0x39ff7a });   // shared by all three: flashes red when the alarm trips
  const plate = textPlane("SECURITY", 0.3, 0.07, "#fff", "#2b3038"); plate.material = new THREE.MeshLambertMaterial({ map: plate.material.map });
  for (const x of [-1.35, 0, 1.35]) {
    const g = new THREE.Group(); g.position.set(x, 0, GZ); scene.add(g);
    const add = (geo, m, px, py, pz) => { const o = new THREE.Mesh(geo, m); o.position.set(px, py, pz); g.add(o); return o; };
    add(new THREE.BoxGeometry(0.12, 0.08, 0.52), grey, 0, 0.04, 0);                       // floor base
    add(new THREE.BoxGeometry(0.03, 1.42, 0.42), acrylic, 0, 0.08 + 0.71, 0);            // clear antenna panel
    for (const z of [-0.215, 0.215]) add(new THREE.BoxGeometry(0.05, 1.42, 0.035), grey, 0, 0.08 + 0.71, z);   // side frames
    add(new THREE.BoxGeometry(0.12, 0.07, 0.52), grey, 0, 1.535, 0);                      // top cap
    glow(add(new THREE.BoxGeometry(0.03, 0.02, 0.08), led, 0, 1.58, 0.14));               // status LED
    for (const sx of [-1, 1]) {                                                           // SECURITY plate, both faces
      const p = plate.clone(); p.position.set(sx * 0.018, 1.36, 0); p.rotation.y = sx * Math.PI / 2; g.add(p);
    }
    colliders.push({ x0: x - 0.06, x1: x + 0.06, z0: GZ - 0.26, z1: GZ + 0.26 });
  }
}

// ---------------- lobby trash receptacle ----------------
// Commercial lobby bin, not a plain can: wood-slat cabinet on a bronze plinth,
// brass trim bands, molded top, and a swinging "THANK YOU" push flap. Stands on
// the carpet just past the entry rail, facing into the store. E with a snack,
// drink or popcorn in hand throws it away (the flap swings in).
let trashFlap = null, trashFlapT = 0;
{
  const TX = 2.5, TZ = 3.85, W = 0.56, H = 1.02;
  const g = new THREE.Group(); g.position.set(TX, 0, TZ); g.rotation.y = 0; scene.add(g);   // front faces +z, into the store
  const bronze = new THREE.MeshPhongMaterial({ color: 0x3b2a1c, specular: 0x6b5238, shininess: 35 });
  const brass = new THREE.MeshPhongMaterial({ color: 0xb08432, specular: 0xffe2a0, shininess: 70 });
  const slats = makeTexture((ctx, w, h) => {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const x = i * w / n, hue = [28, 25, 30, 26, 29, 27, 24][i];
      ctx.fillStyle = `hsl(${hue} 48% ${30 + (i % 3) * 3}%)`; ctx.fillRect(x, 0, w / n, h);
      ctx.strokeStyle = "rgba(40,20,8,.35)"; ctx.lineWidth = 1;                  // wood grain
      for (let k = 0; k < 6; k++) { ctx.beginPath(); const gx = x + 4 + Math.random() * (w / n - 8); ctx.moveTo(gx, 0); ctx.bezierCurveTo(gx + 3, h * 0.3, gx - 3, h * 0.7, gx + 1, h); ctx.stroke(); }
      ctx.fillStyle = "#1c1008"; ctx.fillRect(x, 0, 3, h);                        // groove between boards
    }
  }, 256, 512);
  const wood = new THREE.MeshLambertMaterial({ map: slats });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  const parts = [];
  parts.push(add(new THREE.BoxGeometry(W + 0.06, 0.08, W + 0.06), bronze, 0, 0.04, 0));                 // plinth
  parts.push(add(new THREE.BoxGeometry(W - 0.02, H - 0.1, W - 0.02), wood, 0, 0.08 + (H - 0.1) / 2, 0)); // slatted body
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    parts.push(add(new THREE.BoxGeometry(0.045, H - 0.08, 0.045), bronze, x * W / 2, 0.08 + (H - 0.08) / 2, z * W / 2));   // corner posts
  for (const y of [0.16, H - 0.1]) parts.push(add(new THREE.BoxGeometry(W + 0.02, 0.025, W + 0.02), brass, 0, y, 0));   // brass bands
  parts.push(add(new THREE.BoxGeometry(W + 0.08, 0.05, W + 0.08), bronze, 0, H + 0.025, 0));             // molded top
  parts.push(add(new THREE.BoxGeometry(W - 0.04, 0.03, W - 0.04), bronze, 0, H + 0.065, 0));             // raised center
  for (const [dx, dz, w, d] of [[0, 1, W + 0.08, 0.02], [0, -1, W + 0.08, 0.02], [1, 0, 0.02, W + 0.08], [-1, 0, 0.02, W + 0.08]])
    parts.push(add(new THREE.BoxGeometry(w, 0.04, d), brass, dx * (W / 2 + 0.03), H + 0.07, dz * (W / 2 + 0.03)));   // tray rim
  // push flap on the front: bronze panel hinged at its top edge, gold "THANK YOU"
  parts.push(add(new THREE.BoxGeometry(0.44, 0.3, 0.012), new THREE.MeshLambertMaterial({ color: 0x0c0806 }), 0, 0.74, W / 2 - 0.004));   // dark opening behind it
  trashFlap = new THREE.Group(); trashFlap.position.set(0, 0.88, W / 2 + 0.006); g.add(trashFlap);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.014), bronze); flap.position.y = -0.13; trashFlap.add(flap); parts.push(flap);
  const thanks = textPlane("THANK YOU", 0.34, 0.08, "#e3b64a", "#3b2a1c");
  thanks.material = new THREE.MeshLambertMaterial({ map: thanks.material.map }); thanks.position.set(0, -0.13, 0.008); trashFlap.add(thanks); parts.push(thanks);
  for (const p of parts) { p.userData.trash = true; aimables.push(p); }
  colliders.push({ x0: TX - W / 2 - 0.04, x1: TX + W / 2 + 0.04, z0: TZ - W / 2 - 0.04, z1: TZ + W / 2 + 0.04 });
}

// ---------------- lobby extras: tile entry, snacks, popcorn ----------------
// real video stores tiled the entry/checkout zone and carpeted the aisles —
// same trick here: a terrazzo plane laid right over the carpet up
// front, flecked in the store's blue and yellow, split into big panels by
// brass divider strips, with a blue border band where it meets the carpet.
{
  const PANEL = 1.2;                           // meters per terrazzo panel (one texture repeat)
  const tileTex = makeTexture((ctx, W, H) => {
    ctx.fillStyle = "#e6e0d2"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9000; i++) {           // fine cement grain
      ctx.fillStyle = Math.random() < 0.5 ? "rgba(120,110,95,.18)" : "rgba(255,255,255,.35)";
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    // aggregate chips: irregular little polygons, mostly neutral stone with brand-color confetti
    const chips = [["#1d4296", 0.2], ["#00349c", 0.14], ["#ffd400", 0.12], ["#1a1a1c", 0.1], ["#8f887b", 0.2], ["#fbf8f0", 0.14], ["#b9b1a1", 0.1]];
    const pickChip = () => { let r = Math.random(); for (const [c, w] of chips) if ((r -= w) < 0) return c; return chips[0][0]; };
    for (let i = 0; i < 2600; i++) {
      const cx = Math.random() * W, cy = Math.random() * H, r = 1.5 + Math.random() ** 2.2 * 9;
      const n = 4 + Math.floor(Math.random() * 3), rot = Math.random() * Math.PI * 2;
      ctx.fillStyle = pickChip(); ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a = rot + k / n * Math.PI * 2, rr = r * (0.6 + Math.random() * 0.4);
        ctx[k ? "lineTo" : "moveTo"](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.fill();
    }
    ctx.strokeStyle = "#b8923a"; ctx.lineWidth = 6;   // brass divider strips, split across the wrap so they tile seamlessly
    ctx.strokeRect(0, 0, W, H);
  }, 1024, 1024);
  // tile covers just the entry lane + counter area: it ends with the entry rail
  // (z 4.35, level with the checkout edge) and at the rail line (x 1.95) — carpet
  // past the rail and out to the glass on the east side
  const TILE_Z = 4.35, TILE_X1 = 1.95, BORDER = 0.14;
  const XC = (WALL_L + TILE_X1) / 2, XW = TILE_X1 - WALL_L;
  tileTex.repeat.set(XW / PANEL, TILE_Z / PANEL);
  tileTex.offset.set(-((XW / PANEL) % 1), 0);   // panel seams line up with the rail edge, not the side wall
  // matte on purpose: a Phong sheen here pays per-pixel specular for every point
  // light in the store (~40, mostly poster marquees) across a floor that fills
  // the screen up close — it more than halved the frame rate in the lobby
  const terrazzo = new THREE.MeshLambertMaterial({ map: tileTex });
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(XW, TILE_Z), terrazzo);
  tile.rotation.x = -Math.PI / 2; tile.position.set(XC, 0.003, TILE_Z / 2); scene.add(tile);
  const band = new THREE.MeshLambertMaterial({ color: BLUE });
  for (const [w, d, x, z] of [[XW, BORDER, XC, TILE_Z - BORDER / 2], [BORDER, TILE_Z - BORDER, TILE_X1 - BORDER / 2, (TILE_Z - BORDER) / 2]]) {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, d), band);
    b.rotation.x = -Math.PI / 2; b.position.set(x, 0.008, z); scene.add(b);   // 5 mm over the tile — 1 mm flickered at a distance
  }
}
// ---------------- snack center: drink cooler, popcorn machine ----------------
// Two fixtures against the movie-side wall, just past the register's
// customer edge (z 4.35), all facing the store. Each is modeled in its own local
// frame — front faces +z, width along x, origin at floor center — then turned
// to face +x. Local +x ends up pointing north (toward the register).
const SNACK_ZONE = [4.5, 7.4];               // wall z-span the fixtures cover — side-wall posters skip it
// Branding slots: set window.VAULT_BRANDING = { "cooler-marquee": "data:image/…", … }
// (data URIs — file:// can't feed local image files to WebGL) to swap in real
// art; each slot otherwise draws a placeholder. Slot sizes (w x h, meters):
//   cooler-marquee 0.74x0.2 · cooler-side 0.7x1.66 · popcorn-header 0.52x0.11
//   popcorn-cart 0.54x0.54 · snack-header 0.96x0.28
const BRANDING = window.VAULT_BRANDING || {};
function brandTex(slot, w, h, draw) {
  if (BRANDING[slot]) { const t = new THREE.TextureLoader().load(BRANDING[slot]); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const k = 512 / Math.max(w, h);
  return makeTexture(draw, Math.round(w * k), Math.round(h * k));
}
let coolerDoor = null, coolerOpen = false, coolerThermo = null;
let popcornKit = null;                       // cup geometry/material + popcorn texture, reused for the box in your hand
let buildSnackRack = null;                   // (width, header) -> a stocked snack rack group; set in the snack center
{
  const WX = WALL_L + 0.1;                    // movie-side wall's inner face
  const addTo = (parent, geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
  const place = (g, depth, width, z) => {     // back against the wall, facing the store, plus a footprint collider
    g.rotation.y = Math.PI / 2; g.position.set(WX + 0.01 + depth / 2, 0, z); scene.add(g);
    colliders.push({ x0: WX, x1: WX + 0.01 + depth, z0: z - width / 2, z1: z + width / 2 });
  };
  const chrome = new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 90 });
  const glass = new THREE.MeshLambertMaterial({ color: 0xcfe9f7, transparent: true, opacity: 0.16, depthWrite: false });

  // ---- drink cooler: glass-door merchandiser, 0.78 wide, 2.1 tall with its marquee ----
  {
    const W = 0.78, D = 0.74, H = 1.86, KICK = 0.1, T = 0.035, CZ = 5.25;
    const g = new THREE.Group();
    const shell = new THREE.MeshLambertMaterial({ color: 0x1b1d22 });
    const liner = new THREE.MeshLambertMaterial({ color: 0xe4ebf1, emissive: 0xa9bdd0, emissiveIntensity: 0.35 });   // lit interior — glows a bit in lights-out, like a real one
    for (const sx of [-1, 1]) addTo(g, new THREE.BoxGeometry(T, H, D), shell, sx * (W / 2 - T / 2), H / 2, 0);
    addTo(g, new THREE.BoxGeometry(W, T, D), shell, 0, H - T / 2, 0);
    addTo(g, new THREE.BoxGeometry(W, H, T), shell, 0, H / 2, -D / 2 + T / 2);
    const slats = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#15171b"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2c3036"; for (let y = 6; y < h; y += 14) ctx.fillRect(10, y, w - 20, 6);
    }, 256, 64);
    addTo(g, new THREE.BoxGeometry(W, KICK, D - 0.02), new THREE.MeshLambertMaterial({ map: slats }), 0, KICK / 2, -0.01);  // louvered kick plate
    // interior: liner walls, floor, a light strip up top, and shelves
    const IW = W - 2 * T, IB = -D / 2 + T, IF = D / 2 - 0.05, ID = IF - IB, IH = H - T - KICK;
    addTo(g, new THREE.BoxGeometry(IW, IH, 0.01), liner, 0, KICK + IH / 2, IB + 0.005);
    for (const sx of [-1, 1]) addTo(g, new THREE.BoxGeometry(0.01, IH, ID), liner, sx * (IW / 2 - 0.005), KICK + IH / 2, (IB + IF) / 2);
    addTo(g, new THREE.BoxGeometry(IW, 0.01, ID), liner, 0, KICK + 0.005, (IB + IF) / 2);
    addTo(g, new THREE.BoxGeometry(IW, 0.01, ID), liner, 0, H - T - 0.005, (IB + IF) / 2);
    glow(addTo(g, new THREE.BoxGeometry(IW - 0.06, 0.018, 0.03), new THREE.MeshBasicMaterial({ color: 0xf4f9ff }), 0, H - T - 0.025, IF - 0.04));
    const wire = new THREE.MeshLambertMaterial({ color: 0x9aa3ad });
    const priceStrip = new THREE.MeshLambertMaterial({ color: 0xffffff });
    // shelf tops (y) for stocking drinks later — plus the cooler floor at KICK
    g.userData.shelves = [0.46, 0.8, 1.14, 1.48];
    for (const y of g.userData.shelves) {
      addTo(g, new THREE.BoxGeometry(IW - 0.02, 0.012, ID - 0.04), wire, 0, y - 0.006, (IB + IF) / 2 - 0.01);
      addTo(g, new THREE.BoxGeometry(IW - 0.02, 0.028, 0.006), priceStrip, 0, y - 0.01, IF - 0.03);     // price-tag strip on the shelf lip
    }
    // ---- drinks: each unit is a small group (body, label, cap); every mesh in it
    // points back to the unit so the whole bottle/can is what you grab ----
    {
      const levels = [KICK + 0.01, ...g.userData.shelves];          // floor, then each shelf top
      const layout = [[[0], 1], [[1, 2], 1], [[3, 4], 1], [[5, 6], 1], [[7, 8, 9], 2]];   // [products, stack height] per level
      const silver = new THREE.MeshPhongMaterial({ color: 0xc7ccd2, specular: 0xffffff, shininess: 80 });
      const labelTex = (p, w, h) => makeTexture((ctx, W, H) => {
        ctx.fillStyle = p.label[0]; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = p.label[1]; ctx.fillRect(0, H * 0.08, W, H * 0.05); ctx.fillRect(0, H * 0.87, W, H * 0.05);
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        let f = H * 0.42; ctx.font = `italic 900 ${f}px Arial Black, Arial`;
        while (ctx.measureText(p.name).width > W * 0.4 && f > 8) { f -= 2; ctx.font = `italic 900 ${f}px Arial Black, Arial`; }
        for (const cx of [0.25, 0.75]) ctx.fillText(p.name, W * cx, H / 2);   // front + back of the wrap
      }, w, h);
      const lathe = (pts, m) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24), m);
      const build = p => {                    // one template per product; units are clones (shared geometry/materials)
        const u = new THREE.Group(), { r, h } = p;
        if (p.shape === "can") {
          const side = new THREE.MeshLambertMaterial({ map: labelTex(p, 512, Math.round(512 * h / (Math.PI * 2 * r))) });
          const can = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h * 0.94, 24).rotateY(-Math.PI / 2), [side, silver, silver]);
          can.position.y = h * 0.47; u.add(can);
          u.add(lathe([[r, h * 0.94], [r * 0.86, h * 0.985], [r * 0.84, h], [0, h]], silver));   // tapered top + lid
          u.add(lathe([[0, 0], [r * 0.84, 0], [r, h * 0.03]], silver));                           // domed bottom rim
        } else {
          const long = p.shape === "longneck";
          const body = long
            ? [[0, 0], [r * 0.92, 0], [r, 0.012], [r, h * 0.55], [r * 0.9, h * 0.62], [r * 0.42, h * 0.76], [r * 0.38, h * 0.95], [0.001, h * 0.95]]
            : [[0, 0], [r * 0.9, 0], [r, 0.01], [r, h * 0.28], [r * 0.9, h * 0.34], [r, h * 0.42], [r, h * 0.62], [r * 0.92, h * 0.7], [r * 0.45, h * 0.84], [r * 0.42, h * 0.92], [0.001, h * 0.92]];
          const glassMat = new THREE.MeshPhongMaterial({ color: p.glass, specular: 0xffffff, shininess: 90, transparent: p.opacity < 1, opacity: p.opacity });
          u.add(lathe(body, glassMat));
          const [l0, l1] = long ? [0.14, 0.44] : [0.42, 0.62];                 // label band, as fractions of height
          const band = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.0015, r + 0.0015, h * (l1 - l0), 24, 1, true).rotateY(-Math.PI / 2),
            new THREE.MeshLambertMaterial({ map: labelTex(p, 512, Math.round(512 * h * (l1 - l0) / (Math.PI * 2 * r))) }));
          band.position.y = h * (l0 + l1) / 2; u.add(band);
          const capMat = new THREE.MeshPhongMaterial({ color: p.cap, specular: 0xffffff, shininess: 50 });
          const cap = long ? new THREE.CylinderGeometry(r * 0.42, r * 0.44, h * 0.05, 16) : new THREE.CylinderGeometry(r * 0.47, r * 0.47, h * 0.08, 16);
          const capM = new THREE.Mesh(cap, capMat); capM.position.y = long ? h * 0.975 : h * 0.96; u.add(capM);
        }
        u.userData.snack = p;
        return u;
      };
      layout.forEach(([ids, stack], li) => {
        const segW = (IW - 0.03) / ids.length;
        ids.forEach((pi, si) => {
          const p = DRINK_PRODUCTS[pi], tmpl = build(p), pitch = 2 * p.r + 0.008;
          const across = Math.max(1, Math.floor(segW / pitch));
          const x0 = -(IW - 0.03) / 2 + si * segW + (segW - (across - 1) * pitch) / 2;
          for (let row = 0; row < 3; row++) for (let a = 0; a < across; a++) for (let k = 0; k < stack; k++) {
            const u = tmpl.clone();
            u.position.set(x0 + a * pitch, levels[li] + k * p.h, IF - 0.05 - p.r - row * (2 * p.r + 0.012));
            u.traverse(m => { if (m.isMesh) { m.userData.unit = u; aimables.push(m); } });
            g.add(u);
          }
        });
      });
    }
    // digital thermometer, stuck in the top hinge-side corner behind the glass
    const thermoTex = makeTexture(() => {}, 128, 64);
    const tctx = thermoTex.image.getContext("2d");
    const thermo = new THREE.Group(); thermo.position.set(IW / 2 - 0.065, H - T - 0.075, IF - 0.02); g.add(thermo);
    addTo(thermo, new THREE.BoxGeometry(0.085, 0.048, 0.016), new THREE.MeshLambertMaterial({ color: 0xe9ecef }), 0, 0, 0);
    addTo(thermo, new THREE.PlaneGeometry(0.066, 0.03), new THREE.MeshBasicMaterial({ map: thermoTex }), 0, 0.002, 0.0085);
    coolerThermo = {
      temp: 36, shown: null,
      tick(dt) {                              // drifts up while the door's open, settles back to 36°F once it shuts
        this.temp += ((coolerOpen ? 46 : 36) - this.temp) * Math.min(1, dt * (coolerOpen ? 0.025 : 0.06));
        const t = Math.round(this.temp);
        if (t === this.shown) return;
        this.shown = t;
        tctx.fillStyle = "#9fb89a"; tctx.fillRect(0, 0, 128, 64);                    // backlit LCD
        tctx.fillStyle = "#1d2a1c"; tctx.textAlign = "right"; tctx.textBaseline = "middle";
        tctx.font = "bold 44px 'Courier New', monospace"; tctx.fillText(String(t), 92, 34);
        tctx.font = "bold 20px Arial"; tctx.fillText("°F", 122, 24);
        thermoTex.needsUpdate = true;
      },
    };
    coolerThermo.tick(0);
    // full glass door, hinged on the register-side (+x) edge, swings out
    coolerDoor = new THREE.Group(); coolerDoor.position.set(W / 2, 0, D / 2 - 0.02); g.add(coolerDoor);
    const DW = W, DH = H - KICK, SW = 0.05, doorY = KICK + DH / 2;
    const doorParts = [
      addTo(coolerDoor, new THREE.BoxGeometry(SW, DH, 0.04), shell, -SW / 2, doorY, 0),                    // hinge stile
      addTo(coolerDoor, new THREE.BoxGeometry(SW, DH, 0.04), shell, -DW + SW / 2, doorY, 0),               // latch stile
      addTo(coolerDoor, new THREE.BoxGeometry(DW, 0.07, 0.04), shell, -DW / 2, KICK + 0.035, 0),           // bottom rail
      addTo(coolerDoor, new THREE.BoxGeometry(DW, 0.06, 0.04), shell, -DW / 2, H - 0.03, 0),               // top rail
      addTo(coolerDoor, new THREE.BoxGeometry(DW - 2 * SW, DH - 0.13, 0.012), glass, -DW / 2, KICK + 0.07 + (DH - 0.13) / 2, 0),
      addTo(coolerDoor, new THREE.CylinderGeometry(0.012, 0.012, 0.9, 10), chrome, -DW + 0.06, 1.0, 0.06), // pull handle
    ];
    for (const dy of [-0.4, 0.4]) doorParts.push(addTo(coolerDoor, new THREE.BoxGeometry(0.02, 0.02, 0.05), chrome, -DW + 0.06, 1.0 + dy, 0.035));
    for (const p of doorParts) { p.userData.coolerDoor = true; aimables.push(p); }
    // branding: marquee light box on top, full-height graphics on both outer sides
    const MH = 0.24;
    addTo(g, new THREE.BoxGeometry(W, MH, 0.16), shell, 0, H + MH / 2, D / 2 - 0.08);
    const marqueeTex = brandTex("cooler-marquee", 0.74, 0.2, (ctx, w, h) => {
      const gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "#e0141e"); gr.addColorStop(1, "#8e0a10");
      ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 900 ${h * 0.5}px Arial Black, Arial`; ctx.fillText("ICE COLD", w / 2, h * 0.4);
      ctx.font = `bold ${h * 0.22}px Arial`; ctx.fillText("VAULT COLA · DRINKS", w / 2, h * 0.8);
    });
    addTo(g, new THREE.PlaneGeometry(0.74, 0.2), new THREE.MeshBasicMaterial({ map: marqueeTex }), 0, H + MH / 2, D / 2 + 0.001);
    const sideTex = brandTex("cooler-side", 0.7, 1.66, (ctx, w, h) => {
      ctx.fillStyle = "#c8101c"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#fff"; ctx.lineWidth = w * 0.09;                      // white swoosh
      ctx.beginPath(); ctx.moveTo(-10, h * 0.62); ctx.bezierCurveTo(w * 0.4, h * 0.5, w * 0.6, h * 0.8, w + 10, h * 0.66); ctx.stroke();
      ctx.save(); ctx.translate(w / 2, h * 0.32); ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 900 ${w * 0.3}px Arial Black, Arial`; ctx.fillText("VAULT", 0, -w * 0.13);
      ctx.fillText("COLA", 0, w * 0.2); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.font = `bold ${w * 0.1}px Arial`; ctx.fillText("ICE COLD", w / 2, h * 0.9);
    });
    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
    for (const sx of [-1, 1]) {
      const p = addTo(g, new THREE.PlaneGeometry(0.7, 1.66), sideMat, sx * (W / 2 + 0.001), KICK + 0.03 + 1.66 / 2, 0);
      p.rotation.y = sx * Math.PI / 2;
    }
    place(g, D, W, CZ);
  }

  // ---- popcorn machine: red kettle machine on its cart, condiment shelf on the side ----
  {
    const PZ = 6.75, CW = 0.62, CD = 0.46, SHELF = 0.3;
    const g = new THREE.Group();
    const pop = (m, what) => { m.userData.popcorn = what; aimables.push(m); return m; };   // popcorn-sequence targets
    const red = new THREE.MeshLambertMaterial({ color: 0xc8102e });
    const gold = new THREE.MeshPhongMaterial({ color: 0xd4a017, specular: 0xfff0b0, shininess: 60 });
    const black = new THREE.MeshLambertMaterial({ color: 0x141414 });
    // cart: body on casters, gold trim, graphic panel on the front
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      addTo(g, new THREE.CylinderGeometry(0.04, 0.04, 0.035, 12), black, x * (CW / 2 - 0.06), 0.04, z * (CD / 2 - 0.06)).rotation.z = Math.PI / 2;
      addTo(g, new THREE.BoxGeometry(0.03, 0.07, 0.03), chrome, x * (CW / 2 - 0.06), 0.09, z * (CD / 2 - 0.06));
    }
    addTo(g, new THREE.BoxGeometry(CW, 0.66, CD), red, 0, 0.12 + 0.33, 0);
    addTo(g, new THREE.BoxGeometry(CW + 0.02, 0.025, CD + 0.02), gold, 0, 0.79, 0);
    addTo(g, new THREE.BoxGeometry(CW + 0.01, 0.02, CD + 0.01), gold, 0, 0.13, 0);
    const cartTex = brandTex("popcorn-cart", 0.54, 0.54, (ctx, w, h) => {
      for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? "#fff6e0" : "#d81e2c"; ctx.fillRect(i * w / 9, 0, w / 9 + 1, h); }
      ctx.fillStyle = "#ffd400"; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#8e0a10"; ctx.lineWidth = w * 0.02; ctx.stroke();
      ctx.fillStyle = "#b3121d"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 900 ${w * 0.1}px Arial Black, Arial`; ctx.fillText("FRESH", w / 2, h * 0.43); ctx.fillText("POPCORN", w / 2, h * 0.57);
    });
    addTo(g, new THREE.PlaneGeometry(0.54, 0.54), new THREE.MeshLambertMaterial({ map: cartTex }), 0, 0.46, CD / 2 + 0.001);
    // kettle cabinet: red plinth + corner posts, glass all round, red top with a lit header
    const K0 = 0.8, KH = 0.56, KW = 0.58, KD = 0.42;
    addTo(g, new THREE.BoxGeometry(KW, 0.08, KD), red, 0, K0 + 0.04, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) addTo(g, new THREE.BoxGeometry(0.03, KH, 0.03), red, x * (KW / 2 - 0.015), K0 + 0.08 + KH / 2, z * (KD / 2 - 0.015));
    pop(addTo(g, new THREE.BoxGeometry(KW - 0.06, KH, 0.006), glass, 0, K0 + 0.08 + KH / 2, KD / 2 - 0.015), "corn");    // front
    addTo(g, new THREE.BoxGeometry(KW - 0.06, KH, 0.006), glass, 0, K0 + 0.08 + KH / 2, -KD / 2 + 0.015);   // back
    for (const sx of [-1, 1]) pop(addTo(g, new THREE.BoxGeometry(0.006, KH, KD - 0.06), glass, sx * (KW / 2 - 0.015), K0 + 0.08 + KH / 2, 0), "corn");
    const TOP = K0 + 0.08 + KH;
    addTo(g, new THREE.BoxGeometry(KW, 0.15, KD), red, 0, TOP + 0.075, 0);
    addTo(g, new THREE.BoxGeometry(KW + 0.015, 0.02, KD + 0.015), gold, 0, TOP + 0.16, 0);
    addTo(g, new THREE.CylinderGeometry(0.035, 0.05, 0.05, 16), gold, 0, TOP + 0.195, 0);              // little crown on the roof
    const headerTex = brandTex("popcorn-header", 0.52, 0.11, (ctx, w, h) => {
      ctx.fillStyle = "#b3121d"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#ffd400"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 900 ${h * 0.72}px Arial Black, Arial`; ctx.fillText("POPCORN", w / 2, h * 0.54);
    });
    addTo(g, new THREE.PlaneGeometry(0.52, 0.11), new THREE.MeshBasicMaterial({ map: headerTex }), 0, TOP + 0.075, KD / 2 + 0.001);
    // inside: warming light, kettle hanging off its rod, popcorn heaped on the deck
    glow(addTo(g, new THREE.BoxGeometry(KW - 0.12, 0.012, 0.04), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), 0, TOP - 0.01, 0.1));
    const steel = new THREE.MeshPhongMaterial({ color: 0xa3a9b0, specular: 0xffffff, shininess: 80 });
    addTo(g, new THREE.CylinderGeometry(0.007, 0.007, 0.14, 8), steel, 0, TOP - 0.07, -0.02);
    const kettle = addTo(g, new THREE.CylinderGeometry(0.1, 0.085, 0.1, 20), steel, 0, TOP - 0.19, -0.02); kettle.rotation.z = 0.12;
    addTo(g, new THREE.CylinderGeometry(0.105, 0.105, 0.012, 20), steel, 0, TOP - 0.135, -0.02).rotation.z = 0.12;
    const cornTex = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#f3cf6b"; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = ["#fff8e2", "#fbe8a8", "#f6d77e", "#fffdf4"][i % 4];
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
      }
    }, 256, 256);
    const corn = addTo(g, new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ map: cornTex, emissive: 0x6a4a10, emissiveIntensity: 0.4 }), 0, K0 + 0.08, 0);
    corn.scale.set((KW - 0.06) / 1.0, 0.36, (KD - 0.06) / 1.0); pop(corn, "corn");
    // condiment shelf bolted to the side facing the snack rack (local -x)
    const SX = -CW / 2 - SHELF / 2, SY = 0.79;
    addTo(g, new THREE.BoxGeometry(SHELF, 0.025, CD - 0.04), red, SX, SY, 0);
    addTo(g, new THREE.BoxGeometry(SHELF, 0.03, 0.012), chrome, SX, SY + 0.025, (CD - 0.04) / 2);            // front rail
    addTo(g, new THREE.BoxGeometry(0.012, 0.03, CD - 0.04), chrome, SX - SHELF / 2, SY + 0.025, 0);          // end rail
    const brace = addTo(g, new THREE.BoxGeometry(0.02, 0.36, 0.02), chrome, SX + 0.04, SY - 0.13, 0); brace.rotation.z = -0.62;
    const ST = SY + 0.0125;                   // shelf top
    // stack of paper popcorn boxes: tapered, red-and-white striped, nested
    const boxTex = makeTexture((ctx, w, h) => {
      for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? "#fffaf0" : "#d81e2c"; ctx.fillRect(i * w / 12, 0, w / 12 + 1, h); }
      ctx.fillStyle = "#ffd400"; ctx.fillRect(0, h * 0.4, w, h * 0.2);
    }, 256, 128);
    const cup = new THREE.CylinderGeometry(0.052, 0.036, 0.12, 4, 1, true); cup.rotateY(Math.PI / 4);
    const cupMat = new THREE.MeshLambertMaterial({ map: boxTex, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) pop(addTo(g, cup, cupMat, SX + 0.06, ST + 0.06 + i * 0.016, -0.1), "boxes");
    popcornKit = { cup, cupMat, cornTex };
    // salt shaker, sugar pourer, butter pump
    const shakerGlass = new THREE.MeshLambertMaterial({ color: 0xf4f6f8, transparent: true, opacity: 0.75 });
    pop(addTo(g, new THREE.CylinderGeometry(0.022, 0.024, 0.07, 14), shakerGlass, SX - 0.06, ST + 0.035, 0.1), "salt");
    pop(addTo(g, new THREE.SphereGeometry(0.023, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), chrome, SX - 0.06, ST + 0.07, 0.1), "salt");
    const sugarGlass = new THREE.MeshLambertMaterial({ color: 0xfaf3e6, transparent: true, opacity: 0.8 });
    pop(addTo(g, new THREE.CylinderGeometry(0.03, 0.032, 0.09, 16), sugarGlass, SX + 0.03, ST + 0.045, 0.11), "sugar");
    pop(addTo(g, new THREE.CylinderGeometry(0.008, 0.032, 0.035, 16), chrome, SX + 0.03, ST + 0.107, 0.11), "sugar");
    pop(addTo(g, new THREE.CylinderGeometry(0.004, 0.006, 0.03, 8), chrome, SX + 0.03, ST + 0.135, 0.11), "sugar");
    const butterTex = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#f7d44c"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#b3121d"; ctx.fillRect(0, h * 0.34, w, h * 0.32);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `bold ${h * 0.22}px Arial Black, Arial`; ctx.fillText("BUTTER", w * 0.25, h * 0.5); ctx.fillText("BUTTER", w * 0.75, h * 0.5);
    }, 256, 128);
    pop(addTo(g, new THREE.CylinderGeometry(0.045, 0.045, 0.16, 20), new THREE.MeshLambertMaterial({ map: butterTex }), SX - 0.07, ST + 0.08, -0.07), "butter");
    pop(addTo(g, new THREE.CylinderGeometry(0.012, 0.012, 0.05, 10), black, SX - 0.07, ST + 0.185, -0.07), "butter");
    pop(addTo(g, new THREE.BoxGeometry(0.03, 0.018, 0.06), black, SX - 0.07, ST + 0.215, -0.05), "butter");   // pump head + nozzle
    place(g, CD, CW, PZ);
    colliders.push({ x0: WX, x1: WX + 0.01 + CD, z0: PZ + CW / 2, z1: PZ + CW / 2 + SHELF });   // the side shelf (local -x = world +z)
  }

  // ---- snack rack: 1.62 tall, sloped shelves, every product its own shape ----
  // (a function: the candy aisle out on the floor builds it — see the store layout)
  const RD = 0.42, RH = 1.62;
  buildSnackRack = (RW, header = "SNACKS") => {
    const g = new THREE.Group();
    const frame = new THREE.MeshLambertMaterial({ color: 0x1c1f26 });
    for (const sx of [-1, 1]) addTo(g, new THREE.BoxGeometry(0.03, RH, RD), frame, sx * (RW / 2 - 0.015), RH / 2, 0);
    const peg = makeTexture((ctx, w, h) => {
      ctx.fillStyle = "#2a2e36"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#15171b"; for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) ctx.fillRect(x, y, 3, 3);
    }, 256, 512);
    aimBlockers.push(addTo(g, new THREE.BoxGeometry(RW - 0.06, RH - 0.02, 0.02), new THREE.MeshLambertMaterial({ map: peg }), 0, RH / 2, -RD / 2 + 0.01));
    const headerTex = brandTex("snack-header", 0.96, 0.28, (ctx, w, h) => {
      ctx.fillStyle = "#00349c"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#ffd400"; ctx.lineWidth = h * 0.06; ctx.strokeRect(h * 0.05, h * 0.05, w - h * 0.1, h - h * 0.1);
      ctx.fillStyle = "#ffd400"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `italic 900 ${h * 0.55}px Arial Black, Arial`; ctx.fillText(header, w / 2, h * 0.53);
      ctx.fillStyle = "#fff"; ctx.font = `${h * 0.3}px Arial`; ctx.fillText("★", w * 0.13, h * 0.53); ctx.fillText("★", w * 0.87, h * 0.53);
    });
    addTo(g, new THREE.BoxGeometry(RW, 0.3, 0.05), frame, 0, RH - 0.15, -RD / 2 + 0.06);
    addTo(g, new THREE.PlaneGeometry(0.96, 0.28), new THREE.MeshLambertMaterial({ map: headerTex }), 0, RH - 0.15, -RD / 2 + 0.086);   // lit by the room, no glow
    const TILT = 0.12, shelfYs = [0.18, 0.5, 0.8, 1.07];
    const board = new THREE.MeshLambertMaterial({ color: 0xd9dde2 }), lip = new THREE.MeshLambertMaterial({ color: 0xffd400 });
    for (const y of shelfYs) {                // tilted toward the shopper, yellow price lip on the front edge
      const b = addTo(g, new THREE.BoxGeometry(RW - 0.06, 0.015, RD - 0.04), board, 0, y, 0); b.rotation.x = TILT;
      addTo(g, new THREE.BoxGeometry(RW - 0.06, 0.04, 0.008), lip, 0, y - (RD / 2 - 0.02) * Math.sin(TILT) + 0.012, RD / 2 - 0.02);
    }
    // one texture per product: its color, its name, a few shape-specific touches
    const labelTex = p => makeTexture((ctx, w, h) => {
      ctx.fillStyle = p.color; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,.18)";
      if (p.shape === "bag") { ctx.fillRect(0, 0, w, h * 0.08); ctx.fillRect(0, h * 0.92, w, h * 0.08); }  // crimped seals
      if (p.shape === "bar") { ctx.fillRect(0, h * 0.7, w, h * 0.3); }
      if (p.shape === "tube") { ctx.fillStyle = "#e9ecef"; ctx.fillRect(0, 0, w, h * 0.06); }
      if (p.shape === "box") { ctx.strokeStyle = "#ffd400"; ctx.lineWidth = w * 0.05; ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88); }
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      const words = p.name.split(" "), vertical = h > w * 1.2, sliver = h > w * 2.5;   // sliver: licorice-thin
      const maxW = p.shape === "tube" ? w * 0.4 : w * 0.9;                                 // a tube only shows ~half its wrap
      let f = (vertical ? w * 0.26 : h * 0.34);
      ctx.font = `italic 900 ${f}px Arial Black, Arial`;
      while (Math.max(...words.map(s => ctx.measureText(s).width)) > maxW && f > 8) { f -= 2; ctx.font = `italic 900 ${f}px Arial Black, Arial`; }
      if (p.shape === "tube") words.forEach((s, i) => { for (const cx of [0.25, 0.75]) ctx.fillText(s, w * cx, h / 2 + (i - (words.length - 1) / 2) * f * 1.05); });
      else if (sliver) {                      // licorice-thin: name runs up the length, like the real packs
        ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(-Math.PI / 2);
        let fv = w * 0.62; ctx.font = `italic 900 ${fv}px Arial Black, Arial`;
        while (ctx.measureText(p.name).width > h * 0.86 && fv > 8) { fv -= 2; ctx.font = `italic 900 ${fv}px Arial Black, Arial`; }
        ctx.fillText(p.name, 0, 0); ctx.restore();
      }
      else if (vertical) words.forEach((s, i) => ctx.fillText(s, w / 2, h / 2 + (i - (words.length - 1) / 2) * f * 1.05));
      else ctx.fillText(p.name, w / 2, h / 2);
    }, p.shape === "tube" ? 512 : 256, p.shape === "tube" ? Math.round(512 * p.h / (Math.PI * p.w)) : Math.round(256 * p.h / p.w));
    // chip bags: a box puffed out in the middle and pinched flat at the sealed top and bottom
    const pillow = (w, h, d) => {
      const geo = new THREE.BoxGeometry(w, h, d, 8, 10, 1), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i) / (w / 2), ny = pos.getY(i) / (h / 2);
        pos.setZ(i, pos.getZ(i) * Math.max(0.08, (1 - 0.5 * nx * nx) * (1 - Math.pow(Math.abs(ny), 5))));
      }
      geo.computeVertexNormals(); return geo;
    };
    const geoFor = p => p.shape === "bag" ? pillow(p.w, p.h, p.d)
      : p.shape === "tube" ? new THREE.CylinderGeometry(p.w / 2, p.w / 2, p.h, 20).rotateY(-Math.PI / 2)   // texture seam to the back, label (u=.25/.75) front and back
      : new THREE.BoxGeometry(p.w, p.h, p.d);
    // [shelf, which half, stack height]: bags bottom, tubes + licorice, theater boxes, then bars + gum piled up top
    const layout = [[0, -1, 1], [0, 1, 1], [1, -1, 1], [1, 1, 1], [2, -1, 1], [2, 1, 1], [3, -1, 3], [3, 1, 4]];
    SNACK_PRODUCTS.forEach((p, pi) => {
      const [si, half, stack] = layout[pi];
      if (!p.geo) {                            // built once, shared by every rack
        const tex = labelTex(p);
        const side = new THREE.MeshLambertMaterial({ color: p.color });
        const face = new THREE.MeshLambertMaterial({ map: tex });
        p.mat = p.shape === "box" || p.shape === "bar" || p.shape === "gum" ? [side, side, side, side, face, side] : face;
        p.geo = geoFor(p);                     // what you get in hand is this exact geometry + material
      }
      const geo = p.geo, m = p.mat;
      const across = Math.max(1, Math.floor((RW / 2 - 0.05) / (p.w + 0.015)));
      const x0 = half * (RW / 4) - (across - 1) * (p.w + 0.015) / 2;
      for (let row = 0; row < 2; row++) for (let a = 0; a < across; a++) for (let k = 0; k < stack; k++) {
        const z = 0.1 - row * (p.d + 0.05);
        const y = shelfYs[si] + 0.009 + p.h / 2 + k * p.h - z * Math.tan(TILT);   // sits on the tilted board
        const u = addTo(g, geo, m, x0 + a * (p.w + 0.015), y, z);
        u.rotation.x = TILT;
        u.userData.snack = p; aimables.push(u);
      }
    });
    return g;                                  // local +z faces the shopper; the pegboard back is at z = -RD/2
  };
  buildSnackRack.depth = RD;
}

// ---------------- posters on the walls ----------------
const marquee = [];   // flashing bulbs around the posters: { mat, phase }
const posterMats = [];                     // lamps-out mode: posters glow faintly under their marquees
{
  // chosen by fetch-covers.mjs: top movies + a few top non-cartoon shows
  const picks = (window.VAULT_POSTERS || []).map(art => ({ art }));
  const loader = new THREE.TextureLoader();
  const bulbGeo = new THREE.SphereGeometry(0.022, 6, 5);
  const pts = [];                          // bulb ring around one poster, wall-local coords
  for (let j = 0; j < 7; j++) { pts.push([-0.485 + (j + 0.5) * 0.97 / 7, 0.695]); pts.push([-0.485 + (j + 0.5) * 0.97 / 7, -0.695]); }
  for (let j = 0; j < 9; j++) { pts.push([-0.485, -0.695 + (j + 0.5) * 1.39 / 9]); pts.push([0.485, -0.695 + (j + 0.5) * 1.39 / 9]); }
  function placePoster(tape, x, y, z, ry, i) {  // group faces +z local; wall sits just behind
    if (!tape) return;                       // fewer posters than wall spots: leave the spot bare
    loader.load(artUrl(tape.art), t => {
      t.colorSpace = THREE.SRGBColorSpace;
      const g = new THREE.Group(); g.position.set(x, overWallShelf(x, z) ? 2.85 : y, z); g.rotation.y = ry;   // lifted clear of any wall shelving below it
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.97, 1.39, 0.04), mat.dark);
      back.position.z = -0.027; g.add(back);
      const pm = new THREE.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveIntensity: 0, emissiveMap: t });
      posterMats.push(pm);
      g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.31), pm));
      pts.forEach(([px, py], j) => {
        const bm = new THREE.MeshBasicMaterial({ color: 0xffd400 });
        const b = glow(new THREE.Mesh(bulbGeo, bm)); b.position.set(px, py, 0.04); g.add(b);
        marquee.push({ mat: bm, phase: i * 1.3 + j * 0.55 });
      });
      // the marquee bulbs actually cast a bit of warm light now, not just an
      // unlit color chase — modest range/intensity so ~24 of these stay cheap;
      // not in allLights, so (like the couch lamps) they survive lights-out
      const pl = new THREE.PointLight(0xffcf70, 0.4, 2.4, 2); pl.position.set(0, 0, 0.35); g.add(pl);
      scene.add(g);
    });
  }
  // front & back walls, each split in two (front around the doors, back around
  // the mural): n posters per section with every gap equal — section edge to
  // poster and poster to poster. Section edges stop short of the side-wall
  // beam (0.31) and clear the door frame / mural by 0.2.
  const PW = 0.97, CORNER = 0.31;                   // poster frame width
  const spread = (a, b, n) => { const gap = (b - a - n * PW) / (n + 1); return Array.from({ length: n }, (_, k) => a + gap * (k + 1) + PW * (k + 0.5)); };
  const frontXs = [...spread(WALL_L + CORNER, -2.0, 2), ...spread(2.0, STORE.x - CORNER, 2)];
  const backXs = [...spread(WALL_L + CORNER, -3.2, 2), ...spread(3.2, BOH_DOORS.store - BOH_OPENING_W / 2 - 0.3, 2)];   // right half stops short of the back-hall opening
  frontXs.forEach((x, i) => placePoster(picks[i], x, 2.1, 0.26, 0, i));
  backXs.forEach((x, i) => placePoster(picks[4 + i], x, 2.1, STORE.z - 0.26, Math.PI, 4 + i));
  for (let s = 0; s < 16; s++) {           // regular run down both bare side walls, mounted on the beam
    const side = s < 8 ? -1 : 1, i = 8 + s;
    const wx = side < 0 ? WALL_L + 0.36 : STORE.x - 0.36;   // hug whichever wall (movie side pulled in)
    const pz = 2.6 + (s % 8) * 3.25;
    if (side < 0 && pz + 0.49 > SNACK_ZONE[0] && pz - 0.49 < SNACK_ZONE[1]) continue;   // the cooler/popcorn/snack run stands here
    placePoster(picks[i], wx, 2.1, pz, -side * Math.PI / 2, i);
  }
}

// ---------------- cover atlases ----------------
// Each tape's front cover is drawn once into one of a few shared 2048² atlas
// canvases (144x288 px cells, 98 per atlas) — tapes are shelved face-out.
const COLS = 14, ROWS = 7, CELLS = COLS * ROWS, CW = 144, CH = 288;
const catColor = {}, catIdx = {};
ORDER.forEach((c, i) => catIdx[c] = i);
{
  let extra = ORDER.length;
  for (const t of catalog) if (!(t.category in catIdx)) catIdx[t.category] = extra++;
  for (const c in catIdx) {
    const h = (catIdx[c] * 137.5) % 360;
    catColor[c] = `hsl(${h.toFixed(0)} 62% 36%)`;
  }
}
const atlases = [];   // {canvas, ctx, material}
function atlasFor(n) {
  while (atlases.length <= n) {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 2048;
    const ctx = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    atlases.push({ canvas, ctx, texture, material: new THREE.MeshLambertMaterial({ map: texture }) });
  }
  return atlases[n];
}
const artLoader = new THREE.TextureLoader();
// full-res cover texture cache, keyed by art path — hand/table-box art gets
// picked up and put back constantly, so avoid re-decoding the same image
const coverTexCache = new Map();
function loadCoverTexture(tape, onLoad) {
  const cached = coverTexCache.get(tape.art);
  if (cached) { onLoad(cached); return; }
  artLoader.load(artUrl(tape.art), t => {
    t.colorSpace = THREE.SRGBColorSpace;
    coverTexCache.set(tape.art, t);
    onLoad(t);
  });
}
// box sides/back take the cover's dominant color: vote 12x18 downsampled
// pixels into 8-level-per-channel buckets and average the winning bucket.
// One material per bucket (≤512), shared by every tape that lands in it.
const swatch = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
swatch.canvas.width = 12; swatch.canvas.height = 18;
const sideMats = new Map();
function sideMatFor(img) {
  swatch.drawImage(img, 0, 0, 12, 18);
  const d = swatch.getImageData(0, 0, 12, 18).data, votes = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] >> 5) << 6 | (d[i + 1] >> 5) << 3 | d[i + 2] >> 5;
    const v = votes.get(k) || { k, n: 0, r: 0, g: 0, b: 0 };
    v.n++; v.r += d[i]; v.g += d[i + 1]; v.b += d[i + 2]; votes.set(k, v);
  }
  const top = [...votes.values()].reduce((a, b) => b.n > a.n ? b : a);
  if (!sideMats.has(top.k)) sideMats.set(top.k, new THREE.MeshLambertMaterial({
    color: new THREE.Color().setRGB(top.r / top.n / 255, top.g / top.n / 255, top.b / top.n / 255, THREE.SRGBColorSpace) }));
  return sideMats.get(top.k);
}
// the MonsterVision sticker: a round black-and-green badge slapped on the
// top-right corner of every MonsterVision cover (shelf covers + the held-up view)
function drawMVSticker(ctx, x, y, r) {        // x, y = badge center
  ctx.save(); ctx.translate(x, y); ctx.rotate(0.22);
  ctx.fillStyle = "#0b0b0b"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = r * 0.12; ctx.strokeStyle = "#7dff3a"; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = `900 ${r * 0.34}px "Arial Black", Arial`;
  ctx.fillStyle = "#7dff3a"; ctx.fillText("MONSTER", 0, -r * 0.2);
  ctx.fillStyle = "#fff"; ctx.fillText("VISION", 0, r * 0.24);
  ctx.restore();
}
// a cover image with the sticker composited on (for the held-up <img>); falls back to the plain image
function stickerize(src, done) {
  const img = new Image(); img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
      drawMVSticker(ctx, c.width * 0.8, c.width * 0.2, c.width * 0.16);
      done(c.toDataURL("image/jpeg", 0.92));
    } catch { done(src); }                    // tainted (no CORS): plain poster
  };
  img.onerror = () => done(src); img.src = src;
}
function drawCover(tape, cell) {
  const a = atlasFor(Math.floor(cell / CELLS)), ctx = a.ctx;
  const x0 = (cell % CELLS) % COLS * CW, y0 = Math.floor((cell % CELLS) / COLS) * CH;
  // placeholder: category-colored case with the title printed on it
  ctx.fillStyle = catColor[tape.category]; ctx.fillRect(x0, y0, CW, CH);
  ctx.strokeStyle = "#00000088"; ctx.lineWidth = 2; ctx.strokeRect(x0 + 1, y0 + 1, CW - 2, CH - 2);
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "top";
  const fs = 24, maxW = CW - 16; ctx.font = `bold ${fs}px Arial`;
  const lines = [""];
  for (const w of tape.title.split(" ")) {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(last + " " + w).width > maxW) lines.push(w);
    else lines[lines.length - 1] = last ? last + " " + w : w;
  }
  if (lines.length > 8) { lines.length = 8; lines[7] += "…"; }
  let line = y0 + 26;
  for (const L0 of lines) {
    let L = L0;
    while (ctx.measureText(L + "…").width > maxW && L.length > 1) L = L.slice(0, -1);
    if (L !== L0) L += "…";
    ctx.fillText(L, x0 + CW / 2, line); line += fs + 4;
  }
  if (tape.label) { ctx.fillStyle = "#ffd400"; ctx.font = "bold 15px Arial"; ctx.fillText(tape.label.slice(0, 12), x0 + CW / 2, y0 + CH - 24); }
  const mv = tape.category === "MonsterVision";
  if (mv) drawMVSticker(ctx, x0 + CW - 30, y0 + 30, 25);
  tape.cell = cell;
  // real cover art from art/, painted over the placeholder once it loads
  if (tape.art) artLoader.load(artUrl(tape.art), tex => {
    const img = tex.image;                    // TextureLoader hands back a Texture, not an <img>
    const s = Math.max((CW - 4) / img.width, (CH - 4) / img.height);
    const sw = (CW - 4) / s, sh = (CH - 4) / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x0 + 2, y0 + 2, CW - 4, CH - 4);
    if (mv) drawMVSticker(ctx, x0 + CW - 30, y0 + 30, 25);
    a.texture.needsUpdate = true;
    tape.sideMat = sideMatFor(img);
    for (const c of [tape, ...(tape.copies || [])]) paintBody(c);   // art usually lands after the shelves are built
  }, undefined, () => {});
}
catalog.forEach((tape, i) => drawCover(tape, i + 1));                          // cell 0 reserved
atlases.forEach(a => a.texture.needsUpdate = true);
function cellUV(cell) {
  const cx = (cell % CELLS) % COLS, cy = Math.floor((cell % CELLS) / COLS);
  const u0 = cx * CW / 2048, u1 = (cx * CW + CW) / 2048;
  const v1 = 1 - cy * CH / 2048, v0 = 1 - (cy * CH + CH) / 2048;
  return [u0, v0, u1, v1];
}

// ---------------- shelves ----------------
// Face = one category chunk on one side of a band; a side = faces chained along x.
// Everything on the shelves gets merged into a handful of big meshes once the
// store is laid out (flushShelves): thousands of separate tape and board
// meshes made per-object overhead the bottleneck (the bloom pass walks every
// mesh twice a frame). Taking a tape off a shelf collapses its own vertices in
// the merged mesh instead of hiding a mesh of its own.
const shelfParts = new Map();                 // material -> [world-space geometry]
const coverParts = new Map();                 // atlas index -> [{ geo, tape }]
const bodyParts = [];                         // [{ geo, tape }]
const coverMeshes = [];                       // merged covers, for picking: userData.tapes[i] owns vertices 4i..4i+3
const COVER_V = 4, BODY_V = 24;               // vertices per cover plane / tape box
const bodyColor = new THREE.Color(0x101318);  // plain black case until the cover art tells us its color
let bodyMesh = null;
function addShelfPart(material, geo) {
  if (!shelfParts.has(material)) shelfParts.set(material, []);
  shelfParts.get(material).push(geo.index ? geo.toNonIndexed() : geo);   // Extrude geometry isn't indexed; merging needs them all alike
}
function paintBody(tape) {                    // a copy's case takes its cover's dominant color (see sideMatFor)
  if (!bodyMesh || !tape.slot) return;
  const c = tape.sideMat ? tape.sideMat.color : bodyColor, col = bodyMesh.geometry.attributes.color;
  for (let i = 0; i < BODY_V; i++) col.setXYZ(tape.slot.bv + i, c.r, c.g, c.b);
  col.needsUpdate = true;
}
function setOnShelf(tape, on) {               // show/hide one copy in the merged shelf meshes
  const sl = tape.slot;
  if (!sl || tape.offShelf === !on) return;
  for (const [mesh, v0, n] of [[sl.cover, sl.cv, COVER_V], [bodyMesh, sl.bv, BODY_V]]) {
    const pos = mesh.geometry.attributes.position;
    if (!on) { sl.saved.set(mesh, pos.array.slice(v0 * 3, (v0 + n) * 3)); for (let i = 0; i < n; i++) pos.setXYZ(v0 + i, 0, -10, 0); }   // collapse it under the floor
    else pos.array.set(sl.saved.get(mesh), v0 * 3);
    pos.needsUpdate = true;
  }
  tape.offShelf = !on;
}
function flushShelves() {
  for (const [material, geos] of shelfParts) scene.add(new THREE.Mesh(mergeGeometries(geos), material));
  for (const [a, parts] of coverParts) {
    const m = new THREE.Mesh(mergeGeometries(parts.map(p => p.geo)), atlases[a].material);
    m.userData.tapes = parts.map(p => p.tape);
    parts.forEach((p, i) => { p.tape.slot = { cover: m, cv: i * COVER_V, bv: 0, saved: new Map() }; p.tape.offShelf = false; });   // own props on every copy
    coverMeshes.push(m); scene.add(m);
  }
  bodyParts.forEach(({ geo, tape }, i) => {
    const c = tape.sideMat ? tape.sideMat.color : bodyColor, col = new Float32Array(geo.attributes.position.count * 3);
    for (let v = 0; v < col.length; v += 3) { col[v] = c.r; col[v + 1] = c.g; col[v + 2] = c.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    tape.slot.bv = i * BODY_V;
  });
  bodyMesh = new THREE.Mesh(mergeGeometries(bodyParts.map(p => p.geo)), new THREE.MeshLambertMaterial({ vertexColors: true }));
  scene.add(bodyMesh);
  shelfParts.clear(); coverParts.clear(); bodyParts.length = 0;
}
const catStripMat = {};  // yellow header strip per category
function stripTexture(cat) {
  const t = makeTexture((ctx, W, H) => {
    ctx.fillStyle = "#ffd400"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#00349c"; ctx.font = "bold 52px Arial Black, Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(cat.toUpperCase(), W / 2, H / 2);
  }, 1024, 96);
  return new THREE.MeshLambertMaterial({ map: t });   // lit by the room, dims in lights-out
}
// A slim category can ride along in the leftover shelf space at the end of a
// bigger one's last (partial) bay instead of starting a whole new bay: tail
// is that bigger category's trailing tapes (< CAP of them); this pads out to
// the next empty row, reserves that row for a header sign, and fills next's
// tapes into the row below. Returns the padded (CAP-length, gaps as null)
// tapes array for that single shared bay, the header descriptor for
// buildFace, and whatever of next's tapes didn't fit (to shelve normally).
function mergeIntoTail(tail, next, label, spec = BAY) {
  const cap = spec.rows * spec.perRow;
  const rowsUsed = Math.ceil(tail.length / spec.perRow);
  const headerStart = rowsUsed * spec.perRow;
  const contentStart = headerStart + spec.perRow;
  const avail = Math.max(0, cap - contentStart);
  const headCount = tail.length ? Math.min(next.length, avail) : 0;   // no tail = no leftover row to share
  const arr = new Array(cap).fill(null);
  tail.forEach((t, i) => arr[i] = t);
  for (let i = 0; i < headCount; i++) arr[contentStart + i] = next[i];
  return { arr, header: headCount ? { index: headerStart, label } : null, leftover: next.slice(headCount) };
}
// cover-face center of a tape leaning back LEAN on shelf row r, its top resting
// on that row's backing (which stands where the next row's front edge is)
function leanAt(r, spec = BAY) {
  const y0 = spec.boardY[r] + 0.02, back = frontAt(spec.boardY[r + 1] ?? spec.h, spec);
  const sn = Math.sin(LEAN), cs = Math.cos(LEAN);
  const xb0 = back + TAPE.h * sn + 0.002;          // bottom-back corner, so the top-back corner just touches
  return { cx: xb0 - TAPE.h / 2 * sn + (TAPE.w + 0.001) * cs, cy: y0 + TAPE.h / 2 * cs + (TAPE.w + 0.001) * sn };
}
// ry: the face's rotation — its shelves face local +x turned by ry (so ry=0
// faces +x, π faces -x, -π/2 faces +z, π/2 faces -z); m: which way along local z
// the bays extend from the anchor. spec: the gondola (BAY, or SHORT)
function buildFace(tapes, ax, az, ry, m, headers = [], lead = true, spec = BAY, label = null) {   // label: header-strip text, instead of the first tape's genre   // headers: mid-run category signs on an otherwise-empty row; lead=false shares the previous face's end panel
  const cap = spec.rows * spec.perRow;
  const nBays = Math.max(1, Math.ceil(tapes.length / cap));
  // local +z runs to the shopper's left, so mirror bay and slot order on m>0
  // faces — every face then reads left→right, top→bottom
  const flip = m > 0;
  const place = k => {
    const rem = k % cap, row = spec.rows - 1 - Math.floor(rem / spec.perRow); // fill top-down: partial faces keep tapes at eye level
    let bay = Math.floor(k / cap), slot = rem % spec.perRow;
    if (flip) { bay = nBays - 1 - bay; slot = spec.perRow - 1 - slot; }
    return { row, bay, lz: m * (bay * spec.len + 0.08 + (slot + 0.5) * SLOT_W) };
  };
  const covers = [], bodies = [], boards = [], uprights = [], backings = [];
  tapes.forEach((tape, k) => {
    if (!tape) { covers.push(null); bodies.push(null); return; }   // reserved gap: header row or unused slot
    const { row, lz } = place(k);
    const { cx, cy } = leanAt(row, spec);
    const p = new THREE.PlaneGeometry(TAPE.d, TAPE.h);                          // face-out cover
    const [u0, v0, u1, v1] = cellUV(tape.cell);
    const uv = p.attributes.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    p.rotateY(Math.PI / 2); p.rotateZ(LEAN); p.translate(cx, cy, lz);
    covers.push(p);
    const b = new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d); b.rotateZ(LEAN);
    b.translate(cx - (TAPE.w / 2 + 0.001) * Math.cos(LEAN), cy - (TAPE.w / 2 + 0.001) * Math.sin(LEAN), lz);
    bodies.push(b);
  });
  // stepped shelves: each board's front edge sits on the sloped face, and a
  // white backing rises from it to the next board's front edge — so the
  // backing a row leans on is exactly where the row above starts
  const riseTo = r => spec.boardY[r + 1] ?? spec.h;
  for (let bay = 0; bay < nBays; bay++) {
    const zc = m * (bay * spec.len + spec.len / 2), zl = spec.len - 0.05;
    spec.boardY.forEach((y, r) => {
      const d = frontAt(y, spec);
      const g = new THREE.BoxGeometry(d, 0.04, zl); g.translate(d / 2, y, zc); boards.push(g);
      // spans top of this board → underside of the next board/cap (overlap z-fights)
      const xb = frontAt(riseTo(r), spec), y0 = y + 0.02, y1 = riseTo(r) - (r < spec.rows - 1 ? 0.02 : 0.04);
      const w = new THREE.BoxGeometry(0.015, y1 - y0, zl); w.translate(xb - 0.0075, (y0 + y1) / 2, zc); backings.push(w);
    });
    const top = new THREE.BoxGeometry(spec.top, 0.04, zl); top.translate(spec.top / 2, spec.h - 0.02, zc); uprights.push(top);
    const kick = new THREE.BoxGeometry(0.02, spec.boardY[0], zl);                  // toe kick under the bottom shelf
    kick.translate(frontAt(0, spec) - 0.03, spec.boardY[0] / 2, zc); uprights.push(kick);
    const back = new THREE.BoxGeometry(0.02, spec.h, spec.len); back.translate(0.005, spec.h / 2, zc); uprights.push(back);   // solid back: a run with nothing behind it shows a panel, not bare shelving. It sits 5 mm behind x=0, where the boards, caps and end panels all stop, so their back faces hide inside it instead of flickering against it
  }
  const side = new THREE.Shape([[0, 0], [spec.depth, 0], [spec.top, spec.h], [0, spec.h]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (let b = lead ? 0 : 1; b <= nBays; b++) {   // blue wedge end panels at every bay boundary
    const u = new THREE.ExtrudeGeometry(side, { depth: 0.05, bevelEnabled: false }); u.translate(0, 0, m * b * spec.len - 0.025); uprights.push(u);
  }

  const group = new THREE.Group();
  group.rotation.y = ry;
  group.position.set(ax, 0, az);
  group.updateMatrixWorld(true);
  const M = group.matrixWorld;                  // everything goes into the merged shelf meshes in world space (see flushShelves)
  tapes.forEach((tape, k) => {
    if (!tape) return;
    const a = Math.floor(tape.cell / CELLS);
    if (!coverParts.has(a)) coverParts.set(a, []);
    coverParts.get(a).push({ geo: covers[k].applyMatrix4(M), tape });   // this exact copy — duplicates share a cover cell, so the cell can't say which
    bodyParts.push({ geo: bodies[k].applyMatrix4(M), tape });
  });
  boards.forEach(g => addShelfPart(mat.board, g.applyMatrix4(M)));
  backings.forEach(g => addShelfPart(mat.backing, g.applyMatrix4(M)));
  uprights.forEach(g => addShelfPart(mat.upright, g.applyMatrix4(M)));
  // header strip on the top backing, above the top row of tapes; genre labels live on the endcaps
  const cat = label || tapes.find(Boolean).category;
  if (!catStripMat[cat]) catStripMat[cat] = stripTexture(cat);
  if (cat !== "MonsterVision") for (let bay = 0; bay < nBays; bay++) {   // (MonsterVision has its own topper sign instead)
    const h = new THREE.PlaneGeometry(spec.len - 0.1, 0.16);
    h.rotateY(Math.PI / 2); h.translate(spec.top + 0.006, spec.h - 0.15, m * (bay * spec.len + spec.len / 2));   // 6 mm off the backing: closer flickers at a distance
    addShelfPart(catStripMat[cat], h.applyMatrix4(M));
  }
  // mid-run sign: a slim category riding the leftover shelf space gets its
  // own small placard on the empty row, right above where its tapes start
  headers.forEach(({ index, label }) => {
    if (!catStripMat[label]) catStripMat[label] = stripTexture(label);
    const { row, bay } = place(index);
    const { cx, cy } = leanAt(row, spec);
    const lz = m * (bay * spec.len + 0.08 + spec.perRow * SLOT_W / 2);
    const hp = new THREE.PlaneGeometry(spec.perRow * SLOT_W - 0.1, TAPE.h);
    hp.rotateY(Math.PI / 2); hp.rotateZ(LEAN); hp.translate(cx, cy, lz);
    addShelfPart(catStripMat[label], hp.applyMatrix4(M));
  });
  // world-space slot position per tape (for hover highlight)
  tapes.forEach((tape, k) => {
    if (!tape) return;
    const { row, lz } = place(k);
    const { cx, cy } = leanAt(row, spec);
    tape.pos = new THREE.Vector3(cx, cy, lz).applyMatrix4(group.matrixWorld);
    tape.ry = ry;                                 // hover highlight turns to match the shelf
  });
  const len = nBays * spec.len;
  const corners = [[0, 0], [spec.depth, 0], [0, m * len], [spec.depth, m * len]]   // footprint, local (x, z) → world
    .map(([x, z]) => [ax + x * Math.cos(ry) + z * Math.sin(ry), az - x * Math.sin(ry) + z * Math.cos(ry)]);
  colliders.push({ x0: Math.min(...corners.map(c => c[0])), x1: Math.max(...corners.map(c => c[0])),
                   z0: Math.min(...corners.map(c => c[1])), z1: Math.max(...corners.map(c => c[1])), y1: spec.h });
  return len;
}

// ---------------- store layout ----------------
// Three zones:
//  - kids: the front corner by the windows on the TV Shows side — kids' movies,
//    shows, cartoons, kids' anime and Holiday, on low shelving over its own carpet
//  - the outer walls: movies from NEW_FROM on, in genre order sweeping from the
//    register wall around the back to the far wall, face-out, with extra copies
//    of the hits (more TMDB votes = more copies) so the walls fill up without
//    using up titles
//  - the center: low gondolas either side of the door→lounge corridor with
//    everything else — the older movies by genre (west), then TV (east)
const NEW_FROM = 1991;
const WALL_GENRES = ["Comedy", "Drama", "Action & Adventure", "Horror", "Sci-Fi & Fantasy"];   // most titles first
const MAX_COPIES = 12;
// wall runs in sweep order: anchor = the run's end on the shopper's right, ry
// faces it into the room, and bays extend to the shopper's left (m = +1)
const WALL_RUNS = [
  { x: WALL_L + 0.1, z: 8.1, ry: 0, bays: 12 },                     // register (Movies) wall, front → back, just past the snack center
  { x: WALL_L + 0.1 + BAY.depth, z: STORE.z - 0.1, ry: Math.PI / 2, bays: 2 },   // back wall, left of the lounge
  { x: 3.89, z: STORE.z - 0.1, ry: Math.PI / 2, bays: 3 },          // back wall, right of the lounge, up to the back-hall opening
  { x: STORE.x - 0.1, z: 26.8, ry: Math.PI, bays: 11 },             // far wall, back → front, stopping short of the opening and the kids section
];
const CENTER = { corridor: 1.5, westBays: 2, eastBays: 4, z0: 8.6, gap: 2.0, bands: 4 };   // corridor = half-width of the door→lounge walkway; z0 = front band's door-side face
const KIDS = { bandX: [4.75, 8.15], z0: 1.1, bays: 4, x0: 1.95, x1: STORE.x - 0.1, z1: 8.3 };   // bandX = each band's center plane; x0..x1/z0..z1 = the carpet
// is this spot on a wall above one of the wall runs? (posters get lifted over them)
function overWallShelf(x, z) {
  return wallSpans.some(w => w.axis === "x" ? Math.abs(x - w.at) < 0.5 && z > w.a0 - 0.5 && z < w.a1 + 0.5
                                            : Math.abs(z - w.at) < 0.5 && x > w.a0 - 0.5 && x < w.a1 + 0.5);
}
const crtSpots = [];                         // ceiling CRT clusters, filled in below: [x, z]
const rentedCopies = [];                     // copies pulled off the shelves as "out on rental", filled in below
const wallSpans = [];                        // what the wall runs cover, for lifting posters above them: { axis, at, a0, a1 }
{
  const meta = window.VAULT_META || {};
  const yearOf = t => meta[t.id]?.[0] ?? 0, votesOf = t => meta[t.id]?.[1] ?? 0;
  // movies are single-episode tapes in a genre with at least a shelf row of them;
  // two Stephen King TV-movie miniseries (multi-part) count as movies by name
  const TV_MOVIE_IDS = new Set(["TheShining1997", "Tommyknockers"]);
  const mvCount = new Map();
  for (const t of catalog) if (t.seasons[0].episodes.length === 1) mvCount.set(t.category, (mvCount.get(t.category) || 0) + 1);
  const isMovie = t => (t.seasons[0].episodes.length === 1 && mvCount.get(t.category) >= BAY.perRow) || TV_MOVIE_IDS.has(t.id);
  // Animation and Anime each hold both kids' and grown-up shows — the grown-up
  // ones stay in the center, everything else in those two goes to kids
  const ADULT_TOON = /^(Aeon Flux|Beavis|Big Mouth|The Boondocks|the Brak|Common Side|Daria|Drawn Together|Duckman|Home Movies|Moral Orel|the Oblongs|The PJs|The Simpsons|Spawn|Undergrads|Bob and Margaret|The Ren & Stimpy)/i;
  const KID_ANIME = /^(Digimon|Dragon Ball|Pok|Monster Rancher|Ultimate Muscle)/i;
  const isKids = t => ["Family & Kids", "Kids & Educational", "Holiday"].includes(t.category)
    || (t.category === "Animation" && !ADULT_TOON.test(t.title)) || (t.category === "Anime" && KID_ANIME.test(t.title));
  const isWall = t => isMovie(t) && WALL_GENRES.includes(t.category) && yearOf(t) >= NEW_FROM;

  // ---- shelving helpers ----
  const capOf = spec => spec.rows * spec.perRow;
  // Shelve a block of gondola runs as one continuous snake: runs are given in
  // walking order (down one side of a band, around its endcap, back up the
  // other side, across the aisle to the next band) and every genre fills the
  // next stretch of whole bays — so each genre stays in one unbroken stretch,
  // however many runs it turns the corner onto. Spare bays go to the most
  // crowded genres (tapes spread evenly across a genre's bays), so no bay is
  // left bare. ride: { host: guest } lets a genre too small for a bay of its
  // own sit on its host's last bay, under its own placard.
  const layBlock = (list, order, runs, spec, ride = {}, fill = null) => {   // fill(tapes, slots) → tapes: restock a genre once its bays are set
    const cap = capOf(spec), byCat = new Map();
    for (const t of list) { if (!byCat.has(t.category)) byCat.set(t.category, []); byCat.get(t.category).push(t); }
    const cats = [...order.filter(c => byCat.has(c)), ...[...byCat.keys()].filter(c => !order.includes(c))];   // anything unlisted goes last
    const rowsFor = n => Math.ceil(n / spec.perRow);
    const units = [], riding = new Set();
    for (const c of cats) {
      if (riding.has(c)) continue;
      const u = { cat: c, tapes: byCat.get(c) };
      u.bays = Math.ceil(u.tapes.length / cap);
      const g = ride[c], gt = g && byCat.get(g);
      const lastBay = u.tapes.length - Math.floor(u.tapes.length / u.bays) * (u.bays - 1);   // roughly — even spread, the last bay holds the remainder
      if (gt && rowsFor(lastBay) + 1 + rowsFor(gt.length) <= spec.rows) { u.guest = { cat: g, tapes: gt }; riding.add(g); }
      units.push(u);
    }
    const total = runs.reduce((a, r) => a + r.bays, 0);
    let spare = total - units.reduce((a, u) => a + u.bays, 0);
    if (spare < 0) console.warn(`shelving short by ${-spare} bays for: ${cats.join(", ")}`);
    while (spare-- > 0) units.reduce((a, u) => u.tapes.length / u.bays > a.tapes.length / a.bays ? u : a).bays++;
    if (fill) for (const u of units) if (!u.guest) u.tapes = fill(u.tapes, u.bays * cap);
    const bays = [];                                   // [{ cat, tapes (cap long, nulls = empty), headers }]
    for (const u of units) {
      for (let i = 0, from = 0; i < u.bays; i++) {
        const n = Math.floor(u.tapes.length / u.bays) + (i < u.tapes.length % u.bays ? 1 : 0);   // spread evenly
        const slice = u.tapes.slice(from, from + n); from += n;
        if (u.guest && i === u.bays - 1) {
          const { arr, header } = mergeIntoTail(slice, u.guest.tapes, u.guest.cat, spec);
          bays.push({ cat: u.cat, tapes: arr, headers: header ? [header] : [] });
        } else {                                       // a part-filled bay spreads its tapes evenly over its shelves, not a full top row and a straggler
          const arr = Array(cap).fill(null);
          for (let r = 0, k = 0; r < spec.rows; r++)
            for (let i = 0, n = Math.floor(slice.length / spec.rows) + (r < slice.length % spec.rows ? 1 : 0); i < n; i++) arr[r * spec.perRow + i] = slice[k++];
          bays.push({ cat: u.cat, tapes: arr, headers: [] });
        }
      }
    }
    let bi = 0;
    for (const r of runs) {                            // each run takes its next stretch of bays; one face per genre within it
      const mine = bays.slice(bi, bi + r.bays); bi += r.bays;
      const faces = [];
      mine.forEach(bay => {
        const f = faces[faces.length - 1];
        if (f && f.cat === bay.cat) { bay.headers.forEach(h => f.headers.push({ ...h, index: h.index + f.tapes.length })); f.tapes.push(...bay.tapes); }
        else faces.push({ cat: bay.cat, tapes: [...bay.tapes], headers: [...bay.headers] });
      });
      buildRun(faces, r.x, r.z, r.ry, r.dx, r.dz, spec);
    }
    return Object.fromEntries(units.map(u => [u.cat + (u.guest ? " + " + u.guest.cat : ""), u.bays]));
  };
  // One double-sided gondola run: faces laid end to end from (x, z) along
  // world direction (dx, dz), shelves facing ry, with the stacked genre list
  // on the blue endcap at each end
  const buildRun = (chain, x, z, ry, dx, dz, spec) => {
    if (!chain.length) return;
    const lx = Math.sin(ry), lz = Math.cos(ry);                     // the face's local +z, in world
    const m = Math.sign(lx * dx + lz * dz);                         // bays extend toward (dx, dz)
    // m>0 runs read toward the anchor, so lay their faces out last-first —
    // then every run reads left→right, and consecutive runs join end-to-end:
    // a genre snakes down one side of a band and back up the other
    let at = 0;
    (m > 0 ? [...chain].reverse() : chain).forEach((f, i) => { at += buildFace(f.tapes, x + dx * at, z + dz * at, ry, m, f.headers, i === 0, spec); });
    const cats = [...new Set(chain.flatMap(f => f.tapes.filter(Boolean).map(t => t.category)))];
    const tag = tagPlane(cats, frontAt(1.1 + cats.length * 0.08, spec) - 0.04, 0.14);   // fits the wedge where its top edge is
    const nx = Math.cos(ry), nz = -Math.sin(ry), off = frontAt(1.1, spec) / 2;        // out from the back plane, to mid-wedge
    [[-0.033, Math.atan2(-dx, -dz)], [at + 0.033, Math.atan2(dx, dz)]].forEach(([d, rot], i) => {   // 8 mm off the 5 cm end panels
      const t = i ? tag.clone() : tag;
      t.position.set(x + dx * d + nx * off, 1.1, z + dz * d + nz * off); t.rotation.y = rot; scene.add(t);
    });
  };

  // ---- the walls: newer movies, with copies of the hits ----
  const wallBays = WALL_RUNS.reduce((a, r) => a + r.bays, 0);
  const weight = t => Math.pow(votesOf(t) + 1, 0.3);
  const byGenre = WALL_GENRES.map(g => catalog.filter(t => t.category === g && isWall(t)));   // catalog's already in shelf (alphabetical) order
  // bays per genre by its share of the total pull (largest remainder), at least enough for one of each
  const pull = byGenre.map(ts => ts.reduce((a, t) => a + weight(t), 0)), pullSum = pull.reduce((a, b) => a + b, 0);
  const ideal = pull.map(p => p / pullSum * wallBays);
  const bays = ideal.map((v, i) => Math.max(Math.ceil(byGenre[i].length / CAP), Math.floor(v)));
  for (const i of ideal.map((v, i) => i).sort((a, b) => (ideal[b] % 1) - (ideal[a] % 1)))
    if (bays.reduce((a, b) => a + b, 0) < wallBays) bays[i]++;
  // copies per title fill its genre's bays exactly: ∝ weight, 1..MAX_COPIES
  const copiesFor = (ts, slots) => {
    const w = ts.map(weight), calc = s => w.map(x => Math.max(1, Math.min(MAX_COPIES, Math.round(s * x))));
    let lo = 0, hi = 100;
    for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2; calc(mid).reduce((a, b) => a + b, 0) > slots ? hi = mid : lo = mid; }
    const c = calc(lo), order = w.map((x, i) => i).sort((a, b) => w[b] - w[a]);
    let left = slots - c.reduce((a, b) => a + b, 0);
    for (let cap = MAX_COPIES; left > 0; cap++) for (const i of order) { if (left > 0 && c[i] < cap) { c[i]++; left--; } }
    return c;
  };
  // the sweep runs right→left for someone facing the wall, but each face reads
  // left→right: lay every genre in reverse along the sweep, and flip each run's
  // slice back when it's shelved
  const sweep = [];
  byGenre.forEach((ts, gi) => {
    ts.forEach(t => t.newRelease = true);             // the walls are the new releases (POS prices them that way)
    const n = copiesFor(ts, bays[gi] * CAP), stock = [];
    ts.forEach((t, i) => {
      t.copies = [];
      for (let k = 0; k < n[i]; k++) { const c = k ? Object.create(t) : t; if (k) t.copies.push(c); stock.push(c); }   // a copy is the same tape in every way but where it sits
    });
    sweep.push(...stock.reverse());
  });
  let si = 0;
  for (const run of WALL_RUNS) {
    const slice = sweep.slice(si, si + run.bays * CAP); si += run.bays * CAP;
    const lx = Math.sin(run.ry), lz = Math.cos(run.ry);
    let at = 0;
    for (let i = 0; i < slice.length;) {                // one face per genre stretch within the run
      let j = i; while (j < slice.length && slice[j].category === slice[i].category) j++;
      at += buildFace(slice.slice(i, j).reverse(), run.x + lx * at, run.z + lz * at, run.ry, 1, [], at === 0);
      i = j;
    }
    wallSpans.push(Math.abs(lx) > 0.5 ? { axis: "z", at: run.z, a0: Math.min(run.x, run.x + lx * at), a1: Math.max(run.x, run.x + lx * at) }
                      : { axis: "x", at: run.x, a0: Math.min(run.z, run.z + lz * at), a1: Math.max(run.z, run.z + lz * at) });
  }

  // ---- kids: low bands running back from the windows ----
  const kidsList = catalog.filter(isKids);
  // snake: each band's entrance-side (-x) face front→back, around the back endcap, its far (+x) face back→front, then the next band
  const kidsRuns = KIDS.bandX.flatMap(bx => [Math.PI, 0].map(ry => ({ x: bx, z: KIDS.z0, ry, dx: 0, dz: 1, bays: KIDS.bays })));
  const kidsBays = layBlock(kidsList, ["Family & Kids", "Holiday", "Kids & Educational", "Animation", "Anime"], kidsRuns, SHORT);
  {                                                  // the kids' own carpet: arcade-style confetti on deep purple
    const kidsTex = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#2a1660"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3000; i++) {                // carpet fleck
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.18)";
        ctx.fillRect(Math.random() * W, Math.random() * H, 3, 3);
      }
      const cols = ["#ffd400", "#ff4f7b", "#2fd3c7", "#7bea4a", "#ff8a1f", "#5aa9ff"];
      const star = (r) => { ctx.beginPath(); for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5 - Math.PI / 2, rr = k % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); };
      const shapes = [
        r => star(r),
        r => { ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill(); },                               // dot
        r => { ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.lineWidth = r * 0.22; ctx.stroke(); },   // ring
        r => { ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.87, r * 0.5); ctx.lineTo(-r * 0.87, r * 0.5); ctx.closePath(); ctx.fill(); },   // triangle
        r => { ctx.beginPath(); ctx.lineWidth = r * 0.22; ctx.lineCap = "round"; for (let k = 0; k <= 4; k++) ctx.lineTo(-r + k * r / 2, k % 2 ? r * 0.35 : -r * 0.35); ctx.stroke(); },   // zigzag
        r => { ctx.beginPath(); ctx.lineWidth = r * 0.2; ctx.lineCap = "round"; ctx.moveTo(-r, 0); ctx.bezierCurveTo(-r * 0.4, -r, r * 0.4, r, r, 0); ctx.stroke(); },            // squiggle
      ];
      // scatter with wraparound so the pattern tiles seamlessly
      for (let i = 0; i < 70; i++) {
        const x = Math.random() * W, y = Math.random() * H, r = 18 + Math.random() * 26, rot = Math.random() * Math.PI * 2;
        const draw = shapes[i % shapes.length], c = cols[Math.floor(Math.random() * cols.length)];
        for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
          ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(rot); ctx.fillStyle = ctx.strokeStyle = c; draw(r); ctx.restore();
        }
      }
    }, 1024, 1024);
    const TILE = 2.4, w = KIDS.x1 - KIDS.x0, d = KIDS.z1 - 0.1;
    kidsTex.repeat.set(w / TILE, d / TILE);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial({ map: kidsTex }));
    rug.rotation.x = -Math.PI / 2; rug.position.set((KIDS.x0 + KIDS.x1) / 2, 0.003, 0.1 + d / 2); scene.add(rug);
  }

  // ---- center: older movies west of the corridor, TV east ----
  const isMV = t => t.category === "MonsterVision";
  const centerList = catalog.filter(t => !isKids(t) && !isWall(t) && !isMV(t));
  const classics = centerList.filter(isMovie), tv = centerList.filter(t => !isMovie(t));
  const bandStep = 2 * SHORT.depth + CENTER.gap;
  const bandZ = b => CENTER.z0 + b * bandStep + SHORT.depth;   // a band's back plane
  // snake through a block's bands: door-side (-z) face first, around the endcap, then its back (+z) face
  const blockRuns = (bands, x, dx, bays) => bands.flatMap(b => [Math.PI / 2, -Math.PI / 2].map(ry => ({ x, z: bandZ(b), ry, dx, dz: 0, bays })));
  // TV east of the corridor, all four bands; grown-up Animation right next to Anime
  const TV_ORDER = ["Sitcoms", "Classic Sitcoms", "Sketch Comedy & Late Night", "Broadcast Blocks", "Drama & Adventure",
    "Horror & Anthology", "Animation", "Anime", "Reality TV"];
  const tvBays = layBlock(tv, TV_ORDER, blockRuns([0, 1, 2, 3], CENTER.corridor, 1, CENTER.eastBays), SHORT, { "Broadcast Blocks": "Music" });
  // classics west of the corridor, in its back two bands — the front band is
  // the candy aisle, and the one behind it stays open floor by the register
  const classicsFrom = 2;
  // the classics are thin on their own: once each genre's bays are set, its
  // most-voted titles get a second copy (side by side) until it's ~90% stocked
  const secondCopies = (ts, slots) => {
    const extra = new Set([...ts].sort((a, b) => votesOf(b) - votesOf(a)).slice(0, Math.max(0, Math.floor(slots * 0.9) - ts.length)));
    return ts.flatMap(t => extra.has(t) ? [t, (() => { const c = Object.create(t); (t.copies ||= []).push(c); return c; })()] : [t]);
  };
  const classicsBays = layBlock(classics, WALL_GENRES, blockRuns([classicsFrom, classicsFrom + 1], -CENTER.corridor, -1, CENTER.westBays), SHORT, {}, secondCopies);
  for (let b = 0; b < CENTER.bands - 1; b++) {           // a ceiling CRT cluster at each outer end of the aisle behind each band
    const zMid = bandZ(b) + SHORT.depth + CENTER.gap / 2;
    crtSpots.push([-CENTER.corridor - CENTER.westBays * BAY.len - 0.9, zMid], [CENTER.corridor + CENTER.eastBays * BAY.len + 0.9, zMid]);
  }

  // ---- Staff Picks: a low display across the far end of the walkway, facing the entrance ----
  // Hand-picked, one copy of each: movies in the left section, TV in the
  // right. Each list entry is one shelf row, top to bottom; a row's unused
  // slots stay empty (reads as rented out).
  const STAFF_ROWS = [
    ["Hackers", "Masterminds (1997)", "Gremlins 2: The New Batch", "IT", "Jaws", "Mac and Me", "Blade Runner", "Over the Edge",
      "The Rocky Horror Picture Show", "Phantasm", "Dazed and Confused"],
    ["The Lost Boys", "WarGames", "Escape from New York", "Labyrinth", "Clue", "Spaceballs", "Bill & Ted's Excellent Adventure", "The Rocketeer",
      "SLC Punk!", "Detroit Rock City", "Pink Floyd: The Wall"],
    ["Flight of the Navigator", "Pee-wee's Big Adventure", "Hellraiser", "Creepshow", "American Werewolf In London", "Chopping Mall", "Trancers", "Hell Comes to Frogtown",
      "Starman", "Maniac Cop", "Kin-Dza-Dza"],
    ["The Twilight Zone (1959)", "Twin Peaks", "The Whitest Kids U'Know"],
    ["Quantum Leap"],
    ["Dragon Ball Z"],
  ];                                                       // a show's name brings all its season tapes; "Show#a-b" = just seasons a..b
  const lastBandEnd = CENTER.z0 + (CENTER.bands - 1) * bandStep + 2 * SHORT.depth;
  const pickZ = lastBandEnd + 1.1 + SHORT.depth;           // display's back plane: a walkway's clearance behind the last band
  const pickW = 2;                                         // bays wide — wider than the walkway
  const tapesNamed = spec => {                             // "Title" → all its tapes; "Title#a-b" → season tapes a..b (1-based)
    const [title, range] = spec.split("#"), all = catalog.filter(t => t.title === title);
    if (!all.length) console.warn(`staff pick not in the catalog: ${title}`);
    if (!range) return all;
    const [a, b = a] = range.split("-").map(Number);
    return all.slice(a - 1, b);
  };
  const slots = STAFF_ROWS.flatMap(row => {                // one copy each, padded out to a full shelf row
    const ts = row.flatMap(tapesNamed).slice(0, SHORT.perRow).map(t => { const c = Object.create(t); (t.copies ||= []).push(c); return c; });
    return [...ts, ...Array(SHORT.perRow - ts.length).fill(null)];
  });
  const px0 = -pickW * BAY.len / 2;
  buildFace(slots, -px0, pickZ, Math.PI / 2, -1, [], true, SHORT, "STAFF PICKS");   // faces the entrance, runs +x → -x
  {                                                        // a topper sign, facing the entrance
    const sg = textPlane("STAFF PICKS", 2.4, 0.42);
    sg.material = new THREE.MeshLambertMaterial({ map: sg.material.map });
    box(2.5, 0.5, 0.06, mat.upright, 0, SHORT.h + 0.25, pickZ - 0.03);
    sg.position.set(0, SHORT.h + 0.25, pickZ - 0.066); sg.rotation.y = Math.PI; scene.add(sg);   // 6 mm off the board
  }

  // ---- MonsterVision: band 1's back face (register side), facing into the
  // store — the first thing before the Classics, one standard aisle from
  // Comedy, back to back with the candy rack. 75 films, so this one unit is
  // four rows high (same 1.5 m gondola) to hold them in two bays ----
  const MV_SPEC = { ...SHORT, rows: 4, boardY: [0.12, 0.45, 0.78, 1.11] };
  const mvBays = layBlock(catalog.filter(isMV), ["MonsterVision"],
    [{ x: -CENTER.corridor, z: bandZ(1), ry: -Math.PI / 2, dx: -1, dz: 0, bays: CENTER.westBays }], MV_SPEC);
  {                                                        // topper: MONSTERVISION in green on black, facing into the store
    const cx = -CENTER.corridor - CENTER.westBays * BAY.len / 2, z = bandZ(1);
    box(2.5, 0.5, 0.06, mat.dark, cx, SHORT.h + 0.25, z + 0.03);
    const sg = textPlane("MONSTERVISION", 2.4, 0.42, "#7dff3a", "#0b0b0b");
    sg.material = new THREE.MeshLambertMaterial({ map: sg.material.map });
    sg.position.set(cx, SHORT.h + 0.25, z + 0.066); scene.add(sg);
  }

  // home spot: faces into the aisle at 45°, tucked by the MonsterVision endcap
  Object.assign(cutout, { x: -1.3, z: bandZ(1) + 0.9, ry: -Math.PI / 4 });
  // ---- cardboard standee (cutout.js): life-size Dracula at the walkway end of
  // the MonsterVision aisle, facing the same way as the covers (into the store). Shaped exactly like the PNG
  // (alpha-tested), printed on the front, plain cardboard on the back, a few
  // cardboard layers between for a visible edge, and an easel strut folded
  // out behind to hold it up. E picks it up and carries it; E again sets it
  // down anywhere it fits (see "carrying the standee") ----
  if (window.VAULT_CUTOUT) {
    const img = new Image();
    img.onload = () => {
      const H = 1.85, W = H * img.width / img.height, T = 0.005;              // life-size; 5 mm board
      const layer = fill => {                                                  // the PNG's silhouette, recolored (null = the print itself)
        const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
        const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
        if (fill) { ctx.globalCompositeOperation = "source-in"; fill(ctx, c.width, c.height); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      };
      const kraft = (ctx, w, h) => {                                           // cardboard: tan with faint fibres
        ctx.fillStyle = "#b98c5a"; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 900; i++) { ctx.fillStyle = Math.random() < 0.5 ? "rgba(90,60,30,.18)" : "rgba(255,240,210,.15)"; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 6, 1); }
      };
      const g = cutout.g = new THREE.Group(); g.position.set(cutout.x, 0, cutout.z); g.rotation.y = cutout.ry; scene.add(g);
      const face = (tex, z, ry = 0) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: ry ? THREE.FrontSide : THREE.DoubleSide }));
        m.position.set(0, H / 2, z); m.rotation.y = ry; g.add(m); return m;
      };
      face(layer(null), T / 2);                                                // printed front
      face(layer(kraft), -T / 2, Math.PI);                                     // cardboard back
      const edge = layer((ctx, w, h) => { ctx.fillStyle = "#8f6a42"; ctx.fillRect(0, 0, w, h); });
      for (let i = 1; i < 4; i++) face(edge, T / 2 - i * T / 4);                // the board's thickness, seen edge-on
      // easel strut: a tapered cardboard leg hinged a bit over halfway up the back, foot on the floor behind
      const top = 1.05, reach = 0.45, len = Math.hypot(top, reach);
      const strut = new THREE.Shape([[-0.07, 0], [0.07, 0], [0.12, -len], [-0.12, -len]].map(([x, y]) => new THREE.Vector2(x, y)));
      const leg = new THREE.Mesh(new THREE.ShapeGeometry(strut), new THREE.MeshLambertMaterial({ color: 0xb98c5a, side: THREE.DoubleSide }));
      leg.position.set(0, top, -T); leg.rotation.x = Math.atan2(reach, top); g.add(leg);   // swings the foot back (-z), behind the board
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.004), new THREE.MeshLambertMaterial({ color: 0x8f6a42 }));
      hinge.position.set(0, top - 0.02, -T - 0.002); g.add(hinge);             // the glued tab the strut folds out from
      g.traverse(o => { if (o.isMesh) { o.userData.cutout = true; aimables.push(o); } });
    };
    img.src = window.VAULT_CUTOUT;
    colliders.push(cutout.box); cutoutFit(cutout.x, cutout.z, cutout.ry, cutout.box);
  }

  // ---- candy aisle: band 1's door-side face on the register side, back to back with MonsterVision ----
  // one wide snack rack facing the register and the doors, where a checkout line would stand
  {
    const w = CENTER.westBays * BAY.len, cx = -CENTER.corridor - w / 2, cz = bandZ(1), d = buildSnackRack.depth;
    const g = buildSnackRack(w, "CANDY");
    g.rotation.y = Math.PI; g.position.set(cx, 0, cz - d / 2); scene.add(g);
    colliders.push({ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d, z1: cz });
  }

  // hanging section signs — two back-to-back panels (not one double-sided
  // plane, which mirrors the text on the far side) so both faces read
  // correctly, hung from a pair of thin cables, lit by the room
  const westEnd = -CENTER.corridor - CENTER.westBays * BAY.len, eastEnd = CENTER.corridor + CENTER.eastBays * BAY.len;
  for (const [txt, x, z, w] of [
    ["KIDS", (KIDS.bandX[0] + KIDS.bandX[1]) / 2, KIDS.z0 - 0.4, 2.2],
    ["NEW RELEASES", (WALL_L + 0.1 + BAY.depth + westEnd) / 2, CENTER.z0 - 0.5, 2.3],
    ["NEW RELEASES", (STORE.x - 0.1 - BAY.depth + eastEnd) / 2, CENTER.z0 - 0.5, 2.3],
    ["CLASSICS", (westEnd - CENTER.corridor) / 2, CENTER.z0 + classicsFrom * bandStep - 0.5, 2.6],
    ["TV SHOWS", (eastEnd + CENTER.corridor) / 2, CENTER.z0 - 0.5, 2.6],
  ]) {
    const tex = textPlane(txt, w, 0.6).material.map;
    const signMat = new THREE.MeshLambertMaterial({ map: tex });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.6), signMat);
    front.position.set(x, 2.95, z); front.rotation.y = Math.PI; scene.add(front); // faces the door
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.6), signMat);
    back.position.set(x, 2.95, z); scene.add(back);                              // faces into the store
    const cableLen = STORE.h - 3.25;
    for (const cx of [x - w * 0.38, x + w * 0.38]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, cableLen), mat.dark);
      cable.position.set(cx, 3.25 + cableLen / 2, z); scene.add(cable);
    }
  }
  flushShelves();
  // some copies of the multi-copy titles are out on rental: hide a random
  // share (up to ~45%) off the END of each title's row, so the shelf still
  // reads as faced-up but clearly shopped. A returned one (returns bin →
  // putBack) just drops back into its own gap
  if (SAVE?.rented) for (const c of SAVE.rented.map(copyByKey).filter(Boolean)) { setOnShelf(c, false); rentedCopies.push(c); }   // same gaps as last visit
  else for (const t of catalog) {
    const n = 1 + (t.copies?.length || 0);
    if (n < 3) continue;
    const out = Math.floor(Math.random() * n * 0.45);
    t.copies.slice(t.copies.length - out).forEach(c => { setOnShelf(c, false); rentedCopies.push(c); });   // the POS checks each out to a member
  }
  window.__layout = { mvBays, wall: sweep.length, wallBays: Object.fromEntries(WALL_GENRES.map((g, i) => [g, bays[i]])), kidsBays, tvBays, classicsBays };
}

// ---------------- TV lounge (living room, center of the back half) ----------------
const TV = { x: 0, z: 26.8 };   // whole lounge (rug, table, couch, lamps, TV lights) is placed relative to this
const LAMP_ON = 0.32;               // mood lighting only — barely reaches past its own pool
const SHADE_GLOW = 0.45;                   // lit-fabric glow on the lamp shades — higher blows them out to a white blob under bloom
// TV light, scene side (shader side is TVU/TV_FRAG up top). Zone k = row*3 + col
// of the picture; the screen faces -z, so picture column 0 (the viewer's left) is world +x
const tvLight = { base: 0, avg: new THREE.Color(0x8899bb) };   // base: set by playEpisode/eject; avg: linear screen average
const TV_GAIN = 6.5, TV_AMB = 0.875;                           // direct throw / bounce fill, at full lights-out strength
const TV_SCREEN_Z = TV.z - 0.558 - 0.01;                       // just in front of the glass
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) TVU.uTvZoneP.value.set([0.6 - 0.6 * c, 1.35 - 0.4 * r, TV_SCREEN_Z], (r * 3 + c) * 3);
TVU.uTvRoom.value.set(WALL_L, STORE.x, STORE.h + 0.05, TV_SCREEN_Z);   // +5cm: the ceiling sits exactly at STORE.h, and a hard cutoff there flickers in and out
const tvZoneTarget = new Float32Array(27).fill(0.3);           // latest screen sample (linear); uTvZoneC eases toward it every frame
// a real TV throws light behind itself too — the screen patches above only
// light what's in front of the glass, so a short point light covers the
// wash on the wall and floor behind the cabinet
const tvBackGlow = new THREE.PointLight(0x8899bb, 0, 6, 2); tvBackGlow.position.set(TV.x, 1.3, TV.z + 0.6); scene.add(tvBackGlow);
// shadow casters the colliders don't describe well: the table as its top +
// TV-side panel (so the floor under it is shaded, not buried in one solid
// box), the couch as base/back/arms, and the two lamp shades. Everything
// else casts from its collider (y0..y1, default shelf height)
const TV_PROXIES = [
  { x0: -0.53, x1: 0.53, y0: 0.3, y1: 0.35, z0: TV.z - 2.08, z1: TV.z - 1.55 },    // table top
  { x0: -0.5, x1: 0.5, y0: 0, y1: 0.315, z0: TV.z - 1.58, z1: TV.z - 1.55 },       // table's TV-side panel
  { x0: -1.254, x1: 1.254, y0: 0.11, y1: 0.5, z0: TV.z - 3.89, z1: TV.z - 2.83 },  // couch base
  { x0: -1.05, x1: 1.05, y0: 0.39, y1: 1.0, z0: TV.z - 3.89, z1: TV.z - 3.6 },     // couch back
  ...[-1, 1].map(s => ({ x0: s < 0 ? -1.254 : 1.01, x1: s < 0 ? -1.01 : 1.254, y0: 0.11, y1: 0.71, z0: TV.z - 3.87, z1: TV.z - 2.9 })),   // arms
  ...[-1, 1].map(s => ({ x0: s * 1.6 - 0.2, x1: s * 1.6 + 0.2, y0: 1.3, y1: 1.64, z0: TV.z - 3.56, z1: TV.z - 3.16 })),              // lamp shades
];
const TV_VOL = { x0: WALL_L, z0: 4, cell: 0.3 };               // front of the store past the counter is far enough out to go unshadowed
const tvVolN = [Math.ceil((STORE.x - WALL_L) / TV_VOL.cell), Math.ceil(STORE.h / TV_VOL.cell), Math.ceil((TV_SCREEN_Z - TV_VOL.z0) / TV_VOL.cell)];
const tvVisTex = new THREE.Data3DTexture(new Uint8Array(tvVolN[0] * tvVolN[1] * tvVolN[2] * 4).fill(255), ...tvVolN);
tvVisTex.minFilter = tvVisTex.magFilter = THREE.LinearFilter; tvVisTex.unpackAlignment = 1; tvVisTex.needsUpdate = true;
TVU.uTvVis.value = tvVisTex;
TVU.uTvVolMin.value.set(TV_VOL.x0, 0, TV_VOL.z0);
TVU.uTvVolSize.value.set(tvVolN[0] * TV_VOL.cell, tvVolN[1] * TV_VOL.cell, tvVolN[2] * TV_VOL.cell);
TVU.uTvCell.value = TV_VOL.cell * 0.6;
// segment o→o+d (t in 0..1) vs axis-aligned box, slab test
function segHitsBox(ox, oy, oz, dx, dy, dz, b) {
  let t0 = 0, t1 = 1;
  const axis = (o, d, lo, hi) => {
    if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
    let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; return t0 <= t1;
  };
  return axis(ox, dx, b.x0, b.x1) && axis(oy, dy, b.y0, b.y1) && axis(oz, dz, b.z0, b.z1);
}
// Bake: per voxel, the fraction of each screen third (6 sample points apiece)
// with a clear line of sight. A box containing the voxel itself is skipped, so
// a surface's own lighting reads right instead of every voxel touching a
// wall or shelf going black. Runs as a generator, a slice per frame, from
// the main loop — colliders are all in place by the first frame.
// ponytail: brute-force boxes filtered per voxel column, ~1s spread over frames; a BVH if the store grows a lot
function* bakeTvVis() {
  const boxes = colliders.filter(c => c.shadow !== false)
    .map(c => ({ x0: c.x0, x1: c.x1, y0: c.y0 ?? 0, y1: c.y1 ?? BAY.h, z0: c.z0, z1: c.z1 })).concat(TV_PROXIES);
  const P = TVU.uTvZoneP.value, [nx, ny, nz] = tvVolN, { x0, z0, cell } = TV_VOL, data = tvVisTex.image.data;
  const S = [0, 1, 2].map(c => [-0.15, 0.15].flatMap(dx => [1.35, 0.95, 0.55].map(y => [P[c * 3] + dx, y, TV_SCREEN_Z])));
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const vx = x0 + (i + 0.5) * cell, vz = z0 + (k + 0.5) * cell;
    const near = boxes.filter(b => b.x1 > Math.min(vx, -0.9) && b.x0 < Math.max(vx, 0.9) && b.z1 > vz && b.z0 < TV_SCREEN_Z);
    for (let j = 0; j < ny; j++) {
      const vy = (j + 0.5) * cell, o = ((k * ny + j) * nx + i) * 4;
      const cand = near.filter(b => !(vx > b.x0 && vx < b.x1 && vy > b.y0 && vy < b.y1 && vz > b.z0 && vz < b.z1));
      for (let c = 0; c < 3; c++) {
        let lit = 0;
        for (const [sx, sy, sz] of S[c]) if (!cand.some(b => segHitsBox(vx, vy, vz, sx - vx, sy - vy, sz - vz, b))) lit++;
        data[o + c] = lit * 255 / S[c].length | 0;
      }
    }
    yield;
  }
  tvVisTex.needsUpdate = true;
}
let tvBake = bakeTvVis();
const screenGeo = new THREE.PlaneGeometry(1.8, 1.2);   // big-screen TV, ~4:3

// video is drawn into this canvas fit to its own native aspect (never
// stretched), black bars filling whatever's left — see updateVideoFrame,
// called once per frame from the main loop while a tape is playing
const videoCanvas = document.createElement("canvas"); videoCanvas.width = 480; videoCanvas.height = 320;
const videoCtx = videoCanvas.getContext("2d");
// Per show-season crops carried over from VaultVision's show data: some rips
// bake the picture into a black surround with a watermark panel down the left
// (crop = {x,y,w,h} fractions of the full frame, measured with ffmpeg cropdetect).
// ponytail: no intro skip — archive.org/cors ignores Range so the video can't
// seek, and /download/ has no CORS header (taints the canvas). Skip lengths
// live in VaultVision's introSkip* fields if a Range+CORS proxy ever exists.
const TAPE_FIXES = {
  "TwilightZone1959:3": { crop: { x: 0.1522, y: 0.0333, w: 0.7119, h: 0.9375 } },
  "TwilightZone1959:4": { crop: { x: 0.1546, y: 0.0167, w: 0.7096, h: 0.9625 } },
  "AlfredHitchcockPresents:1": { crop: { x: 0.1499, y: 0.0354, w: 0.7084, h: 0.9229 } },
  "AlfredHitchcockPresents:2": { crop: { x: 0.1522, y: 0.0208, w: 0.7178, h: 0.9563 } },
  "AlfredHitchcockPresents:3": { crop: { x: 0.1440, y: 0.0167, w: 0.7155, h: 0.9625 } },
  "AlfredHitchcockPresents:4": { crop: { x: 0.1487, y: 0.0250, w: 0.7026, h: 0.9458 } },
  "AlfredHitchcockPresents:5": { crop: { x: 0.1464, y: 0.0208, w: 0.7307, h: 0.9521 } },
  "AlfredHitchcockPresents:6": { crop: { x: 0.1405, y: 0.0146, w: 0.7447, h: 0.9688 } },
  "AlfredHitchcockPresents:7": { crop: { x: 0.1382, y: 0.0208, w: 0.7295, h: 0.9542 } },
};
const tapeFix = tape => TAPE_FIXES[`${tape.id}:${tape.season}`] || {};
// the colorized rips are garish — force the picture back to black & white
const BW_SHOWS = new Set(["TwilightZone1959", "AlfredHitchcockPresents"]);

// ---------------- TV picture settings: VaultVision's SETTINGS menu, on the TV ----------------
// Same controls as VaultVision's player (minus captions — no caption tracks
// here): OVERLAY (the VCR on-screen display), SCANLINES, PIXELATED, B&W,
// BRIGHTNESS / CONTRAST / COLOR / TINT / SHARPEN, RESET, CLOSE. The crosshair
// is the remote: right-click the TV (or anywhere while seated) opens it, left-
// click picks a row — toggles flip, a slider jumps to where you clicked on its
// bar, the wheel nudges whichever slider you're pointing at. Saved per browser.
const TV_DEFAULTS = { overlay: true, scanlines: true, pixelated: false, bw: false,
  brightness: 100, contrast: 100, saturate: 100, hue: 0, sharpen: 0 };
let tvSet = { ...TV_DEFAULTS };
try { Object.assign(tvSet, JSON.parse(localStorage.getItem("vaultbuster-tv") || "{}")); } catch {}
const TV_ROWS = [
  { k: "overlay", label: "OVERLAY" }, { k: "scanlines", label: "SCANLINES" },
  { k: "pixelated", label: "PIXELATED" }, { k: "bw", label: "B&W" },
  { k: "brightness", label: "BRIGHTNESS", min: 50, max: 150, step: 5 },
  { k: "contrast", label: "CONTRAST", min: 50, max: 150, step: 5 },
  { k: "saturate", label: "COLOR", min: 0, max: 200, step: 5 },
  { k: "hue", label: "TINT", min: 0, max: 360, step: 10 },
  { k: "sharpen", label: "SHARPEN", min: 0, max: 100, step: 5 },
];
// menu layout on the 480x320 screen canvas
const TVM = { rowY: 58, rowH: 23, labelX: 44, barX: 214, barW: 190, chkX: 214, chkW: 26, btnY: 272, btnH: 30,
  buttons: [{ k: "reset", label: "RESET", x: 128, w: 100 }, { k: "close", label: "CLOSE", x: 252, w: 100 }] };
let tvMenu = false, tvHover = null;          // hover: a TV_ROWS index, "reset" or "close"
const osd = { text: "", until: 0 };          // VCR on-screen display (the OVERLAY setting)
function tvOsd(text, secs = 3) { osd.text = text; osd.until = secs ? performance.now() + secs * 1000 : Infinity; }
function applyTv() {
  try { localStorage.setItem("vaultbuster-tv", JSON.stringify(tvSet)); } catch {}
  // unsharp-mask kernel, as VaultVision: lerp identity -> classic sharpen by SHARPEN
  const a = tvSet.sharpen / 100 * 1.5;
  document.getElementById("tvSharpenMatrix")?.setAttribute("kernelMatrix", `0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0`);
  const f = tvSet.pixelated ? THREE.NearestFilter : THREE.LinearFilter;
  if (videoTex && videoTex.magFilter !== f) { videoTex.magFilter = videoTex.minFilter = f; videoTex.needsUpdate = true; }
}
function pictureFilter(tape, withSharpen = true) {
  const t = tvSet, f = [];
  if (t.brightness !== 100) f.push(`brightness(${t.brightness}%)`);
  if (t.contrast !== 100) f.push(`contrast(${t.contrast}%)`);
  if (t.bw || (tape && BW_SHOWS.has(tape.id))) f.push("grayscale(1)");   // B&W overrides COLOR without losing it
  else if (t.saturate !== 100) f.push(`saturate(${t.saturate}%)`);
  if (t.hue) f.push(`hue-rotate(${t.hue}deg)`);
  if (withSharpen && t.sharpen > 0) f.push("url(#tvSharpen)");
  return f.join(" ") || "none";
}
const scanFx = document.createElement("canvas"); scanFx.width = 480; scanFx.height = 320;   // scanlines + glass vignette, drawn once
{
  const c = scanFx.getContext("2d");
  // every other row dimmed, with a faint cool tint (like the gap between phosphor lines), the lit rows a hair brighter
  for (let y = 0; y < 320; y += 2) { c.fillStyle = "rgba(4,8,20,.34)"; c.fillRect(0, y + 1, 480, 1); c.fillStyle = "rgba(255,255,255,.035)"; c.fillRect(0, y, 480, 1); }
  const g = c.createRadialGradient(240, 160, 110, 240, 160, 300); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.45)");
  c.fillStyle = g; c.fillRect(0, 0, 480, 320);
}
function drawTvMenu(ctx) {
  // OVERLAY checked: no panel, just the text (drop-shadowed to stay readable)
  // over the picture, so you can see the changes behind it. Unchecked: the dark panel
  if (!tvSet.overlay) { ctx.fillStyle = "rgba(0,8,30,.82)"; ctx.fillRect(20, 12, 440, 296); }
  ctx.shadowColor = tvSet.overlay ? "rgba(0,0,0,.9)" : "transparent"; ctx.shadowBlur = 3; ctx.shadowOffsetX = ctx.shadowOffsetY = 1;
  ctx.strokeStyle = "#7dff9a"; ctx.lineWidth = 2; ctx.strokeRect(20, 12, 440, 296);
  ctx.fillStyle = "#7dff9a"; ctx.textBaseline = "middle"; ctx.textAlign = "center";
  ctx.font = "bold 22px 'Courier New', monospace"; ctx.fillText("SETTINGS", 240, 34);
  ctx.font = "bold 15px 'Courier New', monospace";
  TV_ROWS.forEach((r, i) => {
    const y = TVM.rowY + i * TVM.rowH, v = tvSet[r.k];
    if (tvHover === i) { ctx.fillStyle = "rgba(125,255,154,.18)"; ctx.fillRect(34, y - 10, 412, 21); }
    ctx.fillStyle = "#7dff9a"; ctx.textAlign = "left"; ctx.fillText(r.label, TVM.labelX, y + 1);
    ctx.strokeStyle = "#7dff9a"; ctx.lineWidth = 1.5;
    if (r.min == null) {
      ctx.strokeRect(TVM.chkX, y - 8, TVM.chkW, 16);
      if (v) ctx.fillRect(TVM.chkX + 4, y - 4, TVM.chkW - 8, 8);
    } else {
      ctx.strokeRect(TVM.barX, y - 7, TVM.barW, 14);
      ctx.fillRect(TVM.barX, y - 7, (v - r.min) / (r.max - r.min) * TVM.barW, 14);
      ctx.textAlign = "right"; ctx.fillText(String(v), 444, y + 1);
    }
  });
  ctx.textAlign = "center"; ctx.font = "bold 16px 'Courier New', monospace";
  for (const b of TVM.buttons) {
    if (tvHover === b.k) { ctx.fillStyle = "rgba(125,255,154,.25)"; ctx.fillRect(b.x, TVM.btnY, b.w, TVM.btnH); }
    ctx.strokeStyle = "#7dff9a"; ctx.lineWidth = 2; ctx.strokeRect(b.x, TVM.btnY, b.w, TVM.btnH);
    ctx.fillStyle = "#7dff9a"; ctx.fillText(b.label, b.x + b.w / 2, TVM.btnY + TVM.btnH / 2 + 1);
  }
  ctx.shadowColor = "transparent"; ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
}
// what's under screen-canvas point (x, y): a row index, "reset"/"close", or null
function tvMenuHit(x, y) {
  for (const b of TVM.buttons) if (x >= b.x && x <= b.x + b.w && y >= TVM.btnY && y <= TVM.btnY + TVM.btnH) return b.k;
  const i = Math.round((y - TVM.rowY) / TVM.rowH);
  return i >= 0 && i < TV_ROWS.length && Math.abs(y - (TVM.rowY + i * TVM.rowH)) <= 11 && x >= 34 && x <= 446 ? i : null;
}
function tvMenuClick(x, y) {
  const h = tvMenuHit(x, y);
  if (h === "close") { tvMenu = false; return; }
  if (h === "reset") tvSet = { ...TV_DEFAULTS };
  else if (h != null) {
    const r = TV_ROWS[h];
    if (r.min == null) tvSet[r.k] = !tvSet[r.k];
    else if (x >= TVM.barX - 8) {            // clicked on (or just off) the bar: jump there, snapped to the step
      const t = Math.max(0, Math.min(1, (x - TVM.barX) / TVM.barW));
      tvSet[r.k] = Math.round((r.min + t * (r.max - r.min)) / r.step) * r.step;
    }
  }
  applyTv();
}
function tvMenuWheel(dir) {                  // wheel over a slider row nudges it one step
  const r = TV_ROWS[tvHover];
  if (!r || r.min == null) return false;
  tvSet[r.k] = Math.max(r.min, Math.min(r.max, tvSet[r.k] + dir * r.step)); applyTv(); return true;
}
function updateVideoFrame() {
  const W = videoCanvas.width, H = videoCanvas.height;
  videoCtx.fillStyle = "#000"; videoCtx.fillRect(0, 0, W, H);
  if (playing && video.videoWidth) {
    const c = tapeFix(playing.tape).crop || { x: 0, y: 0, w: 1, h: 1 };
    const sx = c.x * video.videoWidth, sy = c.y * video.videoHeight;
    const sw = c.w * video.videoWidth, sh = c.h * video.videoHeight;
    const scale = Math.min(W / sw, H / sh);
    const dw = sw * scale, dh = sh * scale;
    videoCtx.filter = pictureFilter(playing.tape);
    videoCtx.drawImage(video, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
    videoCtx.filter = "none";
  }
  if (playing && tvSet.overlay && !tvMenu && (video.paused || performance.now() < osd.until)) {   // VCR-style OSD, top left
    videoCtx.font = "bold 20px 'Courier New', monospace"; videoCtx.textAlign = "left"; videoCtx.textBaseline = "top";
    const t = video.paused ? "PAUSE ❚❚" : osd.text;
    videoCtx.fillStyle = "rgba(0,0,0,.6)"; videoCtx.fillText(t, 26, 22);
    videoCtx.fillStyle = "#e8ffe8"; videoCtx.fillText(t, 24, 20);
  }
  if (tvMenu) drawTvMenu(videoCtx);
  if (tvSet.scanlines) videoCtx.drawImage(scanFx, 0, 0, W, H);
  videoTex.needsUpdate = true;
}

// ---------------- idle screensaver: bouncing "VaultBuster" logo ----------------
// one shared canvas feeds every idle screen (same sharing trick as videoMat
// for playing tapes) — one redraw + texture upload per frame, not one per screen
const dvdLogoTex = makeTexture((ctx, W, H) => {   // square brand mark used as the bouncing sprite
  const m = 22, r = 34, w = W - m * 2, h = H - m * 2;
  ctx.beginPath(); ctx.roundRect(m, m, w, h, r);
  ctx.fillStyle = "#00349c"; ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = "#ffd400"; ctx.stroke();
  ctx.fillStyle = "#ffd400"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `italic 900 ${Math.round(W * 0.155)}px Arial Black, Arial`;
  ctx.fillText("VAULT", W / 2, H * 0.4);
  ctx.fillText("BUSTER", W / 2, H * 0.62);
}, 512, 512);
const ssLogoBuf = document.createElement("canvas"); ssLogoBuf.width = ssLogoBuf.height = 128;
const ssLogoCtx = ssLogoBuf.getContext("2d");
const ssCanvas = document.createElement("canvas"); ssCanvas.width = 320; ssCanvas.height = 240;
const ssCtx = ssCanvas.getContext("2d");
const screensaverTex = new THREE.CanvasTexture(ssCanvas); screensaverTex.colorSpace = THREE.SRGBColorSpace;
const screensaverMat = new THREE.MeshBasicMaterial({ map: screensaverTex });
const DVD_TINTS = ["#ffd400", "#4dd0e1", "#ff6b6b", "#8affc1", "#c792ea", "#ffab40", "#ffffff"];
const dvd = { x: 40, y: 30, vx: 78, vy: 61, w: 100, h: 100, tint: 0 };
function updateScreensaver(dt) {
  const W = ssCanvas.width, H = ssCanvas.height;
  dvd.x += dvd.vx * dt; dvd.y += dvd.vy * dt;
  let bounced = false;
  if (dvd.x <= 0) { dvd.x = 0; dvd.vx = Math.abs(dvd.vx); bounced = true; }
  else if (dvd.x + dvd.w >= W) { dvd.x = W - dvd.w; dvd.vx = -Math.abs(dvd.vx); bounced = true; }
  if (dvd.y <= 0) { dvd.y = 0; dvd.vy = Math.abs(dvd.vy); bounced = true; }
  else if (dvd.y + dvd.h >= H) { dvd.y = H - dvd.h; dvd.vy = -Math.abs(dvd.vy); bounced = true; }
  if (bounced) dvd.tint = (dvd.tint + 1) % DVD_TINTS.length;   // recolors on each bounce, classic-screensaver style
  ssLogoCtx.clearRect(0, 0, 128, 128);
  ssLogoCtx.drawImage(dvdLogoTex.image, 0, 0, 128, 128);
  ssLogoCtx.globalCompositeOperation = "source-atop";          // tint only the logo's own pixels, not the black behind it
  ssLogoCtx.fillStyle = DVD_TINTS[dvd.tint] + "55";
  ssLogoCtx.fillRect(0, 0, 128, 128);
  ssLogoCtx.globalCompositeOperation = "source-over";
  ssCtx.fillStyle = "#000"; ssCtx.fillRect(0, 0, W, H);
  ssCtx.drawImage(ssLogoBuf, dvd.x, dvd.y, dvd.w, dvd.h);
  screensaverTex.needsUpdate = true;
}
let screenMesh, videoMat, videoTex, miniScreens;
let tvPowerLed, vcrDisplay;                  // the TV console's power LED + the VCR's VFD clock (built with the TV)
const crtGlows = [];                       // one real light per ceiling CRT cluster — bloom alone doesn't light the shelves under it
{
  // the preview living room: rug, coffee table, couch facing the TV
  const rugZ0 = TV.z - 6.2, rugZ1 = STORE.z - 0.1;   // runs up to the back wall and stops — the back-of-house hall is behind it
  // the Overlook Hotel carpet from The Shining — the SVG pattern behind
  // IceCreamDrip's render_motif_ref.py, drawn with real SVG semantics (that
  // script's PIL version draws strokes inward and tiles unclipped/overlapping,
  // which scrambles the motif): one 7 x 10 stroke-width tile of red hexes with
  // the group's black stroke, big black hex rings and descender bars, clipped
  // to the tile and repeated.
  const SW = 0.18;                                                              // world m per stroke width
  const overlookTex = makeTexture((ctx, W, H) => {
    const sw = W / 7, w = W, h = H;
    const ORANGE = "rgb(223,95,24)", RED = "rgb(152,31,36)", BLACK = "rgb(72,38,22)";   // "black" is the carpet's dark brown
    const g = ctx;
    const hexPts = (cx, cy, r) => [0, 60, 120, 180, 240, 300].map(deg => { const a = deg * Math.PI / 180; return [cx + r * Math.sin(a), cy + r * Math.cos(a)]; });
    const poly = pts => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); };
    const line = (x0, y0, x1, y1, width) => { g.lineWidth = width; g.lineCap = "butt"; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); };
    // SVG pattern semantics: one tile, clipped to its own box (the canvas edge
    // does that), strokes centred on the path, children painted in document order
    g.save(); g.translate(0, H); g.scale(1, -1);   // flipped so the motif's top points away from the couch, toward the TV
    g.fillStyle = ORANGE; g.fillRect(0, 0, w, h);
    g.strokeStyle = BLACK; g.lineJoin = "miter"; g.lineWidth = sw;
    for (const [cx, cy] of [[w / 2, h / 2], [0, h - sw], [w, h - sw], [0, -sw], [w, -sw]]) {
      poly(hexPts(cx, cy, sw * 2)); g.fillStyle = RED; g.fill(); g.lineWidth = sw; g.stroke();   // red hexes, inherited black stroke
    }
    for (const [cx, cy] of [[0, -sw], [w, -sw]]) { poly(hexPts(cx, cy, sw * 4)); g.lineWidth = sw; g.stroke(); }   // big rings
    line(w / 2, h - sw * 3, w / 2, h, sw * 1.1);                                                     // descenders
    line(0, h - sw * 7, 0, h - sw * 3, sw);
    line(w, h - sw * 7, w, h - sw * 3, sw);
    g.restore();
    const img = ctx.getImageData(0, 0, W, H), d = img.data;                                           // a little pile texture
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    ctx.putImageData(img, 0, 0);
  }, 7 * 96, 10 * 96);
  overlookTex.repeat.set(7 / (7 * SW), (rugZ1 - rugZ0) / (10 * SW));
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, rugZ1 - rugZ0), new THREE.MeshLambertMaterial({ map: overlookTex }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, (rugZ0 + rugZ1) / 2); scene.add(rug);
  // vintage coffee table, 0.78 m clear of the couch front (room — player is 0.64
  // wide — to reach the middle seat). Same 1.0 x 0.5 x 0.35 block as before, so
  // the tape case on top still lines up; the TV-facing side stays one solid
  // flat panel (TV_PROXIES casts the TV light's shadow from it).
  {
    const zc = TV.z - 1.8, W = 1.0, D = 0.5, H = 0.35;
    const dark = new THREE.MeshLambertMaterial({ color: 0x4a2a12 });
    const knobMat = new THREE.MeshPhongMaterial({ color: 0xb08432, specular: 0xffe2a0, shininess: 70 });
    const tg = new THREE.Group(); tg.position.set(0, 0, zc); scene.add(tg);
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); tg.add(o); return o; };
    add(new THREE.BoxGeometry(W, H - 0.035, 0.03), mat.wood, 0, (H - 0.035) / 2, D / 2 - 0.015);        // solid TV-side panel
    add(new THREE.BoxGeometry(W + 0.06, 0.035, D + 0.03), mat.wood, 0, H - 0.0175, -0.015);            // top: overhangs couch side + ends, flush at the TV
    add(new THREE.BoxGeometry(W + 0.03, 0.014, D + 0.015), dark, 0, H - 0.042, -0.0075);               // molded lip under it
    // couch-side skirt between the legs, scalloped along its bottom edge
    const aw = W - 0.1, ah = 0.09, sk = new THREE.Shape();
    sk.moveTo(-aw / 2, 0); sk.lineTo(aw / 2, 0); sk.lineTo(aw / 2, -ah * 0.7);
    const N = 7;
    for (let i = 0; i < N; i++) {                                       // shallow arches, deepest in the middle
      const x0 = aw / 2 - (i / N) * aw, x1 = aw / 2 - ((i + 1) / N) * aw;
      const dip = ah * (0.7 + 0.3 * (1 - Math.abs((i + 0.5) / N - 0.5) * 2));
      sk.quadraticCurveTo((x0 + x1) / 2, -dip - 0.02, x1, -ah * 0.7);
    }
    sk.lineTo(-aw / 2, 0);
    const skirt = new THREE.ExtrudeGeometry(sk, { depth: 0.02, bevelEnabled: false });
    add(skirt, dark, 0, H - 0.049, -D / 2 + 0.03);
    add(new THREE.BoxGeometry(0.36, 0.045, 0.012), mat.wood, 0, H - 0.075, -D / 2 + 0.028);              // drawer front
    add(new THREE.SphereGeometry(0.011, 10, 8), knobMat, 0, H - 0.075, -D / 2 + 0.018);                  // brass knob
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.06, D - 0.09), dark, sx * (W / 2 - 0.025), H - 0.079, 0.0); // end skirts
    // turned legs at the two couch-side corners (the TV side rests on its panel)
    const legPts = [[0, 0], [0.028, 0], [0.032, 0.015], [0.024, 0.04], [0.017, 0.11], [0.021, 0.17],
                    [0.027, 0.185], [0.02, 0.2], [0.024, 0.22], [0.03, 0.235], [0.03, H - 0.049], [0, H - 0.049]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    for (const sx of [-1, 1]) add(new THREE.LatheGeometry(legPts, 18), dark, sx * (W / 2 - 0.035), 0, -D / 2 + 0.04);
    add(new THREE.BoxGeometry(W - 0.07, 0.018, D - 0.07), mat.wood, 0, 0.075, 0.0);                     // lower shelf
    [[-0.28, 0, 0.1, 0x8c2a1e], [-0.27, 1, -0.05, 0x1f3f86], [0.25, 0, 0.25, 0xd8c9a0]].forEach(([x, k, r, c]) => {   // a few tapes left on the shelf
      const tb = add(new THREE.BoxGeometry(TAPE.d, TAPE.w, TAPE.h), new THREE.MeshLambertMaterial({ color: c }), x, 0.084 + TAPE.w / 2 + k * TAPE.w, 0.01);
      tb.rotation.y = r;
    });
    colliders.push({ x0: -W / 2 - 0.03, x1: W / 2 + 0.03, z0: zc - D / 2 - 0.03, z1: zc + D / 2, shadow: false });   // TV_PROXIES shape its shadow instead
  }
  const couch = buildCouch();                                             // ornate orange sofa facing the TV (couch.js)
  const cs = 1.12;                                                        // model is built life-size; scaled up a touch (SEATS below match)
  couch.scale.setScalar(cs);
  couch.position.set(0, 0, TV.z - 3.89 - couch.userData.zRange[0] * cs); scene.add(couch);   // back edge stays at TV.z - 3.89
  const couchMeshes = couch.children.filter(c => c.isMesh);              // every mesh carries userData.sit
  { const [z0, z1] = couch.userData.zRange, w = couch.userData.footprint.w * cs;
    colliders.push({ x0: -w / 2, x1: w / 2, z0: couch.position.z + z0 * cs, z1: couch.position.z + z1 * cs, shadow: false }); }
  const ps = textPlane("PREVIEW STATION", 1.2 * cs, 0.25 * cs);          // on the back of the couch
  const sg = couch.userData.sign;
  ps.position.set(0, sg.y * cs, couch.position.z + sg.z * cs); ps.rotation.set(sg.tilt, Math.PI, 0);
  ps.material = new THREE.MeshLambertMaterial({ map: ps.material.map }); // lit by the room, no unlit glow in the dark
  scene.add(ps);
  // classic 90s floor-standing rear-projection TV: glossy black console,
  // bullnosed top, stepped charcoal frame round the (recessed) screen, fabric
  // speaker columns either side, a full-width bottom grille with the model
  // plate, a chrome brand badge up top, a control strip with a power LED, the
  // sloped projector housing out the back — and a VCR with a blinking 12:00.
  // Built round the screen (1.8 x 1.2, centred y 0.95, front at TV.z - 0.558),
  // which the TV light / picture menu / shadow bake all key off.
  {
    const g = new THREE.Group(); g.position.set(TV.x, 0, TV.z); scene.add(g);  // local -z = front (toward the couch)
    const gloss = new THREE.MeshPhongMaterial({ color: 0x141518, specular: 0x3a3a3a, shininess: 45 });
    const satin = new THREE.MeshPhongMaterial({ color: 0x0d0e10, specular: 0x222222, shininess: 20 });
    const frameM = new THREE.MeshPhongMaterial({ color: 0x2a2d33, specular: 0x555555, shininess: 60 });
    const silver = new THREE.MeshPhongMaterial({ color: 0xa9aeb5, specular: 0xffffff, shininess: 90 });
    const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); return o; };
    const bx = (w, h, d, m, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent);
    const W = 2.3, ZF = -0.545, TOPY = 1.78;                                  // cabinet width, front face, top
    const grilleTex = (w, h, reps) => {                                         // black speaker cloth: a fine weave
      const t = makeTexture((ctx, cw, ch) => {
        ctx.fillStyle = "#1c1e22"; ctx.fillRect(0, 0, cw, ch);
        ctx.fillStyle = "#2c2f34"; for (let x = 0; x < cw; x += 4) ctx.fillRect(x, 0, 1, ch);
        ctx.fillStyle = "#0a0b0c"; for (let y = 0; y < ch; y += 4) ctx.fillRect(0, y, cw, 1);
      }, 128, 128);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(w * reps, h * reps); return t;
    };
    const grille = (w, h, x, y) => add(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: grilleTex(w, h, 8) }), x, y, ZF - 0.003).rotation.y = Math.PI;
    // body: plinth, lower band, the screen section, the bullnosed top
    bx(W - 0.08, 0.06, 0.56, satin, 0, 0.03, -0.24);                                        // recessed plinth
    bx(W, 0.3, 0.6, gloss, 0, 0.21, ZF + 0.3);                                               // lower band (0.06-0.36)
    bx(W, 1.2, 0.6, gloss, 0, 0.96, ZF + 0.3);                                               // screen section (0.36-1.56)
    bx(W, 0.12, 0.6, gloss, 0, 1.62, ZF + 0.3);                                              // top band (1.56-1.68)
    bx(W, 0.1, 0.55, gloss, 0, TOPY - 0.05, ZF + 0.325);                                     // behind the bullnose
    const nose = add(new THREE.CylinderGeometry(0.05, 0.05, W, 20), gloss, 0, TOPY - 0.05, ZF + 0.05); nose.rotation.z = Math.PI / 2;
    // sloped rear housing: the projector + mirror box, tall at the cabinet, raking down to the back
    const prof = new THREE.Shape([[0.055, 0.06], [0.055, TOPY - 0.02], [0.3, 1.52], [0.6, 0.95], [0.6, 0.06]].map(([z, y]) => new THREE.Vector2(z, y)));
    const rear = new THREE.ExtrudeGeometry(prof, { depth: 2.0, bevelEnabled: false }); rear.rotateY(-Math.PI / 2); rear.translate(1.0, 0, 0);
    add(rear, satin, 0, 0, 0);
    // stepped frame round the screen, with a silver pinline at its inner edge
    const SY = 0.95, SW = 1.8, SH = 1.2, FW = 0.05;
    for (const [w, h, x, y] of [[SW + 2 * FW, FW, 0, SY + SH / 2 + FW / 2], [SW + 2 * FW, FW, 0, SY - SH / 2 - FW / 2], [FW, SH, SW / 2 + FW / 2, SY], [FW, SH, -SW / 2 - FW / 2, SY]]) {
      bx(w, h, 0.05, frameM, x, y, ZF - 0.02);
      bx(w + (w > h ? 0.04 : 0.02), h + (h > w ? 0.04 : 0.02), 0.02, gloss, x, y, ZF - 0.005);   // the step out to the cabinet face
    }
    for (const [w, h, x, y] of [[SW, 0.006, 0, SY + SH / 2 + 0.003], [SW, 0.006, 0, SY - SH / 2 - 0.003], [0.006, SH, SW / 2 + 0.003, SY], [0.006, SH, -SW / 2 - 0.003, SY]])
      bx(w, h, 0.006, silver, x, y, ZF - 0.047);
    // speaker columns either side of the screen, and the full-width grille below
    for (const s of [-1, 1]) grille(0.14, 1.12, s * (W / 2 - 0.09), SY);
    grille(1.72, 0.2, -0.13, 0.2);
    const plate = textPlane("PROJECTION 60", 0.34, 0.05, "#1a1c20", "#b8bdc4", "Arial", 64);
    plate.material = new THREE.MeshLambertMaterial({ map: plate.material.map });
    plate.position.set(-0.13, 0.2, ZF - 0.006); plate.rotation.y = Math.PI; g.add(plate);
    // brand badge on the top band
    const badge = textPlane("VIDEOTRONIC", 0.4, 0.05, "#d8dce2", "#141518", "Arial Black", 72);
    badge.material = new THREE.MeshPhongMaterial({ map: badge.material.map, specular: 0x888888, shininess: 70 });
    badge.position.set(0, 1.655, ZF - 0.004); badge.rotation.y = Math.PI; g.add(badge);
    // control strip, lower right: a row of little buttons and the power LED
    bx(0.3, 0.07, 0.012, satin, 0.93, 0.2, ZF - 0.006);
    for (let i = 0; i < 4; i++) bx(0.03, 0.018, 0.012, frameM, 0.84 + i * 0.045, 0.2, ZF - 0.014);
    tvPowerLed = glow(add(new THREE.SphereGeometry(0.008, 10, 8), new THREE.MeshBasicMaterial({ color: 0x551008 }), 1.05, 0.2, ZF - 0.012));
    // feet
    for (const x of [-1, 1]) for (const z of [-0.45, 0.45]) add(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 12), satin, x * (W / 2 - 0.12), 0.01, z + 0.05);
    colliders.push({ x0: TV.x - W / 2, x1: TV.x + W / 2, z0: TV.z + ZF, z1: TV.z + 0.6, y1: TOPY });   // starts behind the screen: the TV light's shadow bake treats colliders as blockers

    // the VCR on top: black, a VHS door, buttons, and a green VFD clock
    const vcr = new THREE.Group(); vcr.position.set(0.55, TOPY, -0.2); g.add(vcr);
    bx(0.43, 0.09, 0.3, gloss, 0, 0.045, 0, vcr);
    bx(0.43, 0.012, 0.3, frameM, 0, 0.006, 0, vcr);                                         // silver-grey base trim
    bx(0.2, 0.035, 0.006, satin, -0.07, 0.05, -0.152, vcr);                                  // tape door
    const vhs = textPlane("VHS", 0.04, 0.014, "#c9cdd2", "#0d0e10", "Arial Black", 60);
    vhs.material = new THREE.MeshLambertMaterial({ map: vhs.material.map }); vhs.position.set(-0.07, 0.023, -0.156); vhs.rotation.y = Math.PI; vcr.add(vhs);
    for (let i = 0; i < 5; i++) bx(0.016, 0.008, 0.006, frameM, 0.07 + i * 0.022, 0.028, -0.152, vcr);
    const vfd = document.createElement("canvas"); vfd.width = 128; vfd.height = 40;
    vcrDisplay = { ctx: vfd.getContext("2d"), tex: new THREE.CanvasTexture(vfd), shown: "" };
    vcrDisplay.tex.colorSpace = THREE.SRGBColorSpace;
    glow(add(new THREE.PlaneGeometry(0.1, 0.03), new THREE.MeshBasicMaterial({ map: vcrDisplay.tex }), 0.12, 0.06, -0.1535, vcr)).rotation.y = Math.PI;
  }
  screenMesh = new THREE.Mesh(screenGeo, screensaverMat);
  screenMesh.position.set(0, 0.95, TV.z - 0.558);
  screenMesh.rotation.y = Math.PI;                 // faces the couch
  scene.add(glow(screenMesh));
  aimables.push(screenMesh, ...couchMeshes);
  const poolTex = makeTexture((ctx, W, H) => {   // soft warm pool on the floor under each lamp — edge fades gradually, no hard ring
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, "rgba(255,176,102,.22)"); g.addColorStop(0.35, "rgba(255,176,102,.12)");   // -25% from the original .3/.16
    g.addColorStop(0.7, "rgba(255,176,102,.04)"); g.addColorStop(1, "rgba(255,176,102,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }, 256, 256);
  // floor lamps at either end of the couch, just clear of its arms, level with its middle
  const lampZ = couch.position.z + (couch.userData.zRange[0] + couch.userData.zRange[1]) / 2 * cs;
  const lampX = couch.userData.footprint.w * cs / 2 + 0.35;
  // vintage brass floor lamp to go with the parlor sofa: stepped weighted
  // base, turned stem with collars, harp + finial, bell-shaped fabric shade
  // with trim, a bulb you can see glowing inside, and a pull chain
  const brass = new THREE.MeshPhongMaterial({ color: 0xb08432, specular: 0xffe2a0, shininess: 70 });
  const bronze = new THREE.MeshPhongMaterial({ color: 0x3a2a18, specular: 0x7a6040, shininess: 40 });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x7a1f1a });                 // oxblood fabric trim
  const lathe = (pts, m, seg = 28) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), m);
  const SHADE_Y0 = 1.3, SHADE_H = 0.34;
  function makeLamp(lx) {
    const g = new THREE.Group(); g.position.set(lx, 0, lampZ);
    const parts = [
      lathe([[0, 0], [0.19, 0], [0.19, 0.018], [0.165, 0.03], [0.15, 0.055], [0.05, 0.075], [0, 0.08]], bronze),        // weighted base
      lathe([[0.045, 0.07], [0.05, 0.09], [0.03, 0.1]], brass),                                                          // base collar
      lathe([[0.018, 0.1], [0.016, 0.62], [0.034, 0.64], [0.034, 0.67], [0.016, 0.69],                                 // stem, knop midway
             [0.014, 1.18], [0.028, 1.2], [0.028, 1.23], [0.012, 1.25], [0.012, 1.3]], brass, 16),
      lathe([[0.02, 1.3], [0.026, 1.31], [0.026, 1.39], [0.02, 1.4]], brass, 16),                                       // bulb socket
    ];
    // harp: a brass wire loop from the socket up over the bulb to the finial
    const harp = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.0045, 6, 24, Math.PI), brass);
    harp.position.y = 1.53; harp.scale.y = 1.6; parts.push(harp);
    for (const hx of [-0.075, 0.075]) {                                                   // harp legs down to the socket saddle
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.14, 6), brass); leg.position.set(hx, 1.46, 0); parts.push(leg);
    }
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.008, 0.012), brass); saddle.position.y = 1.39; parts.push(saddle);
    parts.push(lathe([[0, 1.645], [0.012, 1.655], [0.02, 1.672], [0.012, 1.69], [0.004, 1.71], [0, 1.715]], brass, 12)); // finial
    // bell shade: flared skirt, soft shoulder, narrow top; double-sided so the lit inside shows
    const shadeMat = new THREE.MeshLambertMaterial({ color: 0xf2dcae, emissive: 0xe8a458, emissiveIntensity: SHADE_GLOW, side: THREE.DoubleSide });
    const shadePts = [[0.25, 0], [0.235, 0.03], [0.205, 0.12], [0.18, 0.22], [0.155, 0.3], [0.13, SHADE_H]]
      .map(([r, y]) => [r, SHADE_Y0 + y]);
    const shade = lathe(shadePts, shadeMat, 36); glow(shade);
    const rimTop = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 6, 36), trimMat);
    rimTop.rotation.x = Math.PI / 2; rimTop.position.y = SHADE_Y0 + SHADE_H;
    const rimBot = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 6, 40), trimMat);
    rimBot.rotation.x = Math.PI / 2; rimBot.position.y = SHADE_Y0;
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff3d6 });
    bulbMat.userData.onColor = new THREE.Color(0xfff3d6); bulbMat.userData.offColor = new THREE.Color(0x5a554a);
    const bulb = glow(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), bulbMat)); bulb.position.y = 1.45; bulb.scale.y = 1.25;
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.16, 4), brass); chain.position.set(0.03, 1.3, 0);
    const pull = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), brass); pull.position.set(0.03, 1.22, 0);
    parts.push(shade, rimTop, rimBot, bulb, chain, pull);
    g.add(...parts); scene.add(g);
    return { parts, shadeMat, bulbMat };
  }
  for (const lx of [-lampX, lampX]) {
    const { parts, shadeMat, bulbMat } = makeLamp(lx);
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false }));
    lampPools.push(pool);   // dimmed further to nothing once the overhead fluorescents are on — see the main update loop
    pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.03, lampZ); scene.add(pool);
    const lampL = new THREE.PointLight(0xffb066, LAMP_ON, 4, 2); lampL.position.set(lx, 1.45, lampZ);   // at the bulb
    lampL.userData.on = LAMP_ON; lampL.userData.shadeMat = shadeMat; lampL.userData.bulbMat = bulbMat; lampL.userData.pool = pool;
    scene.add(lampL);   // not in allLights — survives lights-out
    lamps.push(lampL);
    for (const m of parts) { m.userData.lamp = lampL; aimables.push(m); }
  }

  // every screen shares ONE decode: the single <video> is drawn, letterboxed
  // to its own native aspect, into one shared canvas that any number of
  // meshes can sample for free — a raw VideoTexture would just stretch to
  // fill the (fixed-aspect) screen plane, distorting anything that isn't
  // exactly that aspect
  videoTex = new THREE.CanvasTexture(videoCanvas);
  queueMicrotask(applyTv);                 // saved picture settings (pixelated filter, sharpen kernel) once the texture exists
  videoTex.colorSpace = THREE.SRGBColorSpace;
  videoMat = new THREE.MeshBasicMaterial({ map: videoTex, color: 0xd9d9d9 }); // -15%, blown-out whites were blinding
  miniScreens = [screenMesh];
  // ceiling CRT clusters at the outer ends of the center aisles, pairs side by side
  // (along z), fanned ~45° apart, screens facing the center of the store
  const crtBody = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const crt = base => {                    // front box + tube bulge + screen
    const g = new THREE.Group();
    g.rotation.order = "YXZ"; g.rotation.y = base; g.rotation.x = 0.32;   // aimed down — they hang high
    g.scale.setScalar(1.15);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.3), crtBody));
    const bulge = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.22), crtBody);
    bulge.position.z = -0.24; g.add(bulge);
    const m = glow(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.38), screensaverMat));
    m.position.z = 0.154; g.add(m); miniScreens.push(m);
    return g;
  };
  for (const [x, z] of crtSpots) {          // one cluster over each outer end of the center aisles (see the store layout)
    {
      const g = new THREE.Group(); g.position.set(x, 2.75, z);
      const base = x < 0 ? Math.PI / 2 : -Math.PI / 2;   // face the store center
      for (const o of [-0.45, 0.45]) {      // side by side along the aisle, fanned to its ends
        const fan = (x < 0 ? 1 : -1) * (o < 0 ? 1 : -1) * Math.PI / 8;
        const c = crt(base + fan); c.position.z = o; g.add(c);
      }
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, STORE.h - 2.75), mat.dark);
      pole.position.y = (STORE.h - 2.75) / 2; g.add(pole);
      const cg = new THREE.PointLight(0x8899bb, 0, 6, 1.5); g.add(cg); crtGlows.push(cg);
      scene.add(g);
    }
  }
  // one more for the staff: up in the corner where the west wall meets the
  // front glass, aimed back at the register bullpen
  {
    const x = WALL_L + 0.55, z = 0.55, g = new THREE.Group(); g.position.set(x, 2.75, z);
    g.add(crt(Math.atan2(-4.5 - x, 2.4 - z)));             // toward the middle of the space behind the counter
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, STORE.h - 2.75), mat.dark);
    pole.position.y = (STORE.h - 2.75) / 2; g.add(pole);
    const cg = new THREE.PointLight(0x8899bb, 0, 4, 1.5); g.add(cg); crtGlows.push(cg);
    scene.add(g);
  }
}
// one seat per couch cushion (cushion centers ±0.6 m in couch.js, × the 1.12 couch scale)
const SEATS = [-0.672, 0, 0.672].map(x => ({ x, z: TV.z - 3.3 }));   // the three cushions (your body sits there; the camera rides its head)
let seatAt = SEATS[1], aimSeatX = 0;         // seat in use / world x where the couch was aimed at
let seated = false, stoodAt = null;

// Fluorescents restriking: most panels come on after a short random stagger;
// a minority flicker a few times first before settling steady. Returns a list
// of [onAt, offAt] windows (in seconds since warm-up started) — the panel
// reads "lit" whenever t falls in one of them, and the final window always
// runs through to `duration` so every panel is steady by the time it ends.
function buildFlickerSchedule(duration) {
  if (Math.random() > 0.4) return [[Math.random() * 0.5, duration]];    // comes on cleanly, just staggered
  const pulses = []; let t = Math.random() * 0.15;
  const n = 2 + Math.floor(Math.random() * 3);                          // 2-4 stutters before it strikes
  for (let i = 0; i < n; i++) {
    const on = t + 0.03 + Math.random() * 0.12;
    pulses.push([t, on]);
    t = on + 0.05 + Math.random() * 0.22;
    if (t > duration * 0.75) break;
  }
  pulses.push([t, duration]);
  return pulses;
}
function flickerLit(schedule, t) { return schedule.some(([on, off]) => t >= on && t < off); }

// ---- lights: six switch zones (see LIGHT_ZONES), each with its own flicker warm-up ----
// lightsOut = "the store's dark": every sales-floor zone off and no daylight
// to speak of — the TV glow, marquee posters, bloom and lamp pools key off it
let lightsOut = false;
const zoneOn = Object.fromEntries(LIGHT_ZONES.map(z => [z, true]));
const zoneLvl = Object.fromEntries(LIGHT_ZONES.map(z => [z, 1]));   // what the shader gets: 0..1, flickering while warming up
const zoneWarm = {};                              // zone -> { t, duration, mats, schedules } while its panels restrike
function setZone(zone, on) {
  zoneOn[zone] = on;
  const mats = panelMats.filter(m => m.userData.zone === zone);
  if (on) {
    const duration = 1.1 + Math.random() * 0.6;
    zoneWarm[zone] = { t: 0, duration, mats, schedules: mats.map(() => buildFlickerSchedule(duration)) };
  } else {
    delete zoneWarm[zone]; zoneLvl[zone] = 0;
    mats.forEach(m => m.color.set(0x0d1016));
  }
  applyLighting();
}
function lightingTick(dt) {                       // fluorescents restriking, zone by zone
  for (const [zone, w] of Object.entries(zoneWarm)) {
    w.t += dt;
    const done = w.t >= w.duration;
    let lit = 0;
    w.mats.forEach((m, i) => { const on = done || flickerLit(w.schedules[i], w.t); if (on) lit++; m.color.set(on ? 0xf8fbff : 0x30343d); });
    zoneLvl[zone] = w.mats.length ? lit / w.mats.length : 1;
    if (done) delete zoneWarm[zone];
  }
  todTick(dt);
  applyLighting();
}
function applyLighting() {
  const Z = TVU.uZone.value, B = TVU.uBoh.value;
  Z.set(zoneLvl.front, zoneLvl.aisles, zoneLvl.lounge, tod.level);
  B.set(zoneLvl.hall, zoneLvl.breakroom, zoneLvl.restroom, 0);
  for (const l of allLights) l.intensity = l.userData.on * (zoneLvl[l.userData.zone] ?? 1);
  const dark = !zoneOn.front && !zoneOn.aisles && !zoneOn.lounge && tod.level < 0.35;
  if (dark === lightsOut && applyLighting.done) return;
  applyLighting.done = true; lightsOut = dark;
  for (const m of posterMats) m.emissiveIntensity = dark ? 0.22 : 0;   // marquees and screens glow on their own
  bloomPass.strength = dark ? 0.55 : 0.28;    // barely-there with the lights on; a bit more presence in the dark
  // threshold raised from .2/.4 — screen whites (menus, bright scenes) were blooming
  // too readily; this only raises the bar for what counts as "glowing"
  bloomPass.threshold = dark ? 0.34 : 0.52;
}

// ---- time of day: L cycles it. Daylight (level) eases between phases and
// sets how much comes in through the storefront; the street lights come on
// from dusk ----
const TOD = [
  { name: "Day", level: 1, sky: 0x4f8fd6 },
  { name: "Dusk", level: 0.4, sky: 0xc9794f },
  { name: "Night", level: 0, sky: 0x0e1a38 },
  { name: "Dawn", level: 0.45, sky: 0x9b8cb4 },
];
const tod = { i: 0, level: 1, from: 1, t: 1, sky: new THREE.Color(TOD[0].sky), skyFrom: new THREE.Color(TOD[0].sky) };
function setTimeOfDay(i, instant = false) {
  tod.i = (i + TOD.length) % TOD.length;
  tod.from = tod.level; tod.skyFrom.copy(tod.sky); tod.t = instant ? 1 : 0; tod.done = false;
  if (instant) todTick(0);
}
function todTick(dt) {
  if (tod.t >= 1 && tod.done) return;
  tod.t = Math.min(1, tod.t + dt / 2.5); tod.done = tod.t >= 1;    // a 2.5 s fade
  const ph = TOD[tod.i], k = tod.t * tod.t * (3 - 2 * tod.t);
  tod.level = tod.from + (ph.level - tod.from) * k;
  tod.sky.copy(tod.skyFrom).lerp(new THREE.Color(ph.sky), k); setSky(tod.sky);
  setExteriorDay(tod.level > 0.5);                                   // lamps/lot lights from dusk on
  TVU.uDayC.value.set(0.95, 0.97, 1.0);                             // daylight through the glass (linear)
  TVU.uNightC.value.set(0.035, 0.045, 0.08);                        // moonlight + the lot lights through it
}
function nextTimeOfDay() { setTimeOfDay(tod.i + 1); toast(`Outside: ${TOD[tod.i].name.toLowerCase()}`, true); }

// the light switches: a plate of toggles on the wall, one per zone. Built in
// the world section below (lightSwitches), toggled with E
const switchToggles = [];                         // { mesh, zone } — the rocker flips with its zone
const switchPlate = {};                           // zone -> every zone on its plate, in order
let switchAc = null;
function flipSwitch(zone) { setZone(zone, !zoneOn[zone]); switchSnap(zoneOn[zone]); }
// hold E on a plate: the whole row goes the opposite of its first switch
function flipPlate(zone) {
  const zones = switchPlate[zone], on = !zoneOn[zones[0]];
  for (const z of zones) if (zoneOn[z] !== on) setZone(z, on);
  switchSnap(on);
}
function switchSnap(on) {
  try {                                           // a plastic snap
    const ac = switchAc ||= new AudioContext(), n = ac.sampleRate * 0.03, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (n * 0.12));
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    f.type = "bandpass"; f.frequency.value = on ? 2600 : 2100; g.gain.value = 0.35;
    src.buffer = b; src.connect(f).connect(g).connect(ac.destination); src.start();
  } catch {}
}

// the plates: ivory, a toggle per gang with its zone printed under it. A gang's
// whole face is the aim target (an invisible pad), so you don't have to hit the lever
{
  const ivory = new THREE.MeshLambertMaterial({ color: 0xece6d6 }), pad = new THREE.MeshBasicMaterial({ visible: false });
  const plate = (x, y, z, ry, zones) => {
    for (const zn of zones) switchPlate[zn] = zones;
    const n = zones.length, GW = 0.07, W = GW * n + 0.03, H = 0.15;
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; scene.add(g);
    const face = makeTexture((ctx, w, h) => {                     // the plate's face: screw dots, lever slots, labels
      ctx.fillStyle = "#ece6d6"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#2b2b2b"; ctx.textAlign = "center";
      zones.forEach((zn, i) => {
        const cx = (0.015 + GW * (i + 0.5)) / W * w;
        ctx.fillStyle = "#b9b09a"; ctx.fillRect(cx - w * 0.012 / W, h * 0.3, w * 0.024 / W, h * 0.3);   // the slot
        ctx.fillStyle = "#c9c1ad"; for (const sy of [0.13, 0.75]) { ctx.beginPath(); ctx.arc(cx, h * sy, h * 0.03, 0, 7); ctx.fill(); }   // screws
        const lb = ZONE_LABELS[zn], maxW = w * (GW - 0.008) / W;
        let fs = Math.round(h * 0.11); ctx.font = `bold ${fs}px Arial`;
        while (ctx.measureText(lb).width > maxW && fs > 6) ctx.font = `bold ${--fs}px Arial`;   // fit the gang
        ctx.fillStyle = "#2b2b2b"; ctx.fillText(lb, cx, h * 0.93);
      });
    }, 256, Math.round(256 * H / W));
    const pm = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.008), [ivory, ivory, ivory, ivory, new THREE.MeshLambertMaterial({ map: face }), ivory]);
    pm.position.z = 0.004; g.add(pm);
    zones.forEach((zn, i) => {
      const cx = -W / 2 + 0.015 + GW * (i + 0.5), cy = H * (0.5 - 0.45);
      const piv = new THREE.Group(); piv.position.set(cx, cy, 0.009); g.add(piv);
      const lever = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.03), ivory); lever.position.z = 0.013; piv.add(lever);   // sticks out, tipped up (on) or down (off)
      piv.rotation.x = zoneOn[zn] ? -0.32 : 0.32;
      switchToggles.push({ mesh: piv, zone: zn });
      const hit = new THREE.Mesh(new THREE.BoxGeometry(GW, H, 0.04), pad); hit.position.set(cx, 0, 0.02); g.add(hit);
      for (const m of [hit, lever]) { m.userData.lightZone = zn; aimables.push(m); }
    });
  };
  // behind the register: the west wall, by the front window — the sales floor's three zones and the back hall
  plate(WALL_L + 0.1, 1.22, 1.3, Math.PI / 2, ["front", "aisles", "lounge", "hall"]);
  // just inside each back room, on the wall with the door, latch side (the doors hinge on their east side)
  const inside = BOH.hallZ + WALL_T / 2;
  plate(BOH_DOORS.breakroom - DOOR_W / 2 - 0.25, 1.22, inside, 0, ["breakroom"]);
  plate(BOH_DOORS.restroom - DOOR_W / 2 - 0.25, 1.22, inside, 0, ["restroom"]);
}

// ---------------- player ----------------
const player = { x: 0, z: 2.6, yaw: Math.PI, pitch: 0, r: 0.32 };
let eyeY = 1.65;                            // eased toward standing/crouch height
camera.position.set(player.x, 1.65, player.z);
camera.rotation.y = player.yaw;
// your own body: a customer rig in the store uniform, with the TV head and neck hidden, since the
// camera is where they'd be. It stands a little behind the eye so looking
// down shows your chest, belly and feet; on the couch it takes Dana's sitting
// pose and the camera rides its head
const me = VaultCustomers.build({ ...VaultCustomers.randomOutfit(seeded(1985), false), height: 1, build: 1, hat: null,
  top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, pants: "khaki", pantsColor: "#b9a27a", shoes: "#1e1e1e" });   // Dana's uniform, no name tag
me.rig.head.visible = false; me.rig.neck.visible = false;
me.walkLean = false;                        // the eye doesn't tip forward, so neither does the chest: the feet stay in view
scene.add(me.group);
const meLast = { x: player.x, z: player.z }, meEye = new THREE.Vector3();
function meTick(dt) {
  const g = me.group;
  let speed = 0;
  if (onStool) {
    g.position.set(stool.x, 0, stool.z); g.rotation.y = stool.angle + Math.PI;
    me.setPose("sit", STOOL_SIT);
  } else if (seated) {                        // on the cushion, a hair inboard like Dana so the elbows clear the arm
    g.position.set(Math.sign(seatAt.x) * Math.max(0, Math.abs(seatAt.x) - 0.04), 0, seatAt.z); g.rotation.y = 0;
    me.setPose("sit");
  } else {
    speed = Math.hypot(player.x - meLast.x, player.z - meLast.z) / Math.max(dt, 1e-4);
    g.position.set(player.x + Math.sin(player.yaw) * 0.21, 0, player.z + Math.cos(player.yaw) * 0.21);   // 21 cm behind the eye: looking down, the chest only creeps in near the bottom
    g.rotation.y = player.yaw + Math.PI;      // the rig faces +z; yaw 0 looks down -z
    me.setPose(keys.has("KeyC") ? "crouch" : "idle");
  }
  meLast.x = player.x; meLast.z = player.z;
  me.tick(dt, speed);
}

// ---- the spinning stool (starts behind the counter; hold E to carry it off
// like the standee): E sits; seated, each E is a
// shove that adds spin (up to a hard cap), and bearing friction winds it
// down — a constant drag plus a little that grows with speed, so a hard spin
// coasts a few turns and a nudge dies in a couple of seconds. You turn with
// the seat: the body stays put under you while the store goes round. Any
// move key gets you up; an empty seat coasts to a stop on its own ----
const STOOL = { SEAT: 0.72, R: 0.26, CARRY_D: 0.95,          // seat top height, footprint half-width, how far ahead it's carried
  PUSH: 2.4, MAX: 14,                                           // rad/s per shove, hard cap (~2.2 turns a second)
  DRAG: 0.9, VISC: 0.25, EMPTY: 2.5 };                          // rad/s² constant, 1/s per rad/s, x friction with nobody on it
const STOOL_SIT = { hipY: STOOL.SEAT + 0.05, tuck: 0.5 };       // up on the seat, feet pulled back onto the footring
const stool = { x: -4.5, z: 2.0, angle: 0, vel: 0, g: null, top: null, carried: false, spot: null, by: null, danaCarry: false };   // by: "dana" while she has it
const stoolFit = (x, z, b) => Object.assign(b, { x0: x - STOOL.R, x1: x + STOOL.R, z0: z - STOOL.R, z1: z + STOOL.R });
stool.box = stoolFit(stool.x, stool.z, { y1: STOOL.SEAT, shadow: false });
let onStool = false;
{
  const chrome = new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 90 });
  const black = new THREE.MeshPhongMaterial({ color: 0x18181a, specular: 0x444444, shininess: 30 });
  const vinyl = new THREE.MeshPhongMaterial({ color: 0xb3161f, specular: 0x552222, shininess: 45 });   // diner-red seat
  const g = stool.g = new THREE.Group(); g.position.set(stool.x, 0, stool.z); scene.add(g);
  const add = (geo, m, x, y, z, parent = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); parent.add(o); o.userData.stool = true; aimables.push(o); return o; };
  for (let i = 0; i < 5; i++) {                                 // five-star base on casters
    const a = i / 5 * Math.PI * 2, arm = new THREE.Group(); arm.rotation.y = a; g.add(arm);
    add(new THREE.BoxGeometry(0.04, 0.03, 0.27), chrome, 0, 0.075, 0.15, arm).rotation.x = 0.12;   // sloping down to the wheel
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.04, 8), chrome, 0, 0.055, 0.27, arm);           // caster stem
    add(new THREE.CylinderGeometry(0.028, 0.028, 0.025, 14), black, 0, 0.028, 0.285, arm).rotation.z = Math.PI / 2;   // the wheel
  }
  add(new THREE.CylinderGeometry(0.055, 0.065, 0.06, 18), chrome, 0, 0.09, 0);                    // hub
  add(new THREE.CylinderGeometry(0.036, 0.036, 0.26, 18), black, 0, 0.24, 0);                      // gas-lift sleeve
  add(new THREE.CylinderGeometry(0.024, 0.024, STOOL.SEAT - 0.4, 14), chrome, 0, (STOOL.SEAT + 0.3) / 2, 0);   // the column
  const ring = add(new THREE.TorusGeometry(0.23, 0.011, 8, 40), chrome, 0, 0.34, 0); ring.rotation.x = Math.PI / 2;   // footring
  for (let i = 0; i < 3; i++) {                                 // its spokes back to the sleeve
    const a = i / 3 * Math.PI * 2, sp = add(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 6), chrome, Math.sin(a) * 0.13, 0.34, Math.cos(a) * 0.13);
    sp.rotation.set(Math.PI / 2, 0, 0); sp.rotation.order = "YXZ"; sp.rotation.y = a;
  }
  const top = stool.top = new THREE.Group(); top.position.y = STOOL.SEAT; g.add(top);   // everything that turns
  add(new THREE.CylinderGeometry(0.19, 0.19, 0.075, 32), vinyl, 0, -0.04, 0, top);                  // cushion
  add(new THREE.CylinderGeometry(0.185, 0.19, 0.012, 32), vinyl, 0, -0.001, 0, top);                // its slightly domed top
  const band = add(new THREE.TorusGeometry(0.19, 0.012, 8, 40), chrome, 0, -0.06, 0, top); band.rotation.x = Math.PI / 2;   // chrome edge band
  add(new THREE.CylinderGeometry(0.12, 0.08, 0.04, 20), black, 0, -0.1, 0, top);                   // the mechanism under the seat
  const lever = add(new THREE.BoxGeometry(0.018, 0.012, 0.14), chrome, 0.09, -0.11, 0.1, top); lever.rotation.y = -0.6;   // height paddle (and how you can tell it's turning)
  add(new THREE.BoxGeometry(0.03, 0.02, 0.04), black, 0.13, -0.11, 0.155, top).rotation.y = -0.6;  // its grip
  colliders.push(stool.box);
}
let stoolAc = null;
function stoolPush() {
  stool.vel = Math.min(STOOL.MAX, stool.vel + STOOL.PUSH);
  try {                                           // the bearing's dry swish as it goes
    const ac = stoolAc ||= new AudioContext(), n = ac.sampleRate * 0.25, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / n) ** 2;
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), gn = ac.createGain();
    f.type = "bandpass"; f.frequency.value = 500 + stool.vel * 40; f.Q.value = 2; gn.gain.value = 0.12;
    src.buffer = b; src.connect(f).connect(gn).connect(ac.destination); src.start();
  } catch {}
}
function stoolSit() {
  stoodAt = { x: player.x, z: player.z, yaw: player.yaw };
  player.x = stool.x; player.z = stool.z;                       // you're where the stool is now (NPCs step round you, the gates know where you are)
  stool.angle = player.yaw; onStool = true;                     // sit facing the way you were looking
}
function stoolStand() {                           // step off toward where you're facing, or anywhere clear, or back where you came from
  onStool = false;
  for (const da of [0, 1.2, -1.2, 2.4, -2.4, Math.PI]) {
    const a = player.yaw + da, x = stool.x - Math.sin(a) * 0.62, z = stool.z - Math.cos(a) * 0.62;
    if (!blocked(x, z)) { player.x = x; player.z = z; return; }
  }
  player.x = stoodAt.x; player.z = stoodAt.z;
}
function stoolTick(dt) {
  if (stool.vel) {
    const sat = onStool || stool.by === "dana";
    const drag = (STOOL.DRAG + STOOL.VISC * stool.vel) * (sat ? 1 : STOOL.EMPTY) * dt;
    const v = Math.max(0, stool.vel - drag), d = (stool.vel + v) / 2 * dt;   // averaged over the step, so a stop lands smoothly
    stool.vel = v; stool.angle += d;
    if (onStool) player.yaw += d;                 // you turn with it; your look stays where it was relative to your body
  }
  stool.top.rotation.y = stool.angle;             // (Dana scoots it round by hand, too)
}
const keys = new Set();
const HOLD_MS = 450;                       // hold E on the standee to lift it
let eHoldTimer = null;                     // hold E on the standee to lift it (a tap does nothing, so it's hard to grab by accident)
let eHoldStool = false;                    // E went down on the stool: a tap sits on release, a hold picks it up
let eHoldSwitch = null;                    // E went down on a multi-switch plate: a tap flips this one on release, a hold flips the plate
addEventListener("keydown", e => {
  if (posTerm?.isOpen()) return posTerm.key(e);   // typing at the register: no walking, no hotkeys
  if (document.pointerLockElement !== canvas) {   // paused / title screen: only the window-level keys
    if (e.code === "KeyF") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    return;
  }
  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyE" && !e.repeat) {
    if (aimCutout) eHoldTimer = setTimeout(() => { eHoldTimer = null; if (aimCutout) cutoutPickUp(); }, HOLD_MS);
    else if (aimStool && !stool.by) { eHoldStool = true; eHoldTimer = setTimeout(() => { eHoldTimer = null; eHoldStool = false; stoolPickUp(); }, HOLD_MS); }
    else if (aimSwitch && switchPlate[aimSwitch].length > 1 && !seated && !aimCouch && !cutout.carried && !stool.carried && !aimCustomer) {
      eHoldSwitch = aimSwitch;
      eHoldTimer = setTimeout(() => { eHoldTimer = null; flipPlate(eHoldSwitch); eHoldSwitch = null; }, HOLD_MS);
    }
    else onE();                              // one press, one action — holding E doesn't machine-gun bites, doors, the flap
  }
  if (/^Digit[1-9]$/.test(e.code)) invSelect(+e.code[5] - 1);   // pick an inventory slot
  if (e.code === "Space") togglePause();
  if (e.code === "Comma") stepEpisode(-1);
  if (e.code === "Period") stepEpisode(1);
  if (e.code === "KeyL" && !e.repeat) nextTimeOfDay();   // the store lights are real switches now; L is the sky
  if (e.code === "KeyH") document.body.classList.toggle("nohud");
  if (e.code === "KeyF") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
addEventListener("keyup", e => {
  keys.delete(e.code);
  if (e.code === "KeyE") {
    clearTimeout(eHoldTimer); eHoldTimer = null;   // let go before it's lifted: nothing happens
    if (eHoldSwitch) { flipSwitch(eHoldSwitch); eHoldSwitch = null; }   // a tap on the plate: just the one switch
    if (eHoldStool) { eHoldStool = false; stoolSit(); }                  // a tap on the stool: sit
  }
});
let seatFov = 70;
canvas.addEventListener("wheel", e => {          // lean in on the couch, or zoom a held-up cover
  if (tvMenu && tvMenuWheel(e.deltaY < 0 ? 1 : -1)) return;               // nudging a menu slider
  if (seated) seatFov = Math.max(28, Math.min(70, seatFov + e.deltaY * 0.02));
  else if (held && inspecting) {
    coverZoom = Math.max(1, Math.min(6, coverZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    $("inspectArt").style.transform = `scale(${coverZoom})`;
  }
  else if (inv.length) {                         // scroll the inventory: every item plus one empty slot (empty-handed)
    const n = Math.min(inv.length + 1, INV_MAX), cur = invSel >= 0 ? invSel : Math.min(invEmpty, inv.length);
    invSelect((cur + (e.deltaY > 0 ? 1 : -1) + n) % n);
  }
});
let lastActive = 0;                          // last mouse-look or key — the crosshair hides after a few still seconds
addEventListener("mousemove", e => {
  if (document.pointerLockElement !== canvas) return;
  lastActive = performance.now();
  player.yaw -= e.movementX * 0.0022;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * 0.0022));
});
function blocked(x, z) {
  for (const c of colliders)
    if (x > c.x0 - player.r && x < c.x1 + player.r && z > c.z0 - player.r && z < c.z1 + player.r) return true;
  return false;
}
function move(dt) {
  const f = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const rt = new THREE.Vector3(-f.z, 0, f.x);
  let ix = 0, iz = 0;
  if (document.pointerLockElement !== canvas) return;
  if (onStool) {                            // E spins you; a move key gets you up
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some(k => keys.has(k))) stoolStand();
    return;
  }
  if (seated || inspecting) return;         // stand up with E first
  if (keys.has("KeyW") || keys.has("ArrowUp")) iz += 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) iz -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
  if (!ix && !iz) return;
  const sp = (keys.has("ShiftLeft") || keys.has("ShiftRight")) ? 5.2 : 3.1;
  const crouched = keys.has("KeyC");
  const spd = sp * (crouched ? 0.55 : 1);
  const dx = (f.x * iz + rt.x * ix) * spd * dt, dz = (f.z * iz + rt.z * ix) * spd * dt;
  if (!blocked(player.x + dx, player.z)) player.x += dx;
  if (!blocked(player.x, player.z + dz)) player.z += dz;
}

// ---------------- picking / inspecting ----------------
const raycaster = new THREE.Raycaster();
const tvRay = new THREE.Raycaster();
function tvScreenHit() {                     // crosshair on the main TV screen -> its point on the 480x320 screen canvas
  tvRay.setFromCamera({ x: 0, y: 0 }, camera);
  const h = tvRay.intersectObject(screenMesh, false)[0];
  return h && h.distance < 9 ? { x: h.uv.x * videoCanvas.width, y: (1 - h.uv.y) * videoCanvas.height } : null;
}
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d)),
  new THREE.LineBasicMaterial({ color: YELLOW }));
highlight.visible = false;                 // turned per tape to match its shelf (tape.ry)
scene.add(highlight);
let aimStool = false;
let hovered = null, held = null, heldSnack = null, aimTV = false, aimLamp = null, aimCouch = false, aimReturns = false, aimSnack = null, aimFlap = null, aimCooler = false, aimPop = null, aimTrash = false, aimDoor = null, aimPOS = false, aimSlot = false, aimRewinder = false, aimBell = false, aimDesens = false, aimCutout = false, aimCustomer = false, aimLock = false, aimEmp = false, aimSwitch = null, aimDrawer = false;
let returnBin = [];                          // tapes dropped in the returns slot — carry-only, never auto-reshelved
// a tape you're only looking at — held up straight off a shelf or out of
// Returns, not taken yet: right-click puts it right back where it came from.
// Once it's taken (click to tuck, or swapping to another item) it's yours to
// carry and has to be put back properly
let peek = null, peekSrc = null;             // peekSrc: "shelf" | "bin"
let flapOpen = false;
function toggleFlap() {
  if (flapOpen) {                            // trying to close it — refuse if you're standing in the gap
    const c = flapCollider;
    if (player.x > c.x0 - player.r && player.x < c.x1 + player.r && player.z > c.z0 - player.r && player.z < c.z1 + player.r) return;
  }
  flapOpen = !flapOpen;
  const i = colliders.indexOf(flapCollider);
  if (flapOpen && i >= 0) colliders.splice(i, 1);   // swung up — walk through
  else if (!flapOpen && i < 0) colliders.push(flapCollider);   // back down — flush with the counters again
}
function playerIn(c) { return player.x > c.x0 - player.r && player.x < c.x1 + player.r && player.z > c.z0 - player.r && player.z < c.z1 + player.r; }
function toggleDoor(d) {
  if (d.locked) { d.rattle = 0.35; return; }   // just jiggles in its frame
  const next = d.open ? d.shut : d.openBox;
  if (playerIn(next)) return;                // you're standing where it would swing to
  colliders.splice(colliders.indexOf(d.open ? d.openBox : d.shut), 1);
  colliders.push(next);
  d.open = !d.open;
}
// ---- carrying the standee: E lifts it off the floor and it rides ~1.3 m in
// front of you, turned to face you (walk around it to choose its angle). E sets
// it down if its footprint is clear, you're not in it, and nothing solid sits
// between you and the spot; otherwise it tints red and stays in your arms ----
const CARRY_D = 1.3, cutoutTint = new THREE.Color();
let cutoutSpot = null;                       // where it'd land this frame, or null if it won't fit there
function cutoutSpotAhead() { return carrySpotAhead(CARRY_D, (x, z, ry) => cutoutFit(x, z, ry, {})); }
function carrySpotAhead(dist, fit) {           // a spot `dist` ahead for something carried: its footprint clear, and reachable
  const x = player.x - Math.sin(player.yaw) * dist, z = player.z - Math.cos(player.yaw) * dist, ry = player.yaw;
  const b = fit(x, z, ry);
  const clear = !colliders.some(c => c.x0 < b.x1 && c.x1 > b.x0 && c.z0 < b.z1 && c.z1 > b.z0) && !playerIn(b);
  const inside = (px, pz) => colliders.some(c => px > c.x0 && px < c.x1 && pz > c.z0 && pz < c.z1);
  let reach = true;
  for (let i = 1; i <= 8 && reach; i++) reach = !inside(player.x + (x - player.x) * i / 8, player.z + (z - player.z) * i / 8);
  return { x, z, ry, ok: clear && reach };
}
function cutoutCarryTick() {
  if (!cutout.carried || !cutout.g) return;
  const s = cutoutSpotAhead();
  cutoutSpot = s.ok ? s : null;
  cutout.g.position.set(s.x, 0.04, s.z); cutout.g.rotation.y = s.ry;   // lifted just off the floor
  cutoutTint.set(s.ok ? 0xffffff : 0xff5a5a);
  cutout.g.traverse(o => {
    if (!o.isMesh) return;
    o.userData.baseColor ??= o.material.color.clone();
    o.material.color.copy(o.userData.baseColor).multiply(cutoutTint);
  });
}
function cutoutSeeThrough(on) {                // life-size and facing you: see-through while carried so you can see where you're going
  cutout.g.traverse(o => { if (o.isMesh) { o.material.transparent = on; o.material.opacity = on ? 0.45 : 1; o.material.depthWrite = !on; o.material.needsUpdate = true; } });
}
// the stool, carried the same way: held just ahead of you, a little off the
// floor, red where it won't fit; E sets it down
const stoolTint = new THREE.Color();
function stoolCarryTick() {
  if (!stool.carried) return;
  const s = carrySpotAhead(STOOL.CARRY_D, (x, z) => stoolFit(x, z, {}));
  stool.spot = s.ok ? s : null;
  stool.g.position.set(s.x, 0.08, s.z);
  stoolTint.set(s.ok ? 0xffffff : 0xff5a5a);
  stool.g.traverse(o => {                       // its materials are shared between parts: keep the base color on the material
    if (!o.isMesh) return;
    o.material.userData.baseColor ??= o.material.color.clone();
    o.material.color.copy(o.material.userData.baseColor).multiply(stoolTint);
  });
}
function stoolPickUp() {
  stool.carried = true; stool.vel = 0;
  colliders.splice(colliders.indexOf(stool.box), 1);
}
function stoolPutDown() {
  if (!stool.spot) return;
  Object.assign(stool, { x: stool.spot.x, z: stool.spot.z, carried: false });
  stool.g.position.set(stool.x, 0, stool.z);
  stool.g.traverse(o => { if (o.isMesh && o.material.userData.baseColor) o.material.color.copy(o.material.userData.baseColor); });
  colliders.push(stoolFit(stool.x, stool.z, stool.box));
}
function cutoutPickUp() {
  cutout.carried = true; cutoutSeeThrough(true);
  colliders.splice(colliders.indexOf(cutout.box), 1);
  tvBake = bakeTvVis();                      // its shadow on the TV light leaves with it
}
function cutoutPutDown() {
  if (!cutoutSpot) return;
  Object.assign(cutout, { x: cutoutSpot.x, z: cutoutSpot.z, ry: cutoutSpot.ry, carried: false });
  cutout.g.position.set(cutout.x, 0, cutout.z);
  cutout.g.traverse(o => { if (o.isMesh && o.userData.baseColor) o.material.color.copy(o.userData.baseColor); });
  cutoutSeeThrough(false);
  colliders.push(cutoutFit(cutout.x, cutout.z, cutout.ry, cutout.box));
  tvBake = bakeTvVis();
}
// ---------------- customers (prototype): one TV-head customer at a time ----------------
// customers.js builds them; this walks one through a visit: in the door,
// browse a shelf, pick a tape, wait at the register getting steadily less
// patient, then leave — rung up (E on them at the counter) or not, in which
// case the tape they walk out with sets the gates off. Paths come from a grid
// A* over the colliders, rebuilt per trip, so doors and the moved standee count.
const NAV = { cell: 0.25, x0: WALL_L, z0: 0, x1: STORE.x, z1: STORE.z, pad: 0.3 };
function navGrid(skip, extra = []) {                // extra: temporary obstacles (you, standing in the way)
  const { cell, x0, z0, pad } = NAV, nx = Math.ceil((NAV.x1 - x0) / cell), nz = Math.ceil((NAV.z1 - z0) / cell);
  const g = new Uint8Array(nx * nz);
  const skips = [].concat(skip);                   // one collider or several to leave out (the asker's own, a door they'll open)
  for (const c of colliders.concat(extra)) {
    if (skips.includes(c)) continue;
    const i0 = Math.max(0, Math.ceil((c.x0 - pad - x0) / cell - 0.5)), i1 = Math.min(nx - 1, Math.floor((c.x1 + pad - x0) / cell - 0.5));
    const k0 = Math.max(0, Math.ceil((c.z0 - pad - z0) / cell - 0.5)), k1 = Math.min(nz - 1, Math.floor((c.z1 + pad - z0) / cell - 0.5));
    for (let k = k0; k <= k1; k++) g.fill(1, k * nx + i0, k * nx + i1 + 1);
  }
  const at = (x, z) => { const i = Math.floor((x - x0) / cell), k = Math.floor((z - z0) / cell); return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i; };
  const free = (x, z) => { const n = at(x, z); return n >= 0 && !g[n]; };
  return { nx, nz, g, at, free, xy: n => [x0 + (n % nx + 0.5) * cell, z0 + ((n / nx | 0) + 0.5) * cell] };
}
function navPath(grid, ax, az, bx, bz) {         // A* (8-way, binary heap), then string-pulled to straight runs
  const { nx, g, at, free, xy } = grid, near = n => {   // snap a blocked start/goal to the nearest open cell
    if (n >= 0 && !g[n]) return n;
    for (let r = 1; r < 8; r++) for (let dk = -r; dk <= r; dk++) for (let di = -r; di <= r; di++) { const m = n + dk * nx + di; if (m >= 0 && m < g.length && !g[m]) return m; }
    return -1;
  };
  const s = near(at(ax, az)), e = near(at(bx, bz)); if (s < 0 || e < 0) return null;
  const cost = new Float32Array(g.length).fill(Infinity), from = new Int32Array(g.length).fill(-1), heap = [[0, s]];
  const h = n => { const dx = Math.abs(n % nx - e % nx), dz = Math.abs((n / nx | 0) - (e / nx | 0)); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const push = it => { heap.push(it); for (let i = heap.length - 1; i && heap[i - 1 >> 1][0] > heap[i][0]; i = i - 1 >> 1) [heap[i], heap[i - 1 >> 1]] = [heap[i - 1 >> 1], heap[i]]; };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0; ;) { let m = i; for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c][0] < heap[m][0]) m = c; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  cost[s] = 0;
  while (heap.length) {
    const [, n] = pop(); if (n === e) break;
    const i = n % nx;
    for (const [di, dk, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
      if (i + di < 0 || i + di >= nx) continue;
      const m = n + dk * nx + di; if (m < 0 || m >= g.length || g[m]) continue;
      if (di && dk && (g[n + di] || g[n + dk * nx])) continue;   // no cutting a corner
      const c = cost[n] + w; if (c < cost[m]) { cost[m] = c; from[m] = n; push([c + h(m), m]); }
    }
  }
  if (from[e] < 0 && e !== s) return null;
  const cells = []; for (let n = e; n >= 0; n = from[n]) cells.unshift(xy(n));
  const clear = ([ax, az], [bx, bz]) => { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.1); for (let i = 1; i < n; i++) if (!free(ax + (bx - ax) * i / n, az + (bz - az) * i / n)) return false; return true; };
  const out = [cells[0]];
  for (let i = 1; i < cells.length; i++) if (!clear(out[out.length - 1], cells[i])) out.push(cells[i - 1]);
  out.push([bx, bz]); if (!free(bx, bz)) out[out.length - 1] = cells[cells.length - 1];
  return out;
}
const CUST_DOOR = { x: 0.7, z: 0.9 };
const CUST_COUNTER = { x: -5.45, z: 4.95, ry: Math.PI };           // across the register from the clerk
// where customers browse: every shelf face in the store, found from the tapes
// themselves (each knows its slot and which way its shelf faces). Tapes are
// grouped into ~1.5 m stretches per facing; each stretch becomes a spot 0.8 m
// out in the aisle, tagged with the sections it holds. Built on first use
let custSpots = null, custSnackSpots = null;
const snackPrice = p => p.kind ? 1.25 : 0.99;       // drinks carry a kind (Soda, Water...), candy doesn't
function snackSpots() {                           // in front of each snack fixture (the cooler, the candy racks), where a shopper can reach it
  if (custSnackSpots) return custSnackSpots;
  const grid = navGrid(cust.box), spots = new Map(), v = new THREE.Vector3(), n = new THREE.Vector3();
  for (const u of snackUnits()) {
    u.parent.getWorldDirection(n); u.getWorldPosition(v);   // fixtures face their local +z
    const x = v.x + n.x * 0.75, z = v.z + n.z * 0.75;
    if (x < -2.25 && z < 4.5) continue;           // behind the counter is staff only
    const key = `${Math.round(x / 1.5)},${Math.round(z / 1.5)}`;
    let s = spots.get(key); if (!s) spots.set(key, s = { x: 0, z: 0, n: 0, ry: Math.atan2(-n.x, -n.z), units: [], drinks: false });
    s.x += x; s.z += z; s.n++; s.units.push(u); s.drinks ||= !!u.userData.snack.kind;
  }
  return custSnackSpots = [...spots.values()].map(s => Object.assign(s, { x: s.x / s.n, z: s.z / s.n }))
    .filter(s => navPath(grid, CUST_DOOR.x, CUST_DOOR.z, s.x, s.z));
}
function browseSpots() {
  if (custSpots) return custSpots;
  const grid = navGrid(cust.box), groups = new Map();   // not counting the customer asking: they're standing in the doorway the flood fill starts from
  for (const t of catalog) for (const c of [t, ...(t.copies || [])]) {
    if (!c.pos) continue;
    const nx = Math.cos(c.ry), nz = -Math.sin(c.ry), sx = c.pos.x + nx * 0.8, sz = c.pos.z + nz * 0.8;   // shelves face their local +x
    if (sx < -2.25 && sz < 4.5) continue;        // behind the counter is staff only
    const key = `${Math.round(sx / 1.5)},${Math.round(sz / 1.5)},${Math.round(c.ry / (Math.PI / 2))}`;
    let g = groups.get(key); if (!g) groups.set(key, g = { x: 0, z: 0, nx, nz, n: 0, cats: {}, copies: [] });
    g.x += sx; g.z += sz; g.n++; g.copies.push(c); g.cats[c.category] = (g.cats[c.category] || 0) + 1;
  }
  const reach = new Uint8Array(grid.g.length), q = [grid.at(CUST_DOOR.x, CUST_DOOR.z)];   // flood fill from the door: what can actually be walked to
  reach[q[0]] = 1;
  while (q.length) { const n = q.pop(), i = n % grid.nx; for (const m of [i + 1 < grid.nx && n + 1, i > 0 && n - 1, n + grid.nx, n - grid.nx]) if (m !== false && m >= 0 && m < reach.length && !reach[m] && !grid.g[m]) { reach[m] = 1; q.push(m); } }
  return custSpots = [...groups.values()].filter(g => g.n >= 4)
    .map(g => ({ x: g.x / g.n, z: g.z / g.n, ry: Math.atan2(-g.nx, -g.nz), n: g.n, cats: g.cats, copies: g.copies }))   // facing the shelf
    .filter(g => reach[grid.at(g.x, g.z)] === 1);
}
// who's walking in: a seed drives both the look and the personality, so the
// same seed always rebuilds the same person (outfit, taste, patience)
const TASTES = [
  { name: "horror fan", cats: ["Horror", "Horror & Anthology", "MonsterVision"] },
  { name: "parent", cats: ["Family & Kids", "Kids & Educational", "Animation", "Holiday"] },
  { name: "couch potato", cats: ["Sitcoms", "Classic Sitcoms", "Drama & Adventure", "Sketch Comedy & Late Night", "Reality TV"] },
  { name: "action junkie", cats: ["Action & Adventure", "Sci-Fi & Fantasy"] },
  { name: "date night", cats: ["Comedy", "Drama"] },
  { name: "anime kid", cats: ["Anime", "Animation", "Sci-Fi & Fantasy"] },
  { name: "wanderer", cats: [] },                                 // no favorites: grabs whatever catches their eye
];
function seeded(seed) { return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function customerFor(seed, female) {
  const rnd = seeded(seed), outfit = VaultCustomers.randomOutfit(rnd, female);
  const who = { seed, rnd, outfit, persona: {
    taste: TASTES[Math.floor(rnd() * TASTES.length)],
    patience: 0.6 + rnd() * 1.2,                  // scales how long they'll wait at the counter
    speed: 1.0 + rnd() * 0.55,                    // m/s
    picky: 0.25 + rnd() * 0.5,                    // chance a shelf they like has something for them
    stops: 1 + Math.floor(rnd() * 3),             // shelves they'll look at before deciding
    maxTapes: 1 + (rnd() < 0.35) + (rnd() < 0.12),   // most rent one; some make a night of it
  } };
  who.persona.stops += who.persona.maxTapes - 1;   // a bigger haul means more shelves to look at
  return who;
}
const cust = { c: null, state: "gone", t: 3, path: [], ry: 0, face: 0, tagged: false, hi: 0, box: { x0: 0, x1: 0, z0: 0, z1: 0, shadow: false } };
const custLikes = spot => {                       // 0..1: how much of this shelf is their kind of thing
  const cats = cust.who.persona.taste.cats; if (!cats.length) return 0.3;
  return cats.reduce((a, k) => a + (spot.cats[k] || 0), 0) / spot.n;
};
// who comes in: every walk-in is one of the POS's members, and their member
// number is their seed, so the same member always looks and acts the same.
// About half the time it's someone with tapes out, bringing them back — most
// likely whoever's due today or late
function custPickMember() {
  const ms = posTerm.members.filter(m => m !== cust.lastMember);
  const soonest = m => Math.min(...m.rentals.map(r => posTerm.dueIn(r)));
  const due = ms.filter(m => m.rentals.length && soonest(m) <= 1);
  if (due.length && Math.random() < 0.5) {
    const w = due.map(m => soonest(m) <= 0 ? 3 : 1);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < due.length - 1 && (r -= w[i]) > 0) i++;
    return due[i];
  }
  return ms[Math.floor(Math.random() * ms.length)];
}
const memberName = m => `${m.first[0]}${m.first.slice(1).toLowerCase()} ${m.last[0]}${m.last.slice(1).toLowerCase()}`;
function custSpawn(member = custPickMember()) {
  const who = cust.who = customerFor(Math.imul(member.num, 2654435761) >>> 0, member.female);   // member # -> the same person every time
  cust.member = cust.lastMember = member;
  cust.returning = member.rentals.filter(r => posTerm.dueIn(r) <= 0 || (posTerm.dueIn(r) === 1 && Math.random() < 0.5)).map(r => r.copy);   // what's due (or late) comes back; the rest stays out
  const c = cust.c = VaultCustomers.build(who.outfit);
  c.parts.forEach(m => { m.userData.customer = true; aimables.push(m); });
  c.glows.forEach(glow);
  c.group.position.set(CUST_DOOR.x, 0, CUST_DOOR.z); c.group.rotation.y = cust.ry = cust.face = 0;
  scene.add(c.group); colliders.push(cust.box);
  c.setMood("on"); c.setPose(cust.returning.length ? "hold" : "idle"); c.holdTape(Math.min(3, cust.returning.length));
  Object.assign(cust, { tagged: false, alarmed: false, holding: 0, tapes: [], snacks: [], snackDone: false, seen: new Set(), stopsLeft: who.persona.stops, path: [], spot: null, state: "boot", t: 0.6 });   // screen warms up, then in they come
}
// ---- getting past you (shared by customers and Dana) ----
// you're standing on where they're headed: use a spot beside it (sideways to
// the way they'd face there), whichever side is open
function spotBesideYou(spot, grid) {
  if (Math.hypot(player.x - spot.x, player.z - spot.z) > 0.6) return spot;
  const ry = spot.ry ?? 0, sx = Math.cos(ry), sz = -Math.sin(ry);
  for (const k of [0.75, -0.75, 1.1, -1.1]) {
    const q = { ...spot, x: spot.x + sx * k, z: spot.z + sz * k };
    if (grid.free(q.x, q.z) && Math.hypot(player.x - q.x, player.z - q.z) > 0.6) return q;
  }
  return spot;
}
// one step of "are you in my way": yields while you're right ahead; detours
// around you after a moment (and, on a detour, only yields when actually about
// to bump you); squeezes past if there's truly no way round. w: the walker's
// state ({ stuck, detour, squeeze }), redo(avoid): re-plan the path
function yieldTo(w, p, dx, dz, dt, redo) {
  if (w.squeeze > 0) { w.squeeze -= dt; return false; }            // excuse me...
  const near = Math.hypot(player.x - p.x, player.z - p.z) < (w.detour ? 0.5 : 0.75);
  if (!(near && (player.x - p.x) * dx + (player.z - p.z) * dz > 0)) return false;
  w.stuck = (w.stuck || 0) + dt;
  if (w.stuck > 0.6 && !w.detour) { w.detour = true; redo(true); w.stuck = 0.01; }   // go around
  else if (w.stuck > 3.5) { w.squeeze = 1.4; w.stuck = 0; }                         // no way round: slip past
  return true;
}
function custGo(state, spot, avoidPlayer = false) {   // head for a spot; state is what to do on arrival
  const p = cust.c.group.position, r = 0.35;
  const you = avoidPlayer ? [{ x0: player.x - r, x1: player.x + r, z0: player.z - r, z1: player.z + r }] : [];
  const grid = navGrid(cust.box, you); spot = spotBesideYou(spot, grid);
  cust.path = navPath(grid, p.x, p.z, spot.x, spot.z) || [[spot.x, spot.z]];
  if (!avoidPlayer) cust.detour = false;
  cust.stuck = 0;
  cust.state = state; cust.spot = spot;
}
function custReturnsSpot() {                      // in the lane, facing the drop slot
  const s = returnSlotMesh.position;
  return { x: s.x + 0.6, z: s.z, ry: -Math.PI / 2 };
}
function custNextStop() {                         // a shelf they haven't looked at yet, favoring their kind of thing
  let spots = browseSpots().filter(s => !cust.seen.has(s));
  if (cust.stopsLeft === 1 && !cust.holding && cust.who.persona.taste.cats.length) {   // last stop, still empty-handed: one more try at their favorite section
    const favs = spots.filter(s => custLikes(s) > 0.5); if (favs.length) spots = favs;
  }
  const w = spots.map(s => 1 + 8 * custLikes(s)), total = w.reduce((a, b) => a + b, 0);
  let r = cust.who.rnd() * total, i = 0; while (i < spots.length - 1 && (r -= w[i]) > 0) i++;
  const spot = spots[i]; if (!spot) return custDone();
  cust.seen.add(spot); custGo("stop", spot);
}
function custDone() {                             // out of shelves to look at: grab a snack on the way maybe, then pay for what they've got, or give up
  if (!cust.snackDone) {
    cust.snackDone = true;
    const spots = snackSpots();
    if (spots.length && Math.random() < (cust.holding ? 0.4 : 0.15)) return custGo("snack", spots[Math.floor(Math.random() * spots.length)]);
  }
  if (cust.holding || cust.snacks.length) { cust.c.setMood("happy"); custGo("counter", CUST_COUNTER); }
  else { cust.c.setMood("meh"); custGo("leave", CUST_DOOR); }
}
function custDecide() {                           // done browsing this shelf: take one, put one back, or move on
  const { rnd, persona } = cust.who, likes = custLikes(cust.spot), last = cust.stopsLeft <= 1;
  cust.stopsLeft--;
  const take = ((persona.taste.cats.length ? persona.picky * likes * 1.2 : 0.25) + (last && !cust.holding ? 0.3 : 0.03)) * 0.7 ** cust.holding;   // each extra tape is a harder sell
  if (cust.holding < persona.maxTapes && rnd() < take) cust.reach = "take";
  else if (cust.holding && rnd() < 0.2) cust.reach = "swap";      // saw something better: put theirs back, take this
  else if (cust.holding && rnd() < 0.12) cust.reach = "return";   // second thoughts
  else cust.reach = null;
  if (cust.reach) {
    cust.reachCopy = cust.reach === "return" ? null : custPickCopy();   // decided now, so the hand goes to the copy they'll take
    const aim = cust.reachCopy || cust.tapes[cust.tapes.length - 1];   // ...or the slot theirs goes back into
    if (aim?.pos) cust.c.reachTo(aim.pos); else cust.c.setPose("reach");
    cust.c.setMood(cust.reach === "return" ? "meh" : likes > 0.4 ? "love" : "happy"); cust.state = "reach"; cust.t = 1.3;
  }
  else { cust.c.setMood(cust.holding ? "happy" : "neutral"); cust.stopsLeft > 0 ? custNextStop() : custDone(); }
}
function custPickCopy() {                        // a copy still on this shelf, favoring their kind of thing
  const cs = cust.spot.copies.filter(c => !c.offShelf), cats = cust.who.persona.taste.cats;
  if (!cs.length) return null;
  const w = cs.map(c => cats.includes(c.category) ? 6 : 1);
  let r = cust.who.rnd() * w.reduce((a, b) => a + b, 0), i = 0; while (i < cs.length - 1 && (r -= w[i]) > 0) i++;
  return cs[i];
}
const registerStaffed = () => emp.state === "post" || Math.hypot(player.x - EMP_POST.x, player.z - EMP_POST.z) < 1.5;   // Dana at her post, or you behind the register
function custGone() {
  if (cust.tagged) for (const c of cust.tapes) c.lost = true;   // walked out with them: gone for good (order a replacement on the POS)
  cust.snacks.forEach(restock);                   // lifted snacks just restock, no loss tracking
  const c = cust.c;
  scene.remove(c.group); c.dispose();
  for (const m of c.parts) { const i = aimables.indexOf(m); if (i >= 0) aimables.splice(i, 1); }
  colliders.splice(colliders.indexOf(cust.box), 1);
  cust.c = null; cust.state = "gone"; cust.t = 20 + Math.random() * 20;
}
function custInteract() {                        // E on a customer: ring them up at the counter, or just say hi
  const c = cust.c;
  if (["wait", "impatient", "angry"].includes(cust.state) && !co) { coStart("player"); coAct("customer"); }   // start ringing them up
  else if (co?.by === "player") coAct("customer");
  else if (!["paid", "leave", "out"].includes(cust.state)) { cust.hi = 1.4; c.setMood("happy"); }
}
function custTick(dt) {
  if (!cust.c) { if ((cust.t -= dt) <= 0 && !frontLock.locked) custSpawn(); return; }   // locked: whoever's inside finishes up; nobody new
  const c = cust.c, p = c.group.position, P = cust.who.persona;
  let speed = 0;
  if (cust.path.length) {                         // walking: follow the path, waiting politely if you're in the way
    const [tx, tz] = cust.path[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) cust.path.shift();
    else if (yieldTo(cust, p, dx, dz, dt, av => custGo(cust.state, cust.spot, av))) {}   // you're in the way
    else {
      speed = P.speed * (cust.state === "leave" && cust.tagged ? 1.4 : 1);
      const step = Math.min(d, speed * dt); p.x += dx / d * step; p.z += dz / d * step;
      cust.ry = Math.atan2(dx, dz);
    }
    if (cust.tagged && !cust.alarmed && Math.abs(p.x) < 2 && cust.lastZ >= GATE_Z && p.z < GATE_Z) {   // out through the gates with a tagged tape
      cust.alarmed = true; startGateAlarm(); c.setMood("alarm");
    }
    if (!cust.path.length && cust.spot?.ry !== undefined) cust.ry = cust.spot.ry;
  } else {                                        // arrived: do this stop's thing
    cust.t -= dt;
    switch (cust.state) {
      case "boot": if (cust.t <= 0) { c.setMood("neutral"); cust.returning.length ? custGo("dropoff", custReturnsSpot()) : custNextStop(); } break;
      case "dropoff": c.reachTo(returnSlotMesh.getWorldPosition(new THREE.Vector3())); cust.state = "dropping"; cust.t = 1.2; break;   // tapes in the slot...
      case "dropping": if (cust.t <= 0) {                                               // ...and checked back in
        for (const copy of cust.returning) {
          posTerm.checkIn(copy);
          if (Math.random() < 0.4) setWindFrac(copy, 0.15 + Math.random() * 0.85);   // be kind, rewind — not everyone is
          const k = rentedCopies.indexOf(copy); if (k >= 0) rentedCopies.splice(k, 1);
          returnBin.push(copy);
        }
        refreshReturnsBin(); cust.returning = []; c.holdTape(0); c.setPose("idle"); c.reachTo(null); c.setMood("happy");
        if (Math.random() < 0.5) custNextStop(); else custGo("leave", CUST_DOOR);   // stay and browse, or just a drop-off
      } break;
      case "stop": c.setMood("browse"); cust.state = "browse"; cust.t = 3 + cust.who.rnd() * 4; break;
      case "browse": if (cust.t <= 0) custDecide(); break;
      case "snack":                               // reach in (the cooler door swings open for it), take one if any are left
        { const left = cust.spot.units.filter(u => u.visible && u !== heldSnack); cust.snackUnit = left[Math.floor(Math.random() * left.length)] || null; }
        if (cust.snackUnit) c.reachTo(cust.snackUnit.getWorldPosition(new THREE.Vector3())); else c.setPose("reach");   // hand to the one they're taking
        c.setMood("happy"); cust.state = "snacking"; cust.t = 1.4;
        if (cust.spot.drinks && !coolerOpen) { coolerOpen = true; cust.openedCooler = true; }
        break;
      case "snacking": if (cust.t <= 0) {
        const u = cust.snackUnit?.visible && cust.snackUnit !== heldSnack ? cust.snackUnit : null;
        if (u) { u.visible = false; cust.snacks.push(u); }
        c.reachTo(null);
        if (cust.openedCooler) { coolerOpen = false; cust.openedCooler = false; }
        c.setPose(cust.holding ? "hold" : "idle"); custDone();
      } break;
      case "reach": if (cust.t <= 0) {
        if (cust.reach !== "take") setOnShelf(cust.tapes.pop(), true);   // put back (a swap trades one for one)
        const got = cust.reachCopy && !cust.reachCopy.offShelf ? cust.reachCopy : cust.reach !== "return" && custPickCopy();   // the one they reached for (unless someone beat them to it)
        if (cust.reach !== "return" && got) { setOnShelf(got, false); cust.tapes.push(got); }   // an actual copy off this shelf
        c.reachTo(null);
        cust.holding = cust.tapes.length;
        c.holdTape(cust.holding); c.setPose(cust.holding ? "hold" : "idle");
        cust.stopsLeft > 0 ? custNextStop() : custDone();
      } break;
      case "checkout":                           // mid-sale: the clerk walked off?
        if (co && (co.idle = (co.idle || 0) + dt) > 30) {
          if (co.by === "player" && emp.state === "post") { co.by = "dana"; co.idle = 0; coHud(); }   // Dana steps in
          else if (co.idle > 45) {                 // gone too long: they leave with whatever's in their hands
            c.holdTape(cust.tapes.length);           // (snatching back anything you'd taken)
            cust.tagged = cust.tapes.some(t => !t.desens); drawerOpen = 0; co = null; coHud();
            c.setMood("angry"); c.holdProp(null); c.setPose(cust.tapes.length ? "hold" : "idle"); custGo("leave", CUST_DOOR);
          }
        }
        break;
      case "counter": if (!registerStaffed()) { dingBell(); empSummon(); } c.setPose("wait"); c.holdProp(cust.tapes.length ? "card" : "cash");   // card out, ready c.setMood("wait"); cust.state = "wait"; cust.t = 25 * P.patience; break;   // ding! then a fair wait
      case "wait": if (cust.t <= 0) { dingBell(); empSummon(); c.setMood("impatient"); cust.state = "impatient"; cust.t = 15 * P.patience; } break;   // ding ding, hello?
      case "impatient": if (cust.t <= 0) { c.setMood("angry"); cust.state = "angry"; cust.t = 6; } break;
      case "angry": if (cust.t <= 0) { cust.tagged = cust.tapes.length > 0; cust.alarmed = false; c.setPose("hold"); custGo("leave", CUST_DOOR); } break;   // storms out with it
      case "paid": if (cust.t <= 0) { c.setMood("happy"); custGo("leave", CUST_DOOR); } break;
      case "leave": c.setMood("off"); cust.state = "out"; cust.t = 0.6; break;   // screen clicks off at the door...
      case "out": if (cust.t <= 0) custGone(); return;                               // ...and they're gone
    }
  }
  if (cust.hi > 0 && (cust.hi -= dt) <= 0) c.setMood({ browse: "browse", wait: "wait", impatient: "impatient", angry: "angry" }[cust.state] || (cust.holding ? "happy" : "neutral"));   // the hello wears off
  cust.lastZ = p.z;
  cust.face += Math.atan2(Math.sin(cust.ry - cust.face), Math.cos(cust.ry - cust.face)) * Math.min(1, dt * 8);   // turn smoothly, the short way round
  c.group.rotation.y = cust.face;
  const cr = cust.squeeze > 0 ? 0 : 0.22;          // slipping past you: no body to bump for a moment
  Object.assign(cust.box, { x0: p.x - cr, x1: p.x + cr, z0: p.z - cr, z1: p.z + cr });
  c.tick(dt, speed);
}
// ---------------- the employee: Dana, on the register ----------------
// Same TV-head build as the customers, in the store polo. By default she works
// the register: rings up whoever's waiting and silences the gates. E on her
// switches her to processing returns — take an armful from the tote, rewind any
// that need it on the counter rewinder, reshelve each in its own slot — and
// back to the register once the bin's empty (or when you tell her).
const EMP_POST = { x: -5.45, z: 3.2, ry: 0 };                      // behind the register, facing the customer side
const EMP_TOTE = { x: -3.05, z: 4 - 0.35 - 1.05, ry: Math.PI / 2 }; // behind the returns slot, at the tote
const EMP_REWIND = { x: -4.5, z: 3.2, ry: 0 };                      // at the rewinder
const EMP_ARMFUL = 10;                                              // returns she takes out per trip
const emp = { coT: 0, coReached: false, c: null, task: "register", state: "", path: [], ry: 0, face: 0, t: 0, ringT: 0, alarmT: 0, carry: [], rewinding: null, openedFlap: false, stuck: 0, box: { x0: 0, x1: 0, z0: 0, z1: 0, shadow: false } };
function empCoTarget(at) {                     // where Dana's hand goes for each checkout step
  if (at === "pad") return new THREE.Vector3(-3.95, 1.12, 3.9);
  if (at === "register") return co?.i >= CO_STEPS.findIndex(q => q.id === "ring") ? cashDrawer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, -0.3)) : new THREE.Vector3(-5.45, 1.12, 3.8);   // the drawer / the keyboard
  const q = cust.c.group.position; return new THREE.Vector3(q.x, 1.2, 3.95);   // over the counter, where their hand meets hers
}
function empSpawn() {
  const outfit = { ...VaultCustomers.randomOutfit(seeded(417), true), top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, nameTag: "DANA",
    pants: "khaki", pantsColor: "#b9a27a", shoes: "#1e1e1e", hat: null, tv: { kind: "black", color: "#1c1c1e", w: 0.46, h: 0.36, d: 0.36, antenna: false, knobs: true }, phosphor: "#c9a8ff" };   // lavender
  const c = emp.c = VaultCustomers.build(outfit);
  c.parts.forEach(m => { m.userData.employee = true; aimables.push(m); });
  c.glows.forEach(glow); scene.add(c.group); colliders.push(emp.box);
  c.group.position.set(EMP_POST.x, 0, EMP_POST.z); emp.ry = emp.face = EMP_POST.ry;
  c.setMood("neutral"); emp.state = "post";
}
function empGo(state, spot, avoidPlayer = false) {
  if (STOOL_STATES.includes(emp.state) && !STOOL_STATES.includes(state)) empLeaveStool();
  const p = emp.c.group.position, r = 0.35;
  const you = avoidPlayer ? [{ x0: player.x - r, x1: player.x + r, z0: player.z - r, z1: player.z + r }] : [];
  const grid = navGrid([emp.box, flapCollider], you); spot = spotBesideYou(spot, grid);
  emp.path = navPath(grid, p.x, p.z, spot.x, spot.z) || [[spot.x, spot.z]];   // she can lift the pass-through
  if (!avoidPlayer) emp.detour = false;
  emp.state = state; emp.spot = spot; emp.stuck = 0;
}
const shelfSpot = copy => ({ x: copy.pos.x + Math.cos(copy.ry) * 0.8, z: copy.pos.z - Math.sin(copy.ry) * 0.8, ry: Math.atan2(-Math.cos(copy.ry), Math.sin(copy.ry)) });
function empNext() {                              // processing returns: what's next with what she's carrying
  const c = emp.c;
  c.reachTo(null);
  c.holdTape(Math.min(3, emp.carry.length)); c.setPose(emp.carry.length ? "hold" : "idle");
  if (emp.carry.some(t => !isRewound(t))) return empGo("toRewinder", EMP_REWIND);
  if (emp.carry.length) {                         // nearest slot next: one loop through the floor, not a trip per tape
    const p = c.group.position, d = t => Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
    emp.target = emp.carry.reduce((a, b) => d(b) < d(a) ? b : a);   // ponytail: greedy nearest-neighbor, fine for a handful of tapes
    return empGo("toShelf", shelfSpot(emp.target));
  }
  empGo("toTote", EMP_TOTE);
}
function empToggle() {                            // E on Dana: returns <-> register
  const c = emp.c;
  if (emp.state === "watching") { c.setMood("happy"); emp.watch.hold = 1.5; return; }   // just a smile; she's off the clock
  if (emp.task === "register") {
    if (!returnBin.length) { toast("Dana: returns bin's empty!", true); c.setMood("happy"); emp.t = 1; return; }
    emp.task = "returns"; c.setMood("happy"); empGo("toTote", EMP_TOTE);
  } else empBackToRegister();
}
function empSummon() {                           // the bell: drop what she's doing (tapes stay in hand), ring them up, then back to it
  if (emp.task !== "returns" || emp.paused) return;
  emp.paused = true; emp.c.setMood("happy"); empGo("toPost", EMP_POST);
}
function empBackToRegister(msg) {
  emp.paused = false;
  const c = emp.c;
  returnBin.push(...emp.carry); emp.carry = []; refreshReturnsBin();   // anything still in hand goes back in the tote
  emp.rewinding = null;                            // (a tape in the rewinder stays there for whoever's next)
  c.holdTape(0); c.setPose("idle"); c.reachTo(null); c.setMood(msg ? "happy" : "neutral");
  emp.task = "register"; empGo("toPost", EMP_POST);
  if (msg) toast(msg, true);
}
// ---- off the clock: with the doors locked and the store empty, Dana joins you
// on the couch. She reacts to what the TV actually sounds like — its audio is
// routed through an analyser (the stream is CORS-loaded, so the samples are
// readable): a sudden jump over the recent level startles her, a long loud
// stretch has her into it, near-silence puts her to sleep ----
let tvAudio = null;
function tvLevel() {                              // RMS of the TV's audio right now, 0..~0.5 (null if unreadable)
  if (!playing || video.paused) return 0;
  if (!tvAudio) try {                             // built once, on first need: after this the TV's sound runs through it
    const ac = new AudioContext(), an = ac.createAnalyser(); an.fftSize = 1024;
    ac.createMediaElementSource(video).connect(an); an.connect(ac.destination);
    tvAudio = { ac, an, buf: new Float32Array(1024) };
  } catch { tvAudio = { fail: true }; }
  if (tvAudio.fail) return null;
  if (tvAudio.ac.state === "suspended") tvAudio.ac.resume();
  tvAudio.an.getFloatTimeDomainData(tvAudio.buf);
  let sum = 0; for (const v of tvAudio.buf) sum += v * v;
  return Math.sqrt(sum / tvAudio.buf.length);
}
const empCanWatch = () => frontLock.locked && !cust.c && emp.task === "register" && seated;   // what brings her over
const inLounge = () => Math.hypot(player.x - TV.x, player.z - (TV.z - 2.5)) < 5.5;
const empKeepWatching = () => frontLock.locked && !cust.c && emp.task === "register" && (seated || inLounge());   // what keeps her there
function empWatch(dt) {                           // on the couch: pick a face from the sound
  const c = emp.c, w = emp.watch, lvl = tvLevel();
  w.cool -= dt;
  // you look over at her -> she looks back (and after a scare, she checks on you)
  const hp = c.group.position, cam = camera.position, to = c.screen.getWorldPosition(new THREE.Vector3()).sub(cam).normalize();   // toward her face
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  w.eye = fwd.dot(to) > 0.8 ? (w.eye || 0) + dt : 0;
  const glance = w.eye > 0.35 || (w.hold > 0 && w.hold < 0.9);
  const rel = Math.atan2(cam.x - hp.x, cam.z - hp.z) - emp.face;
  c.lookAt(glance ? Math.atan2(Math.sin(rel), Math.cos(rel)) : null);   // wrapped: her body angle can be a full turn (2π) off
  if (w.eye > 0.35 && w.hold <= 0) { c.setMood("happy"); return; }
  if (lvl === null) { c.setMood("watch"); return; }   // can't hear it: just watches
  w.fast += (lvl - w.fast) * Math.min(1, dt / 0.12);
  w.avg += (lvl - w.avg) * Math.min(1, dt / 4);
  w.quiet = lvl < 0.004 ? w.quiet + dt : 0;
  w.loud = w.avg > 0.12 ? w.loud + dt : 0;
  if (w.cool <= 0 && w.fast > 0.06 && w.fast > w.avg * 2.4) { c.setMood("shock"); w.cool = 3; w.hold = 1.3; }   // BANG
  if ((w.hold -= dt) > 0) return;
  c.setMood(!playing ? (w.idle = (w.idle || 0) + dt) > 8 ? "sleep" : "meh"   // nothing on: bored, then out
    : w.quiet > 6 ? "sleep" : w.loud > 3 ? "happy" : "watch");
  if (playing) w.idle = 0;
}
// ---- Dana and the stool: when nothing's going on at the register for a bit,
// she fetches the stool (wherever you left it, if she can walk there), parks
// it beside the register and sits. Up there she does as she likes: a lazy
// spin now and then, a look around, and she scoots back to face the counter
// once it stops. Sit long enough and she gets bored: a sigh, then a real
// spin, a run of quick shoves like you tapping E. Anything happening — a customer, the bell, a sale, the gate
// alarm, you asking her to do returns, you on the couch — and she's up.
// While she has it, it's hers: you can't sit on it or pick it up ----
const EMP_STOOL = { x: -4.75, z: 2.7 };          // where she parks it: beside the register, clear of her shuffle to the pad
const EMP_STOOL_WAIT = 8;                        // seconds of nothing going on before she goes for it
const EMP_BORED_AT = 25;                         // seconds up there before she's bored enough to really spin
const STOOL_STATES = ["toStool", "stoolGrab", "stoolCarry", "stoolSitDown", "stoolSit", "stoolStandUp"];
const empIdle = () => emp.task === "register" && !emp.paused && !cust.c && !co && !gateAlarm.on && !empCanWatch();
const stoolFree = () => !stool.carried && !onStool && !stool.by && !eHoldStool;
const clearFor = (x, z, r, skip) => !colliders.some(c => !skip.includes(c) && x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r);
function stoolSide(fx, fz) {                      // a clear spot to stand beside the stool, on the side nearest (fx, fz), facing it
  const a0 = Math.atan2(fx - stool.x, fz - stool.z);
  for (const da of [0, 0.8, -0.8, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
    const a = a0 + da, x = stool.x + Math.sin(a) * 0.6, z = stool.z + Math.cos(a) * 0.6;
    if (clearFor(x, z, 0.22, [emp.box, stool.box])) return { x, z, ry: a + Math.PI };
  }
  return null;
}
function empFetchStool() {
  const p = emp.c.group.position, home = Math.hypot(stool.x - EMP_STOOL.x, stool.z - EMP_STOOL.z) < 0.3;
  if (!home) {                                    // its parking spot has to be free, and somewhere to stand behind it
    const b = stoolFit(EMP_STOOL.x, EMP_STOOL.z, {});
    if (colliders.some(c => c !== stool.box && c !== emp.box && c.x0 < b.x1 && c.x1 > b.x0 && c.z0 < b.z1 && c.z1 > b.z0) || playerIn(b)) return;
    if (!clearFor(EMP_STOOL.x, EMP_STOOL.z - 0.5, 0.22, [emp.box, stool.box])) return;
  }
  const side = stoolSide(p.x, p.z);
  if (!side || !navPath(navGrid([emp.box, flapCollider]), p.x, p.z, side.x, side.z)) return;   // can't get to it (a closed door, boxed in)
  stool.by = "dana"; emp.stoolPlan = home ? "sit" : "carry";
  emp.c.setMood("happy"); empGo("toStool", side);
}
function empStoolSit() {                         // back onto the seat from wherever she's standing
  const c = emp.c, p = c.group.position;
  c.reachTo(null); c.setPose("sit", STOOL_SIT);
  emp.state = "stoolSitDown"; emp.t = 0.7; emp.from = { x: p.x, z: p.z };
}
function empLeaveStool() {                       // dropped mid-whatever (you called her away): let go of it right now
  if (stool.by !== "dana") return;
  const c = emp.c, p = c.group.position;
  if (stool.danaCarry) {                          // set it down where it is if it fits, else back where she got it
    const q = stool.g.position, b = stoolFit(q.x, q.z, {});
    const fits = !colliders.some(k => k !== emp.box && k.x0 < b.x1 && k.x1 > b.x0 && k.z0 < b.z1 && k.z1 > b.z0) && !playerIn(b);
    if (fits) { stool.x = q.x; stool.z = q.z; }
    stool.danaCarry = false; stool.g.position.set(stool.x, 0, stool.z);
    colliders.push(stoolFit(stool.x, stool.z, stool.box));
  } else if (["stoolSitDown", "stoolSit", "stoolStandUp"].includes(emp.state)) {
    const side = stoolSide(EMP_POST.x, EMP_POST.z); if (side) { p.x = side.x; p.z = side.z; }   // off the seat
  }
  c.setPose("idle"); c.reachTo(null); c.lookAt(null);
  stool.by = null;
}
function empTick(dt) {
  if (!emp.c) { if (window.VaultCustomers && posTerm) empSpawn(); else return; }
  const c = emp.c, p = c.group.position;
  let speed = 0;
  if (emp.path.length) {                          // walking (same manners as the customers)
    const [tx, tz] = emp.path[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) emp.path.shift();
    else if (yieldTo(emp, p, dx, dz, dt, av => empGo(emp.state, emp.spot, av))) {}
    else {
      speed = 1.45;
      const step = Math.min(d, speed * dt); p.x += dx / d * step; p.z += dz / d * step;
      emp.ry = Math.atan2(dx, dz);
    }
    if (!emp.path.length && emp.spot) emp.ry = emp.spot.ry;
  } else {
    emp.t -= dt;
    switch (emp.state) {
      case "toPost": emp.state = "post"; c.setPose("idle"); c.setMood("neutral"); break;
      case "post":                                // ring up whoever's waiting; shut the gates up
        if (cust.c && ["wait", "impatient", "angry"].includes(cust.state)) {
          c.setMood("happy");
          if (!co && (emp.ringT += dt) > 1.5) { emp.ringT = 0; coStart("dana"); }   // her turn: start ringing them up
        } else emp.ringT = 0;
        const mine = co?.by === "dana" && cust.c;
        // she shuffles over to the pad for the desensitize step and back after — never leans across for it
        const wantX = mine && coStep()?.at === "pad" ? -4.2 : emp.spot?.x ?? EMP_POST.x, gap = wantX - p.x;   // home = wherever she parked (beside you, if you're on her spot)
        if (Math.abs(gap) > 0.02) { const st = Math.sign(gap) * Math.min(Math.abs(gap), 1.0 * dt); p.x += st; speed = 1.0; }
        if (mine) {                                // chatting while she works: faces them, nods, smiles
          c.talk(true);
          const q = cust.c.group.position, rel = Math.atan2(q.x - p.x, q.z - p.z) - emp.face;
          c.lookAt(coStep()?.at === "customer" ? Math.atan2(Math.sin(rel), Math.cos(rel)) : null);
          if ((emp.chatT = (emp.chatT || 0) - dt) <= 0) { emp.chatT = 1.5 + Math.random() * 2; c.setMood(["happy", "happy", "neutral", "love"][Math.floor(Math.random() * 4)]); }
        } else { c.talk(false); if (emp.coWas) c.lookAt(null); }
        emp.coWas = mine;
        if (mine && Math.abs(gap) <= 0.02 && (emp.coT -= dt) <= 0) {   // one step at a time: hand out, then the step happens
          const s = coStep();
          if (emp.coReached) { emp.coReached = false; coAct(s.at); c.reachTo(null); emp.coT = 0.35; }
          else { emp.coReached = true; c.reachTo(empCoTarget(s.at), 1, { lean: false }); emp.coT = s.at === "customer" ? 0.9 : 0.7; }
        }
        if (co?.by === "dana" && !cust.c) { co = null; coHud(); drawerOpen = 0; }
        if (gateAlarm.on) { if ((emp.alarmT += dt) > 2.5) { emp.alarmT = 0; silenceGateAlarm(); } } else emp.alarmT = 0;
        if (emp.t <= 0 && co?.by !== "dana") c.reachTo(null);
        if (emp.t <= 0 && !co && c.mood === "happy" && !(cust.c && ["wait", "impatient", "angry"].includes(cust.state))) { c.setPose("idle"); c.setMood("neutral"); }
        if (emp.paused && emp.t <= 0 && !co && !(cust.c && ["counter", "wait", "impatient", "angry", "checkout"].includes(cust.state))) { emp.paused = false; empNext(); break; }   // served: back to the returns
        if (!co && empCanWatch()) {                       // closed up and you're on the couch: take the next cushion over
          const side = seatAt.x > 0 ? -1 : seatAt.x < 0 ? 1 : (Math.random() < 0.5 ? -1 : 1);   // the end cushion farthest from you
          emp.seat = { x: side * (Math.abs(SEATS[0].x) - 0.04), z: TV.z - 3.3 }; c.setMood("happy");   // on it, a hair inboard so elbows clear the arm
          empGo("toCouch", { x: emp.seat.x, z: TV.z - 2.425, ry: 0 });   // the strip between the couch and the coffee table
        }
        if (emp.state === "post" && empIdle() && emp.t <= 0 && stoolFree()) { if ((emp.idleT = (emp.idleT || 0) + dt) > EMP_STOOL_WAIT) { emp.idleT = 0; empFetchStool(); } }
        else emp.idleT = 0;
        break;
      case "toStool":
        if (!empIdle()) { empGo("toPost", EMP_POST); break; }
        if (emp.stoolPlan === "sit") { empStoolSit(); break; }
        c.reachTo(new THREE.Vector3(stool.x, STOOL.SEAT, stool.z), 1, { lean: true }); emp.state = "stoolGrab"; emp.t = 0.7; break;   // a hand on the seat
      case "stoolGrab":
        if (emp.t > 0) break;
        colliders.splice(colliders.indexOf(stool.box), 1); stool.danaCarry = true; stool.vel = 0;
        c.setPose("hold"); empGo("stoolCarry", { x: EMP_STOOL.x, z: EMP_STOOL.z - 0.5, ry: 0 });   // behind its spot, facing the counter
        break;
      case "stoolCarry":                          // there: down it goes, and she's straight onto it
        stool.danaCarry = false; stool.x = EMP_STOOL.x; stool.z = EMP_STOOL.z;
        stool.g.position.set(stool.x, 0, stool.z); colliders.push(stoolFit(stool.x, stool.z, stool.box));
        empStoolSit(); break;
      case "stoolSitDown": {
        const k = 1 - Math.max(0, emp.t) / 0.7;
        p.x = emp.from.x + (stool.x - emp.from.x) * k; p.z = emp.from.z + (stool.z - emp.from.z) * k;
        if (emp.t <= 0) { stool.angle = emp.face - Math.PI; emp.stoolHome = emp.face; emp.state = "stoolSit"; emp.t = 3 + Math.random() * 5; emp.bored = 0; emp.spins = 0; c.setMood("neutral"); }
        break;
      }
      case "stoolSit": {
        if (!empIdle() || onStool) {               // something's up: off she gets
          emp.side = stoolSide(EMP_POST.x, EMP_POST.z) || { x: p.x, z: p.z - 0.6 };
          emp.from = { x: p.x, z: p.z }; emp.state = "stoolStandUp"; emp.t = 0.5;
          c.setPose("idle"); c.lookAt(null); c.setMood("neutral"); break;
        }
        emp.bored += dt;
        if (emp.spins > 0) {                       // bored stiff: shove after shove, same as you tapping E
          if ((emp.spinT -= dt) <= 0) { emp.spins--; emp.spinT = 0.22 + Math.random() * 0.12; stool.vel = Math.min(STOOL.MAX, stool.vel + STOOL.PUSH); }
          if (!emp.spins) c.setMood("love");       // wheeeee
        }
        if (!stool.vel) {                          // stopped facing who-knows-where: scoot back round to the counter
          const d = Math.atan2(Math.sin(emp.stoolHome - Math.PI - stool.angle), Math.cos(emp.stoolHome - Math.PI - stool.angle));
          stool.angle += Math.sign(d) * Math.min(Math.abs(d), 0.9 * dt);
        }
        emp.ry = emp.face = stool.angle + Math.PI;
        if (emp.t <= 0 && !stool.vel) {            // a whim — the longer nothing happens, the more bored she gets
          const r = Math.random();
          if (emp.bored > EMP_BORED_AT) {          // that's it: a real spin
            emp.bored = 0; emp.spins = 4 + Math.floor(Math.random() * 4); emp.spinT = 0; c.lookAt(null); c.setMood("happy");
          }
          else if (r < 0.2) { stool.vel = Math.min(STOOL.MAX, 1.5 + Math.random() * 1.5); c.setMood("happy"); c.lookAt(null); }   // a lazy half turn
          else if (r < 0.5) { c.lookAt((Math.random() * 2 - 1) * 1.1); c.setMood("browse"); }                                     // what's going on over there
          else { c.lookAt(null); c.setMood(emp.bored > EMP_BORED_AT / 2 ? "meh" : "neutral"); }                                  // sigh
          emp.t = 4 + Math.random() * 8;
        }
        break;
      }
      case "stoolStandUp": {
        const k = 1 - Math.max(0, emp.t) / 0.5;
        p.x = emp.from.x + (emp.side.x - emp.from.x) * k; p.z = emp.from.z + (emp.side.z - emp.from.z) * k;
        if (emp.t <= 0) { stool.by = null; empGo("toPost", EMP_POST); }
        break;
      }
      case "toCouch": emp.state = "sitDown"; emp.t = 0.7; emp.from = { x: p.x, z: p.z }; c.setPose("sit"); break;
      case "sitDown": {                            // back onto the cushion, facing the TV
        const k = 1 - Math.max(0, emp.t) / 0.7;
        p.x = emp.from.x + (emp.seat.x - emp.from.x) * k; p.z = emp.from.z + (emp.seat.z - emp.from.z) * k; emp.ry = 0;
        if (emp.t <= 0) { emp.state = "watching"; emp.watch = { fast: 0, avg: 0, quiet: 0, loud: 0, cool: 2, hold: 0 }; emp.leaveT = 0; }
        break;
      }
      case "watching":
        empWatch(dt);
        if (!empKeepWatching()) {                  // you wandered off (she gives it a bit) / the store opened up (back to work now)
          if ((emp.leaveT += dt) > (frontLock.locked && !cust.c ? 8 : 1.5)) { emp.state = "standUp"; emp.t = 0.6; c.setPose("idle"); c.setMood("neutral"); }
        }
        else emp.leaveT = 0;
        break;
      case "standUp": if (emp.t <= 0) { p.z = TV.z - 2.425; c.lookAt(null); empGo("toPost", EMP_POST); } break;
      case "toTote":
        if (!returnBin.length) { empBackToRegister("Dana: returns are all put away"); break; }
        c.reachTo(new THREE.Vector3(EMP_TOTE.x + 0.55, 0.8, EMP_TOTE.z)); emp.state = "grab"; emp.t = 0.9; break;   // down into the tote
      case "grab": if (emp.t <= 0) { emp.carry = returnBin.splice(-EMP_ARMFUL); refreshReturnsBin(); c.setMood("neutral"); empNext(); } break;
      case "toRewinder": emp.state = "rewind"; break;
      case "rewind": {
        const t = emp.carry.find(x => !isRewound(x));
        if (emp.rewinding && rewinder.tape !== emp.rewinding) {   // someone else took it out: it's theirs now
          emp.carry.splice(emp.carry.indexOf(emp.rewinding), 1); emp.rewinding = null; empNext(); break;
        }
        if (!emp.rewinding) {
          if (!t) { empNext(); break; }
          if (rewinder.tape) { c.setMood("impatient"); break; }   // somebody's tape is in there: wait for it
          rewinderLoad(t); emp.rewinding = t; c.reachTo(rewinder.tapeMesh.getWorldPosition(new THREE.Vector3())); emp.t = 0.8; c.setMood("wait");
          c.holdTape(Math.min(3, emp.carry.length - 1));
        } else if (rewinder.done) {                // out it comes, rewound
          rewinderSound(false); rewinder.tape = null; rewinder.tapeMesh.visible = false; rewinder.led.material.color.set(0x222222);
          emp.rewinding = null; c.setMood("neutral"); empNext();
        } else if (emp.t <= 0) { c.reachTo(null); c.setPose("hold"); }
        break;
      }
      case "toShelf": c.reachTo(emp.target.pos); emp.state = "shelve"; emp.t = 0.9; break;   // into its own slot
      case "shelve": if (emp.t <= 0) { const t = emp.target; emp.carry.splice(emp.carry.indexOf(t), 1); t.desens = false; setOnShelf(t, true); empNext(); } break;   // back in its slot, tag re-armed
    }
  }
  if (stool.danaCarry) {                         // the stool rides just ahead of her, a hand on the seat
    const sx = p.x + Math.sin(emp.face) * 0.5, sz = p.z + Math.cos(emp.face) * 0.5;
    stool.g.position.set(sx, 0.12, sz);
    c.reachTo(new THREE.Vector3(sx - Math.sin(emp.face) * 0.15, STOOL.SEAT + 0.12, sz - Math.cos(emp.face) * 0.15), 1, { lean: false });
  }
  // the counter pass-through: lift it to get by, drop it again behind her
  const fx = (flapCollider.x0 + flapCollider.x1) / 2, fz = (flapCollider.z0 + flapCollider.z1) / 2, fd = Math.hypot(p.x - fx, p.z - fz);
  const goal = emp.path[emp.path.length - 1];
  if (!flapOpen && fd < 1.2 && goal && (p.z - fz) * (goal[1] - fz) < 0) { toggleFlap(); emp.openedFlap = true; }
  else if (emp.openedFlap && flapOpen && fd > 1.4 && !(goal && (p.z - fz) * (goal[1] - fz) < 0)) { toggleFlap(); if (!flapOpen) emp.openedFlap = false; }   // through and clear (her post is ~1.6 m off)
  emp.face += Math.atan2(Math.sin(emp.ry - emp.face), Math.cos(emp.ry - emp.face)) * Math.min(1, dt * 8);
  c.group.rotation.y = emp.face;
  const er = emp.squeeze > 0 ? 0 : 0.22;
  Object.assign(emp.box, { x0: p.x - er, x1: p.x + er, z0: p.z - er, z1: p.z + er });
  c.tick(dt, speed);
}
function setFrontLock(on) {
  frontLock.locked = on;
  frontLock.turn.rotation.z = on ? Math.PI / 2 : 0;
  frontLock.signs.forEach(sg => sg.visible = sg.userData.open !== on);
}
// ---------------- checkout: the same steps whether you or Dana ring them up ----------------
// card → tap it on the register → card back → take the tapes → desensitize each
// on the pad → take the cash → ring it up (the drawer opens) → change → tapes
// back. Snack-only sales skip the card and the pad. Skip the pad and the
// gates will tell you about it on their way out
let co = null;                                  // { by: "player"|"dana", step, tapes, total, bill, change, des }
const money = n => "$" + n.toFixed(2);
const coTotal = () => cust.tapes.reduce((a, t) => a + posTerm.rentPrice(t), 0) + cust.snacks.reduce((a, u) => a + snackPrice(u.userData.snack), 0);
const coTapes = () => cust.tapes.length === 1 ? cust.tapes[0].title : `${cust.tapes.length} tapes`;
const CO_STEPS = [
  { id: "card", at: "customer", need: () => cust.tapes.length, tip: () => "take their member card",
    do() { cust.c.holdProp(null); co.hand = "card"; } },
  { id: "tap", at: "register", need: () => cust.tapes.length, tip: () => "tap the member card on the register",
    do() { posBeep(1900); const m = cust.member, late = m.rentals.filter(r => posTerm.dueIn(r) < 0).length;
      toast(`#${m.num} ${memberName(m)}${late ? ` · ${late} late` : " · account OK"}`, !late); } },
  { id: "cardBack", at: "customer", need: () => cust.tapes.length, tip: () => "hand their card back",
    do() { co.hand = null; } },
  { id: "tapes", at: "customer", need: () => cust.tapes.length, tip: () => `take ${coTapes()}`,
    do() { cust.c.holdTape(0); co.hand = "tapes"; } },
  { id: "desens", at: "pad", need: () => cust.tapes.some(t => !t.desens), repeat: () => cust.tapes.some(t => !t.desens),
    tip: () => { const t = cust.tapes.find(t => !t.desens); return `desensitize ${t.title}${cust.tapes.length > 1 ? ` (${cust.tapes.filter(t => t.desens).length + 1} of ${cust.tapes.length})` : ""}`; },
    do() { desensitize(cust.tapes.find(t => !t.desens)); } },
  { id: "cash", at: "customer", need: () => true, tip: () => `take the cash · ${money(co.total)} due`,
    do() { cust.c.holdProp(null); co.cashIn = co.bill; co.hand = "cash"; } },
  { id: "ring", at: "register", need: () => true, tip: () => `ring it up · ${money(co.bill)} in${co.change ? `, ${money(co.change)} change` : ""}`,
    do() {
      for (const t of cust.tapes) { posTerm.checkOut(t, cust.member); rentedCopies.push(t); }   // on their account
      if (cust.snacks.length) posTerm.sale(cust.snacks.reduce((a, u) => a + snackPrice(u.userData.snack), 0));
      cust.snacks.forEach(restock);
      drawerOpen = 1; posBeep(1200); co.hand = co.change ? "change" : "tapes";
    } },
  { id: "change", at: "customer", need: () => co.change > 0, tip: () => `give ${money(co.change)} change`,
    do() { co.hand = "tapes"; drawerOpen = 0; } },
  { id: "handback", at: "customer", need: () => true, tip: () => cust.tapes.length ? `hand over ${coTapes()}` : "hand over their snacks",
    do() {
      drawerOpen = 0; co.hand = null;
      cust.c.holdTape(cust.tapes.length); cust.snacks = [];
      cust.tagged = cust.tapes.some(t => !t.desens);          // anything still tagged sets the gates off
      cust.c.setMood("thanks"); cust.c.setPose("hold"); cust.state = "paid"; cust.t = 1.8;
      co = null; coHud();
    } },
];
function coStart(by) {
  const total = coTotal(), bills = [1, 5, 10, 20, 50].filter(b => b >= total);
  const bill = Math.random() < 0.25 ? total : (bills[0] ?? 50);          // exact change now and then
  co = { by, i: 0, total, bill, change: +(bill - total).toFixed(2), hand: null };
  cust.state = "checkout"; cust.c.setMood("happy"); cust.c.setPose("wait");
  coSkip(); coHud();
}
function coSkip() { while (co && co.i < CO_STEPS.length && !CO_STEPS[co.i].need()) co.i++; coProps(); }
function coProps() {                              // what the customer's holding out for this step
  if (!co) return;
  const id = CO_STEPS[co.i]?.id;
  cust.c.holdProp(id === "card" ? "card" : id === "cash" ? "cash" : null);
}
const coStep = () => co && CO_STEPS[co.i];
function coWants(at) {
  const s = coStep(); if (!s) return null;
  if (s.at === at) return s;
  if (s.id === "desens" && at === "customer") return CO_STEPS.find(q => q.id === "cash");   // you can skip the pad... the gates won't
  return null;
}
function coAct(at) {                              // do the current step if it happens at this spot
  const s = coWants(at); if (!s) return false;
  if (s !== coStep()) co.i = CO_STEPS.indexOf(s);     // jumped ahead past the pad
  co.idle = 0;
  s.do();
  if (co && !(s.repeat && s.repeat())) { co.i++; coSkip(); }
  coHud();
  return true;
}
function coHud() {
  coHandShow();
  const el = $("checkoutTag");
  if (!co) { el.style.display = "none"; return; }
  const s = coStep(), who = co.by === "dana" ? "Dana is ringing up" : "Ringing up";
  el.style.display = "block";
  el.innerHTML = `<div class="h">CHECKOUT</div>${who} ${memberName(cust.member)} · ${money(co.total)}` +
    (co.by === "player" && s ? `<div class="next">Next: ${s.tip()}</div>` : "");
}
// what you're holding mid-checkout, drawn in your hand like a held tape: their
// card, the stack of tapes (real covers), the cash, the change
const coHand = new THREE.Group(); coHand.visible = false;
let coHandKey = "";
function coHandShow() {
  const want = co?.by === "player" ? co.hand || "" : "";
  const key = want + (want === "tapes" ? cust.tapes.map(t => t.desens ? 1 : 0).join("") : "");
  if (key === coHandKey) return; coHandKey = key;
  coHand.clear(); coHand.visible = !!want;
  if (!coHand.parent) camera.add(coHand);
  coHand.position.set(0.26, -0.26, -0.5); coHand.rotation.set(0.1, -0.35, 0.05);
  const card = (m, w, h) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.003), m); o.rotation.x = -0.25; coHand.add(o); };
  if (want === "card") card(coHandMats.card, 0.086, 0.054);
  if (want === "cash" || want === "change") card(coHandMats.cash, 0.156, 0.066);
  if (want === "tapes") cust.tapes.forEach((t, i) => {             // fanned out a little, covers toward you
    const g = new THREE.Group(); g.position.set(-0.05 + i * 0.045, i * 0.01, -0.03 - i * 0.012); g.rotation.set(-0.15, Math.PI / 2 + 0.35 - i * 0.12, 0.08 * i); coHand.add(g);   // cover toward you, fanned
    g.add(new THREE.Mesh(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d), t.sideMat || mat.tapeBody));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(TAPE.d, TAPE.h), new THREE.MeshBasicMaterial({ color: 0x333333 }));
    art.rotation.y = -Math.PI / 2; art.position.x = -TAPE.w / 2 - 0.001; g.add(art);
    loadCoverTexture(t, tex => { art.material.map = tex; art.material.color.set(0xffffff); art.material.needsUpdate = true; });
    if (t.desens) {                                                // a little green dot: done
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12), new THREE.MeshBasicMaterial({ color: 0x2bff6a }));
      dot.rotation.y = -Math.PI / 2; dot.position.set(-TAPE.w / 2 - 0.002, TAPE.h / 2 - 0.02, 0); g.add(dot);
    }
  });
}
const coHandMats = {
  card: new THREE.MeshLambertMaterial({ map: makeTexture((g, w, h) => { g.fillStyle = "#1b3fa0"; g.fillRect(0, 0, w, h); g.fillStyle = "#ffd400"; g.fillRect(0, h * 0.62, w, h * 0.14); g.fillStyle = "#fff"; g.font = `bold ${h * 0.16}px Arial`; g.fillText("VAULTBUSTER", w * 0.07, h * 0.3); g.font = `${h * 0.11}px monospace`; g.fillText("MEMBER", w * 0.07, h * 0.5); }, 256, 160) }),
  cash: new THREE.MeshLambertMaterial({ map: makeTexture((g, w, h) => { g.fillStyle = "#9cc795"; g.fillRect(0, 0, w, h); g.strokeStyle = "#3d6b3a"; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = "#3d6b3a"; g.beginPath(); g.ellipse(w / 2, h / 2, h * 0.28, h * 0.34, 0, 0, 7); g.fill(); g.font = `bold ${h * 0.3}px Georgia`; g.fillText("$", w * 0.08, h * 0.42); }, 256, 110) }),
};
let posBeepAc = null;
function posBeep(f) {
  try {
    const ac = posBeepAc ||= new AudioContext(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = "square"; o.frequency.value = f; g.gain.setValueAtTime(0.035, t); g.gain.setValueAtTime(0, t + 0.09);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.1);
  } catch {}
}
function pickHover() {
  hovered = null; aimStool = false; aimTV = false; aimLamp = null; aimCouch = false; aimReturns = false; aimSnack = null; aimFlap = null; aimCooler = false; aimPop = null; aimTrash = false; aimDoor = null; aimPOS = false; aimSlot = false; aimRewinder = false; aimBell = false; aimDesens = false; aimCutout = false; aimCustomer = false; aimLock = false; aimEmp = false; aimSwitch = null; aimDrawer = false;
  if (document.pointerLockElement !== canvas) { highlight.visible = false; $("hoverTip").style.display = "none"; return; }
  if (inspecting || seated || onStool) { highlight.visible = false; $("hoverTip").style.display = "none"; return; }
  if (stool.carried) {                       // arms full: setting the stool down is the only thing E does
    highlight.visible = false;
    const tip = $("hoverTip"); tip.innerHTML = stool.spot ? "E — set the stool down" : "No room for the stool here"; tip.style.display = "block";
    return;
  }
  if (cutout.carried) {                      // arms full: the standee is the only thing E does
    highlight.visible = false;
    const tip = $("hoverTip"); tip.innerHTML = cutoutSpot ? "E — set the standee down" : "No room for the standee here"; tip.style.display = "block";
    return;
  }
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = raycaster.intersectObjects(coverMeshes, false).find(h => h.distance < 3.4);   // a checked-out copy is collapsed out of the mesh, so the ray goes past its slot
  if (hit) hovered = hit.object.userData.tapes[Math.floor(hit.face.a / COVER_V)];
  // the tape in hand's own empty slot: aim within ~8cm of its center (a slot is
  // 13cm wide), nothing solid in front of it, and it can go back on the shelf
  if (held?.pos && held.offShelf) {
    const ray = raycaster.ray, t = held.pos.clone().sub(ray.origin).dot(ray.direction);
    const blocked = (hit && hit.distance < t - 0.15) || raycaster.intersectObjects(aimBlockers, false).some(h => h.distance < t - 0.15);
    aimSlot = t > 0.3 && t < 3.4 && ray.distanceSqToPoint(held.pos) < 0.08 ** 2 && !blocked;
  }
  if (aimSlot) {
    hovered = null;
    highlight.visible = true; highlight.position.copy(held.pos); highlight.rotation.y = held.ry;
    const tip = $("hoverTip");
    tip.innerHTML = `CLICK — put ${held.title} back`; tip.style.display = "block";
    return;
  }
  if (hovered) {
    highlight.visible = true; highlight.position.copy(hovered.pos); highlight.rotation.y = hovered.ry;
    const tip = $("hoverTip");
    const season = hovered.seasons?.[0]?.label;             // "Season 1", "Episodes", or "" for a movie
    tip.innerHTML = `${hovered.title}<div class="cat">${hovered.category}${season ? " · " + season : ""}</div>`;
    tip.style.display = "block";
  } else {
    highlight.visible = false;
    let aim = raycaster.intersectObjects(aimables, false)[0];
    const wall = aim && raycaster.intersectObjects(aimBlockers, false)[0];
    if (wall && wall.distance < aim.distance) aim = undefined;   // it's on the far side of a wall or a rack's back
    if (aim?.object === screenMesh && aim.distance < 4.5) aimTV = true;         // TV/couch hints show in tvHint
    else if (aim?.object.userData.lamp && aim.distance < 2.6) aimLamp = aim.object.userData.lamp;
    else if (aim?.object.userData.sit && aim.distance < 3.2) { aimCouch = true; aimSeatX = aim.point.x; }
    else if (aim?.object.userData.returns && aim.distance < 2.4) aimReturns = true;
    else if ((aim?.object.userData.unit || aim?.object.userData.snack) && (aim.object.userData.unit || aim.object).visible && aim.distance < 2.4)
      aimSnack = aim.object.userData.unit || aim.object;   // the exact unit you pointed at (a drink's whole group, not just the label you hit)
    else if (aim?.object.userData.coolerDoor && aim.distance < 2.6) aimCooler = true;
    else if (aim?.object.userData.popcorn && aim.distance < 2.4) aimPop = aim.object.userData.popcorn;
    else if (aim?.object.userData.trash && aim.distance < 2.4 && (heldSnack || heldPopcorn || held)) aimTrash = true;
    else if (aim?.object.userData.flap && aim.distance < 2.6) aimFlap = aim.object.userData.flap;
    else if (aim?.object.userData.door && aim.distance < 2.4) aimDoor = aim.object.userData.door;
    else if (aim?.object.userData.pos && aim.distance < 2.4) aimPOS = true;
    else if (aim?.object.userData.bell && aim.distance < 2.4) aimBell = true;
    else if (aim?.object.userData.desens && aim.distance < 2.4 && (held || (co?.by === "player" && coWants("pad")))) aimDesens = true;
    else if (aim?.object.userData.drawer && aim.distance < 2.4) aimDrawer = true;
    else if (aim?.object.userData.rewinder && aim.distance < 2.4 && (held || rewinder.tape)) aimRewinder = true;
    else if (aim?.object.userData.cutout && aim.distance < 2.6) aimCutout = true;
    else if (aim?.object.userData.frontLock && aim.distance < 2.2) aimLock = true;
    else if (aim?.object.userData.lightZone && aim.distance < 2.2) aimSwitch = aim.object.userData.lightZone;
    else if (aim?.object.userData.stool && aim.distance < 2.2) aimStool = true;
    else if (aim?.object.userData.employee && aim.distance < 2.8) aimEmp = true;
    else if (aim?.object.userData.customer && aim.distance < 2.6 && cust.c && !cust.path.length) aimCustomer = true;
    const tip = $("hoverTip");
    if (aimLamp) tip.innerHTML = `E — turn lamp ${aimLamp.userData.on ? "off" : "on"}`;
    else if (aimReturns && (held || returnBin.length)) tip.innerHTML = [held && "E — drop tape in Returns",
      returnBin.length && inv.length < INV_MAX && `CLICK — look at a tape from Returns (${returnBin.length})`].filter(Boolean).join("<br>");
    else if (aimPop) tip.innerHTML = popcornStep(aimPop, false);
    else if (aimTrash) tip.innerHTML = held ? "Rentals don't go in the trash" : `E — throw away ${heldSnack ? heldSnack.userData.snack.name : "the popcorn"}`;
    else if (aimSnack && inv.length < INV_MAX) tip.innerHTML = `CLICK — grab ${aimSnack.userData.snack.name}${aimSnack.userData.snack.kind ? ` <div class="cat">${aimSnack.userData.snack.kind}</div>` : ""}`;
    else if (aimCooler) tip.innerHTML = `E — ${coolerOpen ? "close" : "open"} the cooler`;
    else if (aimFlap) tip.innerHTML = `E — ${flapOpen ? "close" : "open"} the counter pass-through`;
    else if (aimDoor) tip.innerHTML = aimDoor.locked ? "Locked" : `E — ${aimDoor.open ? "close" : "open"} the door`;
    else if (aimRewinder) tip.innerHTML = !rewinder.tape ? `E — rewind ${held.title}${isRewound(held) ? " (already rewound)" : ""}`
      : rewinder.done ? `E — take out ${rewinder.tape.title} · rewound`
      : `Rewinding… ${Math.round(100 * rewinder.t / rewinder.dur)}% · E — take it out early`;
    else if (aimBell) tip.innerHTML = "E — ring for service";
    else if (aimEmp) tip.innerHTML = emp.state === "watching" ? `Dana<div class="cat">Off the clock · watching with you</div>` : emp.task === "register"
      ? (returnBin.length ? `E — ask Dana to process returns<div class="cat">${returnBin.length} in the bin · on the register</div>` : `Dana<div class="cat">On the register · returns bin is empty</div>`)
      : `E — send Dana back to the register<div class="cat">Processing returns · ${returnBin.length + emp.carry.length} to go</div>`;
    else if (aimSwitch) tip.innerHTML = `E — turn the ${ZONE_NAMES[aimSwitch]} lights ${zoneOn[aimSwitch] ? "off" : "on"}`
      + (switchPlate[aimSwitch].length > 1 ? `<br>Hold E — turn them all ${zoneOn[switchPlate[aimSwitch][0]] ? "off" : "on"}` : "");
    else if (aimStool) tip.innerHTML = stool.by ? "Dana's using the stool" : eHoldTimer ? "Lifting…" : "E — sit on the stool<br>Hold E — pick it up";
    else if (aimLock) tip.innerHTML = `E — ${frontLock.locked ? "unlock the front doors" : "lock the front doors"}`;
    else if (aimCustomer) tip.innerHTML = `${co ? (co.by === "player" && coWants("customer") ? `E — ${coWants("customer").tip()}` : co.by === "dana" ? "Dana's ringing them up" : `Next: ${coStep().tip()}`)
      : ["wait", "impatient", "angry"].includes(cust.state) ? "E — take their member card" : "E — say hi"}<div class="cat">${memberName(cust.member)} · #${cust.member.num}</div>`;
    else if (aimCutout) tip.innerHTML = eHoldTimer ? "Lifting…" : "Hold E — pick up the standee";
    else if (aimDesens && co?.by === "player" && coWants("pad")) tip.innerHTML = `E — ${coWants("pad").tip()}`;
    else if (aimDrawer) tip.innerHTML = co?.by === "player" && coWants("register") ? `E — ${coWants("register").tip()}` : "Cash drawer";
    else if (aimDesens) tip.innerHTML = held.desens ? `${held.title} · already desensitized` : `E — desensitize ${held.title}`;
    else if (aimPOS && co?.by === "player" && coWants("register")) tip.innerHTML = `E — ${coWants("register").tip()}`;
    else if (aimPOS) tip.innerHTML = gateAlarm.on ? "E — log in to the register (silence the gate alarm)" : "E — log in to the register";
    else { tip.style.display = "none"; return; }
    tip.style.display = "block";
  }
}
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("mousedown", e => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 2) {                                    // right click puts down whatever's in hand
    if (tvMenu) { tvMenu = false; return; }                // an open picture menu closes from anywhere...
    if (tvScreenHit()) { tvMenu = true; return; }          // ...but only opens with the crosshair on the screen
    if (held && held === peek) {                           // only still-being-looked-at tapes go back
      if (peekSrc === "bin") { returnBin.push(held); releaseFromHand(); refreshReturnsBin(); } else putBack();
      peek = null;
    }
    else if (heldSnack) dropSnack();
    else if (heldPopcorn && (heldPopcorn.kind === "kernel" || !heldPopcorn.used)) dropPopcorn();   // a used box only goes in the trash
    return;
  }
  if (e.button !== 0 || cutout.carried || stool.carried) return;   // arms full carrying the standee
  if (tvMenu) { const hit = tvScreenHit(); if (hit) { tvMenuClick(hit.x, hit.y); return; } }
  if (held && inspecting) { inspecting = false; peek = null; return; }  // tuck the held-up tape back in hand (it's yours now)
  if (aimSlot) { putBack(); return; }                      // slotted back into its own spot on the shelf
  if (aimReturns && returnBin.length) {                    // Returns works like a shelf: click to look, click again to take, right-click to put it back
    if (invMakeRoom()) { const t = returnBin.pop(); refreshReturnsBin(); pickup(t); peek = t; peekSrc = "bin"; }
    return;
  }
  if (aimPop && popcornStep(aimPop, true)) return;         // popcorn cart steps
  if (hovered || aimSnack) {                               // another item: whatever's in hand goes into the inventory (up to INV_MAX)
    if (invMakeRoom()) { if (hovered) { pickup(hovered); peek = hovered; peekSrc = "shelf"; } else grabSnack(aimSnack); }
    return;
  }
  if (held) { inspecting = true; return; }                 // hold it up to look at it
  if (heldSnack) { if (biteAnim <= 0) consumeSnack(); return; }   // a bite / sip (E stays free for standing up off the couch)
  if (heldPopcorn) { if (biteAnim <= 0) eatPopcorn(); return; }   // ...or a handful of popcorn
});

// held tape in hand
const handGroup = new THREE.Group();
handGroup.position.set(0.3, -0.28, -0.55); handGroup.rotation.set(0.05, -0.4, 0.06);
camera.add(handGroup); scene.add(camera);
const handBody = new THREE.Mesh(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d), mat.tapeBody);
const handArt = new THREE.Mesh(new THREE.PlaneGeometry(TAPE.d, TAPE.h),
  new THREE.MeshBasicMaterial({ color: 0x333333 }));
handArt.rotation.y = -Math.PI / 2; handArt.position.x = -0.017;
handGroup.add(handBody, handArt);
handGroup.visible = false;

// held snack in hand — same hand slot as a tape, no inspect. It's the very unit
// you clicked: same geometry + material, and its rack slot sits empty until you
// put it back (right-click)
const snackGroup = new THREE.Group();
snackGroup.position.copy(handGroup.position); snackGroup.rotation.copy(handGroup.rotation);
camera.add(snackGroup);
snackGroup.visible = false;
function grabSnack(unit) {
  showSnack(unit); unit.visible = false;
  snackLeft = snackTotal = portions(unit.userData.snack);
  snackTag();
}
function showSnack(unit) {                   // put this unit in your hand (fresh grab, or back out of the inventory)
  const p = unit.userData.snack;
  heldSnack = unit;
  // rebuild it part for part (shared geometry/materials) rather than clone():
  // clone() deep-copies userData, and a drink's parts point back at their unit
  const copy = o => {
    const c = o.isMesh ? new THREE.Mesh(o.geometry, o.material) : new THREE.Group();
    c.position.copy(o.position); c.rotation.copy(o.rotation); c.scale.copy(o.scale);
    o.children.forEach(ch => c.add(copy(ch))); return c;
  };
  const inHand = copy(unit); inHand.position.set(0, p.shape === "tube" || !p.r ? 0 : -p.h / 2, 0); inHand.rotation.set(0, 0, 0);
  snackGroup.clear(); snackGroup.add(inHand); snackGroup.visible = true;
}
function dropSnack(toss = false) {           // right-click puts an untouched one back on the shelf; opened ones only go in the trash (toss)
  if (!toss && snackLeft < snackTotal) return;
  if (toss) restock(heldSnack); else heldSnack.visible = true;
  heldSnack = null; snackGroup.visible = false; snackGroup.clear(); $("holdingTag").style.display = "none";
}
// ---- eating + drinking: E takes a bite / sip. Snacks get bites by size (volume,
// log-scaled: gum 2 ... a big chip bag 8); drinks get sips by type (always 5+).
// A finished item stays in your hand as its empty wrapper / can / bottle until
// you take it to the trash, which is also what restocks its shelf slot.
let snackLeft = 0, snackTotal = 0, biteAnim = 0, biteGroup = null, biteDrink = false;
const isDrink = p => !!p.r;
function portions(p) {
  if (isDrink(p)) return p.shape === "bottle" ? (p.kind === "Water" ? 8 : 10) : p.shape === "longneck" ? 8 : 6;
  const vol = p.shape === "tube" ? Math.PI * (p.w / 2) ** 2 * p.h : p.w * p.h * p.d;
  return Math.max(2, Math.min(8, Math.round(2 + Math.log2(vol / 3e-5))));
}
const EMPTY = { bag: "bag", box: "box", bar: "wrapper", gum: "wrapper", tube: "tube", can: "can", bottle: "bottle", longneck: "bottle" };
function snackTag() {
  const p = heldSnack.userData.snack, drink = isDrink(p);
  $("holdingTag").style.display = "block";
  $("holdingName").textContent = snackLeft
    ? `${p.kind || "Snack"} — ${p.name} · ${snackLeft} ${drink ? "sip" : "bite"}${snackLeft === 1 ? "" : "s"} left · click to ${drink ? "drink" : "eat"}`
    : `Empty ${p.name} ${EMPTY[p.shape]} · take it to the trash`;
}
function restock(unit) { setTimeout(() => { if (heldSnack !== unit) unit.visible = true; }, 30000); }   // ponytail: fixed 30s restock, no stock tracking
function consumeSnack() {
  if (!snackLeft) return;                    // finished: nothing left but the wrapper — trash it
  snackLeft--; biteAnim = 0.4; biteGroup = snackGroup; biteDrink = isDrink(heldSnack.userData.snack);
  snackTag();
}

// ---------------- popcorn: box -> scoop -> toppings (optional) -> eat ----------------
// heldPopcorn is { kind: "box", fill: 0-8 handfuls, toppings: [] } or { kind: "kernel" }
// (a single piece, grabbed bare-handed). popcornStep() is the one place the
// sequence rules live: it returns the hover tip for a station part, and with
// apply=true actually performs the step.
let heldPopcorn = null;
const TOPPINGS = { butter: "buttered", salt: "salted", sugar: "sugared" };
const popcornGroup = new THREE.Group();
popcornGroup.position.copy(handGroup.position); popcornGroup.rotation.copy(handGroup.rotation);
camera.add(popcornGroup); popcornGroup.visible = false;
const speckMat = (colors, n, r) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: makeTexture((ctx, w, h) => {
  ctx.clearRect(0, 0, w, h);
  for (let i = 0; i < n; i++) { ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, r * (0.5 + Math.random()), 0, Math.PI * 2); ctx.fill(); }
}, 256, 256) });
let popMats = null;                          // built on first use (needs popcornKit's texture)
function popcornVisual() {
  popcornGroup.clear();
  const hp = heldPopcorn;
  if (!hp) { popcornGroup.visible = false; $("holdingTag").style.display = "none"; return; }
  if (!popMats) {
    const k = popcornKit;
    popMats = {
      plain: new THREE.MeshLambertMaterial({ map: k.cornTex }),
      butter: new THREE.MeshLambertMaterial({ map: k.cornTex, color: 0xffcc55, emissive: 0x5a3a00, emissiveIntensity: 0.35 }),
      salt: speckMat(["#ffffff", "#f2f2f2"], 260, 2.2),
      sugar: speckMat(["#ffffff", "#fff4d0", "#e8f6ff"], 180, 3),
      kernel: new THREE.MeshLambertMaterial({ color: 0xfff1c8 }),
      mound: new THREE.SphereGeometry(0.05, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    };
    const kg = new THREE.IcosahedronGeometry(0.012, 1), kp = kg.attributes.position;   // lumpy popped kernel
    for (let i = 0; i < kp.count; i++) kp.setXYZ(i, kp.getX(i) * (0.8 + Math.random() * 0.5), kp.getY(i) * (0.8 + Math.random() * 0.5), kp.getZ(i) * (0.8 + Math.random() * 0.5));
    kg.computeVertexNormals(); popMats.kernelGeo = kg;
  }
  if (hp.kind === "kernel") {
    const m = new THREE.Mesh(popMats.kernelGeo, popMats.kernel); m.position.set(-0.08, 0.1, -0.05); popcornGroup.add(m);
    $("holdingName").textContent = "A piece of popcorn · click to eat";
  } else {
    popcornGroup.add(new THREE.Mesh(popcornKit.cup, popcornKit.cupMat));
    if (hp.fill > 0) {                       // mound shrinks as you eat it
      const h = 0.35 + 0.65 * hp.fill / 8;
      const mound = new THREE.Mesh(popMats.mound, hp.toppings.includes("butter") ? popMats.butter : popMats.plain);
      mound.position.y = 0.06; mound.scale.set(1, h, 1); popcornGroup.add(mound);
      for (const t of ["salt", "sugar"]) if (hp.toppings.includes(t)) {
        const o = new THREE.Mesh(popMats.mound, popMats[t]); o.position.y = 0.06; o.scale.set(1.02, h * 1.02, 1.02); popcornGroup.add(o);
      }
    }
    const tops = hp.toppings.map(t => TOPPINGS[t]).join(", ");
    $("holdingName").textContent = hp.fill ? `Popcorn${tops ? ` — ${tops}` : ""} · click to eat`
      : hp.used ? "Empty popcorn box · refill it or take it to the trash" : "Empty popcorn box";
  }
  popcornGroup.visible = true; $("holdingTag").style.display = "block";
}
function popcornStep(what, apply) {
  const hp = heldPopcorn;
  let tip, act = null;
  const full = !hp && inv.length >= INV_MAX;
  const take = v => () => { if (invMakeRoom()) heldPopcorn = v(); };   // stashes whatever's in hand into the inventory first
  if (full && (what === "boxes" || what === "corn")) tip = "Hands full";
  else if (what === "boxes") {
    if (!hp) { tip = "CLICK — take a popcorn box"; act = take(() => ({ kind: "box", fill: 0, toppings: [] })); }
    else tip = hp.kind === "kernel" ? "Eat that piece first (E)" : "You've already got a box";
  } else if (what === "corn") {
    if (!hp) { tip = "CLICK — grab a piece of popcorn"; act = take(() => ({ kind: "kernel" })); }
    else if (hp.kind === "kernel") tip = "Eat that piece first (E)";
    else if (hp.fill === 8) tip = "Your box is full";
    else { tip = hp.fill ? "CLICK — top it off" : "CLICK — scoop popcorn"; act = () => { hp.fill = 8; hp.used = true; }; }
  } else {                                   // salt / sugar / butter
    if (!hp || hp.kind === "kernel") tip = "Grab a popcorn box first";
    else if (!hp.fill) tip = "Scoop some popcorn first";
    else if (hp.toppings.includes(what)) tip = `Already ${TOPPINGS[what]}`;
    else { tip = `CLICK — add ${what}`; act = () => hp.toppings.push(what); }
  }
  if (apply && act) { act(); popcornVisual(); }
  return apply ? !!act : tip;
}
function eatPopcorn() {
  const hp = heldPopcorn;
  biteAnim = 0.4; biteGroup = popcornGroup; biteDrink = false;
  if (hp.kind === "kernel") heldPopcorn = null;
  else if (hp.fill > 0 && --hp.fill === 0) hp.toppings = [];   // last handful: an empty box, ready for a refill
  popcornVisual();
}
function dropPopcorn() { heldPopcorn = null; popcornVisual(); }

// ---------------- inventory: up to 9 things carried at once ----------------
// Only one is ever "in hand" — it lives in held / heldSnack / heldPopcorn and
// behaves exactly as before. Picking up something else stashes the in-hand
// item here (with its state: bites left, popcorn fill) and a bar of slots
// appears; 1-9 or the mouse wheel swap which one is in hand. When the in-hand
// item leaves (put back, eaten up, trashed, into the TV) the next one comes out.
const INV_MAX = 9;
const inv = [];                              // { kind: "tape"|"snack"|"popcorn", ref, left?, total?, thumb? }
let invSel = -1;                             // index of the in-hand entry; -1 = empty hand
let invEmpty = -1;                           // which empty slot is selected while the hand is empty (for the outline)
const invKind = () => held ? "tape" : heldSnack ? "snack" : heldPopcorn ? "popcorn" : null;
function invMakeRoom() {                     // before picking something new up: stash the in-hand item, or refuse at 9
  invSync();                                 // account for anything picked up since the last frame first
  if (inv.length >= INV_MAX) return false;
  invStash(); return true;
}
function invStash() {
  const e = inv[invSel]; if (!e) return;
  if (e.kind === "tape") { held = null; inspecting = false; handGroup.visible = false; }
  else if (e.kind === "snack") { e.left = snackLeft; e.total = snackTotal; e.thumb = invThumb(snackGroup); heldSnack = null; snackGroup.visible = false; snackGroup.clear(); }
  else { e.thumb = invThumb(popcornGroup); heldPopcorn = null; popcornGroup.visible = false; }
  $("holdingTag").style.display = "none";
  invSel = -1; peek = null;                  // swapping away from a tape counts as taking it
}
function invSelect(i) {
  invSync();
  if (i === invSel || i < 0 || i >= INV_MAX || biteAnim > 0) return;
  invStash();
  if (!inv[i]) { invEmpty = i; invRender(); return; }   // an empty slot: empty-handed (e.g. to eject a tape without swapping one in)
  const e = inv[i]; invSel = i;
  if (e.kind === "tape") showTape(e.ref);
  else if (e.kind === "snack") { showSnack(e.ref); snackLeft = e.left; snackTotal = e.total; snackTag(); }
  else { heldPopcorn = e.ref; popcornVisual(); }
  invRender();
}
function invSync() {                         // once a frame: notice pickups and whatever left your hand
  const kind = invKind(), ref = held || heldSnack || heldPopcorn, e = inv[invSel];
  if (e && kind === e.kind) e.ref = ref;     // same item, maybe changed in place (a popcorn refill)
  else if (e) {                              // it's gone: the next one comes to hand
    inv.splice(invSel, 1); const next = Math.min(invSel, inv.length - 1); invSel = -1;
    if (ref) { inv.push({ kind, ref }); invSel = inv.length - 1; }
    else if (next >= 0) invSelect(next);
    invRender();
  } else if (ref) {                          // a fresh pickup
    inv.push({ kind, ref, thumb: kind === "snack" ? invThumb(snackGroup) : kind === "popcorn" ? invThumb(popcornGroup) : null });
    invSel = inv.length - 1; invRender();
  }
}
// slot pictures: a tape shows its cover; snacks and popcorn get a little
// render of the actual in-hand object (a second tiny WebGL canvas, made on first use)
let thumbR = null;
const thumbScene = new THREE.Scene(), thumbCam = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
thumbScene.add(new THREE.AmbientLight(0xffffff, 1.4));
{ const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(1, 2, 3); thumbScene.add(d); }
function invThumb(group) {
  if (!group.children.length) return null;
  try {
    thumbR ||= new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    thumbR.setSize(96, 96, false);
    const o = group.clone(); o.position.set(0, 0, 0); o.rotation.set(0.35, -0.6, 0); o.visible = true;
    thumbScene.add(o);
    const box = new THREE.Box3().setFromObject(o), c = box.getCenter(new THREE.Vector3()), r = box.getSize(new THREE.Vector3()).length() / 2;
    thumbCam.position.set(c.x, c.y, c.z + r / Math.tan(THREE.MathUtils.degToRad(15)) * 1.05); thumbCam.lookAt(c);
    thumbR.render(thumbScene, thumbCam);
    thumbScene.remove(o);
    return thumbR.domElement.toDataURL();
  } catch { return null; }
}
function invRender() {
  const bar = $("invBar"), show = inv.length > 1 || (inv.length && invSel < 0);   // 2+ items, or empty-handed with something stashed
  bar.style.display = show ? "flex" : "none";
  if (!show) return;
  const sel = invSel >= 0 ? invSel : invEmpty;
  bar.innerHTML = Array.from({ length: INV_MAX }, (_, i) => {
    const e = inv[i];
    const img = !e ? "" : e.kind === "tape" ? artUrl(e.ref.art) : e.thumb;
    const wind = e?.kind === "tape" ? `<i class="wind" style="--w:${(windFrac(e.ref) * 100).toFixed(1)}%"></i>` : "";   // rewound = all green; red = how far it's played
    return `<div class="slot${i === sel ? " sel" : ""}"><span>${i + 1}</span>${img ? `<img src="${img}">` : ""}${wind}</div>`;
  }).join("");
}

// ---------------- hold a tape up to look at it ----------------
let inspecting = false;                      // true = box held up in view, false = carried in hand
let coverZoom = 1;                           // mouse-wheel zoom on the held-up cover (1-6x), reset per pickup
function releaseFromHand() {                 // clears the hand WITHOUT touching the shelf (TV insert / returns drop-off)
  held = null; inspecting = false; handGroup.visible = false; $("holdingTag").style.display = "none";
}
function pickup(tape) {                      // from a shelf slot OR out of the returns bin — either way, into your hand
  setOnShelf(tape, false);                   // gone from the shelf while it's in your hand
  showTape(tape); inspecting = true;
}
function showTape(tape) {                    // the tape in your hand (fresh pickup, or back out of the inventory)
  held = tape; inspecting = false;
  $("holdingTag").style.display = "block"; $("holdingName").textContent = tape.title;
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
  if (held) { shelveCheck(held); held.desens = false; setOnShelf(held, true); }   // back on the shelf: tag re-armed
  releaseFromHand();
}

// ---------------- the store TV (plays archive.org streams) ----------------
const video = $("vid");
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
  if (onStool) { stoolPush(); return; }
  if (aimStool && !stool.by) { stoolSit(); return; }
  if (seated) {                             // E always stands you up
    player.x = stoodAt.x; player.z = stoodAt.z; player.yaw = stoodAt.yaw; seated = false; return;
  }
  if (aimCouch) {                            // aim at the couch from any side to sit
    stoodAt = { x: player.x, z: player.z, yaw: player.yaw };
    seatAt = SEATS.reduce((a, s) => Math.abs(s.x - aimSeatX) < Math.abs(a.x - aimSeatX) ? s : a);   // cushion nearest the aim point
    seated = true; player.yaw = Math.PI; player.pitch = 0;   // facing the TV
    return;
  }
  if (cutout.carried) { cutoutPutDown(); return; }
  if (stool.carried) { stoolPutDown(); return; }
  if (aimCustomer) { custInteract(); return; }
  if (aimSwitch) { flipSwitch(aimSwitch); return; }
  if (aimEmp) { empToggle(); return; }
  if (aimLock) { setFrontLock(!frontLock.locked); toast(frontLock.locked ? "Front doors locked — no new customers" : "Front doors unlocked — open for business", true); return; }   // stays in your arms if it won't fit there
  if ((aimPOS || aimDrawer) && co?.by === "player" && coAct("register")) return;   // mid-checkout: tap the card / ring it up
  if (aimPOS) { openPOS(); return; }
  if (aimRewinder) { rewinderUse(); return; }
  if (aimBell) { dingBell(); return; }
  if (aimDesens && co?.by === "player" && coAct("pad")) return;
  if (aimDesens) { desensitize(held); return; }
  if (aimLamp) { setLamp(aimLamp, !aimLamp.userData.on); return; }   // E on an aimed lamp flips just that one
  if (aimFlap) { toggleFlap(); return; }
  if (aimDoor) { toggleDoor(aimDoor); return; }
  if (aimCooler) { coolerOpen = !coolerOpen; return; }
  if (aimTrash) {
    if (heldSnack) dropSnack(true); else if (heldPopcorn) dropPopcorn(); else return;
    trashFlapT = 0.5; return;                // swing the flap
  }
  if (aimReturns && held) {                  // drop the tape in hand off (taking one out is a click, like a shelf)
    returnBin.push(held); releaseFromHand(); refreshReturnsBin();
    return;
  }
  if (aimTV) {                               // must actually be looking at the screen
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
    return;
  }
  if (biteAnim > 0) return;                  // still mid-bite: finish chewing first
  if (heldPopcorn) eatPopcorn();             // nothing else aimed: E eats a handful (or the single piece)
  else if (heldSnack) consumeSnack();        // ...or a bite / sip of whatever snack or drink you're holding
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

// ---------------- pointer lock / title screen ----------------
let started = false;
$("titleScreen").addEventListener("click", () => {
  if ($("enterHint").textContent.startsWith("LOADING")) return;
  canvas.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && posTerm?.isOpen()) { keys.clear(); $("crosshair").hidden = true; return; }   // the mouse was freed for the terminal, not a pause
  $("titleScreen").style.display = locked ? "none" : "flex";
  $("crosshair").hidden = !locked;
  if (locked) {
    started = true;
    if (resumePlay) { const r = resumePlay; resumePlay = null; playEpisode(r.idx, r.tape); }   // restored tape: rolls now that there's been a click
    $("enterHint").textContent = "CLICK TO RESUME";
    $("titleScreen").classList.add("paused");
  } else keys.clear();
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  bloomComposer.setSize(innerWidth, innerHeight);
  finalComposer.setSize(innerWidth, innerHeight);
  bloomPass.setSize(innerWidth, innerHeight);
});

// ---------------- register terminal (pos.js) ----------------
// E at the register frees the mouse and hands the keyboard to a full-screen
// green-screen session; logging off (Esc / F10 / 0) takes you straight back
// into the store. The in-world monitor mirrors whatever's on it.
const posTex = new THREE.CanvasTexture(document.createElement("canvas"));
posTex.colorSpace = THREE.SRGBColorSpace;
// ---------------- security gate alarm ----------------
// Walk through the entry gates with a tape in hand and they trip: LEDs flash
// red and a two-tone shop alarm sounds (WebAudio, no sound file) until it's
// silenced from the register terminal — the only place that option shows up.
const gateAlarm = { on: false, armed: true, t: 0, ac: null, stop: null };   // armed: off (from the POS) = walk through freely
function startGateAlarm() {
  if (gateAlarm.on || !gateAlarm.armed) return;
  gateAlarm.on = true; gateAlarm.t = 0;
  try {
    const ac = gateAlarm.ac ||= new AudioContext(); ac.resume();
    const osc = ac.createOscillator(), g = ac.createGain();
    osc.type = "square"; g.gain.value = 0; osc.connect(g).connect(ac.destination); osc.start();
    let hi = false;
    const beep = () => { const t = ac.currentTime; hi = !hi; osc.frequency.setValueAtTime(hi ? 2600 : 2050, t); g.gain.setValueAtTime(0.045, t); g.gain.setValueAtTime(0, t + 0.2); };
    beep(); const timer = setInterval(beep, 280);
    gateAlarm.stop = () => { clearInterval(timer); osc.stop(); osc.disconnect(); };
  } catch { /* no audio: the lights still go */ }
}
function silenceGateAlarm() {
  if (!gateAlarm.on) return;
  gateAlarm.on = false; gateAlarm.stop?.(); gateAlarm.stop = null; gateLed.color.set(gateAlarm.armed ? 0x39ff7a : 0x151515);
}
function armGates(on) {                      // disarmed gates go dark and ignore tapes walking through
  gateAlarm.armed = on;
  if (gateAlarm.on) silenceGateAlarm(); else gateLed.color.set(on ? 0x39ff7a : 0x151515);
}
let gateLastZ = player.z;

const posTerm = window.createPOS({
  catalog, rented: rentedCopies, budget: SAVE?.budget,
  savedRental: c => SAVE?.rentals?.[copyKey(c)],
  replace(c) { returnBin.push(c); refreshReturnsBin(); toast(`Replacement arrived: ${c.title} · in the returns bin`, true); },
  returnBin: () => returnBin, held: () => held, playing: () => playing,
  alarm: () => gateAlarm.on, silenceAlarm: silenceGateAlarm, resetSave: () => resetSave(),
  gatesArmed: () => gateAlarm.armed, armGates,
  onRedraw(c) {
    if (posTex.image !== c) { posTex.image = c; posScreen.material.map = posTex; posScreen.material.needsUpdate = true; }
    posTex.needsUpdate = true;
  },
  onClose() {                                      // straight back into the store (Esc/F10 keydown counts as the gesture)
    const p = canvas.requestPointerLock();
    p?.catch?.(() => { $("titleScreen").style.display = "flex"; });
  },
});
posTerm.idle();
function openPOS() {
  keys.clear(); $("hoverTip").style.display = "none";
  posTerm.open();
  document.exitPointerLock();
}

// ---------------- save / restore (localStorage) ----------------
// The store remembers itself between visits: where you're standing, lights
// and lamps, doors / flap / cooler, your inventory (and which slot is in
// hand, bites left, popcorn fill), the returns bin, which copies are out on
// rental, the tape in the VCR and the last episode watched per title. (TV
// picture settings already persist on their own — see applyTv.) Saved every
// couple of seconds and on the way out; a tape that was playing sits in the
// VCR and starts its episode again on your first click into the store (a
// browser won't autoplay sound before that, and archive.org streams can't
// seek, so it's the episode — not the exact minute — that resumes).
let resumePlay = null, saveOff = false;
const snackUnits = () => [...new Set(aimables.map(o => o.userData.unit || (o.userData.snack ? o : null)).filter(Boolean))];
function saveState() {
  if (saveOff || !started) return;           // nothing worth keeping until you've been in the store
  const units = snackUnits();
  const item = (e, i) => e.kind === "tape" ? { kind: "tape", key: copyKey(e.ref) }
    : e.kind === "snack" ? { kind: "snack", i: units.indexOf(e.ref), left: i === invSel ? snackLeft : e.left, total: i === invSel ? snackTotal : e.total }
    : { kind: "popcorn", pop: e.ref };
  const data = {
    v: SAVE_V, player: { x: onStool ? stoodAt.x : player.x, z: onStool ? stoodAt.z : player.z, yaw: player.yaw, pitch: player.pitch },   // off the stool: its spot is inside a collider
    lights: zoneOn, timeOfDay: tod.i, gatesArmed: gateAlarm.armed, frontLocked: frontLock.locked, lamps: lamps.map(l => !!l.userData.on), doors: doors.map(d => d.open), flap: flapOpen, cooler: coolerOpen,
    desens: catalog.flatMap(t => [t, ...(t.copies || [])]).filter(c => c.desens).map(copyKey),
    rented: rentedCopies.map(copyKey), rentals: Object.fromEntries(rentedCopies.map(c => [copyKey(c), posTerm.rentalOf(c)])),
    lost: catalog.flatMap(t => [t, ...(t.copies || [])]).filter(c => c.lost).map(copyKey), budget: posTerm.budget(), returns: returnBin.map(copyKey), rewinder: rewinder.tape && copyKey(rewinder.tape),
    inv: inv.map(item), invSel, invEmpty,
    playing: playing && { key: copyKey(playing.tape), idx: playing.idx }, payLedger,
    cutout: { x: cutout.x, z: cutout.z, ry: cutout.ry },   // where it was last set down (one still in your arms goes back there)
    stool: { x: stool.x, z: stool.z },                      // likewise
    wound: Object.fromEntries(catalog.flatMap(t => [t, ...(t.copies || [])]).filter(c => !isRewound(c)).map(c => [copyKey(c), c.tapePos])),
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {}
}
function loadState(S) {
  if (S?.v !== SAVE_V) return;
  try {
    if (S.player) Object.assign(player, S.player);
    if (S.lights) for (const z of LIGHT_ZONES) { if (S.lights[z] === false) setZone(z, false); }
    else if (S.lightsOut) for (const z of ["front", "aisles", "lounge"]) setZone(z, false);   // an older save: lights out = the sales floor dark...
    if (S.timeOfDay != null) setTimeOfDay(S.timeOfDay, true); else if (S.lightsOut) setTimeOfDay(2, true);   // ...at night
    if (S.gatesArmed === false) armGates(false);
    if (S.frontLocked) setFrontLock(true);
    S.lamps?.forEach((on, i) => lamps[i] && setLamp(lamps[i], on));
    S.doors?.forEach((open, i) => { if (doors[i] && open !== doors[i].open) toggleDoor(doors[i]); });
    if (S.flap && !flapOpen) toggleFlap();
    coolerOpen = !!S.cooler;
    if (S.cutout) { Object.assign(cutout, S.cutout); cutoutFit(cutout.x, cutout.z, cutout.ry, cutout.box); cutout.g?.position.set(cutout.x, 0, cutout.z); cutout.g?.rotation.set(0, cutout.ry, 0); }
    if (S.stool) { Object.assign(stool, S.stool); stoolFit(stool.x, stool.z, stool.box); stool.g.position.set(stool.x, 0, stool.z); }
    payLedger.push(...(S.payLedger || []));
    for (const [k, pos] of Object.entries(S.wound || {})) { const c = copyByKey(k); if (c) c.tapePos = pos; }
    for (const k of S.desens || []) { const c = copyByKey(k); if (c) c.desens = true; }
    for (const k of S.lost || []) { const c = copyByKey(k); if (c) { c.lost = true; setOnShelf(c, false); } }
    for (const c of (S.returns || []).map(copyByKey).filter(Boolean)) { setOnShelf(c, false); returnBin.push(c); }
    refreshReturnsBin();
    const rw = S.rewinder && copyByKey(S.rewinder);
    if (rw) { setOnShelf(rw, false); rewinderLoad(rw); }   // picks up rewinding from wherever it had got to
    const units = snackUnits();
    for (const it of S.inv || []) {          // re-pick each item up in order, exactly as if you'd grabbed it
      const c = it.kind === "tape" && copyByKey(it.key), u = it.kind === "snack" && units[it.i];
      if ((it.kind === "tape" && !c) || (it.kind === "snack" && !u) || !invMakeRoom()) continue;
      if (c) { setOnShelf(c, false); showTape(c); }
      else if (u) { u.visible = false; showSnack(u); snackLeft = it.left; snackTotal = it.total; snackTag(); }
      else { heldPopcorn = it.pop; popcornVisual(); }
      invSync();
    }
    if (inv.length) invSelect(S.invSel >= 0 ? S.invSel : S.invEmpty >= 0 ? S.invEmpty : inv.length - 1);
    const pt = S.playing && copyByKey(S.playing.key);
    if (pt) {                                 // back in the VCR, case on the coffee table; rolls on your first click in
      setOnShelf(pt, false);
      playing = { tape: pt, idx: S.playing.idx, eps: pt.seasons[0].episodes };
      showTableBox(pt); resumePlay = playing;
    }
  } catch (err) { console.warn("VaultBuster: couldn't restore the saved store", err); }
}
function resetSave() { saveOff = true; try { localStorage.removeItem(SAVE_KEY); } catch {} location.reload(); }
loadState(SAVE);
gateLastZ = player.z;                        // restored position isn't a walk through the gates
setInterval(saveState, 2000);
addEventListener("beforeunload", saveState);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveState(); });

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let clockT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (keys.size) lastActive = performance.now();                          // walking counts as moving
  if (trashFlapT > 0) { trashFlapT = Math.max(0, trashFlapT - dt); trashFlap.rotation.x = 1.1 * Math.sin((1 - trashFlapT / 0.5) * Math.PI); }    // push flap swings in (bottom edge into the bin) and back
  if (biteGroup) {                                                          // bite / sip: up to the mouth and back
    biteAnim = Math.max(0, biteAnim - dt);
    const k = Math.sin((1 - biteAnim / 0.4) * Math.PI), drink = biteDrink;
    biteGroup.position.set(handGroup.position.x - 0.22 * k, handGroup.position.y + 0.2 * k, handGroup.position.z + 0.12 * k);
    biteGroup.rotation.set(handGroup.rotation.x + (drink ? 1.0 : 0.35) * k, handGroup.rotation.y, handGroup.rotation.z);
    if (!biteAnim) biteGroup = null;
  }
  document.body.classList.toggle("idle", performance.now() - lastActive > 2500);
  clockT += dt;
  for (const b of marquee) {              // marquee chase around the posters
    const v = 0.5 + 0.5 * Math.sin(clockT * 7 + b.phase);
    b.mat.color.setRGB(0.3 + 0.7 * v, 0.27 + 0.62 * v, 0.03 + 0.09 * v);
  }
  exteriorTick(dt);
  const cloudSpan = (STORE.x + 20) - (WALL_L - 20);
  for (const c of exteriorClouds) {       // a slow drift so the sky doesn't feel static
    c.position.x += dt * 0.15;
    if (c.position.x > STORE.x + 20) c.position.x -= cloudSpan;
  }
  if (!playing) updateScreensaver(dt);
  if (playing || tvMenu) updateVideoFrame();
  rewinderTick(dt);
  tvPowerLed.material.color.set(tvLight.base ? 0x3dff6a : 0x551008);   // green while a tape plays, dim red standby
  {                                            // VCR clock: blinking 12:00 (nobody ever set it), PLAY while a tape runs
    const txt = playing ? (video.paused ? "PAUSE" : "PLAY") : (Math.floor(clockT * 1.6) % 2 ? "12:00" : "");
    if (txt !== vcrDisplay.shown) {
      const c = vcrDisplay.ctx; vcrDisplay.shown = txt;
      c.fillStyle = "#050807"; c.fillRect(0, 0, 128, 40);
      c.fillStyle = "#6dffb0"; c.font = "bold 28px 'Courier New', monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(txt, 64, 21);
      vcrDisplay.tex.needsUpdate = true;
    }
  }
  if (desensFlash > 0) { desensFlash -= dt; desensLed.material.color.set(desensFlash > 0 ? 0x2bff6a : 0xff3020); }
  if (playing && video.currentTime > 0 && !video.paused)   // the tape winds on
    playing.tape.tapePos = { ep: playing.idx, t: video.currentTime, d: isFinite(video.duration) ? video.duration : undefined };
  if (!playing) screenMesh.material = tvMenu ? videoMat : screensaverMat;   // menu over a blank screen when no tape's in
  if (tvMenu) {                                   // what the crosshair (the remote) is pointing at on the menu
    const hit = tvScreenHit();
    tvHover = hit ? tvMenuHit(hit.x, hit.y) : null;
  }   // pauses while a tape's actually in, like a real screensaver would
  lightingTick(dt);
  if (cashDrawer) cashDrawer.position.z += ((4 - 0.35 - 0.01 - drawerOpen * 0.26) - cashDrawer.position.z) * Math.min(1, dt * 12);   // till slides out toward the clerk
  for (const t of switchToggles) t.mesh.rotation.x += ((zoneOn[t.zone] ? -0.32 : 0.32) - t.mesh.rotation.x) * Math.min(1, dt * 25);   // rocker snaps up/down
  // the TV(s) read as real light sources reaching the couch/floor/shelves
  // nearby — not just bloom's screen-only glow, which doesn't light anything
  // kept fairly short: this is what lights the table's near/top faces up
  // close, not what lights the floor — the floor's falloff (and the table's
  // and couch's shadows) is owned by the decals below, which can actually
  // respect where the furniture blocks it; a real point light can't
  {                                        // TV light: ease the zone colors toward the latest sample, scale for lights on/out
    const k = 1 - Math.exp(-dt / 0.08), zc = TVU.uTvZoneC.value;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < 27; i += 3) {
      zc[i] += (tvZoneTarget[i] - zc[i]) * k; zc[i + 1] += (tvZoneTarget[i + 1] - zc[i + 1]) * k; zc[i + 2] += (tvZoneTarget[i + 2] - zc[i + 2]) * k;
      r += zc[i]; g += zc[i + 1]; b += zc[i + 2];
    }
    tvLight.avg.setRGB(r / 9, g / 9, b / 9);
    const on = tvLight.base * (lightsOut ? 1 : 0.35);    // the fluorescents wash most of it out
    TVU.uTvGain.value = on * TV_GAIN;
    TVU.uTvAmb.value.copy(tvLight.avg).multiplyScalar(on * TV_AMB);
    tvBackGlow.color.copy(tvLight.avg); tvBackGlow.intensity = tvLight.base * (lightsOut ? 0.8 : 0.3);   // a hint of bleed, not a second light
    const crtBase = tvLight.base ? 0.9 : 0;   // ceiling CRTs tint/dim with whatever's actually playing
    crtGlows.forEach(cg => { cg.color.copy(tvLight.avg); cg.intensity = crtBase * (lightsOut ? 1.8 : 1); });
    if (tvBake) { const t0 = performance.now(); while (performance.now() - t0 < 6) if (tvBake.next().done) { tvBake = null; break; } }   // startup shadow bake, a slice per frame
  }
  for (const p of lampPools) p.material.opacity = lightsOut ? 1 : 0;   // overhead fluorescents drown the lamps' own floor pools out entirely
  flapPivot.rotation.z += ((flapOpen ? Math.PI / 2 * 0.97 : 0) - flapPivot.rotation.z) * Math.min(1, dt * 6);   // leaf lifts up against the wall
  flapGate.rotation.y += ((flapOpen ? Math.PI / 2 : 0) - flapGate.rotation.y) * Math.min(1, dt * 5);          // gate swings in behind the counter
  coolerDoor.rotation.y += ((coolerOpen ? 1.75 : 0) - coolerDoor.rotation.y) * Math.min(1, dt * 5);        // cooler door swings out ~100°
  coolerThermo.tick(dt);
  for (const d of doors) {                   // doors ease open/closed; a locked one rattles briefly when tried
    d.a += ((d.open ? d.openA : 0) - d.a) * Math.min(1, dt * 5);
    d.rattle = Math.max(0, d.rattle - dt);
    d.pivot.rotation.y = d.base + d.a + (d.rattle ? 0.012 * Math.sin(d.rattle * 70) : 0);
  }
  move(dt);
  if (inv.some(e => e.kind === "tape" && !e.ref.desens) && Math.abs(player.x) < 2 && (gateLastZ - GATE_Z) * (player.z - GATE_Z) < 0) startGateAlarm();   // carried a tape through the gates
  gateLastZ = player.z;
  if (gateAlarm.on) { gateAlarm.t += dt; gateLed.color.set(Math.floor(gateAlarm.t * 5) % 2 ? 0x2a0000 : 0xff1a1a); }
  stoolTick(dt);
  meTick(dt);
  if (onStool) camera.position.copy(me.rig.head.getWorldPosition(meEye)).add(meEye.set(-Math.sin(stool.angle) * 0.06, 0.03, -Math.cos(stool.angle) * 0.06));   // over the collar, a touch forward of it
  else if (seated) camera.position.copy(me.rig.head.getWorldPosition(meEye)).add(meEye.set(0, 0.03, 0.06));   // eyes just above the collar, a touch forward
  else {
    eyeY += ((keys.has("KeyC") ? 1.06 : 1.65) - eyeY) * Math.min(1, dt * 10);   // crouched: just above the squatting body's collar
    camera.position.set(player.x, eyeY, player.z);
  }
  if (!seated) seatFov = 70;                     // walking resets the couch zoom
  const fovTarget = seated ? seatFov : 70;
  if (Math.abs(camera.fov - fovTarget) > 0.01) { // eased so it feels like leaning in/out
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
  invSync();
  cutoutCarryTick();
  stoolCarryTick();
  custTick(dt);
  empTick(dt);
  pickHover();
  if (held) {                               // held-up view is a DOM overlay now, so it can't clip shelves
    handGroup.visible = !inspecting && !coHand.visible;   // hands full with a sale: your own tape waits        // 3D box only for the carried-at-your-side pose
    handGroup.position.set(0.3, -0.28, -0.55); handGroup.rotation.set(0.05, -0.4, 0.06); handGroup.scale.setScalar(1);
  }
  $("inspect").style.display = inspecting ? "flex" : "none";

  const showTvHint = started && !inspecting
    && (seated || onStool || aimTV || aimCouch)
    && document.pointerLockElement === canvas;
  $("tvHint").style.display = showTvHint ? "block" : "none";
  if (showTvHint) $("tvHint").textContent = onStool
    ? "Press E to spin · tap it fast to spin harder · WASD to get up"
    : tvMenu
    ? "Click to choose · wheel adjusts a slider · right-click closes"
    : seated
    ? "Press E to stand up · right-click the screen for picture settings"
    : aimCouch
      ? "Press E to sit on the couch"
      : held
        ? `Press E to insert “${held.title}” into the TV`
        : (playing ? "Press E to eject the tape · right-click for picture settings" : "Pick up a tape from the shelves to play it here · right-click for picture settings");
  renderWithBloom();
});
window.__t = {
  catalog, pickup, onE, player,
  held: () => held, playing: () => playing, returnBin,
  setAim: v => { aimTV = v; },
  flapOpen: () => flapOpen, aimFlap: () => !!aimFlap, pickHover,
  doors, toggleDoor, colliders, cutout, cutoutPickUp, cutoutPutDown, cutoutCarryTick, cutoutSpot: () => cutoutSpot,
  setFrontLock, me, stool, stoolPickUp, stoolPutDown, stoolSit, stoolPush, stoolStand, onStool: () => onStool, sitOn: i => { seatAt = SEATS[i]; seated = true; player.yaw = Math.PI; player.pitch = 0; },
  emp, cust, empTick, custTick, empToggle, custSpawn, custGo, CUST_COUNTER, setOnShelf, refreshReturnsBin, rewinder, posTerm, rentedCopies, custInteract, custGone, snackSpots, custDone,
};
