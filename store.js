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
const BOH_DOORS = { store: 9.7, breakroom: 5.0, restroom: 9.65, future: 28.9, closet: 28.9 };   // (future, closet: along z, in the hall's west and east walls)
const closetBulb = { mat: null };                 // the closet's bare bulb (its glass goes warm white when the "closet" zone is on)
const CLOSET = { x1: 12.6, doorW: 0.8 };                      // janitor's closet: off the hall's east end, out past the building line to x1 (its back wall)
const trashBins = {};                            // the bins, registered as they're built (see "trash" further down)
const chute = { door: null, t: 0, at: [0, 0, 0], stand: null };   // the break room's trash chute (likewise)
const bath = { water: null, waterY: 0, stream: null, toiletAt: null, sinkAt: null, flushT: 0, tap: false, seat: null };   // the restroom's working parts (built with it; see bathTick)   // opening centers along their walls
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
const renderer = new THREE.WebGLRenderer({ antialias: false });   // (the scene's drawn into the composers' targets, which aren't multisampled: canvas MSAA only ever touched the final copy)
renderer.debug.checkShaderErrors = !!navigator.webdriver;          // checking forces each new shader to finish compiling there and then (a hitch); on for the tests only
renderer.setSize(innerWidth, innerHeight);
const LOWMEM = document.documentElement.classList.contains("touch");   // phones / tablets (touch.js): iOS caps a page's canvas memory, so go lighter
renderer.setPixelRatio(Math.min(devicePixelRatio, LOWMEM ? 1.5 : 2));
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
  uBoh: { value: new THREE.Vector4(1, 1, 1, 0) },    // hall, break room, restroom switches, the closet bulb
  uFloorBox: { value: new THREE.Vector4() },         // sales floor: x0, x1, z1 (back wall), ceiling
  uBohBox: { value: new THREE.Vector4() },           // back of house: x0, x1, hall|rooms z, z1
  uBohSplit: { value: new THREE.Vector2() },         // break room | restroom x, ceiling
  uInSky: { value: new THREE.Color() }, uInGround: { value: new THREE.Color() }, uInAmb: { value: new THREE.Color() },
  uInDirC: { value: new THREE.Color() }, uInDir: { value: new THREE.Vector3() },   // one room's worth of fluorescents
  uSunSky: { value: new THREE.Color() }, uSunGround: { value: new THREE.Color() }, uSunC: { value: new THREE.Color() }, uSunDir: { value: new THREE.Vector3() },
  uMoonSky: { value: new THREE.Color() }, uMoonGround: { value: new THREE.Color() }, uMoonC: { value: new THREE.Color() }, uMoonDir: { value: new THREE.Vector3() },
  uDayC: { value: new THREE.Color() }, uNightC: { value: new THREE.Color() },       // what comes in through the storefront glass by day / by night
  uThLight: { value: new THREE.Vector2(1, 1) },      // x = lobby switch, y = theater house-lights switch
  uLobbyBox: { value: new THREE.Vector4() },         // movie lobby: x0, x1, z0, z1
  uThBox: { value: new THREE.Vector4() },            // auditorium: x0, x1, z0, z1
  uThScreenP: { value: new THREE.Vector3(-2.87, 1.05, 45.8) }, // theater screen center for live bounce
  uThSconce: { value: 1 },                           // auditorium wall sconces 0..1: up between films, fading out once one plays
  // light spilling through doorways into a darker room next door (see spillTick), live ones first (uSpillN): per spill,
  // the light it comes from (xyz, inside the lit room) + reach past the door (w), its color x strength, the box it
  // lands in (x0, x1, z0, z1), and the door opening (plane: 0 z = const, 1 x = const; that const; center along it; half width)
  uSpillN: { value: 0 },
  uSpillD: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
  uSpillP: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
  uSpillC: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
  uSpillB: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) },
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
    float win = exp(-P.z / 9.0);
    float facing = 0.75 + 0.35 * max(-rN.z, 0.0) + 0.2 * max(rN.y, 0.0);
    rl = (uZone.x * w1 + uZone.y * w2 + uZone.z * w3) * fl
       + (day * uDayC + (1.0 - day) * uNightC) * (0.42 + 0.9 * win) * facing;
  } else if (P.x > uBohBox.x && P.x < uBohBox.y && P.z >= uFloorBox.z && P.z < uBohBox.w && P.y < uBohSplit.y + 0.05) {
    bool closet = P.x > uFloorBox.y && P.z < uBohBox.z;   // the janitor's closet: one bare bulb (uBoh.w), warm
    float lvl = closet ? 0.8 * uBoh.w : P.z < uBohBox.z ? uBoh.x : (P.x < uBohSplit.x ? uBoh.y : uBoh.z);
    rl = (0.03 + 0.97 * lvl) * fl * (closet ? vec3(1.12, 0.95, 0.74) : vec3(1.0));
  } else if (P.x > uLobbyBox.x && P.x < uLobbyBox.y && P.z >= uLobbyBox.z && P.z < uLobbyBox.w && P.y < uBohSplit.y + 0.05) {
    rl = (0.04 + 0.96 * uThLight.x) * fl * vec3(1.08, 0.93, 0.80);
  } else if (P.x > uThBox.x && P.x < uThBox.y && P.z >= uThBox.z && P.z < uThBox.w && P.y < uFloorBox.w + 0.1) {
    vec3 thFl = (0.025 + 0.30 * uThLight.y + 0.12 * uThSconce) * fl * vec3(1.15, 0.82, 0.55);   // house lights + a low warm sconce wash
    vec3 sL = uThScreenP - P; float sd2 = dot(sL, sL); sL *= inversesqrt(sd2);
    float sCos = max(sL.z, 0.0) * (0.35 + 0.65 * max(dot(rN, sL), 0.0));
    vec3 scrGlow = uTvGain * (uTvZoneC[4] * 4.2 + uTvAmb * 2.4) * sCos / (1.0 + 0.025 * sd2);
    rl = thFl + scrGlow;
  } else {
    vec3 sun = mix(uSunGround, uSunSky, 0.5 * rN.y + 0.5) + uSunC * max(dot(rN, uSunDir), 0.0);
    vec3 moon = mix(uMoonGround, uMoonSky, 0.5 * rN.y + 0.5) + uMoonC * max(dot(rN, uMoonDir), 0.0);
    rl = mix(moon, sun, day);
  }
  vec3 spill = vec3(0.0);                          // a lit room's light through its doorway, shaped by the opening, fading into the dark one
  for (int i = 0; i < 8; i++) {
    if (i >= uSpillN) break;                       // (all lit, nothing spills: no cost)
    vec4 sb = uSpillB[i];
    if (P.x < sb.x || P.x > sb.y || P.z < sb.z || P.z > sb.w) continue;
    vec4 sp = uSpillP[i], dd = uSpillD[i];
    bool xPl = dd.x > 0.5;
    float sA = xPl ? sp.x : sp.z, t = (dd.y - sA) / ((xPl ? P.x : P.z) - sA);
    if (t <= 0.0 || t >= 1.0) continue;
    vec3 Q = sp.xyz + (P - sp.xyz) * t;            // where the light's path crosses the doorway's plane
    float past = length(P - Q), soft = 0.025 + 0.035 * past;
    float edge = max(abs((xPl ? Q.z : Q.x) - dd.z) - dd.w, max(-Q.y, Q.y - ${DOOR_H.toFixed(2)}));
    float k = clamp(1.0 - past / sp.w, 0.0, 1.0);
    spill += uSpillC[i].rgb * (1.0 - smoothstep(-soft, soft, edge)) * k * k * (0.35 + 0.65 * max(dot(rN, normalize(sp.xyz - P)), 0.0));
  }
  rl = max(rl, spill * fl);
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
      uniform vec4 uZone, uBoh, uFloorBox, uBohBox, uLobbyBox, uThBox; uniform vec2 uBohSplit, uThLight; uniform vec3 uThScreenP; uniform float uThSconce;
      uniform vec4 uSpillP[8], uSpillC[8], uSpillB[8], uSpillD[8]; uniform int uSpillN;
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
bloomComposer.setPixelRatio(renderer.getPixelRatio() / 2);   // the glow pass at half resolution: a quarter of the pixels, and it's blurred anyway
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
// a light at zero intensity still costs every lit pixel its full shading
// loop, so switched-off lights (ceiling CRT glows with nothing playing, the
// lot lights by day, a dark zone) leave the scene: hidden once they've been
// off a second (so a flickering warm-up doesn't churn shader programs), back
// the moment they come on
let sceneLights = null;
cullDarkLights.n = 0;
function cullDarkLights(dt) {
  if (!sceneLights || ++cullDarkLights.n % 120 === 0) {   // re-gathered now and then: some lights arrive after startup
    sceneLights = []; scene.traverse(o => o.isLight && !o.isAmbientLight && !o.isHemisphereLight && sceneLights.push(o));
  }
  for (const l of sceneLights) {
    if (l.intensity > 0) { l.userData.darkT = 0; l.visible = true; }
    else if ((l.userData.darkT = (l.userData.darkT || 0) + dt) > 1) l.visible = false;
  }
}
// in the glow pass, non-glowing meshes only matter as blockers (drawn black so
// glow behind them is hidden). Small ones — snacks, cans, knobs, fingers —
// block next to nothing, so that pass skips them outright: ~a thousand fewer
// draw calls a frame in the store
const occScale = new THREE.Vector3(), skippedInBloom = [];
function tinyOccluder(o) {
  if (o.userData.tinyOcc === undefined) {
    const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
    o.getWorldScale(occScale);
    o.userData.tinyOcc = !o.isInstancedMesh && g.boundingSphere.radius * Math.max(occScale.x, occScale.y, occScale.z) < 0.12;
  }
  return o.userData.tinyOcc;
}
scene.matrixWorldAutoUpdate = false;              // world matrices: worked out once a frame here, not again by each of the two passes
function renderWithBloom() {
  scene.updateMatrixWorld();
  scene.traverse(o => {
    if (!o.isMesh || bloomLayer.test(o.layers)) return;
    if (o.visible && tinyOccluder(o)) { o.visible = false; skippedInBloom.push(o); return; }
    hiddenMaterials.set(o, o.material); o.material = o.userData.clearToBloom ? clearMaterial : darkMaterial;
  });
  bloomComposer.render();
  hiddenMaterials.forEach((m, o) => o.material = m);
  hiddenMaterials.clear();
  for (const o of skippedInBloom) o.visible = true;   // only ever skipped while visible, so this puts it back as it was
  skippedInBloom.length = 0;
  finalComposer.render();
}

const catalog = window.VAULT_CATALOG || [];
// the saved store from last visit (see "save / restore" near the end) — read
// up front because the shelves need it while they're being stocked
// three save slots; slot 1 keeps the original key (so a store saved before slots is slot 1). The
// active one is remembered; switching slots (or starting a new store in one) reloads the page into it
const SLOTS = 3, slotKey = n => n === 1 ? "vaultbuster-save" : `vaultbuster-save-${n}`;
const SLOT = (() => { try { const n = +localStorage.getItem("vaultbuster-slot"); return n >= 1 && n <= SLOTS ? n : 1; } catch { return 1; } })();
const SAVE_KEY = slotKey(SLOT);
// settings (per browser, not per store): see the title menu's SETTINGS
const SETTINGS = { sound: 100, sens: 100, invertY: false, shiftMin: 21, ...(() => { try { return JSON.parse(localStorage.getItem("vaultbuster-settings")) || {}; } catch { return {}; } })() };
const SAVE_V = 3;                            // v1 keyed tapes by id (every season of a show shares it); v2 by catalog position (shifts when tapes are added)
const SAVE = (() => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s?.v === SAVE_V ? s : null; } catch { return null; } })();
// the game mode. Simulation: a bare-bones store you build up (no staff, no
// theater, no popcorn machine, part of the library) out of what it earns.
// Sandbox: everything open and a big budget. Saves from before modes are sandbox
const MODE = SAVE?.mode === "simulation" ? "simulation" : "sandbox", SIM = MODE === "simulation";
const rep = { v: SAVE?.rep ?? 50 };             // store reputation 0..100 (see repStars)
const growth = { pending: SAVE?.signups ?? (SIM ? 2 : 0), prospects: SAVE?.prospects ?? 0, pT: 30 };   // (a new simulation: a couple of curious locals on day one)  // simulation: new members who'll sign up tomorrow morning (word of mouth, ads, what you've built)
const upg = { ...SAVE?.upg };                   // upgrades bought (see UPGRADES)
// a copy's stable id across reloads: "<tape id>#<season>:<n>", n = its place in
// [tape, ...tape.copies] (shelving is deterministic, so n holds every load).
// id + season is unique per tape; the id alone isn't (every season of a show shares it)
const tapeName = t => /^Season/.test(t.seasons?.[0]?.label || "") ? `${t.title} (${t.seasons[0].label})` : t.title;   // which tape of a show: "Cheers (Season 3)"
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
// an extra copy of a title inherits everything from the first copy (Object.create),
// so its per-copy state has to be its own from the start — otherwise desensitizing,
// rewinding or renting the first copy would quietly do it to all of them
const newCopy = t => Object.assign(Object.create(t), { desens: false, lost: false, offShelf: false, tapePos: null, rental: null });
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
// the counter rewinders (two, either side of the returns tote): E puts the
// tape in hand in; it winds back over up to REWIND_SECS (scaled by how far
// it's wound) with a motor whir, clunks when done, and E takes it out — early,
// it comes out only partly rewound. Each machine is its own object in rewinders
const REWIND_SECS = 10;
let rewindAc = null;
function rewinderLoad(rw, tape, who = "you") {
  Object.assign(rw, { tape, f0: windFrac(tape), t: 0, done: false });
  rw.dur = Math.max(1, rw.f0 * REWIND_SECS) * (upg.rewinders ? 0.5 : 1) * Math.max(0.5, 1 - 0.025 * (lv(who, "dex") - 1)) * (has(who, "dex", 5) ? 0.7 : 1);   // (DEX: threaded and running faster; Quick Thread)
  if (has(who, "dex", 10) && Math.random() < 0.2) { rw.dur = 0.15; if (who === "you") toast("Lucky Spool: rewound in a blink!", true); }
  if (who !== "load") gainXp(who, "dex", 3);
  rw.tapeMesh.material = tape.sideMat || mat.tapeBody; rw.tapeMesh.visible = true;
  if (rw.f0 > 0) rewinderSound(rw, true); else rewinderFinish(rw, false);
}
function rewinderEmpty(rw) {                  // the tape's out: machine idle
  rewinderSound(rw, false); rw.tape = null; rw.tapeMesh.visible = false; rw.led.material.color.set(0x222222);
}
function rewinderFinish(rw, clunk = true) {
  rw.done = true; rewinderSound(rw, false); rw.led.material.color.set(0x2bff6a);
  if (clunk) try {                            // the eject thunk
    const ac = rewindAc ||= new AudioContext(), o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime;
    o.type = "square"; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.09);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.13);
  } catch {}
}
function rewinderSound(rw, on) {
  if (!on) { rw.snd?.(); rw.snd = null; return; }
  rw.led.material.color.set(0xff3b1f);
  try {                                       // little motor: a soft hum, tape hiss, and the reel's rattle, speeding up a touch as the tape runs down
    const ac = rewindAc ||= new AudioContext(); ac.resume();
    const t = ac.currentTime, end = t + rw.dur, out = ac.createGain();
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
    rw.snd = () => { src.forEach(o => o.stop()); out.disconnect(); };
  } catch {}
}
function rewinderTick(dt) {
  for (const rw of rewinders) {
    if (!rw.tape || rw.done) continue;
    rw.t += dt;
    const p = Math.min(1, rw.t / rw.dur);
    setWindFrac(rw.tape, rw.f0 * (1 - p));
    if (p >= 1) rewinderFinish(rw);
  }
}
function rewinderUse(rw) {                    // E on a rewinder
  if (rw.tape) {                              // take it out (done, or early)
    if (!invMakeRoom()) { toast("Hands full"); return; }
    const t = rw.tape;
    rewinderEmpty(rw);
    showTape(t);
  } else if (held) { const t = held; releaseFromHand(); rewinderLoad(rw, t); }
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

// ---------------- canvas texture helpers ----------------
function makeTexture(draw, w, h) {
  const S = LOWMEM && w >= 512 ? 0.5 : 1;        // phones: big signs drawn at half scale (iOS caps a page's canvas memory)
  const c = document.createElement("canvas"); c.width = Math.round(w * S); c.height = Math.round(h * S);
  const ctx = c.getContext("2d"); ctx.scale(S, S);
  draw(ctx, w, h);
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
let floorHeightAt = () => 0;                // floor height under (x, z): 0 everywhere but the theater's stepped rows (set with the theater)
let panelMats = [];                        // ceiling panel groups, per switch zone — dark when switched off, flicker independently on warm-up
let theaterScreenMesh = null;
let projBeamMat = null;
let thSconceMat = null;                    // the auditorium wall sconces' shades (see the main loop)
const beamU = { uBeamZ: { value: TVU.uTvZoneC.value }, uBeamOn: { value: 0 } };   // the beam reads the TV light's 3x3 picture colors straight from the shared array
const theaterSeats = [];
// the folding theater seats: one InstancedMesh, a hinge per seat. a: 0 = down, 1 = folded up against the back
let thCushions = null, thSeatFolds = [];
const thSeatDummy = new THREE.Object3D();
function thSeatPose(i) {
  const h = thSeatFolds[i];
  thSeatDummy.position.set(h.x, h.y, h.z); thSeatDummy.rotation.set(-h.a * 1.45, 0, 0); thSeatDummy.updateMatrix();
  thCushions.setMatrixAt(i, thSeatDummy.matrix);
}
// sprung: pushed down while someone's on it, snaps back up (with a little
// bounce off the back) the moment they stand
function thSeatTick(dt) {
  if (!thCushions) return;
  dt = Math.min(dt, 0.05);                        // a stalled frame mustn't fling the springs
  let moved = false;
  thSeatFolds.forEach((h, i) => {
    const sat = (seated && seatAt === h.seat) || custs.some(k => k.thSeat === h.seat && (k.state === "thSitDown" || k.state === "thWatch"));
    const want = sat ? 0 : 1;
    if (h.a === want && !h.v) return;
    h.v += (140 * (want - h.a) - 9 * h.v) * dt; h.a += h.v * dt;
    if (h.a > 1) { h.a = 1; h.v *= -0.35; }        // clack against the back
    if (h.a < 0) { h.a = 0; h.v *= -0.2; }         // bottoms out on its stop
    if (Math.abs(want - h.a) < 0.002 && Math.abs(h.v) < 0.05) { h.a = want; h.v = 0; }
    thSeatPose(i); moved = true;
  });
  if (moved) thCushions.instanceMatrix.needsUpdate = true;
}

// the light switch zones: three along the sales floor, then the back of house rooms
const LIGHT_ZONES = ["front", "aisles", "lounge", "hall", "breakroom", "restroom", "lobby", "theater", "closet"];
const ZONE_NAMES = { front: "front", aisles: "aisle", lounge: "lounge", hall: "back hall", breakroom: "break room", restroom: "restroom", lobby: "theater lobby", theater: "auditorium", closet: "closet" };
const ZONE_LABELS = { front: "FRONT", aisles: "AISLES", lounge: "LOUNGE", hall: "HALL", breakroom: "LIGHTS", restroom: "LIGHTS", lobby: "LOBBY", theater: "HOUSE", closet: "LIGHT" };
function lightZoneAt(x, z) {
  if (z >= BOH.z1) return "theater";
  if (z > STORE.z && x < BOH.x0) return "lobby";
  if (z > STORE.z) return z < BOH.hallZ ? (x > STORE.x ? "closet" : "hall") : x < BOH.splitX ? "breakroom" : "restroom";
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
// push: a regal double-acting cinema door — no latch, no E: it swings away
// from whoever walks into it and springs shut behind them (pushDoorTick).
// porthole: a round window at head height, ringed in gold
const doorGold = new THREE.MeshPhongMaterial({ color: 0xc9a227, specular: 0xffe2a0, shininess: 80 });
const doorGlass = new THREE.MeshLambertMaterial({ color: 0x8a9aae, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const PORT = { y: 1.6, r: 0.17 };
const theaterDoorMat = new THREE.MeshLambertMaterial({ color: 0x5a1020 });   // maroon
function makeDoor({ at, c, alongX, hinge, swing, locked = false, leafMat, signs = [], push = false, porthole = false, w = DOOR_W }) {
  const W = w, base = alongX ? 0 : -Math.PI / 2;   // leaf is built along local x; local +z is world +z (alongX) or world -x
  const toLocal = side => alongX ? side : -side;
  const pivot = new THREE.Group();
  if (alongX) pivot.position.set(c + hinge * W / 2, 0, at); else pivot.position.set(at, 0, c + hinge * W / 2);
  pivot.rotation.y = base; scene.add(pivot);
  const lx = -hinge * W / 2;                    // leaf center, pivot-local
  let leaf;
  if (porthole) {                               // the window's a real hole: the leaf is an extruded slab with a round cut
    const LW = W - 0.03, LH = DOOR_H - 0.02, sh = new THREE.Shape();
    sh.moveTo(-LW / 2, 0); sh.lineTo(LW / 2, 0); sh.lineTo(LW / 2, LH); sh.lineTo(-LW / 2, LH); sh.lineTo(-LW / 2, 0);
    const hole = new THREE.Path(); hole.absarc(0, PORT.y - 0.01, PORT.r, 0, Math.PI * 2, true); sh.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.045, bevelEnabled: false, curveSegments: 24 }); g.translate(0, 0, -0.0225);
    leaf = new THREE.Mesh(g, leafMat); leaf.position.set(lx, 0.01, 0); pivot.add(leaf);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(PORT.r, 32), doorGlass); glass.position.set(lx, PORT.y, 0); pivot.add(glass);
    if (push) aimBlockers.push(glass);          // you can see through it, not reach through it
  } else {
    leaf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, DOOR_H - 0.02, 0.045), leafMat);
    leaf.position.set(lx, DOOR_H / 2, 0); pivot.add(leaf);
  }
  const hx = -hinge * (W - 0.12);               // hardware sits at the latch edge
  if (push) for (const f of [-1, 1]) {          // both faces: gold border inset from the edge, brass kick plate, a push plate where the lever would be
    const g = (w, h, d, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), doorGold); m.position.set(x, y, f * (0.0225 + d / 2)); pivot.add(m); };
    const bw = W - 0.03 - 0.14, bh = DOOR_H - 0.02 - 0.14;
    g(bw, 0.022, 0.006, lx, 0.08); g(bw, 0.022, 0.006, lx, 0.08 + bh);
    g(0.022, bh, 0.006, lx - bw / 2, 0.08 + bh / 2); g(0.022, bh, 0.006, lx + bw / 2, 0.08 + bh / 2);
    g(W - 0.03 - 0.1, 0.22, 0.004, lx, 0.15);    // kick plate
    g(0.1, 0.3, 0.004, hx, 1.1);                  // push plate
    if (porthole) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(PORT.r + 0.01, 0.016, 10, 40), doorGold);
      ring.position.set(lx, PORT.y, f * 0.024); pivot.add(ring);
    }
  }
  else for (const f of [-1, 1]) {
    const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 14), mat.aluminum);
    rose.rotation.x = Math.PI / 2; rose.position.set(hx, 0.98, f * 0.028); pivot.add(rose);
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.022), mat.aluminum);
    lever.position.set(hx + hinge * 0.05, 0.98, f * 0.045); pivot.add(lever);
  }
  for (const { text, side } of signs) {
    const sg = textPlane(text, 0.42, 0.12, "#fff", "#2a2e35", "Arial", 70);
    sg.material = new THREE.MeshLambertMaterial({ map: sg.material.map });   // lit by the room like the other signs
    const f = toLocal(side);
    sg.position.set(lx, porthole ? 1.24 : 1.52, f * 0.028); if (f < 0) sg.rotation.y = Math.PI; pivot.add(sg);   // 5 mm proud of the leaf face (under the window, if it has one)
  }
  casing(at, c, alongX, W);
  const t = WALL_T / 2 + WALL_PAD, hp = c + hinge * W / 2, sw = swing * W;
  const shut = alongX ? { x0: c - W / 2, x1: c + W / 2, z0: at - t, z1: at + t } : { x0: at - t, x1: at + t, z0: c - W / 2, z1: c + W / 2 };
  const openBox = alongX ? { x0: hp - 0.03, x1: hp + 0.03, z0: Math.min(at, at + sw), z1: Math.max(at, at + sw) }
                         : { x0: Math.min(at, at + sw), x1: Math.max(at, at + sw), z0: hp - 0.03, z1: hp + 0.03 };
  // local z the leaf's free edge heads toward = toLocal(swing); rotating by a
  // moves it to local z = hinge * sin(a) * W/2, so the sign of a follows
  const d = { pivot, base, a: 0, openA: Math.PI / 2 * hinge * toLocal(swing), open: false, locked, rattle: 0, shut, openBox,
    push, at, c, alongX, hinge, v: 0, side: 0 };
  if (!push) { colliders.push(shut); leaf.userData.door = d; aimables.push(leaf); }   // a push door never blocks: it gets out of your way
  else aimBlockers.push(leaf);                  // ...but you can't reach through it (it goes wherever the leaf swings)
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
    // the doorway itself, for clocking out (an unseen pane: rays still find it)
    const exit = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2.5), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    exit.visible = false; exit.position.set(0, 1.25, DZ + 0.06); exit.userData.exitDoor = true; scene.add(exit); aimables.push(exit);
  }

  // back of house: hallway along the back wall, breakroom + restroom off it.
  // Lower drop ceiling than the sales floor, plain walls, no stripe
  const BX0 = BOH.x0, BZ0 = Z, BZ1 = BOH.z1, BH = BOH.h, HZ = BOH.hallZ, SX = BOH.splitX;
  wall(HZ, BZ1 + T / 2, BX0, false, BH, mat.wall);                          // west, rooms part
  wall(BZ0, HZ, BX0, false, BH, mat.wall, [BOH_DOORS.future]);              // west, hall part: the future door
  wall(BZ0, BZ1 + T / 2, XR, false, BH, mat.wall, [{ c: BOH_DOORS.closet, w: CLOSET.doorW }]);      // east: the janitor's closet door
  wall(BX0, XR, BZ1, true, BH, mat.wall);                                   // rear
  wall(BX0, XR, HZ, true, BH, mat.wall, [BOH_DOORS.breakroom, BOH_DOORS.restroom]);   // hall | rooms
  wall(HZ, BZ1, SX, false, BH, mat.wall);                                   // breakroom | restroom
  wall(XR, CLOSET.x1 + T / 2, BZ0, true, BH, mat.wall);                    // janitor's closet: its sides (in line with the store's back wall and the hall's)...
  wall(XR, CLOSET.x1 + T / 2, HZ, true, BH, mat.wall);
  wall(BZ0, HZ, CLOSET.x1, false, BH, mat.wall);                            // ...and its back
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
  // ceilings: the hall gets its own, its grid shifted so a row of tiles runs down the middle between
  // the walls (the hall lights sit in it) with a sliver of tile either side; the rooms keep the store's grid
  const hallMid = (BZ0 + WALL_T / 2 + HZ - WALL_T / 2) / 2, rowStart = hallMid - CEIL_TILE.z / 2;
  const hallCeilTex = ceilGrid(ceilTex.clone(), BX0, XR, BZ0, HZ); hallCeilTex.offset.y = (BZ0 - (rowStart % CEIL_TILE.z)) / CEIL_REP; hallCeilTex.needsUpdate = true;
  const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(XR - BX0, HZ - BZ0), new THREE.MeshLambertMaterial({ map: hallCeilTex }));
  hallCeil.rotation.x = Math.PI / 2; hallCeil.position.set((BX0 + XR) / 2, BH, (BZ0 + HZ) / 2); scene.add(hallCeil);
  const bohCeilTex = ceilGrid(ceilTex.clone(), BX0, XR, HZ, BZ1); bohCeilTex.needsUpdate = true;
  const bohCeil = new THREE.Mesh(new THREE.PlaneGeometry(XR - BX0, BZ1 - HZ), new THREE.MeshLambertMaterial({ map: bohCeilTex }));
  bohCeil.rotation.x = Math.PI / 2; bohCeil.position.set((BX0 + XR) / 2, BH, (HZ + BZ1) / 2); scene.add(bohCeil);

  // the sales floor opens straight into the hall; the rooms get painted doors, the theater a maroon push door
  casing(Z, BOH_DOORS.store, true, BOH_OPENING_W);
  const painted = new THREE.MeshLambertMaterial({ color: 0xd9d4c7 });
  makeDoor({ at: HZ, c: BOH_DOORS.breakroom, alongX: true, hinge: 1, swing: 1, leafMat: painted,
    signs: [{ text: "BREAK ROOM", side: -1 }] });
  makeDoor({ at: HZ, c: BOH_DOORS.restroom, alongX: true, hinge: 1, swing: 1, leafMat: painted,
    signs: [{ text: "RESTROOM", side: -1 }] });
  makeDoor({ at: BX0, c: BOH_DOORS.future, alongX: false, hinge: 1, swing: -1, leafMat: theaterDoorMat, push: true, porthole: true,
    signs: [{ text: "THEATER", side: 1 }] });
  makeDoor({ at: XR, c: BOH_DOORS.closet, alongX: false, hinge: 1, swing: -1, w: CLOSET.doorW, leafMat: painted,   // narrow; hinged on the restroom side, swings out into the hall
    signs: [{ text: "JANITOR", side: -1 }] });

  // ---- janitor's closet (interior x XR+0.1..CLOSET.x1-0.1, z BZ0+0.1..HZ-0.1). Its narrow door swings out into the hall;
  // from the door (facing +x): mop + bucket in the back right corner, the carpet sweeper against the back
  // wall, a folded step ladder (for the ceiling lights) on the right, a shelf of cleaning stuff up on the back wall ----
  {
    const x0 = XR + WALL_T / 2, x1 = CLOSET.x1 - WALL_T / 2, z0 = BZ0 + WALL_T / 2, z1 = HZ - WALL_T / 2;
    floorPatch(vctTex, 2.4, XR, CLOSET.x1, BZ0, HZ);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CLOSET.x1 - XR, HZ - BZ0), new THREE.MeshLambertMaterial({ color: 0xe6e3dc }));   // plain painted drywall
    ceil.rotation.x = Math.PI / 2; ceil.position.set((XR + CLOSET.x1) / 2, BH, (BZ0 + HZ) / 2); scene.add(ceil);
    const put = (geo, m, x, y, z, par = scene) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); return o; };
    const bx = (w, h, d, m, x, y, z, par) => put(new THREE.BoxGeometry(w, h, d), m, x, y, z, par);
    const cyl = (r, h, m, x, y, z, par) => put(new THREE.CylinderGeometry(r, r, h, 12), m, x, y, z, par);
    const lam = c => new THREE.MeshLambertMaterial({ color: c });
    const yellow = lam(0xf2c200), grey = lam(0x6b6f74), dark = lam(0x222222), wood = lam(0xb08a5a), alu = new THREE.MeshPhongMaterial({ color: 0xc9cdd2, specular: 0xffffff, shininess: 80 });
    const stick = (a, b, r, m) => {                  // a pole from point a to point b
      const d = new THREE.Vector3().subVectors(b, a), o = cyl(r, d.length(), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o;
    };
    // one bare bulb on a cord from the middle of the ceiling (its own light zone: E on it, or its chain, flips it)
    {
      const bx0 = (x0 + x1) / 2, bz0 = (z0 + z1) / 2, porcelain = lam(0xf1ede2), parts = [];
      parts.push(put(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 16), porcelain, bx0, BH - 0.01, bz0));          // ceiling canopy
      parts.push(cyl(0.004, 0.32, dark, bx0, BH - 0.17, bz0));                                                      // the cord
      parts.push(put(new THREE.CylinderGeometry(0.022, 0.026, 0.06, 12), porcelain, bx0, BH - 0.36, bz0));           // socket
      closetBulb.mat = new THREE.MeshBasicMaterial({ color: 0x3a3833 });
      const glass = glow(put(new THREE.SphereGeometry(0.032, 16, 12), closetBulb.mat, bx0, BH - 0.415, bz0)); glass.scale.y = 1.25; parts.push(glass);
      parts.push(cyl(0.0025, 0.3, alu, bx0 + 0.02, BH - 0.52, bz0), put(new THREE.SphereGeometry(0.008, 8, 6), alu, bx0 + 0.02, BH - 0.675, bz0));   // pull chain + its bead
      for (const o of parts) { o.userData.lightZone = "closet"; aimables.push(o); }
    }
    // mop bucket: yellow tub on casters, the wringer on one end, grey water, the mop stood in it
    const mbx = x1 - 0.26, mbz = z1 - 0.3;
    bx(0.32, 0.3, 0.44, yellow, mbx, 0.2, mbz);
    bx(0.28, 0.005, 0.4, lam(0x7d7a62), mbx, 0.33, mbz + 0.02);                          // dirty water
    bx(0.34, 0.2, 0.14, grey, mbx, 0.42, mbz - 0.14);                                     // wringer
    bx(0.4, 0.03, 0.03, grey, mbx, 0.55, mbz - 0.19);                                     // its lever
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(new THREE.SphereGeometry(0.03, 8, 6), dark, mbx + sx * 0.12, 0.03, mbz + sz * 0.18);
    put(new THREE.CylinderGeometry(0.06, 0.09, 0.14, 10), lam(0xe8e2cf), mbx, 0.32, mbz + 0.08);   // the mop head, poking up out of the water
    stick(new THREE.Vector3(mbx, 0.35, mbz + 0.08), new THREE.Vector3(x1 - 0.03, 1.55, mbz + 0.02), 0.013, wood);
    colliders.push({ x0: mbx - 0.18, x1, z0: mbz - 0.24, z1: mbz + 0.24, y1: 0.6 });
    // carpet sweeper: low housing with a rubber bumper, the handle back against the wall
    const swx = x1 - 0.3, swz = z0 + 0.75;
    bx(0.22, 0.08, 0.34, lam(0x8c1c1c), swx, 0.06, swz);
    bx(0.24, 0.025, 0.36, dark, swx, 0.035, swz);                                          // bumper
    for (const sz of [-1, 1]) cyl(0.022, 0.02, dark, swx, 0.022, swz + sz * 0.15).rotation.x = Math.PI / 2;
    bx(0.03, 0.04, 0.03, alu, swx, 0.115, swz);                                            // the yoke
    stick(new THREE.Vector3(swx, 0.12, swz), new THREE.Vector3(x1 - 0.03, 1.25, swz), 0.011, alu);
    put(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 8), dark, x1 - 0.04, 1.25, swz).rotation.x = Math.PI / 2;   // grip
    colliders.push({ x0: swx - 0.13, x1, z0: swz - 0.19, z1: swz + 0.19, y1: 0.4 });
    // step ladder, folded and leaned against the right-hand wall, just inside the door
    {
      const g = new THREE.Group(); g.position.set(x0 + 0.35, 0, z1 - 0.07); g.rotation.x = 0.09; scene.add(g);   // leaning into the wall (+z)
      for (const sx of [-1, 1]) for (const sz of [0, -0.045]) bx(0.04, 1.05, 0.025, alu, sx * 0.2, 0.525, sz, g);   // front + back rails, folded flat together
      for (let i = 0; i < 3; i++) bx(0.36, 0.025, 0.07, alu, 0, 0.27 + i * 0.25, -0.03, g);                       // steps
      bx(0.44, 0.05, 0.1, lam(0x2a5fb0), 0, 1.07, -0.022, g);                                                      // the top cap
      for (const sx of [-1, 1]) bx(0.05, 0.03, 0.08, dark, sx * 0.2, 0.015, -0.022, g);                            // feet
      colliders.push({ x0: g.position.x - 0.25, x1: g.position.x + 0.25, z0: z1 - 0.2, z1, y1: 1.1 });
    }
    // shelf on the back wall, up out of the way: carpet shampoo, floor cleaner, a gallon of bleach, glass cleaner
    const sy = 1.5, sz0 = z0 + 0.35, sz1 = z1 - 0.08, sd = 0.24, sx = x1 - sd / 2;
    bx(sd, 0.025, sz1 - sz0, wood, sx, sy, (sz0 + sz1) / 2);
    for (const z of [sz0 + 0.1, sz1 - 0.1]) bx(0.02, 0.18, 0.02, grey, x1 - 0.02, sy - 0.1, z);   // brackets
    const top = sy + 0.0125, label = (w, h, c, y, z, d) => bx(0.004, h, w, lam(c), sx - d, y, z);
    const items = [
      z => { bx(0.09, 0.26, 0.11, lam(0x6aa84f), sx, top + 0.13, z); cyl(0.02, 0.03, dark, sx, top + 0.275, z); label(0.09, 0.09, 0xf6f6f2, top + 0.12, z, 0.047); },   // carpet shampoo
      z => { bx(0.08, 0.22, 0.1, yellow, sx, top + 0.11, z); cyl(0.018, 0.03, lam(0xd21f26), sx, top + 0.235, z); label(0.08, 0.08, 0xd21f26, top + 0.1, z, 0.042); },   // floor cleaner
      z => { bx(0.12, 0.24, 0.15, lam(0xf6f6f2), sx, top + 0.12, z); cyl(0.022, 0.03, lam(0x2a5fb0), sx, top + 0.255, z + 0.04); label(0.11, 0.1, 0x2a5fb0, top + 0.11, z, 0.062); },   // bleach jug
      z => { cyl(0.04, 0.2, lam(0x2f8fe8), sx, top + 0.1, z); bx(0.06, 0.06, 0.03, lam(0xf2f2f2), sx - 0.01, top + 0.23, z); bx(0.012, 0.04, 0.012, lam(0xf2f2f2), sx - 0.05, top + 0.19, z); },   // glass cleaner: spray head + trigger
    ];
    items.forEach((f, i) => f(sz0 + 0.12 + i * (sz1 - sz0 - 0.24) / (items.length - 1)));
  }

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

    // trash can by the counter: open top, a liner turned over the rim (what's in it: see trashBins)
    {
      const cx = kx0 - 0.28, cz = z1 - 0.3;
      const can = put(new THREE.LatheGeometry([[0.15, 0], [0.17, 0.55], [0.162, 0.55], [0.142, 0.015], [0.001, 0.015]].map(([r, y]) => new THREE.Vector2(r, y)), 28),
        new THREE.MeshPhongMaterial({ color: 0x3b4a5a, specular: 0x333333, shininess: 20, side: THREE.DoubleSide }), cx, 0, cz);
      const liner = put(new THREE.TorusGeometry(0.168, 0.007, 6, 30), new THREE.MeshLambertMaterial({ color: 0xd8dde2 }), cx, 0.55, cz); liner.rotation.x = Math.PI / 2;
      trashBins.breakroom = { id: "breakroom", name: "break room trash", cap: 10, x: cx, z: cz, rimY: 0.55, r: 0.15, liner: 0xd8dde2, parts: [can, liner], stand: { x: cx, z: cz - 0.62, ry: 0 } };
      colliders.push({ x0: cx - 0.17, x1: cx + 0.17, z0: cz - 0.17, z1: cz + 0.17, y1: 0.55 });
    }

    // the trash chute, on the west wall past the lockers: a stainless hopper door
    // (tips out from the top) down to the dumpster room. Bagged trash goes here
    {
      const cz = 32.32, g = new THREE.Group(); g.position.set(x0, 0, cz); g.rotation.y = Math.PI / 2; scene.add(g);   // local +z: out of the wall into the room
      const brushed = makeTexture((ctx, W, H) => {
        ctx.fillStyle = "#b9bec4"; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 220; i++) { ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${0.03 + Math.random() * 0.05})` : `rgba(50,55,62,${0.03 + Math.random() * 0.05})`; ctx.fillRect(0, Math.random() * H, W, 1); }
      }, 128, 128);
      const steel = new THREE.MeshPhongMaterial({ color: 0xffffff, map: brushed, specular: 0xffffff, shininess: 70 });
      const parts = [], add = (geo, m, x, y, z, par = g) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); par.add(o); parts.push(o); return o; };
      add(new THREE.BoxGeometry(0.66, 1.02, 0.015), steel, 0, 1.13, 0.0075);                         // wall plate
      add(new THREE.BoxGeometry(0.56, 0.045, 0.1), steel, 0, 1.31, 0.065);                           // the frame round the opening
      add(new THREE.BoxGeometry(0.56, 0.045, 0.1), steel, 0, 0.815, 0.065);
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.045, 0.45, 0.1), steel, sx * 0.258, 1.06, 0.065);
      add(new THREE.BoxGeometry(0.47, 0.45, 0.01), new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, 1.06, 0.03);   // the throat, dark behind the door
      const door = new THREE.Group(); door.position.set(0, 0.84, 0.105); g.add(door);              // hinged along its bottom edge
      add(new THREE.BoxGeometry(0.46, 0.44, 0.018), steel, 0, 0.22, 0, door);
      add(new THREE.BoxGeometry(0.3, 0.024, 0.024), steel, 0, 0.37, 0.05, door);                    // pull bar
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.024, 0.05), steel, sx * 0.14, 0.37, 0.025, door);
      const plate = textPlane("TRASH CHUTE", 0.42, 0.075, "#ffffff", "#9b1c1c", "Arial Black", 60);
      plate.material = new THREE.MeshLambertMaterial({ map: plate.material.map }); plate.position.set(0, 1.5, 0.017); g.add(plate); parts.push(plate);
      const warn = textPlane("NO BOXES · NO LIQUIDS · KEEP CLOSED", 0.46, 0.035, "#1a1a1a", "#f2c200", "Arial", 40);
      warn.material = new THREE.MeshLambertMaterial({ map: warn.material.map }); warn.position.set(0, 0.74, 0.017); g.add(warn); parts.push(warn);
      for (const o of parts) { o.userData.chute = true; aimables.push(o); }
      chute.door = door; chute.at = [x0 + 0.15, 1.05, cz]; chute.stand = { x: x0 + 0.62, z: cz, ry: -Math.PI / 2 };
      colliders.push({ x0, x1: x0 + 0.16, z0: cz - 0.33, z1: cz + 0.33, y1: 1.7 });
    }

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

  // ---- restroom, V2.5 (interior x SX+0.1..XR-0.1, z HZ+0.1..BZ1-0.1) ----
  // A two-piece toilet on the back wall; a pedestal sink under a framed mirror
  // on the west wall, with a single-lever faucet; a paper towel dispenser and a
  // little wastebasket beside it; tiled wainscot all round. The door swings in
  // over x 9.1-10.2 up to ~z 30.9. E flushes the toilet and runs the tap (see bath)
  {
    const x0 = SX + 0.1, x1 = XR - 0.1, z0 = HZ + 0.1, z1 = BZ1 - 0.1;
    const put = (geo, m, x, y, z, ry = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
    const china = new THREE.MeshPhongMaterial({ color: 0xf7f7f3, specular: 0x9a9a9a, shininess: 85, side: THREE.DoubleSide });
    const chrome = new THREE.MeshPhongMaterial({ color: 0xd4d8dd, specular: 0xffffff, shininess: 110 });
    const cream = new THREE.MeshPhongMaterial({ color: 0xebe7de, specular: 0x444444, shininess: 30 });
    const darkP = new THREE.MeshPhongMaterial({ color: 0x33373c, specular: 0x333333, shininess: 25 });
    const rrect = (w, d, r) => {                   // a rounded rectangle, w along x, d along the shape's y
      const s = new THREE.Shape(), x = w / 2, y = d / 2;
      s.moveTo(-x + r, -y); s.lineTo(x - r, -y); s.quadraticCurveTo(x, -y, x, -y + r); s.lineTo(x, y - r); s.quadraticCurveTo(x, y, x - r, y);
      s.lineTo(-x + r, y); s.quadraticCurveTo(-x, y, -x, y - r); s.lineTo(-x, -y + r); s.quadraticCurveTo(-x, -y, -x + r, -y); return s;
    };
    const slab = (shape, h, m, b = 0.008) => {    // that shape extruded up h from y 0, edges rounded over
      const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, h - 2 * b), bevelEnabled: b > 0, bevelSize: b, bevelThickness: b, bevelSegments: 3, curveSegments: 12 });
      g.rotateX(-Math.PI / 2); g.translate(0, b, 0); return new THREE.Mesh(g, m);
    };
    const place = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; scene.add(o); return o; };
    const lathe = (pts, m, segs = 32) => new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs), m);
    const tube = (pts, r, m) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 24, r, 10), m);

    // tiled wainscot to 1.05 m (under the light switch): 10 cm glazed squares, a blue cap row on top
    const WH = 1.05;
    const tileTex = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#b9bec4"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const g = ctx.createLinearGradient(0, j * 64, 0, j * 64 + 62); g.addColorStop(0, "#f4f6f7"); g.addColorStop(1, "#e3e8ec");
        ctx.fillStyle = g; ctx.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
      }
    }, 256, 256);
    tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
    const tileMat = (len) => { const t = tileTex.clone(); t.needsUpdate = true; t.repeat.set(len / 0.4, WH / 0.4); return new THREE.MeshLambertMaterial({ map: t }); };
    const capMat = new THREE.MeshLambertMaterial({ color: 0x2a4d8a });
    const wains = (a0, a1, alongX, at, face) => {  // one wall's run: along x (at = z) or along z (at = x); face = which way it looks
      const len = a1 - a0, c = (a0 + a1) / 2, off = face * 0.003;
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(len, WH), tileMat(len));
      if (alongX) { pl.position.set(c, WH / 2, at + off); pl.rotation.y = face > 0 ? 0 : Math.PI; } else { pl.position.set(at + off, WH / 2, c); pl.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; }
      scene.add(pl);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : 0.014, 0.06, alongX ? 0.014 : len), capMat);
      cap.position.set(alongX ? c : at + face * 0.007, WH + 0.03, alongX ? at + face * 0.007 : c); scene.add(cap);
    };
    wains(z0, z1, false, x0, 1); wains(z0, z1, false, x1, -1); wains(x0, x1, true, z1, -1);
    wains(x0, BOH_DOORS.restroom - DOOR_W / 2 - 0.04, true, z0, 1); wains(BOH_DOORS.restroom + DOOR_W / 2 + 0.04, x1, true, z0, 1);   // either side of the door

    // ---- the toilet: two-piece, elongated bowl, seat and lid up ----
    const tx = 10.25, zb = z1, bz = zb - 0.44;       // center line; back wall; bowl center
    const toilet = [];
    toilet.push(place(slab(rrect(0.5, 0.2, 0.045), 0.36, china, 0.012), tx, 0.43, zb - 0.108));                // tank
    toilet.push(place(slab(rrect(0.535, 0.228, 0.05), 0.036, china, 0.012), tx, 0.79, zb - 0.108));            // tank lid
    toilet.push(place(slab(rrect(0.34, 0.24, 0.06), 0.07, china), tx, 0.36, zb - 0.14));                      // the deck the tank sits on
    const bowl = lathe([[0.105, 0], [0.122, 0.014], [0.1, 0.06], [0.098, 0.16], [0.135, 0.255], [0.182, 0.338], [0.2, 0.374], [0.2, 0.392], [0.186, 0.402],
      [0.165, 0.397], [0.132, 0.345], [0.082, 0.262], [0.045, 0.205], [0.001, 0.192]], china, 40);
    bowl.scale.set(1, 1, 1.3); toilet.push(place(bowl, tx, 0, bz));
    const water = put(new THREE.CircleGeometry(0.104, 28), new THREE.MeshPhongMaterial({ color: 0xa9cfe0, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.72 }), tx, 0.288, bz);
    water.rotation.x = -Math.PI / 2; water.scale.set(1, 1.3, 1);
    const seatShape = new THREE.Shape(); seatShape.absellipse(0, 0, 0.188, 0.245, 0, Math.PI * 2);   // a real seat: a broad flat ring, not a tube
    const seatHole = new THREE.Path(); seatHole.absellipse(0, 0.012, 0.112, 0.158, 0, Math.PI * 2, true); seatShape.holes.push(seatHole);   // (the opening sits a touch forward)
    toilet.push(place(slab(seatShape, 0.03, china, 0.011), tx, 0.398, bz - 0.01));
    const lid = put(new THREE.CylinderGeometry(0.188, 0.188, 0.022, 36), china, tx, 0.66, zb - 0.245); lid.scale.set(1, 1, 1.28); lid.rotation.x = Math.PI / 2 - 0.13; toilet.push(lid);   // up, leaning on the tank
    for (const s of [-1, 1]) {
      const h = put(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 12), chrome, tx + s * 0.085, 0.425, zb - 0.235); h.rotation.z = Math.PI / 2;   // seat hinges
      put(new THREE.SphereGeometry(0.02, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), china, tx + s * 0.105, 0.012, bz + 0.06);                     // bolt caps
    }
    const boss = put(new THREE.CylinderGeometry(0.017, 0.017, 0.012, 16), chrome, tx - 0.18, 0.73, zb - 0.214); boss.rotation.x = Math.PI / 2;
    const flushLever = put(new THREE.BoxGeometry(0.075, 0.013, 0.013), chrome, tx - 0.215, 0.73, zb - 0.222);                               // flush lever
    const leverHit = put(new THREE.BoxGeometry(0.13, 0.07, 0.06), new THREE.MeshBasicMaterial({ visible: false }), tx - 0.2, 0.73, zb - 0.225);   // (a forgiving target for it)
    for (const m of [boss, flushLever, leverHit]) { m.userData.flush = true; aimables.push(m); }
    const valve = put(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12), chrome, tx - 0.19, 0.17, zb - 0.025); valve.rotation.x = Math.PI / 2;   // shutoff on the wall
    put(new THREE.CylinderGeometry(0.02, 0.02, 0.008, 16), chrome, tx - 0.19, 0.17, zb - 0.052).rotation.x = Math.PI / 2;
    put(new THREE.BoxGeometry(0.034, 0.012, 0.01), chrome, tx - 0.19, 0.17, zb - 0.058);                                                    // its oval handle
    place(tube([[tx - 0.19, 0.17, zb - 0.05], [tx - 0.2, 0.26, zb - 0.07], [tx - 0.17, 0.38, zb - 0.1], [tx - 0.16, 0.435, zb - 0.1]], 0.006,
      new THREE.MeshPhongMaterial({ color: 0x9aa0a6, specular: 0xdddddd, shininess: 60 })), 0, 0, 0);                                     // braided supply line
    bath.seat = { x: tx, y: 0, z: bz + 0.05, ry: Math.PI, hipY: 0.47, toilet: true };   // sitting on it: facing out into the room
    for (const m of toilet) { m.userData.sit = true; m.userData.seatPos = bath.seat; aimables.push(m); }
    colliders.push({ x0: tx - 0.27, x1: tx + 0.27, z0: zb - 0.72, z1: zb, y1: 0.85 });
    // toilet paper on the east wall: backplate, arm, a roll with a sheet hanging
    put(new THREE.BoxGeometry(0.012, 0.07, 0.19), chrome, x1 - 0.006, 0.74, zb - 0.6);
    const arm = put(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 10), chrome, x1 - 0.012, 0.74, zb - 0.6); arm.rotation.x = Math.PI / 2;
    const roll = put(new THREE.CylinderGeometry(0.057, 0.057, 0.11, 22), new THREE.MeshLambertMaterial({ color: 0xfbfbf9 }), x1 - 0.075, 0.74, zb - 0.6); roll.rotation.x = Math.PI / 2;
    put(new THREE.PlaneGeometry(0.1, 0.12), new THREE.MeshLambertMaterial({ color: 0xfbfbf9, side: THREE.DoubleSide }), x1 - 0.132, 0.68, zb - 0.6, Math.PI / 2);

    // ---- the pedestal sink (on the west wall, facing +x) and its faucet ----
    const wx = x0, sz = 31.75, sx = wx + 0.24, top = 0.86;
    const basinShape = rrect(0.48, 0.58, 0.08), hole = new THREE.Path(); hole.absellipse(0.03, 0, 0.165, 0.205, 0, Math.PI * 2, true); basinShape.holes.push(hole);
    const basin = place(slab(basinShape, 0.14, china, 0.012), sx, top - 0.14, sz);
    const bowlIn = put(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), china, sx + 0.03, top - 0.002, sz); bowlIn.scale.set(0.165, 0.12, 0.205);
    put(new THREE.CylinderGeometry(0.022, 0.022, 0.004, 18), chrome, sx + 0.03, top - 0.12, sz);                                           // drain
    put(new THREE.CircleGeometry(0.009, 12), darkP, sx - 0.13, top - 0.045, sz, Math.PI / 2);                                             // overflow
    place(lathe([[0.13, 0], [0.1, 0.03], [0.074, 0.12], [0.064, 0.4], [0.074, 0.62], [0.11, top - 0.14]], china, 32), sx - 0.02, 0, sz).scale.set(1, 1, 0.9);   // pedestal
    const fx = wx + 0.075, faucet = [];
    faucet.push(put(new THREE.CylinderGeometry(0.03, 0.032, 0.012, 20), chrome, fx, top + 0.006, sz));                                    // escutcheon
    faucet.push(put(new THREE.CylinderGeometry(0.019, 0.022, 0.085, 20), chrome, fx, top + 0.055, sz));                                   // body
    faucet.push(place(tube([[fx, top + 0.08, sz], [fx + 0.012, top + 0.13, sz], [fx + 0.07, top + 0.152, sz], [fx + 0.13, top + 0.125, sz], [fx + 0.148, top + 0.1, sz]], 0.011, chrome), 0, 0, 0));   // arched spout
    const aer = put(new THREE.CylinderGeometry(0.013, 0.012, 0.014, 16), chrome, fx + 0.15, top + 0.093, sz); aer.rotation.z = -0.35; faucet.push(aer);
    const lever = put(new THREE.BoxGeometry(0.085, 0.013, 0.022), chrome, fx - 0.03, top + 0.108, sz); lever.rotation.z = 0.3; faucet.push(lever);
    put(new THREE.CircleGeometry(0.004, 10), new THREE.MeshBasicMaterial({ color: 0xd02020 }), fx, top + 0.06, sz + 0.0205);             // hot / cold dots
    put(new THREE.CircleGeometry(0.004, 10), new THREE.MeshBasicMaterial({ color: 0x2050d0 }), fx, top + 0.06, sz - 0.0205, Math.PI);
    const stream = put(new THREE.CylinderGeometry(0.005, 0.008, 0.21, 10, 1, true), new THREE.MeshPhongMaterial({ color: 0xcfe6f2, specular: 0xffffff, shininess: 120, transparent: true, opacity: 0.55 }), fx + 0.155, top - 0.03, sz);
    stream.visible = false;
    for (const m of [...faucet, basin, bowlIn]) { m.userData.sink = true; aimables.push(m); }
    colliders.push({ x0: wx, x1: wx + 0.5, z0: sz - 0.3, z1: sz + 0.3, y1: 0.9 });
    // mirror: a rounded chrome frame, the glass inset
    const frameShape = rrect(0.58, 0.78, 0.07), inner = rrect(0.5, 0.7, 0.045); frameShape.holes.push(new THREE.Path(inner.getPoints(12)));
    const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.018, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 12 });
    frameGeo.rotateY(Math.PI / 2); put(frameGeo, chrome, wx, 1.52, sz);
    put(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshPhongMaterial({ color: 0xa6b6c4, specular: 0xffffff, shininess: 140 }), wx + 0.012, 1.52, sz, Math.PI / 2);
    const wash = textPlane("EMPLOYEES MUST WASH HANDS", 0.42, 0.1, "#fff", "#1a1d22", "Arial", 64);
    wash.material = new THREE.MeshLambertMaterial({ map: wash.material.map }); wash.position.set(wx + 0.006, 2.02, sz); wash.rotation.y = Math.PI / 2; scene.add(wash);
    // soap dispenser beside the mirror: a rounded box, a push plate, the nozzle
    place(slab(rrect(0.075, 0.1, 0.02), 0.15, cream, 0.008), wx + 0.04, 1.02, sz + 0.37);
    put(new THREE.BoxGeometry(0.006, 0.05, 0.06), darkP, wx + 0.088, 1.1, sz + 0.37);   // push plate
    put(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), darkP, wx + 0.05, 1.012, sz + 0.37);

    // ---- paper towel dispenser: cream plastic, a smoked window on the stack, a towel hanging out ----
    const pz = sz - 0.68;
    const disp = place(slab(rrect(0.14, 0.3, 0.035), 0.36, cream, 0.012), wx + 0.07, 1.2, pz);
    put(new THREE.BoxGeometry(0.004, 0.13, 0.2), new THREE.MeshPhongMaterial({ color: 0x2a2e33, transparent: true, opacity: 0.55, specular: 0xffffff, shininess: 100 }), wx + 0.157, 1.43, pz);   // window (just proud of the rounded front)
    put(new THREE.BoxGeometry(0.004, 0.06, 0.17), new THREE.MeshLambertMaterial({ color: 0xf2efe6 }), wx + 0.1535, 1.4, pz);                  // the stack's edge, seen through it (about half full)
    put(new THREE.BoxGeometry(0.11, 0.006, 0.22), darkP, wx + 0.07, 1.199, pz);                                                             // dispensing slot
    const towelM = new THREE.MeshLambertMaterial({ color: 0xf6f3ea, side: THREE.DoubleSide });
    const t1 = put(new THREE.PlaneGeometry(0.09, 0.2), towelM, wx + 0.085, 1.15, pz, Math.PI / 2); t1.rotation.z = 0.08;
    const t2 = put(new THREE.PlaneGeometry(0.05, 0.2), towelM, wx + 0.1, 1.175, pz, Math.PI / 2); t2.rotation.set(0.9, Math.PI / 2, 0);   // the fold
    const brand = textPlane("VAULTBUSTER", 0.14, 0.025, "#2a4d8a", "#ebe7de", "Arial Black", 60); brand.material = new THREE.MeshLambertMaterial({ map: brand.material.map });
    brand.position.set(wx + 0.154, 1.53, pz); brand.rotation.y = Math.PI / 2; scene.add(brand);
    disp.userData.towels = true; aimables.push(disp);
    // the small wastebasket under it: open top, a liner folded over the rim, a few towels in it
    const bin = place(lathe([[0.1, 0], [0.13, 0.31], [0.124, 0.31], [0.095, 0.012], [0.001, 0.012]], new THREE.MeshPhongMaterial({ color: 0x3d4248, specular: 0x444444, shininess: 30, side: THREE.DoubleSide }), 28), wx + 0.19, 0, pz);
    const liner = put(new THREE.TorusGeometry(0.127, 0.006, 6, 30), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }), wx + 0.19, 0.31, pz); liner.rotation.x = Math.PI / 2;
    trashBins.restroom = { id: "restroom", name: "restroom wastebasket", cap: 8, x: wx + 0.19, z: pz, rimY: 0.31, r: 0.1, liner: 0xeeeeee, towels: true, parts: [bin, liner], stand: { x: wx + 0.78, z: pz, ry: -Math.PI / 2 } };
    colliders.push({ x0: wx + 0.04, x1: wx + 0.34, z0: pz - 0.15, z1: pz + 0.15, y1: 0.35 });
    bath.water = water; bath.waterY = water.position.y; bath.stream = stream; bath.toiletAt = [tx, 0.4, bz]; bath.sinkAt = [fx + 0.15, top, sz];
  }
// ---- movie theater lobby (x WALL_L..BX0, z BZ0..BZ1) & single-screen stadium theater (z BZ1..46.5) ----
  {
    const LX0 = WALL_L, LX1 = BX0, LZ0 = Z, LZ1 = BZ1, LH = BOH.h;
    const TX = (LX0 + LX1) / 2;              // -2.87: centerline of lobby & auditorium
    const TW = 8.2, TX0 = TX - TW / 2, TX1 = TX + TW / 2, TZ0 = LZ1, TZ1 = 46.5, TH = STORE.h;
    TVU.uLobbyBox.value.set(LX0 - 0.05, LX1 + 0.05, LZ0, LZ1 + 0.05);
    TVU.uThBox.value.set(TX0 - 0.05, TX1 + 0.05, TZ0, TZ1 + 0.05);

    // lobby walls, art-deco cinema carpet, and ceiling
    wall(LZ0, LZ1 + T / 2, LX0, false, LH, mat.wall);
    wall(LX0, LX1, LZ1, true, LH, mat.wall, [TX]);   // south wall with door into Cinema 1
    const lobbyCarpetTex = makeTexture((ctx, W, H) => {
      ctx.fillStyle = "#58111a"; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "#d4a017"; ctx.lineWidth = 6;
      const s = W / 4;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const cx = (x + 0.5) * s, cy = (y + 0.5) * s;
        ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.38); ctx.lineTo(cx + s * 0.38, cy);
        ctx.lineTo(cx, cy + s * 0.38); ctx.lineTo(cx - s * 0.38, cy); ctx.closePath(); ctx.stroke();
        ctx.fillStyle = "#1b4d4a"; ctx.beginPath(); ctx.arc(cx, cy, s * 0.1, 0, 7); ctx.fill();
      }
      for (let i = 0; i < 1800; i++) {
        ctx.fillStyle = Math.random() < 0.5 ? "rgba(255,215,100,.12)" : "rgba(0,0,0,.22)";
        ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
      }
    }, 512, 512);
    floorPatch(lobbyCarpetTex, 2.0, LX0, LX1, LZ0, LZ1);
    const lobCeilTex = ceilGrid(ceilTex.clone(), LX0, LX1, LZ0, LZ1); lobCeilTex.needsUpdate = true;
    const lobCeil = new THREE.Mesh(new THREE.PlaneGeometry(LX1 - LX0, LZ1 - LZ0), new THREE.MeshLambertMaterial({ map: lobCeilTex }));
    lobCeil.rotation.x = Math.PI / 2; lobCeil.position.set(TX, LH, (LZ0 + LZ1) / 2); scene.add(lobCeil);

    // the auditorium door: the same maroon push door as the hall's, no window
    makeDoor({ at: LZ1, c: TX, alongX: true, hinge: -1, swing: 1, leafMat: theaterDoorMat, push: true,
      signs: [{ text: "CINEMA 1", side: -1 }, { text: "LOBBY", side: 1 }] });

    // glowing marquee over the Cinema 1 door
    box(2.2, 0.36, 0.14, mat.dark, TX, DOOR_H + 0.25, LZ1 - T / 2 - 0.07);
    const mq = glow(textPlane("★ CINEMA 1 · NOW SHOWING ★", 2.08, 0.28, "#ffd400", "#58111a", "Arial Black", 64));
    mq.position.set(TX, DOOR_H + 0.25, LZ1 - T / 2 - 0.145); mq.rotation.y = Math.PI; scene.add(mq);

    // brass velvet-rope stanchions flanking the Cinema 1 entrance
    const brass = new THREE.MeshPhongMaterial({ color: 0xc9a227, specular: 0xffe2a0, shininess: 80 });
    const velvet = new THREE.MeshLambertMaterial({ color: 0x8f111c });
    for (const sx of [-1, 1]) {
      for (const px of [TX + sx * 1.05, TX + sx * 2.25]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 12), brass);
        post.position.set(px, 0.45, LZ1 - 0.65); scene.add(post);
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.03, 16), brass);
        base.position.set(px, 0.015, LZ1 - 0.65); scene.add(base);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), brass);
        ball.position.set(px, 0.92, LZ1 - 0.65); scene.add(ball);
      }
      const rope = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.022, 8, 24, Math.PI), velvet);
      rope.position.set(TX + sx * 1.65, 0.84, LZ1 - 0.65); rope.rotation.z = Math.PI; rope.scale.y = 0.35; scene.add(rope);
      colliders.push({ x0: TX + sx * 1.65 - 0.65, x1: TX + sx * 1.65 + 0.65, z0: LZ1 - 0.78, z1: LZ1 - 0.52, y1: 0.95 });
    }

    // small-town concession & ticket counter in the west end of the lobby
    const cx0 = LX0 + 0.2, cx1 = -4.5, cz = 30.2, cw = cx1 - cx0, ccx = (cx0 + cx1) / 2;
    box(cw, 0.96, 0.62, mat.wood, ccx, 0.48, cz);
    box(cw + 0.06, 0.05, 0.68, brass, ccx, 0.985, cz);
    box(1.1, 0.38, 0.52, mat.glass, ccx + 0.45, 1.2, cz);   // glass candy display case
    for (const [dx, col] of [[-0.3, 0xe63946], [0, 0xf4a300], [0.3, 0x457b9d]])
      box(0.22, 0.08, 0.28, new THREE.MeshLambertMaterial({ color: col }), ccx + 0.45 + dx, 1.06, cz);
    colliders.push({ x0: cx0, x1: cx1, z0: cz - 0.35, z1: cz + 0.35, y1: 1.4 });
    const adm = textPlane("ADMISSION $3.50 · MATINEE $2.00 · POPCORN $1.50", 2.5, 0.34, "#fff4d0", "#1a1412", "Arial", 48);
    adm.material = new THREE.MeshLambertMaterial({ map: adm.material.map });
    adm.position.set(ccx, 2.05, LZ0 + T / 2 + 0.015); scene.add(adm);

    // ---- Single-Screen Stadium Auditorium ----
    // 6 stadium rows stepping down from y = 0 (at z = 34.6) to y = -1.56 (at z = 42.4)
    const R_Z0 = 34.6, R_ROWS = 6, R_STEP_Z = 1.3, R_DROP = 0.26, R_END = R_Z0 + R_ROWS * R_STEP_Z; // 42.4
    const PIT_Y = -R_ROWS * R_DROP;          // -1.56
    const AISLE_HALF = 0.78;

    floorHeightAt = (x, z) => {
      if (z <= R_Z0 || x < TX0 || x > TX1 || z > TZ1) return 0;
      if (z < R_END) {
        if (Math.abs(x - TX) < AISLE_HALF) return ((z - R_Z0) / (R_END - R_Z0)) * PIT_Y; // smooth center ramp
        const r = Math.min(R_ROWS - 1, Math.floor((z - R_Z0) / R_STEP_Z));
        return -(r + 1) * R_DROP;
      }
      return PIT_Y;
    };

    // outer auditorium walls (spanning down to PIT_Y so no gaps show as the floor drops)
    const WALL_BOT = PIT_Y, WALL_H = TH - WALL_BOT, WALL_CY = (TH + WALL_BOT) / 2;
    const thWall = new THREE.MeshLambertMaterial({ color: 0x261015 });
    const curtainMat = new THREE.MeshLambertMaterial({ color: 0x74121d });
    const stageWood = new THREE.MeshLambertMaterial({ color: 0x3d2314 });
    const tierFloorMat = new THREE.MeshLambertMaterial({ color: 0x38131a });
    const riserMat = new THREE.MeshLambertMaterial({ color: 0x1e0b0f });
    const stepLightMat = new THREE.MeshBasicMaterial({ color: 0xff1a1a });   // red aisle step lights

    // header above lobby roof at z = TZ0, side walls, and rear screen wall
    box(TW, TH - LH, WALL_T, thWall, TX, LH + (TH - LH) / 2, TZ0);
    aimBlockers.push(
      box(WALL_T, WALL_H, TZ1 - TZ0, thWall, TX0, WALL_CY, (TZ0 + TZ1) / 2),
      box(WALL_T, WALL_H, TZ1 - TZ0, thWall, TX1, WALL_CY, (TZ0 + TZ1) / 2),
      box(TW, WALL_H, WALL_T, thWall, TX, WALL_CY, TZ1)
    );
    colliders.push(
      { x0: TX0 - 0.18, x1: TX0 + 0.18, z0: TZ0, z1: TZ1, y0: WALL_BOT, y1: TH },
      { x0: TX1 - 0.18, x1: TX1 + 0.18, z0: TZ0, z1: TZ1, y0: WALL_BOT, y1: TH },
      { x0: TX0, x1: TX1, z0: TZ1 - 0.18, z1: TZ1 + 0.18, y0: WALL_BOT, y1: TH }
    );

    // dark cinema ceiling + back entry cross-aisle + sloped ramp + front orchestra pit
    const thCeil = new THREE.Mesh(new THREE.PlaneGeometry(TW, TZ1 - TZ0), new THREE.MeshLambertMaterial({ color: 0x121016 }));
    thCeil.rotation.x = Math.PI / 2; thCeil.position.set(TX, TH, (TZ0 + TZ1) / 2); scene.add(thCeil);
    box(TW, 0.04, R_Z0 - TZ0, tierFloorMat, TX, -0.02, (TZ0 + R_Z0) / 2);
    box(TW, 0.04, TZ1 - R_END, tierFloorMat, TX, PIT_Y - 0.02, (R_END + TZ1) / 2);

    const rampLen = Math.hypot(R_END - R_Z0, PIT_Y), rampAng = Math.atan2(-PIT_Y, R_END - R_Z0);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(AISLE_HALF * 2, 0.04, rampLen), mat.carpet);
    ramp.position.set(TX, PIT_Y / 2 - 0.02, (R_Z0 + R_END) / 2); ramp.rotation.x = rampAng; scene.add(ramp);
    {                                          // solid fill under the ramp, down to the pit: the rows step below its edges, so its sides would show daylight
      const sh = new THREE.Shape();              // side profile in (z, y): top follows the ramp (tucked just inside its slab), bottom at the pit floor
      sh.moveTo(R_Z0, -0.03); sh.lineTo(R_END, PIT_Y - 0.03); sh.lineTo(R_END, PIT_Y - 0.04); sh.lineTo(R_Z0, PIT_Y - 0.04); sh.lineTo(R_Z0, -0.03);
      const g = new THREE.ExtrudeGeometry(sh, { depth: AISLE_HALF * 2 - 0.004, bevelEnabled: false });
      g.rotateY(-Math.PI / 2); g.translate(TX + AISLE_HALF - 0.002, 0, 0);   // extruded across the aisle's width
      scene.add(new THREE.Mesh(g, riserMat));
    }

    // stadium tiers & 48 seats, v2: real cinema chairs — shared side standards
    // with armrests and cup holders, a reclined padded back in a plastic shell,
    // and a sprung seat that folds up against the back (see thSeatTick). The
    // fixed parts merge into 3 meshes; the 48 folding seats are one InstancedMesh
    const bankW = (TW - AISLE_HALF * 2) / 2;
    const seatPlush = new THREE.MeshLambertMaterial({ color: 0x9e1b24 });
    const seatDark = new THREE.MeshLambertMaterial({ color: 0x1c1a1e });
    const seatWood = new THREE.MeshLambertMaterial({ color: 0x4a2c18 });
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    const plushGeos = [], darkGeos = [], woodGeos = [];
    const pushGeo = (arr, geo, x, y, z, rx = 0) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (rx) g.rotateX(rx);
      g.translate(x, y, z); arr.push(g);
    };
    // a padded slab: rounded rectangle w x h (x, y from 0 up), extruded `depth` along +z with a soft bevel
    const padGeo = (w, h, r, depth, b) => {
      const x0 = -w / 2 + b, x1 = w / 2 - b, y0 = b, y1 = h - b, sh = new THREE.Shape();
      sh.moveTo(x0 + r, y0); sh.lineTo(x1 - r, y0); sh.quadraticCurveTo(x1, y0, x1, y0 + r); sh.lineTo(x1, y1 - r);
      sh.quadraticCurveTo(x1, y1, x1 - r, y1); sh.lineTo(x0 + r, y1); sh.quadraticCurveTo(x0, y1, x0, y1 - r);
      sh.lineTo(x0, y0 + r); sh.quadraticCurveTo(x0, y0, x0 + r, y0);
      return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 4 });
    };
    const RECLINE = -0.2;
    const backPad = padGeo(0.5, 0.6, 0.08, 0.05, 0.025);         // z -0.025..0.075, pivot at its bottom
    const backShell = padGeo(0.54, 0.68, 0.09, 0.02, 0.012);     // z -0.012..0.032
    const standard = new THREE.BoxGeometry(0.05, 0.6, 0.46), armrest = new THREE.BoxGeometry(0.085, 0.045, 0.4);
    const cupHolder = new THREE.CylinderGeometry(0.038, 0.032, 0.05, 12, 1, true);
    // the folding seat, hinged at its top back edge: cushion (plush) + the pan under it (dark), 0.44 deep along +z
    const cushion = padGeo(0.48, 0.44, 0.07, 0.07, 0.02); cushion.rotateX(Math.PI / 2); cushion.translate(0, -0.02, 0);   // top at y 0, z 0..0.44
    const pan = new THREE.BoxGeometry(0.44, 0.025, 0.38).toNonIndexed(); pan.translate(0, -0.125, 0.22);
    const hinges = [];

    for (let r = 0; r < R_ROWS; r++) {
      const z0 = R_Z0 + r * R_STEP_Z, z1 = z0 + R_STEP_Z, y = -(r + 1) * R_DROP;
      for (const s of [-1, 1]) {
        const bx = TX + s * (AISLE_HALF + bankW / 2);
        // solid tier block down to PIT_Y so aisle walls look closed from the ramp
        box(bankW, y - PIT_Y + 0.02, R_STEP_Z, tierFloorMat, bx, (y + PIT_Y) / 2 - 0.01, (z0 + z1) / 2);
        box(bankW, R_DROP + 0.02, 0.04, riserMat, bx, y + R_DROP / 2, z0 + 0.02);
        // red aisle step-edge marker light
        const strip = glow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.018, R_STEP_Z - 0.08), stepLightMat));
        strip.position.set(TX + s * (AISLE_HALF + 0.04), y + 0.01, (z0 + z1) / 2); scene.add(strip);

        // 4 seats per bank in this row (facing +z toward the screen)
        const seatPitch = 0.62, bankInner = TX + s * (AISLE_HALF + 0.48), sz = z0 + 0.36;
        for (let k = 0; k <= 4; k++) {                 // 5 standards: one each side of every seat, shared between neighbours
          const ax = bankInner + s * (k - 0.5) * seatPitch;
          pushGeo(darkGeos, standard, ax, y + 0.3, sz - 0.03);
          pushGeo(woodGeos, armrest, ax, y + 0.625, sz - 0.05);
          pushGeo(darkGeos, cupHolder, ax, y + 0.63, sz + 0.2);
        }
        for (let k = 0; k < 4; k++) {
          const sx = bankInner + s * k * seatPitch;
          pushGeo(plushGeos, backPad, sx, y + 0.47, sz - 0.275, RECLINE);    // padded front, reclined
          pushGeo(darkGeos, backShell, sx, y + 0.43, sz - 0.332, RECLINE);   // the plastic shell behind it
          const seat = { x: sx, y, z: sz + 0.04, rowZ: z0 + 0.86 };
          theaterSeats.push(seat);
          hinges.push({ seat, x: sx, y: y + 0.45, z: sz - 0.19, a: 1, v: 0 });   // starts folded up

          // invisible pick target so aiming at any seat and pressing E sits you right there
          const seatHit = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.82, 0.52), hitMat);
          seatHit.position.set(sx, y + 0.42, sz);
          seatHit.userData.sit = true;
          seatHit.userData.seatPos = seat;              // the same object as the theaterSeats entry: that's how a seat knows it's taken
          scene.add(seatHit); aimables.push(seatHit);
        }
        // row seat-back collider (leaves 0.72m legroom walkway in front of each row)
        colliders.push({
          x0: Math.min(bankInner, bankInner + s * 3 * seatPitch) - 0.28,
          x1: Math.max(bankInner, bankInner + s * 3 * seatPitch) + 0.28,
          z0: z0 + 0.08, z1: z0 + 0.56, y0: y, y1: y + 0.95, shadow: false,
        });
      }
    }
    scene.add(new THREE.Mesh(mergeGeometries(plushGeos), seatPlush));
    scene.add(new THREE.Mesh(mergeGeometries(darkGeos), seatDark));
    scene.add(new THREE.Mesh(mergeGeometries(woodGeos), seatWood));
    thSeatFolds = hinges;
    thCushions = new THREE.InstancedMesh(mergeGeometries([cushion, pan], true), [seatPlush, seatDark], hinges.length);
    thCushions.frustumCulled = false;                  // instances are spread over the whole house; the base geometry sits at the origin
    hinges.forEach((_, i) => thSeatPose(i));
    scene.add(thCushions);

    // acoustic wall drapery + warm brass wall sconces
    const sconceMat = thSconceMat = new THREE.MeshLambertMaterial({ color: 0xffe0a3, emissive: 0xff9d3b, emissiveIntensity: 0.85 });
    for (const s of [-1, 1]) {
      const wx = TX + s * (TW / 2 - 0.12);
      for (let z = 35.2; z < 44.5; z += 2.2) {
        box(0.05, 2.2, 1.5, curtainMat, wx, 0.8, z);
        box(0.08, 0.28, 0.16, brass, wx - s * 0.04, 1.55, z);
        const shade = glow(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.22, 10), sconceMat));
        shade.position.set(wx - s * 0.09, 1.68, z); scene.add(shade);
      }
    }

    // stage, curtains, silver screen, and front-row VCR feed podium
    const ST_Z0 = 44.8, ST_Y = -0.95;
    box(TW - 0.2, ST_Y - PIT_Y, TZ1 - ST_Z0, stageWood, TX, (ST_Y + PIT_Y) / 2, (ST_Z0 + TZ1) / 2);
    box(TW - 0.16, 0.05, TZ1 - ST_Z0 + 0.06, brass, TX, ST_Y + 0.025, (ST_Z0 + TZ1) / 2);
    colliders.push({ x0: TX0, x1: TX1, z0: ST_Z0 - 0.05, z1: TZ1, y0: PIT_Y, y1: ST_Y + 0.5 });

    // stage curtains & valance framing the 5.7m x 3.8m screen (3:2, the video canvas's shape), stage top to valance
    for (const s of [-1, 1]) box(0.9, TH - ST_Y, 0.22, curtainMat, TX + s * (TW / 2 - 0.57), (TH + ST_Y) / 2, 45.75);   // inner edges ±3.08, just clear of the screen
    box(TW - 0.2, 0.55, 0.26, curtainMat, TX, TH - 0.28, 45.7);
    box(5.94, 4.04, 0.08, mat.dark, TX, 1.05, 45.92);

    theaterScreenMesh = glow(new THREE.Mesh(new THREE.PlaneGeometry(5.7, 3.8), mat.dark));
    theaterScreenMesh.position.set(TX, 1.05, 45.85);
    theaterScreenMesh.rotation.y = Math.PI;          // faces -z toward the stadium seats
    scene.add(theaterScreenMesh);
    aimables.push(theaterScreenMesh);

    // small VCR deck at the center of the stage apron so you can load/eject tapes right in the theater
    const deck = box(0.46, 0.12, 0.32, mat.dark, TX, ST_Y + 0.08, ST_Z0 + 0.22);
    deck.userData.theaterDeck = true; aimables.push(deck);
    const deckLbl = textPlane("THEATER VCR FEED", 0.42, 0.07, "#ffd400", "#14161a");
    deckLbl.position.set(TX, ST_Y + 0.08, ST_Z0 + 0.058); deckLbl.rotation.y = Math.PI; scene.add(deckLbl);

    // projection booth ports + volumetric projector beam + EXIT sign on the back wall (z = TZ0)
    box(1.4, 0.55, 0.06, mat.dark, TX + 1.8, 2.25, TZ0 + 0.12);
    for (const dx of [-0.35, 0.35]) {
      const port = glow(new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.22), new THREE.MeshBasicMaterial({ color: dx < 0 ? 0xffffff : 0x5577aa })));
      port.position.set(TX + 1.8 + dx, 2.25, TZ0 + 0.155); scene.add(port);
    }
    {
      const beamTex = makeTexture((ctx, W, H) => {
        const img = ctx.createImageData(W, H), d = img.data;
        for (let y = 0; y < H; y++) {
          const along = Math.pow(1 - y / H, 2.6);                // hugs the booth, dies out well before the screen
          for (let x = 0; x < W; x++) {
            const a = (x / W) * Math.PI * 2;                     // seamless around the cylinder circumference
            const ray = 0.78 + 0.22 * Math.sin(a * 5) * Math.cos(a * 3);
            const alpha = Math.round(255 * along * ray);
            const i = (y * W + x) * 4;
            d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = alpha;
          }
        }
        ctx.putImageData(img, 0, 0);
      }, 128, 256);
      projBeamMat = new THREE.MeshBasicMaterial({
        map: beamTex, color: 0xfff8ee, transparent: true, opacity: 0.01,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      });
      // sections of the picture ride the beam: aScr is where each vertex sits in
      // the frame (0..1, top-left origin), and the fragment blends the 3x3 zone
      // colors there — saturation pushed, since the zones are frame averages
      projBeamMat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, beamU);
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute vec2 aScr; varying vec2 vScr;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvScr = aScr;");
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform vec3 uBeamZ[9]; uniform float uBeamOn; varying vec2 vScr;")
          .replace("#include <map_fragment>", `#include <map_fragment>
            vec2 g = clamp(vScr * 3.0 - 0.5, 0.0, 2.0);
            ivec2 a = ivec2(floor(g)), b = min(a + 1, 2); vec2 f = g - vec2(a);
            vec3 zc = mix(mix(uBeamZ[a.y * 3 + a.x], uBeamZ[a.y * 3 + b.x], f.x), mix(uBeamZ[b.y * 3 + a.x], uBeamZ[b.y * 3 + b.x], f.x), f.y);
            zc = max(mix(vec3(dot(zc, vec3(0.2126, 0.7152, 0.0722))), zc, 3.0), 0.0);
            zc *= 0.8 * inversesqrt(max(max(zc.r, max(zc.g, zc.b)), 0.01));   // brightness -> sqrt: dark sections dim, not black
            diffuseColor.rgb *= mix(vec3(1.0), zc, uBeamOn);`);
      };
      const P0 = new THREE.Vector3(TX + 1.45, 2.25, TZ0 + 0.16);
      const P1 = new THREE.Vector3(TX, 1.35, 45.85);
      const len = 8.5;                                           // stops mid-house so it never hangs over the screen
      // 4 nested concentric cones (no flat crossed fins -> no '+' shape at the port)
      const shells = [
        [0.075, 1.25, 1.00],
        [0.055, 0.90, 0.92],
        [0.038, 0.58, 0.84],
        [0.020, 0.28, 0.75],
      ].map(([r0, r1, k]) => {
        const g = new THREE.CylinderGeometry(r0, r1, len * k, 24, 1, true);
        g.translate(0, len * (1 - k) / 2, 0);
        return g;
      });
      const cone = mergeGeometries(shells);
      cone.translate(0, -len / 2, 0); cone.rotateX(-Math.PI / 2);   // axis now 0..len along +z, +z aimed at the screen
      {                                                      // frame position per vertex, against the outer shell's radius there
        const p = cone.attributes.position, scr = new Float32Array(p.count * 2);
        for (let i = 0; i < p.count; i++) {
          const R = 0.075 + 1.175 * p.getZ(i) / len;
          scr[i * 2] = 0.5 - 0.5 * p.getX(i) / R;            // local +x is world +x: the audience's left
          scr[i * 2 + 1] = 0.5 - 0.5 * p.getY(i) / R;        // +y up = top of the frame
        }
        cone.setAttribute("aScr", new THREE.BufferAttribute(scr, 2));
      }
      const beam = new THREE.Mesh(cone, projBeamMat);
      beam.position.copy(P0); beam.lookAt(P1);
      beam.userData.clearToBloom = true;
      scene.add(beam);

      const lens = glow(new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), new THREE.MeshBasicMaterial({ color: 0xfffbe6 })));
      lens.position.set(P0.x, P0.y, P0.z + 0.01);
      scene.add(lens);
    }
    const exitSign = glow(textPlane("EXIT", 0.46, 0.18, "#ffffff", "#b3121d", "Arial Black", 76));
    exitSign.position.set(TX, DOOR_H + 0.25, TZ0 + WALL_T / 2 + 0.02); scene.add(exitSign);   // over the door, facing the seats
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
  const troffer = (x, z, y, snapZ = true) => {
    x = Math.round((x - CEIL_TILE.x / 2) / CEIL_TILE.x) * CEIL_TILE.x + CEIL_TILE.x / 2;   // centered in a tile slot
    if (snapZ) z = Math.round((z - CEIL_TILE.z / 2) / CEIL_TILE.z) * CEIL_TILE.z + CEIL_TILE.z / 2;   // (the hall's grid is its own: its lights go where they're told)
    const p = new THREE.PlaneGeometry(CEIL_TILE.x - 0.02, CEIL_TILE.z - 0.02); p.rotateX(Math.PI / 2); p.translate(x, y - 0.02, z);
    const key = `${lightZoneAt(x, z)}:${Math.floor(Math.random() * PANEL_GROUPS)}`;
    if (!panelBuckets.has(key)) panelBuckets.set(key, []);
    panelBuckets.get(key).push(p);
  };
  for (const [x, z] of [[-5.4, 30.15], [-1.8, 30.15]]) troffer(x, z, BOH.h);   // movie theater lobby troffers
  // every other tile slot across, every fourth along — a tile or more of
  // plain ceiling on every side, so no two fixtures ever touch
  for (let x = -9.9; x <= STORE.x - 1; x += 2 * CEIL_TILE.x) for (let z = 3.15; z <= STORE.z - 1; z += 4 * CEIL_TILE.z) {
    if (x - CEIL_TILE.x / 2 < XL + 0.3) continue;   // don't float panels past the pulled-in movie-side wall
    troffer(x, z, STORE.h);
  }
  for (const x of [4.5, 8.1]) troffer(x, hallMid, BOH.h, false);              // down the middle of the hall (its ceiling grid is centered there too)
  for (const [x, z] of [[4.5, 31.05], [9.9, 31.05]]) troffer(x, z, BOH.h);   // breakroom, restroom
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
  TVU.uBohBox.value.set(BOH.x0, CLOSET.x1 + 0.05, BOH.hallZ, BOH.z1 + 0.05); TVU.uBohSplit.value.set(BOH.splitX, BOH.h);
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
// the counter's VHS rewinders (models built with the counter, logic near the
// rewind policy): each { tape = the copy inside, f0/dur/t = rewind progress, tapeMesh, led, snd }
const rewinders = [];
let phoneLook = () => {};                    // (set when the phone is built)
let popcornMachine = null, theaterSign = null, jobBoardMesh = null;
const COUNTER = { y: 1.08, tops: [], groups: {} };   // the checkout counter's usable worktop (rectangles, world x/z) and the things on it that can be moved (see counter moves)   // (simulation: bought later — see amenities)
const PHONE_AT = new THREE.Vector3(), HOLDS_AT = new THREE.Vector3();   // the desk phone / the holds tray, on the back cabinet (set when it's built)
const PRN_AT = { x: -4.62, z: 3.93 };           // the receipt printer's paper slot
const printer = { strip: null, tex: null, job: null };   // the receipt feeding out of it (see printReceipt)
const DESENS_AT = { x: -4.95, z: 3.92 };       // the desensitizer pad, beside the register
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
  function counterRun(len, { cubbies = [], miterStart = false, miterEnd = false, endTrim = false, logo = null, drawer = null, stock = null } = {}) {   // stock: (door i, doors) -> "food" | "drinks" | null: a stock cupboard   // drawer: [x0, x1] a drawer front sits over
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
    doorsAt.forEach((d, i) => {                // doors under a drawer stop short of it
      const under = drawer && d + 0.5 > drawer[0] && d < drawer[1], top = under ? TOP - 0.23 : by + 0.02 + (BH - 0.12) / 2, bot = by + 0.02 - (BH - 0.12) / 2;
      const door = add(0.49, top - bot, 0.015, blueDk, d + 0.25, (top + bot) / 2, -CD / 2 + 0.002);
      const pull = add(0.012, 0.12, 0.02, chromeC, d + 0.43, top - 0.14, -CD / 2 - 0.01);
      const kind = stock?.(i, doorsAt.length);
      if (kind) {                              // a stock cupboard: labelled, and E on it hands out restock
        const lbl = textPlane(kind === "food" ? "SNACK STOCK" : "DRINK STOCK", 0.3, 0.06, "#fff", kind === "food" ? "#8a5a1c" : "#1c5a8a", "Arial", 60);
        lbl.material = new THREE.MeshLambertMaterial({ map: lbl.material.map }); lbl.position.set(d + 0.22, top - 0.1, -CD / 2 - 0.008); lbl.rotation.y = Math.PI; g.add(lbl);
        for (const m of [door, pull, lbl]) { m.userData.stock = kind; aimables.push(m); }
      }
    });
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
  const east = counterRun(eLen, { cubbies: [{ x0: RET - 0.42, x1: RET + 0.42, y0: 0.14, y1: 0.66 }], miterStart: true,
    stock: (i, n) => i < Math.ceil(n / 2) ? "drinks" : "food" });   // the stockroom, such as it is: drinks nearest the cooler end, snacks toward the front
  east.position.set(RX, 0, 4 - CD / 2); east.rotation.y = Math.PI / 2;      // local +x runs south (world -z), customer face east
  colliders.push({ x0: RX - CD / 2, x1: RX + CD / 2 + 0.08, z0: FRONT, z1: 4 - CD / 2, y1: TOP + 0.17 });
  // register: a beige CRT point-of-sale terminal with keyboard + mouse, where
  // the old black box stood — facing the employee side (toward the doors' wall)
  {
    const pos = new THREE.Group(); pos.position.set(-5.45, 1.08, 4); pos.rotation.y = Math.PI; scene.add(pos); COUNTER.groups.register = pos;   // local +z = employee side
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
  // tape rewinders: the classic little sports-car shaped ones, a pair on the
  // lane counter either side of the returns tote (placed below, once RZ is
  // known). Each is a little convertible facing the employee side; a loaded tape rides in its open cockpit
  function buildRewinder(x, z, ry) {
    const rw = { tape: null, f0: 0, dur: 0, t: 0, done: false, tapeMesh: null, led: null, snd: null };
    const g = new THREE.Group(); g.position.set(x, TOP, z); g.rotation.y = ry; scene.add(g);
    const red = new THREE.MeshPhongMaterial({ color: 0xc41e1e, specular: 0xffffff, shininess: 80 });
    const blackP = new THREE.MeshPhongMaterial({ color: 0x151515, specular: 0x555555, shininess: 50 });
    const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    const W = 0.17, A = 0.036;                  // body width; wheel-arch radius
    // side profile (+x = nose), extruded across the width with rounded edges; the dip is the open cockpit
    const p = new THREE.Shape();
    p.moveTo(-0.22, 0.014); p.lineTo(-0.14 - A, 0.014); p.lineTo(-0.14 - A, 0.028);
    p.absarc(-0.14, 0.028, A, Math.PI, 0, true); p.lineTo(-0.14 + A, 0.014);
    p.lineTo(0.15 - A, 0.014); p.lineTo(0.15 - A, 0.028);
    p.absarc(0.15, 0.028, A, Math.PI, 0, true); p.lineTo(0.15 + A, 0.014);
    p.lineTo(0.235, 0.018); p.lineTo(0.245, 0.036);
    p.quadraticCurveTo(0.235, 0.058, 0.17, 0.066); p.lineTo(0.085, 0.072);       // long hood up to the cowl
    p.lineTo(0.085, 0.048); p.lineTo(-0.125, 0.048); p.lineTo(-0.125, 0.076);    // cockpit
    p.lineTo(-0.19, 0.078); p.quadraticCurveTo(-0.222, 0.076, -0.225, 0.05); p.lineTo(-0.22, 0.014);   // rear deck, tail
    const bodyGeo = new THREE.ExtrudeGeometry(p, { depth: W - 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 3, curveSegments: 12 });
    bodyGeo.translate(0, 0, -(W - 0.012) / 2);
    add(bodyGeo, red, 0, 0, 0);
    for (const z of [-1, 1]) add(new THREE.BoxGeometry(0.21, 0.026, 0.012), red, -0.02, 0.061, z * (W / 2 - 0.006));   // door tops, closing the cockpit sides
    add(new THREE.BoxGeometry(0.21, 0.004, W - 0.024), blackP, -0.02, 0.057, 0);             // cockpit floor (over the bevel)
    const lean = 0.55, glass = add(new THREE.BoxGeometry(0.003, 0.05, W - 0.02),
      new THREE.MeshPhongMaterial({ color: 0x9fc6de, transparent: true, opacity: 0.35, specular: 0xffffff, shininess: 100 }),
      0.085 - 0.025 * Math.sin(lean), 0.074 + 0.025 * Math.cos(lean), 0);
    glass.rotation.z = lean;                                                                  // raked windshield
    const top = add(new THREE.BoxGeometry(0.006, 0.006, W - 0.014), chromeC, 0.085 - 0.05 * Math.sin(lean), 0.074 + 0.05 * Math.cos(lean), 0);
    top.rotation.z = lean;                                                                    // its chrome header
    for (const x of [0.25, -0.228]) add(new THREE.BoxGeometry(0.01, 0.012, W - 0.02), chromeC, x, 0.022, 0);   // bumpers
    for (const x of [-0.14, 0.15]) for (const z of [-1, 1]) {
      const w = add(new THREE.CylinderGeometry(0.028, 0.028, 0.022, 20), blackP, x, 0.028, z * (W / 2 - 0.008)); w.rotation.x = Math.PI / 2;
      const hub = add(new THREE.CylinderGeometry(0.014, 0.014, 0.004, 16), chromeC, x, 0.028, z * (W / 2 + 0.004)); hub.rotation.x = Math.PI / 2;
    }
    for (const z of [-0.05, 0.05]) {
      add(new THREE.BoxGeometry(0.008, 0.012, 0.028), new THREE.MeshBasicMaterial({ color: 0xfff6c8 }), 0.243, 0.042, z);   // headlights
      glow(add(new THREE.BoxGeometry(0.006, 0.01, 0.03), new THREE.MeshBasicMaterial({ color: 0xff2a2a }), -0.226, 0.058, z));   // taillights
    }
    rw.led = glow(add(new THREE.BoxGeometry(0.012, 0.012, 0.004), new THREE.MeshBasicMaterial({ color: 0x222222 }), 0.03, 0.04, W / 2 + 0.002));   // status LED on the side
    rw.tapeMesh = add(new THREE.BoxGeometry(TAPE.h, TAPE.w, TAPE.d), mat.tapeBody, -0.02, 0.059 + TAPE.w / 2, 0);   // lies lengthwise in the cockpit
    rw.tapeMesh.visible = false;
    g.traverse(o => { if (o.isMesh) { o.userData.rewinder = rw; aimables.push(o); } });
    rw.g = g; rewinders.push(rw);
  }

  // ---- returns: a stainless drop slot on the lane face, into a tote in the cubby behind ----
  const RZ = 4 - CD / 2 - RET;                 // world z of the slot / tote
  const steelC = new THREE.MeshPhongMaterial({ color: 0xaab2ba, specular: 0xffffff, shininess: 70 });
  box(0.012, 0.3, 0.5, steelC, RX + CD / 2 + 0.006, 0.82, RZ);                                   // drop plate
  box(0.008, 0.05, 0.38, mat.dark, RX + CD / 2 + 0.014, 0.86, RZ);                                // the slot
  returnSlotMesh = box(0.02, 0.07, 0.4, chromeC, RX + CD / 2 + 0.02, 0.9, RZ);                     // its hinged lip — the E target from the lane
  returnSlotMesh.userData.returns = true; aimables.push(returnSlotMesh);
  for (const dz of [-0.46, 0.46]) buildRewinder(RX - 0.12, RZ + dz, -Math.PI / 2);
  // the worktop things can be set down on: the north run behind its transaction ledge, and the east run behind its ledge
  COUNTER.y = TOP;
  COUNTER.tops.push({ x0: FLAP_X1 + 0.03, x1: RX + CD / 2 - 0.03, z0: 4 - CD / 2 + 0.02, z1: 4 + CD / 2 - 0.16, run: "north", staff: 4 - CD / 2 - 0.5 },
    { x0: RX - CD / 2 + 0.02, x1: RX + CD / 2 - 0.16, z0: 0.13, z1: 4 - CD / 2 + 0.02, run: "east", staff: RX - CD / 2 - 0.5 });   // on the worktop over the tote, clear of the ledge; local +z (its face) = world -x, the employee side
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
  // receipt printer beside the register
  // a squat charcoal thermal printer: paper roll under a rounded clamshell at the back, the slot and
  // tear bar at the seam, a front deck (clerk side, -z) with the feed button and power LED
  const PRN = PRN_AT.x;                       // the receipt printer: past the desensitizer, toward the register
  const prnG = new THREE.Group(); prnG.position.set(PRN, TOP, PRN_AT.z + 0.028); scene.add(prnG);
  const prnC = new THREE.MeshPhongMaterial({ color: 0x2b2d31, specular: 0x333333, shininess: 30 }), prnLid = new THREE.MeshPhongMaterial({ color: 0x3a3d42, specular: 0x555555, shininess: 50 });
  put(new THREE.BoxGeometry(0.15, 0.06, 0.2), prnC, 0, 0.03, 0, prnG);                                        // base
  const lid = put(new THREE.CylinderGeometry(0.058, 0.058, 0.148, 24), prnLid, 0, 0.062, 0.035, prnG); lid.rotation.z = Math.PI / 2;   // roll cover
  put(new THREE.BoxGeometry(0.15, 0.032, 0.075), prnC, 0, 0.074, -0.0625, prnG);                              // front deck
  put(new THREE.BoxGeometry(0.1, 0.004, 0.01), blackC, 0, 0.091, -0.028, prnG);                               // paper slot
  put(new THREE.BoxGeometry(0.11, 0.006, 0.004), chromeC, 0, 0.094, -0.035, prnG);                            // tear bar
  put(new THREE.BoxGeometry(0.07, 0.012, 0.002), new THREE.MeshLambertMaterial({ color: 0xf3efe2 }), 0, 0.098, -0.031, prnG);   // a tail of paper, always showing
  put(new THREE.BoxGeometry(0.03, 0.008, 0.016), new THREE.MeshLambertMaterial({ color: 0x9a9ea4 }), 0.035, 0.093, -0.075, prnG);   // FEED button
  glow(put(new THREE.BoxGeometry(0.008, 0.004, 0.008), new THREE.MeshBasicMaterial({ color: 0x40ff70 }), -0.05, 0.091, -0.08, prnG));   // power LED
  prnG.traverse(o => { if (o.isMesh) { o.userData.printer = true; aimables.push(o); } });
  // a sale's receipt feeds up out of the slot toward the clerk, top of the slip first, curling
  // over as it comes (the curl is in z, so scaling z with the length keeps it in proportion)
  const stripG = new THREE.PlaneGeometry(0.07, 1, 1, 16).translate(0, 0.5, 0), sp = stripG.attributes.position;
  for (let i = 0; i < sp.count; i++) sp.setZ(i, 0.16 * sp.getY(i) ** 2);
  stripG.computeVertexNormals();
  const strip = printer.strip = new THREE.Mesh(stripG, new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide, alphaTest: 0.5 }));
  strip.position.set(0, 0.098, -0.028); strip.rotation.set(-0.2, Math.PI, 0); strip.visible = false;   // (in the printer's own frame: it goes where the printer goes)
  strip.userData.printer = true; prnG.add(strip); aimables.push(strip);
  COUNTER.groups.printer = prnG;
  // security-tag deactivator pad (the "desensitizer"): tapes run across it before they leave
  const desG = new THREE.Group(); desG.position.set(DESENS_AT.x, TOP, DESENS_AT.z); scene.add(desG); COUNTER.groups.desens = desG;   // right beside the register
  const padMesh = put(new THREE.BoxGeometry(0.28, 0.025, 0.2), blackC, 0, 0.0125, 0, desG);
  desensLed = glow(put(new THREE.BoxGeometry(0.012, 0.006, 0.012), new THREE.MeshBasicMaterial({ color: 0xff3020 }), 0.12, 0.028, -0.08, desG));
  padMesh.userData.desens = true; aimables.push(padMesh);
  const deac = textPlane("DESENSITIZE", 0.2, 0.04, "#ddd", "#151515", "Arial", 60);
  deac.material = new THREE.MeshLambertMaterial({ map: deac.material.map }); deac.position.set(-0.02, 0.026, 0); deac.rotation.x = -Math.PI / 2; deac.rotation.z = Math.PI; desG.add(deac);
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
    // multi-line desk phone (a 2565-style key set): sloped body, handset across the cradle, a Touch-Tone pad,
    // a row of lit line buttons along the front, and a coiled cord. Its front faces you behind the counter
    const ph = new THREE.Group(); ph.position.set(-6.4, BHt, bz); scene.add(ph); PHONE_AT.set(-6.4, BHt + 0.08, bz);
    const slope = Math.atan2(0.04, 0.22);
    const prof = new THREE.Shape([new THREE.Vector2(-0.11, 0), new THREE.Vector2(0.11, 0), new THREE.Vector2(0.11, 0.075), new THREE.Vector2(-0.11, 0.035)]);
    const bodyG = new THREE.ExtrudeGeometry(prof, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 1 });
    bodyG.rotateY(Math.PI / 2); bodyG.translate(-0.11, 0.008, 0);   // profile x -> -z: the low edge at the front (+z)
    put(bodyG, beigeP, 0, 0, 0, ph);
    const top = new THREE.Group(); top.position.set(0, 0.071, 0); top.rotation.x = slope; ph.add(top);   // the sloped top face
    put(new THREE.BoxGeometry(0.085, 0.003, 0.1), blackC, 0, 0.001, 0.045, top);                         // keypad bezel
    const keyM = new THREE.MeshPhongMaterial({ color: 0xf2efe6, shininess: 40 });
    for (let i = 0; i < 12; i++) put(new THREE.BoxGeometry(0.019, 0.007, 0.015), keyM, -0.025 + (i % 3) * 0.025, 0.004, 0.01 + Math.floor(i / 3) * 0.022, top);
    const digits = makeTexture((ctx, W, H) => {
      ctx.clearRect(0, 0, W, H); ctx.fillStyle = "#222"; ctx.font = "bold 24px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      "123456789*0#".split("").forEach((c, i) => ctx.fillText(c, W * (0.5 + (i % 3 - 1) * 0.294), H * (0.225 + Math.floor(i / 3) * 0.1833)));
    }, 128, 180);
    const keyLbl = put(new THREE.PlaneGeometry(0.085, 0.12), new THREE.MeshBasicMaterial({ map: digits, transparent: true, depthWrite: false }), 0, 0.0078, 0.043, top);
    keyLbl.rotation.x = -Math.PI / 2;
    for (const x of [-0.085, 0.085]) put(new THREE.BoxGeometry(0.04, 0.02, 0.05), beigeP, x, 0.008, -0.055, top);   // cradle horns
    put(new THREE.BoxGeometry(0.008, 0.006, 0.012), blackC, 0.085, 0.02, -0.055, top);                     // hookswitch plunger
    const handset = new THREE.Group(); handset.position.set(0, 0.044, -0.055); top.add(handset);
    const grip = put(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 12), beigeP, 0, 0.012, 0, handset); grip.rotation.z = Math.PI / 2; grip.scale.set(1, 1, 1.5);
    for (const x of [-0.09, 0.09]) {                  // earpiece / mouthpiece cups, flared, face down in the cradle
      put(new THREE.CylinderGeometry(0.022, 0.034, 0.036, 24), beigeP, x, -0.004, 0, handset);
      put(new THREE.TorusGeometry(0.03, 0.003, 8, 24).rotateX(Math.PI / 2), beigeP, x, -0.022, 0, handset);   // rolled rim
      put(new THREE.CylinderGeometry(0.027, 0.027, 0.002, 24), blackC, x, -0.0225, 0, handset);                // grille
    }
    const lampOff = new THREE.MeshLambertMaterial({ color: 0xcfd6d8 }), lampLit = new THREE.MeshBasicMaterial({ color: 0xffb040 });
    const lamps = [];                                 // line buttons: clear plastic, lit from behind
    for (let i = 0; i < 6; i++) lamps.push(put(new THREE.BoxGeometry(0.024, 0.014, 0.008), lampOff, -0.075 + i * 0.03, 0.022, 0.122, ph));
    put(new THREE.BoxGeometry(0.2, 0.004, 0.006), blackC, 0, 0.034, 0.12, ph);                             // designation strip over them
    // coiled cord: handset's left end, down onto the cabinet top, back up into the body's side
    const A = new THREE.Vector3(-0.1, 0.075, -0.05), B = new THREE.Vector3(-0.125, 0.02, 0.02), C = new THREE.Vector3(-0.2, -0.02, 0.0);
    const spine = new THREE.QuadraticBezierCurve3(A, C, B);
    const coil = new THREE.Curve(); coil.getPoint = (t, v = new THREE.Vector3()) => {
      const p = spine.getPoint(t), tg = spine.getTangent(t), n = new THREE.Vector3(0, 0, 1).cross(tg).normalize(), b = tg.clone().cross(n), a = t * Math.PI * 2 * 26;
      p.y = Math.max(p.y, 0.004); return v.copy(p).addScaledVector(n, 0.005 * Math.cos(a)).addScaledVector(b, 0.005 * Math.sin(a));
    };
    put(new THREE.TubeGeometry(coil, 520, 0.0018, 5), beigeP, 0, 0, 0, ph);
    phoneLook = now => {                              // handset off the hook while you're on a call; line 1 flashes while it rings
      handset.visible = !phone.call;
      lamps[0].material = phone.call || (phone.ring && now % 1000 < 500) ? lampLit : lampOff;
    };
    ph.traverse(m => { if (m.isMesh) { m.userData.phone = true; aimables.push(m); } });
    // stack of brown paper bags
    const kraft = new THREE.MeshLambertMaterial({ color: 0xa8804f });
    for (let i = 0; i < 6; i++) put(new THREE.BoxGeometry(0.3, 0.008, 0.2), kraft, -5.6 + (i % 2) * 0.01, BHt + 0.004 + i * 0.008, bz);
    // reserved holds: whatever's been put aside for someone, stacked with a slip on each (see holdsRender)
    const pad = put(new THREE.BoxGeometry(0.4, 0.2, 0.34), new THREE.MeshBasicMaterial({ visible: false }), -4.4, BHt + 0.1, bz);
    pad.userData.holds = true; aimables.push(pad);
    const tray = put(new THREE.BoxGeometry(0.34, 0.012, 0.26), new THREE.MeshLambertMaterial({ color: 0x2a2e35 }), -4.4, BHt + 0.006, bz);
    const lbl = textPlane("HOLDS", 0.12, 0.035, "#222", "#fff59a", "Arial Black", 60); lbl.material = new THREE.MeshLambertMaterial({ map: lbl.material.map });
    lbl.position.set(-4.4, BHt + 0.0125, bz + 0.1); lbl.rotation.x = -Math.PI / 2; lbl.rotation.z = Math.PI; scene.add(lbl);
    HOLDS_AT.set(-4.4, BHt + 0.012, bz);
    // Dana's job board: a little cork board on an easel, facing the register
    const jb = new THREE.Group(); jb.position.set(-5.25, BHt, bz - 0.08); jb.rotation.x = -0.12; scene.add(jb);
    const frame = put(new THREE.BoxGeometry(0.52, 0.36, 0.02), new THREE.MeshLambertMaterial({ color: 0x5a3b22 }), 0, 0.2, 0, jb);
    const cork = put(new THREE.BoxGeometry(0.47, 0.31, 0.012), new THREE.MeshLambertMaterial({ map: makeTexture((g, w, h) => {
      g.fillStyle = "#b98a55"; g.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${90 + Math.random() * 60},${60 + Math.random() * 40},30,.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      g.fillStyle = "#fff8c8"; g.fillRect(w * 0.08, h * 0.1, w * 0.84, h * 0.2); g.fillStyle = "#222"; g.font = `bold ${h * 0.12}px Arial`; g.textAlign = "center"; g.fillText("JOB BOARD", w / 2, h * 0.25);
      ["#ffd6d6", "#d6f0ff", "#e3ffd6", "#fff0c8", "#f0d6ff", "#d6fff4"].forEach((c, i) => { g.fillStyle = c; g.fillRect(w * (0.08 + (i % 3) * 0.29), h * (0.4 + Math.floor(i / 3) * 0.28), w * 0.25, h * 0.22); });
    }, 256, 170) }), 0, 0.2, 0.012, jb);
    for (const m of [frame, cork]) { m.userData.jobBoard = true; aimables.push(m); }
    jobBoardMesh = { g: jb, parts: [frame, cork] };   // (simulation: it goes up once Dana's hired — see amenities)
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
let trashFlap = null, trashFlapT = 0, trashFlapRest = 0;   // rest: held ajar when the bin's nearly full
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
  const over = new THREE.Group(); over.position.set(0, 0.63, W / 2 + 0.02); g.add(over); over.visible = false;   // nearly full: what's stopping the flap closing
  const wad = new THREE.Mesh(new THREE.IcosahedronGeometry(0.045, 0), new THREE.MeshLambertMaterial({ color: 0xf0ede4 })); wad.position.set(0.09, 0, 0.01); over.add(wad);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.13, 12), new THREE.MeshLambertMaterial({ color: 0xc8302a })); cup.rotation.set(0.3, 0, Math.PI / 2 - 0.2); cup.position.set(-0.08, 0.005, 0.02); over.add(cup);
  const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.06), new THREE.MeshLambertMaterial({ color: 0xe0b020 })); wrap.position.set(0, -0.02, 0.03); wrap.rotation.set(0.4, 0.5, 0); over.add(wrap);
  parts.push(wad, cup, wrap);
  trashBins.lobby = { id: "lobby", name: "lobby trash", cap: 16, x: TX, z: TZ, closed: true, liner: 0x1c1c1e, parts, over, stand: { x: TX, z: TZ + 0.7, ry: Math.PI } };
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
      tick(dt) {                              // climbs toward room temperature while the door's open; pulls back down to 36°F (slowly) once it shuts
        this.temp += ((coolerOpen ? 66 : 36) - this.temp) * Math.min(1, dt * (coolerOpen ? (upg.compressor ? 0.012 : 0.02) : (upg.compressor ? 0.03 : 0.012)));
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
    popcornMachine = { g, cols: colliders.slice(-2) };   // (simulation: bought later — see amenities)
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
  {
    const lobRack = buildSnackRack(1.2, "CONCESSIONS");
    lobRack.position.set(-3.4, 0, 28.1 + RD / 2); scene.add(lobRack);
    colliders.push({ x0: -4.0, x1: -2.8, z0: 28.0, z1: 28.1 + RD });
  }
}

// ---------------- posters on the walls ----------------
const marquee = [];   // flashing bulbs around the posters: { mesh, phases } — one InstancedMesh per poster, a color per bulb
const bulbTmp = new THREE.Color();
const posterMats = [];                     // lamps-out mode: posters glow faintly under their marquees
// the marquee's warm spill on the wall around each poster: one shared soft
// halo texture, additively blended — a real point light per poster (~21 of
// them) made every lit pixel in the store pay for every poster
const haloMat = new THREE.MeshBasicMaterial({ color: 0xffcf70, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
  map: (() => { const c = document.createElement("canvas"); c.width = 64; c.height = 80; const g = c.getContext("2d");
    const r = g.createRadialGradient(32, 40, 10, 32, 40, 40); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.55, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 80); return new THREE.CanvasTexture(c); })() });
{
  // chosen by fetch-covers.mjs: top movies + a few top non-cartoon shows
  const picks = (window.VAULT_POSTERS || []).map(art => ({ art }));
  const loader = new THREE.TextureLoader();
  const bulbGeo = new THREE.SphereGeometry(0.022, 6, 5), bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });   // white: the instance colors carry the chase
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
      const bulbs = glow(new THREE.InstancedMesh(bulbGeo, bulbMat, pts.length)), bd = new THREE.Object3D();
      pts.forEach(([px, py], j) => { bd.position.set(px, py, 0.04); bd.updateMatrix(); bulbs.setMatrixAt(j, bd.matrix); bulbs.setColorAt(j, bulbTmp.set(0xffd400)); });
      g.add(bulbs);
      marquee.push({ mesh: bulbs, phases: pts.map((_, j) => i * 1.3 + j * 0.55) });
      // the bulbs' warm spill on the wall around it (see haloMat)
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.1), haloMat); halo.position.z = -0.046; g.add(halo);
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
    const S = LOWMEM ? 0.5 : 1;                   // phones: a 1024² canvas drawn at half scale (a quarter of the memory; same layout and UVs)
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 2048 * S;
    const ctx = canvas.getContext("2d"); ctx.scale(S, S);
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
const endTags = [];      // endcap genre lists: { mat, cats, w, lineH } (signsRefresh swaps a locked section for COMING SOON)
let mvTopper = null;     // the MONSTERVISION topper (not up until the section's bought)
function signsRefresh() {                     // simulation: a section that isn't in yet says COMING SOON instead of its genre
  const soon = cat => libLocked({ category: cat });
  for (const [cat, m] of Object.entries(catStripMat)) {
    if (cat === "__soon") continue;
    m.userData.real ??= m.map;
    m.map = soon(cat) ? (catStripMat.__soon ??= stripTexture("Coming Soon")).map : m.userData.real; m.needsUpdate = true;
  }
  for (const t of endTags) {
    t.real ??= t.mat.map; let said = false;
    const lines = t.cats.map(c => !soon(c) ? c : said ? "" : (said = true, "COMING SOON"));
    t.mat.map = said ? tagPlane(lines, t.w, t.lineH).material.map : t.real; t.mat.needsUpdate = true;
  }
  if (mvTopper) mvTopper.visible = !soon("MonsterVision");
}
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
    endTags.push({ mat: tag.material, cats, w: frontAt(1.1 + cats.length * 0.08, spec) - 0.04, lineH: 0.14 });   // (the clone at the far end shares this material)
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
      for (let k = 0; k < n[i]; k++) { const c = k ? newCopy(t) : t; if (k) t.copies.push(c); stock.push(c); }   // a copy is the same tape in every way but where it sits
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
    return ts.flatMap(t => extra.has(t) ? [t, (() => { const c = newCopy(t); (t.copies ||= []).push(c); return c; })()] : [t]);
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
    const ts = row.flatMap(tapesNamed).slice(0, SHORT.perRow).map(t => { const c = newCopy(t); (t.copies ||= []).push(c); return c; });
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
    mvTopper = new THREE.Group(); scene.add(mvTopper);
    mvTopper.add(box(2.5, 0.5, 0.06, mat.dark, cx, SHORT.h + 0.25, z + 0.03));
    const sg = textPlane("MONSTERVISION", 2.4, 0.42, "#7dff3a", "#0b0b0b");
    sg.material = new THREE.MeshLambertMaterial({ map: sg.material.map });
    sg.position.set(cx, SHORT.h + 0.25, z + 0.066); mvTopper.add(sg);
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
  brightness: 100, contrast: 100, saturate: 100, hue: 0, sharpen: 0, volume: 100 };
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
  { k: "volume", label: "VOLUME", min: 0, max: 100, step: 5 },   // the tape's sound only (M is the store's)
];
// menu layout on the 480x320 screen canvas
const TVM = { rowY: 58, rowH: 21, labelX: 44, barX: 214, barW: 190, chkX: 214, chkW: 26, btnY: 272, btnH: 30,
  buttons: [{ k: "reset", label: "RESET", x: 128, w: 100 }, { k: "close", label: "CLOSE", x: 252, w: 100 }] };
let tvMenu = false, tvHover = null;          // hover: a TV_ROWS index, "reset" or "close"
const osd = { text: "", until: 0 };          // VCR on-screen display (the OVERLAY setting)
function tvOsd(text, secs = 3) { osd.text = text; osd.until = secs ? performance.now() + secs * 1000 : Infinity; }
function applyTv() {
  try { localStorage.setItem("vaultbuster-tv", JSON.stringify(tvSet)); } catch {}
  video.volume = tvSet.volume / 100;
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
  if (theaterScreenMesh) {
    theaterScreenMesh.material = screensaverMat;
    miniScreens.push(theaterScreenMesh);
  }
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
const zoneOn = Object.fromEntries(LIGHT_ZONES.map(z => [z, z !== "closet"]));   // (the closet bulb starts off)
const zoneLvl = Object.fromEntries(LIGHT_ZONES.map(z => [z, +zoneOn[z]]));   // what the shader gets: 0..1, flickering while warming up
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
  todTick();
  applyLighting();
}
function applyLighting() {
  const Z = TVU.uZone.value, B = TVU.uBoh.value;
  Z.set(zoneLvl.front, zoneLvl.aisles, zoneLvl.lounge, tod.level);
  B.set(zoneLvl.hall, zoneLvl.breakroom, zoneLvl.restroom, zoneLvl.closet);
  closetBulb.mat?.color.set(zoneOn.closet ? 0xfff2c4 : 0x3a3833);
  TVU.uThLight.value.set(zoneLvl.lobby, zoneLvl.theater);
  for (const l of allLights) l.intensity = l.userData.on * (zoneLvl[l.userData.zone] ?? 1);
  const dark = !zoneOn.front && !zoneOn.aisles && !zoneOn.lounge && tod.level < 0.35;
  if (dark === lightsOut && applyLighting.done) return;
  applyLighting.done = true; lightsOut = dark;
  for (const m of posterMats) m.emissiveIntensity = dark ? 0.22 : 0;   // marquees and screens glow on their own
  haloMat.opacity = dark ? 0.4 : 0.22;        // the marquee spill shows more with the lights down
  bloomPass.strength = dark ? 0.55 : 0.28;    // barely-there with the lights on; a bit more presence in the dark
  // threshold raised from .2/.4 — screen whites (menus, bright scenes) were blooming
  // too readily; this only raises the bar for what counts as "glowing"
  bloomPass.threshold = dark ? 0.34 : 0.52;
}

// ---- the shift: the store's open 10A-12A (the placard by the door). While
// it's open a store hour passes every SHIFT.hour real seconds; at midnight the
// clock drops to real time and stays there — the day doesn't end until you've
// locked up and walked out the front doors (clockOut). It only runs while
// you're in the store (not on the title screen). L fast-forwards an hour ----
const SHIFT = { start: 9, open: 10, lastIn: 23.75, close: 24, hour: SETTINGS.shiftMin * 60 / 14 };   // hours since the shift day's midnight; hour: real seconds per store hour while open (a ~21 minute shift)
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const shiftStats = () => ({ score: 0, you: 0, dana: 0, tickets: 0, refunds: 0, signups: 0, visitors: 0, served: 0, rentals: 0, rentalTake: 0, snackTake: 0, returns: 0, walkouts: 0, stolen: 0, caught: 0, upsells: 0, feesCollected: 0, feesWaived: 0 });
// points for the shift. The store's score is everything; your own and Dana's are
// the parts each of you earned (walkouts and theft hit only the store's)
function shiftScore(n, who = null) { const s = shift.stats; s.score += n; if (who) s[who] += n; }   // who: "you" | "dana" | null
// ---- the log, bottom left: ring-outs, money in and out, fees, returns, trouble.
// Fixed height, scrolls (newest at the bottom; PageUp/PageDown), J collapses it ----
const actLog = [], logData = [];                 // rows on screen / the same, as data for the save
function logAct(text, kind = "", money = null, pts = null, at = null) {   // kind: "good" | "bad" | ""; money/pts: signed amounts, shown on the right; at: a saved row's time
  const el = $("actLogList"); if (!el) return;
  logData.push([at || fmtClock(shift.h), text, kind, money, pts]); if (logData.length > 60) logData.shift();
  const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  const row = document.createElement("div"); row.className = `row ${kind}`;
  const amt = [money != null && money !== 0 ? `${money > 0 ? "+" : "\u2212"}$${Math.abs(money).toFixed(2)}` : "", pts ? `${pts > 0 ? "+" : "\u2212"}${Math.abs(pts)} pts` : ""].filter(Boolean).join(" · ");
  row.innerHTML = `<span class="t">${at || fmtClock(shift.h)}</span><span class="x"></span>${amt ? `<span class="a">${amt}</span>` : ""}`;
  row.querySelector(".x").textContent = text;
  el.appendChild(row); actLog.push(row);
  while (actLog.length > 200) actLog.shift().remove();
  if (atEnd) el.scrollTop = el.scrollHeight;     // follow along, unless you've scrolled back to read
  $("actLog").style.display = "block";
  const box = $("actLog"); if (!at && box.classList.contains("shut")) box.querySelector(".n").textContent = `(${++logAct.unseen} new)`;
}
logAct.unseen = 0;
function logToggle() {
  const box = $("actLog"); box.classList.toggle("shut"); logAct.unseen = 0; box.querySelector(".n").textContent = "";
  if (!box.classList.contains("shut")) { const el = $("actLogList"); el.scrollTop = el.scrollHeight; }
}
function logScroll(dir) { const el = $("actLogList"); el.scrollTop += dir * el.clientHeight * 0.8; }
const shift = {
  day: SAVE?.shift?.day ?? 1, h: SAVE?.shift?.h ?? SHIFT.start, warp: 0,
  date0: SAVE?.shift?.date0 ?? new Date().setHours(12, 0, 0, 0),   // day 1's date (noon, like the POS's)
  stats: { ...shiftStats(), ...SAVE?.shift?.stats }, greet: null, report: false,
};
const shiftDate = () => new Date(shift.date0 + (shift.day - 1) * 864e5);
// ---- reputation: 0..100 (1-5 stars), moved each night by how the shift went.
// A better name brings more people in (and sells more tickets) ----
const repStars = (v = rep.v) => Math.max(1, Math.min(5, Math.round(1 + v / 25)));
const starStr = n => "\u2605".repeat(n) + "\u2606".repeat(5 - n);
const repMult = () => 0.7 + rep.v / 100 * 0.6;
// the shift slip's "how far to the next star": a bar between this star's threshold and the next
// (a star every 25 points, starting at 37.5 for 3), and roughly how many A nights (+5 each) it'll take
function repProgress() {
  const n = repStars(); if (n >= 5) return ["  TOP RATED: KEEP IT THERE"];
  const lo = n <= 1 ? 0 : 25 * (n - 1.5), hi = 25 * (n - 0.5), f = Math.max(0, Math.min(1, (rep.v - lo) / (hi - lo))), k = Math.round(f * 20);
  const nights = Math.max(1, Math.ceil((hi - rep.v) / 5));
  return [`  NEXT STAR [${"#".repeat(k)}${"-".repeat(20 - k)}]`, `  ~${nights} MORE A NIGHT${nights > 1 ? "S" : ""} TO ${starStr(n + 1)}`];
}
// ---- upgrades, bought on the register out of the store budget ----
const LIBRARY = [                               // simulation: the library comes in tiers, each after the one before
  { cats: ["Kids & Educational", "Holiday", "Reality TV", "Music", "Broadcast Blocks"] },
  { cats: ["Classic Sitcoms", "Sketch Comedy & Late Night"] },
  { cats: ["Anime", "Horror & Anthology", "MonsterVision"] },
];
const owned = id => !SIM || !!upg[id];           // sandbox has it all
const libTier = () => SIM ? (upg.library || 0) : LIBRARY.length;
const libLocked = c => SIM && LIBRARY.slice(libTier()).some(t => t.cats.includes(c.category));
const UPGRADES = [
  { id: "hire", name: "HIRE AN EMPLOYEE", cost: 250, repeat: true, desc: "3 APPLICANTS TO CHOOSE FROM" },
  { id: "popcorn", name: "POPCORN MACHINE", cost: 150, sim: true, desc: "FRESH POPCORN, RIGHT IN THE STORE" },
  { id: "theater", name: "OPEN THE THEATER", cost: 600, sim: true, desc: "UNLOCK THE LOBBY AND THE AUDITORIUM" },
  { id: "lib1", name: "LIBRARY UPGRADE 1", cost: 200, sim: true, lib: 1, desc: "KIDS, HOLIDAY, REALITY TV, MUSIC" },
  { id: "lib2", name: "LIBRARY UPGRADE 2", cost: 350, sim: true, lib: 2, desc: "CLASSIC SITCOMS, SKETCH & LATE NIGHT" },
  { id: "lib3", name: "LIBRARY UPGRADE 3", cost: 500, sim: true, lib: 3, desc: "ANIME, HORROR ANTHOLOGY, MONSTERVISION" },
  { id: "cameras", name: "SECURITY CAMERAS", cost: 450, desc: "EVERY SHOPLIFTER ON TAPE; FEWER TRY" },
  { id: "sign", name: "ANTI-THEFT SIGNAGE", cost: 60, desc: "\"SHOPLIFTERS WILL BE PROSECUTED\"" },
  { id: "rewinders", name: "HIGH-SPEED REWINDERS", cost: 180, desc: "REWINDS IN HALF THE TIME" },
  { id: "compressor", name: "COOLER COMPRESSOR", cost: 220, desc: "COOLER STAYS COLD, RECOVERS FASTER" },
  { id: "dana", name: "STAFF TRAINING", cost: 250, desc: "THE STAFF LEARN 50% FASTER" },
  { id: "ad", name: "NEWSPAPER AD", cost: 120, repeat: true, desc: SIM ? "NEW MEMBERS, A BIT OF BUZZ (1/DAY)" : "+REPUTATION (ONE A DAY)" },
];
function upgBuy(id) {                            // -> null if bought, else why not
  const u = UPGRADES.find(q => q.id === id); if (!u) return "NO SUCH UPGRADE.";
  if (!u.repeat && owned(id)) return "ALREADY INSTALLED.";
  if (id === "dana" && !staff.length) return "HIRE SOMEONE FIRST.";
  if (id === "hire") {                           // three applicants come up to pick from (the POS has taken the money; not hiring refunds it)
    if (staff.length >= STAFF_MAX) return `THE STAFF ROOM'S FULL (${STAFF_MAX}).`;
    if (hiring.open) return "ALREADY INTERVIEWING.";
    setTimeout(() => hireOpen(hireCost()), 0); return null;
  }
  if (u.lib) {                                   // the distributor stocks the shelves overnight
    if (libTier() !== u.lib - 1 || deliveries.some(d => d.lib)) return libTier() >= u.lib || deliveries.some(d => d.lib === u.lib) ? "ALREADY ORDERED." : `LIBRARY UPGRADE ${u.lib - 1} FIRST.`;
    deliveries.push({ lib: u.lib }); upg[id] = true;
    logAct(`Ordered ${u.name.toLowerCase()}: the tapes arrive tomorrow morning`, "good"); return null;
  }
  if (id === "ad") {                             // simulation: new sign-ups tomorrow (and a little reputation); sandbox: reputation
    if (upg.adDay === shift.day) return "AN AD ALREADY RAN TODAY."; upg.adDay = shift.day;
    rep.v = Math.min(100, rep.v + (SIM ? 3 : 8)); if (SIM) growth.pending += 4;
    logAct(SIM ? "Ran an ad in the paper: expect some new members tomorrow" : "Ran an ad in the paper: the word's getting out", "good"); return null;
  }
  upg[id] = true; upgVisuals(); amenities();
  if (SIM) growth.pending += { theater: 6, popcorn: 2 }[id] || 0;   // a theater brings people in
  logAct(id === "theater" ? "The theater's open for business" : `Installed: ${u.name.toLowerCase()}`, "good");
  return null;
}
function upgVisuals() {                          // what you can see of what you've bought
  if (upg.cameras && !upgVisuals.cams) {
    upgVisuals.cams = true;
    const dome = new THREE.MeshPhongMaterial({ color: 0x1a1a1e, specular: 0x666666, shininess: 60, transparent: true, opacity: 0.85 }), base = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    for (const [x, z] of [[0, 3.2], [-5, 12], [5, 18], [-2, 24]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 16), base); b.position.set(x, STORE.h - 0.02, z); scene.add(b);
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), dome); d.position.set(x, STORE.h - 0.035, z); scene.add(d);
      const led = glow(new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }))); led.position.set(x + 0.05, STORE.h - 0.06, z); scene.add(led);
    }
  }
  if (upg.sign && !upgVisuals.sign) {
    upgVisuals.sign = true;
    const t = textPlane("SHOPLIFTERS WILL BE PROSECUTED", 1.5, 0.11, "#fff", "#8c1c1c", "Arial Black", 48);
    t.material = new THREE.MeshLambertMaterial({ map: t.material.map }); t.position.set(0, 2.66, 0.28); scene.add(t);   // a placard on the door header, under BE KIND, REWIND
  }
}
// ---- tonight's feature: pick a film on the register; customers buy tickets at
// checkout; ticket holders come in at 7:45 and take their seats. It has to be
// playing (in the theater deck or the lounge VCR, same feed) by 8:15, or it's
// refunds all round ----
const SHOW = { at: 20, grace: 0.25, len: 1.75, ticket: 4 };
const show = { title: null, day: 0, sold: 0, status: "", spawned: 0 };   // status: "" | arriving | late | on | failed | done
const filmOn = () => show.title && playing && !video.paused && titleOfCopy(playing.tape) === show.title;
function showTick() {
  if (!show.title || show.day !== shift.day || ["failed", "done"].includes(show.status)) return;
  const h = shift.h, goers = () => custs.filter(k => k.moviegoer);
  if (!show.status && h >= SHOW.at - 0.25) { show.status = "arriving"; logAct(show.sold ? `Ticket holders arriving for ${show.title.title} (${show.sold})` : `No tickets sold for ${show.title.title} tonight`); if (!show.sold) { show.status = "done"; return; } }
  if (show.status === "arriving" && show.spawned < show.sold && h >= SHOW.at - 0.25 + show.spawned * 0.02) {   // they trickle in
    const m = custPickMember(); if (m) { const k = custSpawn(m); k.moviegoer = true; k.returning = []; k.thief = false; show.spawned++; }
  }
  if (show.status === "arriving" && h >= SHOW.at) {
    if (filmOn()) { show.status = "on"; logAct(`Showtime: ${show.title.title} is playing`, "good"); }
    else { show.status = "late"; toast(`8:00 — ${show.title.title} should be starting! Put it in the VCR`); logAct(`It's 8 and ${show.title.title} isn't on: load it in the VCR`, "bad"); }
  }
  if (show.status === "late") {
    if (filmOn()) { show.status = "on"; logAct(`${show.title.title} started late`); }
    else if (h >= SHOW.at + SHOW.grace) {        // refunds, and a lot of unhappy people
      show.status = "failed"; posTerm.sale(-show.sold * SHOW.ticket); shift.stats.refunds += show.sold * SHOW.ticket; shiftScore(-20 * show.sold);
      for (const k of goers()) { posTerm.loyal(k.member, -6); k.c.setMood("angry"); k.hi = 2; if (k.state === "thWatch") k.t = 0; else custGo(k, "leave", CUST_DOOR); }
      logAct(`${show.title.title} never started: refunded ${show.sold} ticket${show.sold > 1 ? "s" : ""}`, "bad", -show.sold * SHOW.ticket, -20 * show.sold);
    }
  }
  if (show.status === "on" && h >= SHOW.at + SHOW.len) {
    show.status = "done"; const n = goers().length; shiftScore(10 * n);
    for (const k of goers()) { posTerm.loyal(k.member, 3); if (k.state === "thWatch") k.t = 0; }
    logAct(`${show.title.title} let out: ${n} happy moviegoer${n === 1 ? "" : "s"}`, "good", null, 10 * n);
  }
}
function showSet(title) {                        // from the register: today's 8 PM if there's time to sell tickets, else tomorrow's
  if (!owned("theater")) return "THE THEATER ISN'T OPEN YET.";
  const day = shift.h < 18 ? shift.day : shift.day + 1;
  if (show.day === day && show.sold) return `TICKETS ALREADY SOLD FOR ${show.title.title.toUpperCase()}.`;
  Object.assign(show, { title, day, sold: 0, status: "", spawned: 0 });
  logAct(`Tonight's feature${day === shift.day ? "" : " (tomorrow)"}: ${title.title} at 8 PM`, "good");
  return null;
}
const ticketChance = () => show.title && show.day === shift.day && !show.status && shift.h < SHOW.at - 0.3
  ? Math.min(0.4, 0.08 + 0.04 * Math.log10(1 + (window.VAULT_META?.[show.title.id]?.[1] || 0))) * (0.8 + rep.v / 250) : 0;
const shiftOpen = () => shift.h >= SHIFT.open && shift.h < SHIFT.lastIn;   // new customers still come in
const afterClose = () => shift.h >= SHIFT.close;
function fmtClock(h, secs = false) {
  const t = Math.floor(h * 3600), hh = Math.floor(t / 3600) % 24, mm = Math.floor(t / 60) % 60, ss = t % 60;
  return `${hh % 12 || 12}:${String(mm).padStart(2, "0")}${secs ? ":" + String(ss).padStart(2, "0") : ""} ${hh < 12 ? "AM" : "PM"}`;
}
// The sky through the day: [hour, daylight 0..1, sky, daylight's color through
// the glass (linear)]. Everything eases between neighbors, so dusk is a slow
// slide from golden hour through sunset and the blue hour into night
const GLASS = { day: [0.95, 0.97, 1.0], morning: [1.0, 0.9, 0.8], gold: [1.0, 0.74, 0.45], sunset: [1.0, 0.55, 0.34], blue: [0.55, 0.65, 1.0] };
const SKY_KEYS = [
  [0, 0, 0x0e1a38, GLASS.blue],
  [4.8, 0, 0x0e1a38, GLASS.blue],
  [5.6, 0.12, 0x2d3564, GLASS.blue],            // first light
  [6.3, 0.45, 0x9b8cb4, GLASS.sunset],          // dawn
  [7.4, 0.85, 0x8fb0d8, GLASS.morning],
  [8.6, 1, 0x4f8fd6, GLASS.day],
  [17.4, 1, 0x4f8fd6, GLASS.day],
  [18.8, 0.8, 0x9ea9bd, GLASS.gold],            // golden hour
  [19.6, 0.45, 0xc9794f, GLASS.sunset],         // sunset
  [20.3, 0.12, 0x39406e, GLASS.blue],           // the blue hour
  [21.1, 0, 0x0e1a38, GLASS.blue],              // night
  [24, 0, 0x0e1a38, GLASS.blue],
].map(([h, level, sky, glass]) => ({ h, level, sky: new THREE.Color(sky), glass }));
const SUN_C = TVU.uSunC.value.clone(), SUN_LOW = new THREE.Color(1.0, 0.5, 0.22).multiplyScalar(0.95);   // noon sun / sun on the horizon
const tod = { level: 1, sky: new THREE.Color() };
function todTick() {                              // sample the sky for the shift clock's hour
  const h = shift.h % 24;
  let i = 0; while (i < SKY_KEYS.length - 2 && SKY_KEYS[i + 1].h <= h) i++;
  const a = SKY_KEYS[i], b = SKY_KEYS[i + 1], t = Math.min(1, Math.max(0, (h - a.h) / (b.h - a.h))), k = t * t * (3 - 2 * t);
  tod.level = a.level + (b.level - a.level) * k;
  tod.sky.lerpColors(a.sky, b.sky, k); setSky(tod.sky);
  setExteriorDay(tod.level > 0.5);                                   // lamps/lot lights from dusk on
  TVU.uDayC.value.setRGB(...a.glass.map((v, n) => v + (b.glass[n] - v) * k));   // daylight through the glass (linear)
  TVU.uNightC.value.set(0.035, 0.045, 0.08);                        // moonlight + the lot lights through it
  const arc = Math.min(1, Math.max(0, (h - 5.9) / 14.2)) * Math.PI, up = Math.sin(arc);   // the sun: up in the east ~6, across, down in the west ~8
  TVU.uSunDir.value.set(-16 * Math.cos(arc), 3 + 30 * up, -8).normalize();
  TVU.uSunC.value.copy(SUN_C).lerp(SUN_LOW, (1 - up) ** 3);         // warm and low at either end of the day
}
function shiftTick(dt) {
  if (shift.report) return;
  if (shift.greet && document.pointerLockElement === canvas) { toast(shift.greet, true); shift.greet = null; }
  if (started && (document.pointerLockElement === canvas || posTerm.isOpen())) {
    const was = shift.h;
    if (shift.warp > shift.h) shift.h = Math.min(shift.warp, shift.h + dt / 2.5);   // L: an hour in 2.5 s
    else shift.h += dt / (shift.h < SHIFT.close ? SHIFT.hour : 3600);             // after close: real time
    const crossed = at => was < at && shift.h >= at;
    if (crossed(SHIFT.open)) toast(frontLock.locked ? "10:00 AM — opening time. Unlock the front doors" : "10:00 AM — we're open", true);
    if (crossed(SHIFT.lastIn)) toast("11:45 PM — last customers of the night", true);
    const d = shiftDate().getDay(), weekend = d === 5 || d === 6;
    if (crossed(12)) logAct("The lunch crowd's starting to come in");
    if (crossed(15)) logAct(weekend ? "Afternoon's picking up" : "School's out: here comes the after-school crowd");
    if (crossed(18.5)) logAct(weekend ? `${d === 5 ? "Friday" : "Saturday"} night rush: it's about to get busy` : "The evening rush is starting");
    if (crossed(SHIFT.close)) toast("Midnight — closing time. Lock up and head out the front doors when you're done", true);
  }
  showTick();
  if (started && (document.pointerLockElement === canvas || posTerm.isOpen())) { phoneTick(dt); holdsTick(); }
  shiftHud();
}
function skipHour() {                             // L: fast-forward an hour (the sky eases through it). Never past close: after that the clock's real
  if (afterClose()) return toast("After close the clock's running for real");
  shift.warp = Math.min(SHIFT.close, Math.max(shift.warp, shift.h) + 1);
}
let shiftHudTxt = "";
function shiftHud() {
  const late = afterClose(), txt = `${WEEKDAYS[shiftDate().getDay()]} ${fmtClock(shift.h, late)}|${late ? "CLOSED" : shift.h < SHIFT.open ? "OPENS 10 AM" : `DAY ${shift.day}`} ${starStr(repStars())} · ${(b => (b < 0 ? "-$" : "$") + Math.abs(b).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))(posTerm.budget())} · STORE ${shift.stats.score.toLocaleString()} · YOU ${shift.stats.you.toLocaleString()}${staff.length ? ` · STAFF ${shift.stats.dana.toLocaleString()}` : ""}`;
  if (txt === shiftHudTxt) return; shiftHudTxt = txt;
  const [t, sub] = txt.split("|"), el = $("shiftClock");
  el.innerHTML = `${t}<div class="h">${sub}</div>`; el.classList.toggle("late", late); el.style.display = "block";
}

// the light switches: a plate of toggles on the wall, one per zone. Built in
// the world section below (lightSwitches), toggled with E
const switchToggles = [];                         // { mesh, zone } — the rocker flips with its zone
const switchPlate = { closet: ["closet"] };        // zone -> every zone on its plate, in order (the closet: just its bulb)
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
  plate(-1.8, 1.22, BOH.z1 - WALL_T / 2, Math.PI, ["lobby", "theater"]);
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
    g.position.set(seatAt.y != null ? seatAt.x : Math.sign(seatAt.x) * Math.max(0, Math.abs(seatAt.x) - 0.04), seatAt.y || 0, seatAt.z); g.rotation.y = seatAt.ry || 0;
    me.setPose("sit", seatAt.hipY ? { hipY: seatAt.hipY } : undefined);
  } else {
    speed = Math.hypot(player.x - meLast.x, player.z - meLast.z) / Math.max(dt, 1e-4);
    g.position.set(player.x + Math.sin(player.yaw) * 0.21, floorHeightAt(player.x, player.z), player.z + Math.cos(player.yaw) * 0.21);   // 21 cm behind the eye: looking down, the chest only creeps in near the bottom
    g.rotation.y = player.yaw + Math.PI;      // the rig faces +z; yaw 0 looks down -z
    me.setPose(keys.has("KeyC") ? "crouch" : "idle");
  }
  meLast.x = player.x; meLast.z = player.z;
  const onToilet = seated && !!seatAt?.toilet;    // pants down, and the broadcast-standards mosaic over the middle
  if (onToilet !== meToilet) { meToilet = onToilet; me.setPantsDown(onToilet); censor.visible = onToilet; }
  if (onToilet) { censor.lookAt(camera.position); if ((censor.t -= dt) <= 0) { censor.t = 0.12; censorDraw(); } }   // (always square to your eye)
  me.tick(dt, speed);
}
// the censor: a pixel mosaic over your lap, redrawn a few times a second so it shimmers like a TV blur
let meToilet = false;
const censorTex = makeTexture(() => {}, 64, 64); censorTex.magFilter = THREE.NearestFilter; censorTex.minFilter = THREE.NearestFilter;
const censor = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshLambertMaterial({ map: censorTex, transparent: true, alphaTest: 0.1 }));   // lit like the skin around it (an unlit sprite bloomed)
censor.position.set(0, 0.6, 0.17); censor.visible = false; censor.t = 0; me.group.add(censor);
function censorDraw() {
  const g = censorTex.image.getContext("2d"), skin = me.outfit.skin, n = 8, c = 64 / n;
  g.clearRect(0, 0, 64, 64);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const dx = (i + 0.5) / n - 0.5, dy = (j + 0.5) / n - 0.5; if (dx * dx + dy * dy > 0.25) continue;   // a round-ish patch
    const tone = Math.random(); g.fillStyle = tone < 0.4 ? skin : tone < 0.62 ? "#9a6a4c" : tone < 0.8 ? "#f6dcc4" : tone < 0.92 ? "#b9a27a" : "#5a4230";   // skin, shade, highlight, khaki, deep shadow
    g.globalAlpha = 0.85 + Math.random() * 0.15; g.fillRect(i * c, j * c, c, c);
  }
  g.globalAlpha = 1; censorTex.needsUpdate = true;
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
    const sat = onStool || !!stool.by;
    const drag = (STOOL.DRAG + STOOL.VISC * stool.vel) * (sat ? 1 : STOOL.EMPTY) * dt;
    const v = Math.max(0, stool.vel - drag), d = (stool.vel + v) / 2 * dt;   // averaged over the step, so a stop lands smoothly
    stool.vel = v; stool.angle += d;
    if (onStool) player.yaw += d;                 // you turn with it; your look stays where it was relative to your body
  }
  stool.top.rotation.y = stool.angle;             // (Dana scoots it round by hand, too)
}
// dizzy: a hard spin on the stool builds it up (a nudge doesn't); once the spinning
// eases off the room keeps drifting the other way, the view sways and blurs, and
// walking forward pulls you off to one side or the other. Wears off over ~20 s
const dizzy = { v: 0, t: 0, blur: "", said: false, ph: 0 };
function dizzyTick(dt) {
  if (onStool && stool.vel > 5) dizzy.v = Math.min(1, dizzy.v + dt * stool.vel / STOOL.MAX / 8);   // ~8 s flat out to max
  else dizzy.v = Math.max(0, dizzy.v - dt / 20);
  const k = Math.max(0, (dizzy.v - 0.3) / 0.7);   // the first few seconds of spinning are free
  dizzy.t += dt;
  if (k && !(onStool && stool.vel > 2)) player.yaw -= k * 0.7 * dt * (1 + 0.4 * Math.sin(dizzy.t * 0.9));   // the room keeps going round the other way
  if (k > 0.5 && !dizzy.said) { dizzy.said = true; toast("Whoa... the room's still spinning", true); }
  if (!k) { dizzy.said = false; dizzy.ph = Math.random() * Math.PI * 2; }   // next time it may pull the other way first
  if (k && !onStool && !seated && (keys.has("KeyW") || keys.has("ArrowUp"))) player.yaw += k * 1.3 * dt * Math.sin(dizzy.t * 0.7 + dizzy.ph);   // walking: pulled left, then right...
  const blur = k > 0.05 ? `blur(${(k * 2.5).toFixed(1)}px)` : "";
  if (blur !== dizzy.blur) canvas.style.filter = dizzy.blur = blur;
  return k;
}
const keys = new Set();
const HOLD_MS = 450;                       // hold E on the standee to lift it
let eHoldTimer = null;                     // hold E on the standee to lift it (a tap does nothing, so it's hard to grab by accident)
let eHoldStool = false;                    // E went down on the stool: a tap sits on release, a hold picks it up
let eHoldSwitch = null;                    // E went down on a multi-switch plate: a tap flips this one on release, a hold flips the plate
addEventListener("keydown", e => {
  if (relockOnInput && e.code !== "Escape" && !posTerm?.isOpen() && !shift.report && !hiring.open) { relockOnInput = false; canvas.requestPointerLock()?.catch?.(() => {}); }
  if (posTerm?.isOpen()) { posEsc = e.key === "Escape"; return posTerm.key(e); }   // typing at the register: no walking, no hotkeys
  if (shift.report) { if (["Enter", "Space", "KeyE"].includes(e.code) && !e.repeat) nextShift(); return; }   // the end-of-shift slip
  if (board.open) { if (document.pointerLockElement === canvas) boardKey(e); return; }   // arranging the staff's jobs
  if (e.code === "KeyK" && !e.repeat && document.pointerLockElement === canvas) { sheetToggle(); return; }   // the skills sheet
  if (document.pointerLockElement !== canvas) {   // paused / title screen: only the window-level keys
    if (e.code === "KeyF") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    return;
  }
  if (e.code === "Escape") { if (!escClose()) document.exitPointerLock(); return; }   // (only reaches us in fullscreen, with the keyboard lock)
  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyE" && !e.repeat && cmove.item) { /* carrying one: click sets it down */ }
  else if (e.code === "KeyE" && !e.repeat) {
    if (aimMove && !seated && !onStool && !cutout.carried && !stool.carried && !boxCarry.length) { eHoldMove = aimMove; eHoldTimer = setTimeout(() => { eHoldTimer = null; const it = eHoldMove; eHoldMove = null; if (it) moveStart(it); }, HOLD_MS); }   // a tap does its usual thing (on release); a hold picks it up
    else if (aimCutout) eHoldTimer = setTimeout(() => { eHoldTimer = null; if (aimCutout) cutoutPickUp(); }, HOLD_MS);
    else if (aimStool && !stool.by) { eHoldStool = true; eHoldTimer = setTimeout(() => { eHoldTimer = null; eHoldStool = false; stoolPickUp(); }, HOLD_MS); }
    else if (aimSwitch && switchPlate[aimSwitch].length > 1 && !seated && !aimCouch && !cutout.carried && !stool.carried && !aimCustomer) {
      eHoldSwitch = aimSwitch;
      eHoldTimer = setTimeout(() => { eHoldTimer = null; flipPlate(eHoldSwitch); eHoldSwitch = null; }, HOLD_MS);
    }
    else onE();                              // one press, one action — holding E doesn't machine-gun bites, doors, the flap
  }
  if (catchCall && /^Digit[1-5]$/.test(e.code)) catchDecide(+e.code[5]);   // deciding what happens to a shoplifter
  else if (phone.call && /^Digit[12]$/.test(e.code)) callAnswer(+e.code[5]);   // on the phone
  else if (/^Digit[1-9]$/.test(e.code)) invSelect(+e.code[5] - 1);   // pick an inventory slot
  if (e.code === "Space") togglePause();
  if (e.code === "Comma") stepEpisode(-1);
  if (e.code === "Period") stepEpisode(1);
  if (e.code === "KeyQ" && !e.repeat) coQ();
  if (e.code === "KeyJ" && !e.repeat) logToggle();      // the log, bottom left
  if (e.code === "PageUp" || e.code === "PageDown") { e.preventDefault(); logScroll(e.code === "PageUp" ? -1 : 1); }        // at the counter: waive fees / offer a snack
  if (e.code === "KeyL" && !e.repeat) skipHour();   // the store lights are real switches; L fast-forwards the clock
  if (e.code === "KeyH") document.body.classList.toggle("nohud");
  if (e.code === "KeyM" && !e.repeat && window.VaultAmbience) { const m = !VaultAmbience.muted(); VaultAmbience.setMuted(m); toast(m ? "Store sounds off (M)" : "Store sounds on (M)", true); }
  if (e.code === "KeyF") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
addEventListener("keyup", e => {
  keys.delete(e.code);
  if (e.code === "KeyE") {
    clearTimeout(eHoldTimer); eHoldTimer = null;   // let go before it's lifted: nothing happens
    if (eHoldSwitch) { flipSwitch(eHoldSwitch); eHoldSwitch = null; }   // a tap on the plate: just the one switch
    if (eHoldStool) { eHoldStool = false; stoolSit(); }                  // a tap on the stool: sit
    if (eHoldMove) { eHoldMove = null; onE(); }                         // a tap on a rewinder / the pad / the printer: its usual thing
  }
});
let seatFov = 70;
canvas.addEventListener("wheel", e => {          // lean in on the couch, or zoom a held-up cover
  if (cmove.item) {                              // carrying a counter thing: turn it, 15° per notch's worth of scrolling
    const px = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);   // (lines / pages -> pixels)
    if (Math.abs(px) >= 50) { cmove.wheel = 0; cmove.ry -= Math.sign(px) * Math.PI / 12; return; }   // a mouse wheel notch: one step
    cmove.wheel = (cmove.wheel || 0) + px;                                                   // a touchpad's little deltas: a step per 50 px of swipe
    while (Math.abs(cmove.wheel) >= 50) { const d = Math.sign(cmove.wheel); cmove.ry -= d * Math.PI / 12; cmove.wheel -= d * 50; }
    return;
  }
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
  const k = 0.0022 * SETTINGS.sens / 100;   // (SETTINGS: sensitivity, invert)
  player.yaw -= e.movementX * k;
  player.pitch = Math.max(-1.45, Math.min(1.45, player.pitch - e.movementY * k * (SETTINGS.invertY ? -1 : 1)));
});
function blocked(x, z) {
  for (const c of colliders) if (!c.staff)       // (you walk through the staff: they can't pin you in a corner)
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
  const sp = ((keys.has("ShiftLeft") || keys.has("ShiftRight")) ? 5.2 * (has("you", "con", 5) ? 1.15 : 1) : 3.1) * (1 + 0.02 * (lv("you", "con") - 1));   // (CON: quicker on your feet; Second Wind)
  const crouched = keys.has("KeyC");
  const spd = sp * (crouched ? 0.55 : 1);
  const dx = (f.x * iz + rt.x * ix) * spd * dt, dz = (f.z * iz + rt.z * ix) * spd * dt;
  const x0 = player.x, z0 = player.z;
  if (!blocked(player.x + dx, player.z)) player.x += dx;
  if (!blocked(player.x, player.z + dz)) player.z += dz;
  const walked = Math.hypot(player.x - x0, player.z - z0); if ((walkXp += walked) > 25) { walkXp = 0; gainXp("you", "con", 1); }
  if ((playerStepD += walked) > (sp > 4 ? 0.95 : 0.72)) { playerStepD = 0; ambStep(player.x, player.z, crouched ? 0.35 : 0.6); }   // your own, quieter (you're wearing sneakers)
}
let playerStepD = 0, walkXp = 0;
const ambStep = (x, z, w) => window.VaultAmbience?.step(x, z, z < 4.35 || (z > STORE.z && x > BOH.x0 && z < BOH.z1), w);   // tile at the front and in back of house; carpet elsewhere

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
let hovered = null, held = null, heldSnack = null, aimTV = false, aimLamp = null, aimCouch = false, aimReturns = false, aimSnack = null, aimFlap = null, aimCooler = false, aimPop = null, aimTrash = false, aimDoor = null, aimPOS = false, aimSlot = false, aimRewinder = null, aimBell = false, aimDesens = false, aimCutout = false, aimCustomer = false, aimLock = false, aimEmp = false, aimSwitch = null, aimDrawer = false, aimSeatObj = null, aimExit = false, aimPrinter = false, aimStockSlot = null, aimCupboard = null, aimBox = null, aimMess = null, aimStray = null, aimPhone = false, aimHolds = false, aimBoard = false, aimMove = null, aimToilet = false, aimSink = false, aimTowels = false, aimBin = null, aimBag = null, aimChute = false;   // aimSeatObj: the theater seat aimed at (null = a couch cushion)
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
// a push door: whoever's in the doorway (you, a customer, Dana) swings it away
// from the side they came in on; once they're through it springs shut, swinging
// past center a few times before it settles, like a real double-acting door
function pushDoorTick(d, dt) {
  if (d.locked) { d.a = d.v = 0; d.side = 0; d.pivot.rotation.y = d.base; return; }   // chained shut
  dt = Math.min(dt, 0.05);
  const bodies = [[player.x, player.z]];
  for (const k of custs) if (k.c) bodies.push([k.c.group.position.x, k.c.group.position.z]);
  for (const e of staff) if (e.c) bodies.push([e.c.group.position.x, e.c.group.position.z]);
  let near = null;                              // across-the-wall offset of whoever's closest to the threshold
  for (const [x, z] of bodies) {
    const along = (d.alongX ? x : z) - d.c, across = (d.alongX ? z : x) - d.at;
    if (Math.abs(along) < DOOR_W / 2 + 0.2 && Math.abs(across) < 0.8 && (near === null || Math.abs(across) < Math.abs(near))) near = across;
  }
  if (near === null) d.side = 0;
  else if (!d.side) { d.side = -Math.sign(near) || 1; if (Math.abs(d.a) < 0.15) doorSnd(d, "push", "open"); }   // opens away from them; holds that way until the doorway's clear
  const target = d.side ? Math.PI / 2 * 0.95 * d.hinge * (d.alongX ? d.side : -d.side) : 0;
  d.v += ((d.side ? 90 : 30) * (target - d.a) - (d.side ? 16 : 2.2) * d.v) * dt;   // pushed: quick and firm; let go: a loose spring
  d.a += d.v * dt;
  if (Math.abs(d.v) > 0.4) d.moving = true;
  if (!d.side && Math.abs(d.a) < 0.002 && Math.abs(d.v) < 0.01) { d.a = 0; d.v = 0; if (d.moving) { d.moving = false; doorSnd(d, "push", "settle"); } }
  window.VaultAmbience?.swing(d, ...doorAt(d), Math.abs(d.v));
  d.pivot.rotation.y = d.base + d.a;
}
const doorAt = d => [(d.shut.x0 + d.shut.x1) / 2, 1.05, (d.shut.z0 + d.shut.z1) / 2];
const doorSnd = (d, kind, action) => window.VaultAmbience?.door(kind, action, ...doorAt(d));
function toggleDoor(d) {
  if (d.push) return;                        // push doors aren't opened, they're walked through
  if (d.locked) { d.rattle = 0.35; doorSnd(d, "wood", "rattle"); return; }   // just jiggles in its frame
  const next = d.open ? d.shut : d.openBox;
  if (playerIn(next)) return;                // you're standing where it would swing to
  colliders.splice(colliders.indexOf(d.open ? d.openBox : d.shut), 1);
  colliders.push(next);
  d.open = !d.open;
  if (d.open) doorSnd(d, "wood", "open"); else d.closing = true;   // (the thump comes when it meets the frame)
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
// ---------------- customers: up to three TV-head shoppers at a time ----------------
// customers.js builds them; this walks each through a visit: in the door,
// browse a shelf, pick a tape, wait at the register getting steadily less
// patient, then leave — rung up (E on them at the counter) or not, in which
// case the tape they walk out with sets the gates off. Paths come from a grid
// A* over the colliders, rebuilt per trip, so doors and the moved standee count.
const NAV = { cell: 0.25, x0: WALL_L, z0: 0, x1: STORE.x, z1: 46.5, pad: 0.3 };
function navGrid(skip, extra = []) {                // extra: temporary obstacles (you, standing in the way)
  const { cell, x0, z0, pad } = NAV, nx = Math.ceil((NAV.x1 - x0) / cell), nz = Math.ceil((NAV.z1 - z0) / cell);
  const g = new Uint8Array(nx * nz), hard = new Uint8Array(nx * nz);   // g: blocked with walking room around things; hard: the things themselves
  const skips = [].concat(skip, doors.filter(d => !d.locked).flatMap(d => [d.shut, d.openBox]));   // path through unlocked doors
  for (const c of colliders.concat(extra)) {
    if (skips.includes(c)) continue;
    const i0 = Math.max(0, Math.ceil((c.x0 - pad - x0) / cell - 0.5)), i1 = Math.min(nx - 1, Math.floor((c.x1 + pad - x0) / cell - 0.5));
    const k0 = Math.max(0, Math.ceil((c.z0 - pad - z0) / cell - 0.5)), k1 = Math.min(nz - 1, Math.floor((c.z1 + pad - z0) / cell - 0.5));
    for (let k = k0; k <= k1; k++) if (i1 >= i0) g.fill(1, k * nx + i0, k * nx + i1 + 1);
    const h0 = Math.max(0, Math.floor((c.x0 - x0) / cell)), h1 = Math.min(nx - 1, Math.floor((c.x1 - x0) / cell));   // every cell it touches: a wall is never skipped over
    const q0 = Math.max(0, Math.floor((c.z0 - z0) / cell)), q1 = Math.min(nz - 1, Math.floor((c.z1 - z0) / cell));
    for (let k = q0; k <= q1; k++) if (h1 >= h0) hard.fill(1, k * nx + h0, k * nx + h1 + 1);
  }
  const at = (x, z) => { const i = Math.floor((x - x0) / cell), k = Math.floor((z - z0) / cell); return i < 0 || k < 0 || i >= nx || k >= nz ? -1 : k * nx + i; };
  const free = (x, z) => { const n = at(x, z); return n >= 0 && !g[n]; };
  return { nx, nz, g, hard, at, free, xy: n => [x0 + (n % nx + 0.5) * cell, z0 + ((n / nx | 0) + 0.5) * cell] };
}
function navPath(grid, ax, az, bx, bz) {         // A* (8-way, binary heap), then string-pulled to straight runs
  const { nx, nz, g, hard, at, free, xy } = grid, near = (x, z) => {   // snap a blocked start/goal to the nearest open cell you could step to:
    const i = Math.min(nx - 1, Math.max(0, Math.floor((x - NAV.x0) / NAV.cell))), k = Math.min(nz - 1, Math.max(0, Math.floor((z - NAV.z0) / NAV.cell)));
    const n0 = k * nx + i; if (!g[n0]) return n0;
    const seen = new Set([n0]), q = [n0];              // flood out from where they stand, never through anything solid (so never out the far side of a wall)
    for (let h = 0; h < q.length && h < 400; h++) {
      const n = q[h], ni = n % nx;
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (ni + di < 0 || ni + di >= nx) continue;
        const m = n + dk * nx + di; if (m < 0 || m >= g.length || seen.has(m) || (hard[m] && !hard[n])) continue;   // (already inside something: work out of it, but never into the next thing)
        if (!g[m]) return m;
        seen.add(m); q.push(m);
      }
    }
    return -1;
  };
  const s = near(ax, az), e = near(bx, bz); if (s < 0 || e < 0) return null;
  const cost = new Float64Array(g.length).fill(Infinity), from = new Int32Array(g.length).fill(-1), closed = new Uint8Array(g.length), heap = [[0, s]];
  const h = n => { const dx = Math.abs(n % nx - e % nx), dz = Math.abs((n / nx | 0) - (e / nx | 0)); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
  const push = it => { heap.push(it); for (let i = heap.length - 1; i && heap[i - 1 >> 1][0] > heap[i][0]; i = i - 1 >> 1) [heap[i], heap[i - 1 >> 1]] = [heap[i - 1 >> 1], heap[i]]; };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; for (let i = 0; ;) { let m = i; for (const c of [2 * i + 1, 2 * i + 2]) if (c < heap.length && heap[c][0] < heap[m][0]) m = c; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  cost[s] = 0;
  while (heap.length) {
    const [, n] = pop();
    if (closed[n]) continue;
    closed[n] = 1;
    if (n === e) break;
    const i = n % nx;
    for (const [di, dk, w] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]) {
      if (i + di < 0 || i + di >= nx) continue;
      const m = n + dk * nx + di; if (m < 0 || m >= g.length || g[m] || closed[m]) continue;
      if (di && dk && (g[n + di] || g[n + dk * nx])) continue;   // no cutting a corner
      const c = cost[n] + w; if (c + 1e-9 < cost[m]) { cost[m] = c; from[m] = n; push([c + h(m), m]); }
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
  const grid = navGrid(custs.map(k => k.box)), spots = new Map(), v = new THREE.Vector3(), n = new THREE.Vector3();
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
  const grid = navGrid(custs.map(k => k.box)), groups = new Map();   // not counting the customers: they're standing in the doorway the flood fill starts from
  for (const t of catalog) for (const c of [t, ...(t.copies || [])]) {
    if (!c.pos || c.libLocked) continue;       // (a section that isn't in yet is just empty shelf)
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
    stops: (r => r < 0.05 ? 7 + Math.floor(rnd() * 4) : r < 0.2 ? 4 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3))(rnd()),   // shelves they'll look at: 1-3 mostly, a proper browse now and then, rarely 7-10
    maxTapes: 1 + (rnd() < 0.35) + (rnd() < 0.12),   // most rent one; some make a night of it
    dwell: 0.6 + rnd() * 0.9,                     // how long they tend to stand at a shelf
    sweet: rnd(),                                 // sweet tooth: how easily a snack's talked up at the counter
  } };
  who.persona.stops = Math.min(10, who.persona.stops + who.persona.maxTapes - 1);   // a bigger haul means more shelves to look at
  return who;
}
// everyone in the store: up to CUST_MAX at once, each with their own visit.
// One at a time at the register; the rest line up behind them (custLine[0] is
// the one at the counter). Someone new wanders in every so often while there's room
// how busy it is: slow mornings, a lunch bump, the after-school wave, the
// evening rush (bigger Friday and Saturday nights), a trickle before close
function rushLevel() {
  const h = shift.h, d = shiftDate().getDay(), weekend = d === 5 || d === 6;
  let r = h < 12 ? 0.5 : h < 14 ? 0.9 : h < 15 ? 0.7 : h < 17.5 ? 1.2 : h < 18.5 ? 0.9 : h < 21.5 ? 1.5 : h < 23 ? 0.9 : 0.5;
  if (weekend && h >= 18) r *= 1.35;
  if (d === 2) r *= 1.15;                         // new release Tuesday
  const members = SIM ? (rushLevel.n ??= posTerm.members.filter(m => m.active).length) : 150;   // (simulation: a small member base is a quiet store)
  const easeIn = SIM ? Math.min(1, 0.25 + 0.15 * shift.day) : 1;   // (simulation: a gentle first week, 40% busy on day 1 up to full on day 5)
  return r * repMult() * (0.45 + 0.55 * Math.min(1, members / 150)) * easeIn;
}
const custMax = () => Math.min(6, Math.round(2 + 2 * rushLevel()));
const custs = [], custLine = [];
const custArrivals = { t: 3, lastMember: null };
const custLikes = (cust, spot) => {               // 0..1: how much of this shelf is their kind of thing
  const cats = cust.who.persona.taste.cats; if (!cats.length) return 0.3;
  return cats.reduce((a, k) => a + (spot.cats[k] || 0), 0) / spot.n;
};
const custWaiting = () => custLine[0] && ["wait", "impatient", "angry"].includes(custLine[0].state) ? custLine[0] : null;   // at the counter, waiting to be rung up
// who comes in: every walk-in is one of the POS's members, and their member
// number is their seed, so the same member always looks and acts the same.
// About half the time it's someone with tapes out, bringing them back — most
// likely whoever's due today or late
function custPickMember() {
  const ms = posTerm.members.filter(m => m.active && m !== custArrivals.lastMember && !custs.some(k => k.member === m) && posTerm.canVisit(m) && (m.loyalty || 0) > -60);   // not someone who's already in here, banned, or fed up with the place
  const soonest = m => Math.min(...m.rentals.map(r => posTerm.dueIn(r)));
  const due = ms.filter(m => m.rentals.length && soonest(m) <= 1);
  if (due.length && Math.random() < 0.5) {
    const w = due.map(m => soonest(m) <= 0 ? 3 : 1);
    let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < due.length - 1 && (r -= w[i]) > 0) i++;
    return due[i];
  }
  const w = ms.map(m => Math.max(0.2, 1 + (m.loyalty || 0) / 40));   // regulars come in more often
  let r = Math.random() * w.reduce((a, b) => a + b, 0), i = 0; while (i < ms.length - 1 && (r -= w[i]) > 0) i++;
  return ms[i];
}
const memberName = m => `${m.first[0]}${m.first.slice(1).toLowerCase()} ${m.last[0]}${m.last.slice(1).toLowerCase()}`;
function custSpawn(member = custPickMember()) {
  const who = customerFor(Math.imul(member.num, 2654435761) >>> 0, member.female);   // member # -> the same person every time
  const cust = { who, member, ry: 0, face: 0, hi: 0, box: { x0: CUST_DOOR.x - 0.22, x1: CUST_DOOR.x + 0.22, z0: CUST_DOOR.z - 0.22, z1: CUST_DOOR.z + 0.22, shadow: false } };
  custArrivals.lastMember = member; shift.stats.visitors++;
  window.VaultAmbience?.chime(CUST_DOOR.x, 2.3, 0.2);   // the entry chime
  const loyal = member.loyalty || 0;
  who.persona.patience *= 1 + loyal / 200;        // regulars will wait a bit longer; the fed-up, less
  member.likes = who.persona.taste.name;          // (for the POS: now somebody's noticed)
  if (shift.h >= 23 && Math.random() < 0.5) { who.persona.stops = 7 + Math.floor(Math.random() * 4); who.persona.dwell *= 1.5; }   // the 11:30 walk-in, in no hurry at all
  if (loyal >= 40) logAct(`${memberName(member)}, one of the regulars, came in`);
  cust.litterT = Math.random() < 0.15 ? 15 + Math.random() * 60 : Infinity;   // now and then somebody drops something
  const grot = messes.length + binList().filter(binFull).length + bagsDown.length;   // litter, overflowing bins, bags left lying about
  if (grot >= 3) { posTerm.loyal(member, -2); if (clockT - (custSpawn.messNote || -999) > 120) { custSpawn.messNote = clockT; logAct(`Customers are noticing the mess (${messes.length} spots to clean${binList().some(binFull) ? ", the trash overflowing" : ""})`, "bad"); } }
  cust.thief = Math.random() < 0.06 * (upg.cameras ? 0.6 : 1) * (upg.sign ? 0.7 : 1);   // now and then somebody means to walk out with it (less, with cameras and signs up)
  cust.returning = member.rentals.filter(r => posTerm.dueIn(r) <= 0 || (posTerm.dueIn(r) === 1 && Math.random() < 0.5)).map(r => r.copy);   // what's due (or late) comes back; the rest stays out
  who.persona.maxTapes = Math.min(who.persona.maxTapes, Math.max(0, posTerm.rentMax - (member.rentals.length - cust.returning.length)));   // 3 out at a time, counting what they're keeping
  const c = cust.c = VaultCustomers.build(who.outfit);
  c.parts.forEach(m => { m.userData.customer = cust; aimables.push(m); });
  c.glows.forEach(glow);
  c.group.position.set(CUST_DOOR.x, 0, CUST_DOOR.z); c.group.rotation.y = 0;
  scene.add(c.group); colliders.push(cust.box);
  c.setMood("on"); c.setPose(cust.returning.length ? "hold" : "idle"); c.holdTape(Math.min(3, cust.returning.length));
  Object.assign(cust, { tagged: false, alarmed: false, holding: 0, tapes: [], snacks: [], snackDone: false, seen: new Set(), stopsLeft: who.persona.stops, path: [], spot: null, state: "boot", t: 0.6 });   // screen warms up, then in they come
  custs.push(cust);
  return cust;
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
// the same manners with the other shoppers (and Dana): wait a beat for whoever's
// right ahead, then re-plan around them (they're colliders), and slip past if
// that doesn't do it. Two meeting head-on don't both wait: whoever's already
// waiting on the other one gets the right of way
function custBumps(cust, p, dx, dz, dt) {
  if (cust.squeeze > 0) return false;
  const d = Math.hypot(dx, dz), ahead = q => { const ox = q.x - p.x, oz = q.z - p.z, r = Math.hypot(ox, oz); return r < 0.7 && (ox * dx + oz * dz) / d > r * 0.5; };
  const o = custs.find(k => k !== cust && k.waitFor !== cust && ahead(k.c.group.position)) || staff.find(e => e.c && ahead(e.c.group.position)) || null;
  cust.waitFor = o;
  if (!o) { cust.bumpT = 0; return false; }
  cust.bumpT = (cust.bumpT || 0) + dt;
  if (cust.bumpT > 0.7 && !cust.bumpDetour) { custGo(cust, cust.state, cust.spot); cust.bumpDetour = true; cust.bumpT = 0.01; }   // go around
  else if (cust.bumpT > 3) { cust.squeeze = 1.4; cust.bumpT = 0; }                                                            // pardon me
  return true;
}
function custGo(cust, state, spot, avoidPlayer = false) {   // head for a spot; state is what to do on arrival
  if (state === "leave") custLeaveLine(cust);
  const p = cust.c.group.position, r = 0.35;
  const you = avoidPlayer ? [{ x0: player.x - r, x1: player.x + r, z0: player.z - r, z1: player.z + r }] : [];
  const grid = navGrid(cust.box, you); spot = spotBesideYou(spot, grid);
  const path = navPath(grid, p.x, p.z, spot.x, spot.z)
    || navPath(navGrid([cust.box, ...staff.map(e => e.box), ...custs.map(k => k.box)]), p.x, p.z, spot.x, spot.z);   // someone's standing in the doorway: plan through them (the walk waits them out)
  if (!path) { cust.path = []; cust.repath = { state, spot }; cust.state = "repath"; cust.t = 1; cust.spot = spot; return; }   // no way there right now: try again in a sec (never straight through a wall)
  cust.path = path;
  if (!avoidPlayer) cust.detour = false;
  cust.stuck = 0; cust.bumpDetour = false;
  cust.state = state; cust.spot = spot;
}
// the checkout line: the front of it stands at the counter, the rest queue
// back into the store behind them, facing the register
const TAG_FIX_SPOT = { x: CUST_COUNTER.x + 0.9, z: CUST_COUNTER.z, ry: Math.PI };   // beside the line: back with a tag that set the gates off
function tagFix(cust, by) {                        // run their tapes over the desensitizer and send them on their way
  for (const t of cust.tapes) if (!t.desens) desensitize(t);
  silenceGateAlarm(); cust.tagged = false; cust.c.setMood("meh"); cust.hi = 1.5;
  logAct(`${by === "dana" ? emp.first : "You"} fixed ${memberName(cust.member)}'s tag: they're on their way`); gainXp(by, "dex", 3);
  custGo(cust, "leave", CUST_DOOR);
}
const custLineSpot = i => i ? { x: CUST_COUNTER.x, z: CUST_COUNTER.z + 0.85 * i, ry: Math.PI } : CUST_COUNTER;
function custToLine(cust) { const i = custLine.indexOf(cust); custGo(cust, i ? "queue" : "counter", custLineSpot(i)); }
function custLeaveLine(cust) {                    // out of the line: everyone behind shuffles up a spot
  const i = custLine.indexOf(cust); if (i < 0) return;
  custLine.splice(i, 1);
  for (const k of custLine.slice(i)) if (["queue", "inLine", "counter"].includes(k.state)) custToLine(k);
}
function custReturnsSpot() {                      // in the lane, facing the drop slot
  const s = returnSlotMesh.position;
  return { x: s.x + 0.6, z: s.z, ry: -Math.PI / 2 };
}
function custNextStop(cust) {                     // a shelf they haven't looked at yet (and nobody else is at), favoring their kind of thing
  let spots = browseSpots().filter(s => !cust.seen.has(s) && !custs.some(k => k !== cust && k.spot === s));
  if (cust.stopsLeft === 1 && !cust.holding && cust.who.persona.taste.cats.length) {   // last stop, still empty-handed: one more try at their favorite section
    const favs = spots.filter(s => custLikes(cust, s) > 0.5); if (favs.length) spots = favs;
  }
  const w = spots.map(s => 1 + 8 * custLikes(cust, s)), total = w.reduce((a, b) => a + b, 0);
  let r = cust.who.rnd() * total, i = 0; while (i < spots.length - 1 && (r -= w[i]) > 0) i++;
  const spot = spots[i]; if (!spot) return custDone(cust);
  cust.seen.add(spot); custGo(cust, "stop", spot);
}
function custDwell(cust) {                        // how long they look at a shelf: a few seconds mostly; now and then something really grabs them
  const r = cust.who.rnd;
  return (2 + r() * 5) * cust.who.persona.dwell * (r() < 0.1 ? 2.5 : 1);
}
function custPickTheaterSeat(cust) {              // pick an open stadium seat and walk to its row on the center ramp
  if (!owned("theater")) return false;
  const free = theaterSeats.filter(s =>
    !custs.some(k => k !== cust && k.thSeat === s) &&
    !(seated && seatAt && Math.hypot(seatAt.x - s.x, seatAt.z - s.z) < 0.3)
  );
  if (!free.length) return false;
  const s = free[Math.floor(cust.who.rnd() * free.length)];
  cust.thSeat = s;
  custGo(cust, "thAisle", { x: -2.87, z: s.rowZ, ry: 0 });
  return true;
}
function custDone(cust) {                         // out of shelves to look at: grab a snack, catch a movie, or head out
  if (cust.thief && cust.holding && !(cust.known && Math.random() < 0.35)) return custSneak(cust);   // you've had an eye on them: maybe not today
  if (!cust.snackDone) {
    cust.snackDone = true;
    const spots = snackSpots();
    if (spots.length && Math.random() < (cust.holding ? 0.4 : 0.25)) return custGo(cust, "snack", spots[Math.floor(Math.random() * spots.length)]);
  }
  if (!cust.holding && !cust.watchedTheater && Math.random() < (playing ? 0.75 : 0.35) && custPickTheaterSeat(cust)) return;
  if (cust.holding || cust.snacks.length) { cust.c.setMood("happy"); custLine.push(cust); custToLine(cust); }
  else { cust.c.setMood("meh"); custGo(cust, "leave", CUST_DOOR); }
}
function custDecide(cust) {                       // done browsing this shelf: take one, put one back, or move on
  const { rnd, persona } = cust.who, likes = custLikes(cust, cust.spot), last = cust.stopsLeft <= 1;
  cust.stopsLeft--;
  const take = ((persona.taste.cats.length ? persona.picky * likes * 1.2 : 0.25) + (last && !cust.holding ? 0.3 : 0.03)) * 0.7 ** cust.holding;   // each extra tape is a harder sell
  if (cust.holding < persona.maxTapes && rnd() < take) cust.reach = "take";
  else if (cust.holding && rnd() < 0.2) cust.reach = "swap";      // saw something better: put theirs back, take this
  else if (cust.holding && rnd() < 0.12) cust.reach = "return";   // second thoughts
  else cust.reach = null;
  if (cust.reach) {
    cust.reachCopy = cust.reach === "return" ? null : custPickCopy(cust);   // decided now, so the hand goes to the copy they'll take
    const aim = cust.reachCopy || cust.tapes[cust.tapes.length - 1];   // ...or the slot theirs goes back into
    if (aim?.pos) cust.c.reachTo(aim.pos); else cust.c.setPose("reach");
    cust.c.setMood(cust.reach === "return" ? "meh" : likes > 0.4 ? "love" : "happy"); cust.state = "reach"; cust.t = 1.3;
  }
  else { cust.c.setMood(cust.holding ? "happy" : "neutral"); cust.stopsLeft > 0 ? custNextStop(cust) : custDone(cust); }
}
function custPickCopy(cust) {                     // a copy still on this shelf, favoring their kind of thing
  const cs = cust.spot.copies.filter(c => !c.offShelf), cats = cust.who.persona.taste.cats;
  if (!cs.length) return null;
  const w = cs.map(c => cats.includes(c.category) ? 6 : 1);
  let r = cust.who.rnd() * w.reduce((a, b) => a + b, 0), i = 0; while (i < cs.length - 1 && (r -= w[i]) > 0) i++;
  return cs[i];
}
const registerStaffed = () => staff.some(e => e.state === "post") || Math.hypot(player.x - EMP_POST.x, player.z - EMP_POST.z) < 1.5;   // Dana at her post, or you behind the register
function custGone(cust) {
  custLeaveLine(cust);
  if (co?.cust === cust) { co = null; coHud(); drawerOpen = 0; }
  if (cust.tagged && !cust.paid && cust.tapes.length) {   // walked out with them unpaid: gone for good (order a replacement on the POS). A paid one with a missed tag is still just a rental
    for (const c of cust.tapes) c.lost = true;
    shift.stats.stolen += cust.tapes.length; shiftScore(-75 * cust.tapes.length);
    const what = cust.tapes.length === 1 ? cust.tapes[0].title : cust.tapes.length + " tapes";
    if (upg.cameras) cust.known = true;          // it's all on tape
    if (cust.known) posTerm.incident(cust.member, `${cust.sneaking ? "SHOPLIFTED" : "LEFT WITHOUT PAYING FOR"} ${what}`);   // you know who it was: it goes on their account
    logAct(`${cust.known ? memberName(cust.member) : "Someone"} walked out with ${what}: stolen`, "bad", null, -75 * cust.tapes.length);
  }   // walked out with them: gone for good (order a replacement on the POS)
  const c = cust.c;
  scene.remove(c.group); c.dispose();
  for (const m of c.parts) { const i = aimables.indexOf(m); if (i >= 0) aimables.splice(i, 1); }
  colliders.splice(colliders.indexOf(cust.box), 1);
  custs.splice(custs.indexOf(cust), 1);
  cust.c = null; cust.state = "gone";
  custArrivals.t = Math.max(custArrivals.t, (6 + Math.random() * 14) / rushLevel());   // not a revolving door
  const a = custAsks.indexOf(cust); if (a >= 0) custAsks.splice(a, 1);
}
function custInteract(cust) {                     // E on a customer: ring them up at the counter, or just say hi
  const c = cust.c;
  if (cust.sneaking) return custCatch(cust);
  if (cust.state === "asking") return custAskInteract(cust);
  if (cust.state === "tagWait") return tagFix(cust, "you");
  if (["wait", "impatient", "angry"].includes(cust.state) && !co) { coStart("player", cust); coAct("customer"); }   // start ringing them up
  else if (co?.cust === cust && co.by === "player") coAct("customer");
  else if (cust.state !== "out") {
    cust.hi = 1.4; c.setMood("happy");
    if (cust.thief && !cust.greeted && Math.random() < 0.7) cust.thief = false;   // a friendly hello: suddenly they'd rather just rent it
    cust.greeted = true;
  }
}
// someone sneaking out notices you watching (aimed at them a moment): half the
// time they lose their nerve and bring it to the counter
function wisTick(dt) {                          // WIS: who notices a shoplifter heading out
  for (const k of custs) {
    if (!k.sneaking || k.alarmed || !k.c) continue;
    const p = k.c.group.position;
    if (!k.wisSaid && lv("you", "wis") >= 3 && Math.hypot(player.x - p.x, player.z - p.z) < 6 + lv("you", "wis")) {   // you: the tells jump out at you
      k.wisSaid = true; k.known = true; logAct(`Something's off about ${memberName(k.member)}: watch the door`, "bad");
    }
    for (const e of staff) {                      // staff: a chance each second, better with WIS, to stop them on the way past
      if (!e.c || Math.hypot(e.c.group.position.x - p.x, e.c.group.position.z - p.z) > 3.5) continue;
      if (Math.random() < dt * 0.03 * lv(e, "wis")) { withEmp(e, () => empCatch(k)); break; }
    }
  }
}
function empCatch(cust) {                         // an employee stops a shoplifter: tapes back, a warning on their record
  const n = cust.tapes.length, what = n === 1 ? cust.tapes[0].title : `${n} tapes`;
  returnBin.push(...cust.tapes); refreshReturnsBin();
  cust.tapes = []; cust.holding = 0; cust.tagged = false; cust.sneaking = false; cust.known = true;
  cust.c.holdTape(0); cust.c.setMood("shock"); cust.hi = 1.5;
  shift.stats.caught++; shiftScore(150, "dana"); gainXp("dana", "wis", 20);
  posTerm.incident(cust.member, `CAUGHT SHOPLIFTING ${what}`); posTerm.incident(cust.member, "WARNED");
  logAct(`${emp.first} caught ${memberName(cust.member)} sneaking out with ${what} (back in the returns bin, a warning)`, "good", null, 150);
  custGo(cust, "leave", CUST_DOOR);
}
function custWatched(cust, dt) {
  if (!cust.sneaking || cust.alarmed || cust.fessRolled) return;
  if (aimCustomer !== cust) { cust.watchT = 0; return; }
  if ((cust.watchT = (cust.watchT || 0) + dt) < 0.8) return;
  cust.fessRolled = true;
  if (!has("you", "wis", 10) && Math.random() >= 0.5) return;   // ...or they keep going (Stern Look: they never do)
  const c = cust.c;
  cust.sneaking = false; cust.tagged = false; cust.thief = false;
  c.holdTape(cust.tapes.length); c.setPose("hold"); c.setMood("meh"); cust.hi = 2;
  logAct(`${memberName(cust.member)} saw you watching and brought ${cust.tapes.length === 1 ? cust.tapes[0].title : "the tapes"} to the counter`, "good");
  custLine.push(cust); custToLine(cust);
}
// ---- wanting something: a title they came in for, or "got anything good?" ----
// They wait at the counter (beside the line) until someone helps. Hand them a
// tape from your hand (E); Q tells them a title's all out. Leave them long
// enough and Dana goes and gets it; longer still and they give up and look
// for themselves
const TASTE_ASK = { "horror fan": "something scary", parent: "something for the kids", "couch potato": "a show to binge",
  "action junkie": "something with some action", "date night": "something for date night", "anime kid": "some anime" };
const custAsks = [];                              // who's waiting at the counter for help, in order
const ASK_SPOT = i => ({ x: CUST_COUNTER.x + 1.2 + 0.7 * i, z: CUST_COUNTER.z + 0.1, ry: Math.PI });
const titleCopies = t => [t, ...(t.copies || [])];
const onShelfCopy = t => titleCopies(t).find(c => !c.offShelf && !c.lost && c.pos);
function custWant(cust) {
  if (custAsks.length >= 3 || cust.who.persona.maxTapes <= cust.holding) return false;   // (at their limit: nothing to ask for)
  const cats = cust.who.persona.taste.cats, r = Math.random();
  if (r < 0.16) {                                 // a title in mind: usually one that's in; now and then one that's all out
    const pool = catalog.filter(t => t.pos && !t.libLocked && (!cats.length || cats.includes(t.category)));
    const inNow = pool.filter(onShelfCopy), out = pool.filter(t => !onShelfCopy(t));
    const from = Math.random() < 0.75 || !out.length ? inNow : out; if (!from.length) return false;
    cust.want = { kind: "title", title: from[Math.floor(Math.random() * from.length)] };
  } else if (r < 0.28 && cats.length) cust.want = { kind: "rec" };
  else return false;
  cust.tries = 0; return true;
}
function custAskGo(cust) { custAsks.push(cust); custGo(cust, "toAsk", ASK_SPOT(custAsks.indexOf(cust))); }
function custAskDone(cust, then) {                // helped (or gave up): off the counter, and on with it
  const i = custAsks.indexOf(cust); if (i >= 0) custAsks.splice(i, 1);
  if (then === "pay") { custLine.push(cust); custToLine(cust); }
  else if (then === "leave") custGo(cust, "leave", CUST_DOOR);
  else if (cust.stopsLeft > 0) custNextStop(cust); else custDone(cust);
}
function custAskInteract(cust) {                  // E: hand over what's in your hand, or just "be right with you"
  if (held && !inspecting) return custHandTape(cust, held, "you");
  if (!cust.acked) { cust.acked = true; cust.t += 30; }   // "I'll go look": they'll wait a bit longer
  cust.hi = 1.2; cust.c.setMood("happy");
}
function custHandTape(cust, tape, by) {           // -> true if they took it
  if (cust.want.kind === "hold") return custHandHold(cust, tape, by);
  const c = cust.c, w = cust.want, cats = cust.who.persona.taste.cats, likes = cats.includes(tape.category), name = memberName(cust.member);
  const exact = w.kind === "title" && titleOfCopy(tape) === w.title;
  const charm = 0.02 * (lv(by, "cha") - 1);         // (CHA: a better pitch)
  const ok = exact || Math.random() < (w.kind === "title" ? (tape.category === w.title.category ? 0.6 : likes ? 0.4 : 0.12) : likes ? 0.85 : 0.2) + charm;
  const who = by === "dana" ? "dana" : "you", Who = by === "dana" ? emp.first : "You";
  if (!ok) {
    cust.tries++; c.setMood("meh"); cust.hi = 1.6;
    logAct(`${Who} offered ${name} ${tape.title}: \u201cNah, not really my thing\u201d`);
    if (cust.tries >= 2) { posTerm.loyal(cust.member, -3); custAskDone(cust); }   // they'll find something themselves
    return false;
  }
  if (by === "you") { tape.fromReturns = tape.strayFix = false; releaseFromHand(); }
  cust.tapes.push(tape); cust.holding = cust.tapes.length;
  c.holdTape(Math.min(3, cust.holding)); c.setPose("hold"); c.setMood("love"); cust.hi = 1.8;
  const fast = Math.max(0, Math.round(60 - (clockT - cust.askAt))), pts = exact ? 80 + fast : w.kind === "title" ? 40 : likes ? 80 + fast : 30;
  shiftScore(pts, who); posTerm.loyal(cust.member, exact ? 10 : w.kind === "title" ? 4 : likes ? 8 : 2);
  gainXp(by, exact ? "int" : "cha", exact ? 10 : likes ? 10 : 5);
  logAct(exact ? `${Who} found ${name} ${tape.title}` : w.kind === "title" ? `${name} took ${tape.title} instead of ${tapeName(w.title)}` : `${Who} recommended ${tape.title} to ${name}${likes ? ": right up their alley" : ""}`, "good", null, pts);
  custAskDone(cust, "pay");
  return true;
}
function holdEnd(h) {                            // a hold's done with (picked up, or it fell through): off the books; an unclaimed copy goes back out
  const i = holds.indexOf(h); if (i >= 0) holds.splice(i, 1);
  if (h.copy) { setOnShelf(h.copy, true); h.copy = null; }
  holdsRender();
}
function custHandHold(cust, tape, by) {           // their hold: only that title will do
  const c = cust.c, w = cust.want, h = w.hold, name = memberName(cust.member), who = by === "dana" ? "dana" : "you", Who = by === "dana" ? emp.first : "You";
  if (titleOfCopy(tape) !== w.title) { c.setMood("meh"); cust.hi = 1.4; logAct(`${name}: “That's not what I had on hold. It's ${tapeName(w.title)}”`); return false; }
  const setAside = tape === h.pulled || tape === h.copy;
  if (by === "you") { tape.fromReturns = tape.strayFix = false; releaseFromHand(); }
  if (tape === h.copy) h.copy = null;
  holdEnd(h);
  cust.tapes.push(tape); cust.holding = cust.tapes.length; c.holdTape(Math.min(3, cust.holding)); c.setPose("hold");
  if (setAside) {
    c.setMood("love"); cust.hi = 1.8; shiftScore(40, h.by === "dana" ? "dana" : who); posTerm.loyal(cust.member, 8); gainXp(who, "int", 6);
    logAct(`${Who} handed ${name} their hold: ${tape.title}`, "good", null, 40);
  } else {                                        // it wasn't set aside: you scrambled and found one on the floor
    c.setMood("meh"); cust.hi = 1.6; shiftScore(5, who); posTerm.loyal(cust.member, -2);
    logAct(`${name}'s hold wasn't set aside. ${Who} found a copy of ${tape.title} on the shelf: awkward, but they got it`, "", null, 5);
  }
  custAskDone(cust, "pay");
  return true;
}
function custHoldOut(cust, by = "you") {          // "you said you'd hold it!"
  const w = cust.want, name = memberName(cust.member), who = by === "dana" ? "dana" : "you";
  const had = w.hold.copy || w.hold.pulled || onShelfCopy(w.title);
  shiftScore(had ? -50 : -30, who); posTerm.loyal(cust.member, had ? -12 : -8); cust.c.setMood("angry"); cust.hi = 3;
  logAct(had ? `Told ${name} their hold for ${tapeName(w.title)} wasn't there. There was a copy right there. They were not happy`
    : `${name} came in for ${tapeName(w.title)} on hold, and there wasn't one. “You SAID you'd hold it!”`, "bad", null, had ? -50 : -30);
  holdEnd(w.hold);
  custAskDone(cust, Math.random() < 0.6 ? "leave" : null);
}
function custAllOut(cust, by = "you") {          // "sorry, all our copies are out"
  if (cust.want.kind === "hold") return custHoldOut(cust, by);
  const copy = onShelfCopy(cust.want.title), name = memberName(cust.member), who = by === "dana" ? "dana" : "you";
  if (copy) {                                     // ...it was right there
    shiftScore(-30, who); posTerm.loyal(cust.member, -5); cust.c.setMood("meh"); cust.hi = 1.5;
    logAct(`Told ${name} ${tapeName(cust.want.title)} was out, but there's one on the shelf`, "bad", null, -30);
    return custAskDone(cust);                     // they'll have a look themselves
  }
  shiftScore(10, who); posTerm.loyal(cust.member, 2); cust.c.setMood("meh"); cust.hi = 1.5; gainXp(who, "int", 3);
  logAct(`${by === "dana" ? `${emp.first} told` : "Told"} ${name} ${tapeName(cust.want.title)} is all out`, "", null, 10);
  custAskDone(cust, Math.random() < 0.5 ? "leave" : null);
}
function custAskGiveUp(cust) {
  if (cust.want.kind === "hold") return custHoldOut(cust, "you");   // (standing at the counter that long for a hold: same scene)
  shiftScore(-20); posTerm.loyal(cust.member, -8); cust.c.setMood("meh");
  logAct(`${memberName(cust.member)} gave up waiting for help at the counter`, "bad", null, -20);
  custAskDone(cust);
}
function custSneak(cust) {                        // a shoplifter: tapes under the jacket, eyes everywhere, straight for the door
  const c = cust.c;
  cust.sneaking = true; cust.tagged = cust.tapes.some(t => !t.desens); cust.alarmed = false;
  c.holdTape(0); c.setPose("idle"); c.setMood("shifty");
  custGo(cust, "leave", CUST_DOOR);
}
function custCatch(cust) {                        // E on one before they're out the door: the tapes come back
  const c = cust.c, n = cust.tapes.length, what = n === 1 ? cust.tapes[0].title : `${n} tapes`;
  returnBin.push(...cust.tapes); refreshReturnsBin();
  cust.tapes = []; cust.holding = 0; cust.tagged = false; cust.sneaking = false;
  c.holdTape(0); c.setMood("shock"); cust.hi = 1.5;
  shift.stats.caught++; shiftScore(150, "you"); gainXp("you", "wis", 20);
  logAct(`Caught ${memberName(cust.member)} sneaking out with ${what} (back in the returns bin)`, "good", null, 150);
  posTerm.incident(cust.member, `CAUGHT SHOPLIFTING ${what}`);
  if (catchCall) catchDecide(5);                  // one at a time: the last one gets a warning
  cust.path = []; cust.state = "caught"; cust.t = 20; cust.caughtWhat = what;
  catchCall = cust; catchHud();
}
// what happens to them: you decide (1-5), or after 20 s they get a warning
let catchCall = null;
const CATCH_CALLS = [
  { key: 1, label: "Ban 1 week", log: "banned for a week", rec: "BANNED 1 WEEK", act: m => posTerm.setStatus(m, "banned", 7) },
  { key: 2, label: "Ban 1 month", log: "banned for a month", rec: "BANNED 1 MONTH", act: m => posTerm.setStatus(m, "banned", 30) },
  { key: 3, label: "Cancel membership", log: "membership cancelled", rec: "MEMBERSHIP CANCELLED", act: m => posTerm.setStatus(m, "cancelled") },
  { key: 4, label: "Call the police", log: "arrested", rec: "ARRESTED", act: m => posTerm.setStatus(m, "arrested") },
  { key: 5, label: "Let them go with a warning", log: "let off with a warning", rec: "WARNED", act: () => {} },
];
function catchDecide(key) {
  const cust = catchCall, k = CATCH_CALLS.find(q => q.key === key); if (!cust || !k) return;
  catchCall = null; catchHud();
  k.act(cust.member); posTerm.incident(cust.member, k.rec);
  logAct(`${memberName(cust.member)}: ${k.log}`, key === 5 ? "" : "good");
  if (cust.c) { cust.c.setMood(key === 4 ? "alarm" : "meh"); cust.hi = 0; custGo(cust, "leave", CUST_DOOR); }   // ...and out
}
function catchHud() {
  const el = $("catchCall"); if (!catchCall) { el.style.display = "none"; return; }
  el.innerHTML = `<div class="h">CAUGHT \u00b7 ${memberName(catchCall.member)} #${catchCall.member.num} \u00b7 ${catchCall.caughtWhat}</div>` +
    CATCH_CALLS.map(q => `<span><b>${q.key}</b> ${q.label}</span>`).join("");
  el.style.display = "block";
}
// a snack from the rack, rebuilt as a plain copy for a customer's hand (the
// rack's own unit stays put, hidden until it restocks)
function snackProxy(u) {
  const g = new THREE.Group(), inv = new THREE.Matrix4();
  u.updateWorldMatrix(true, true); inv.copy(u.matrixWorld).invert();
  u.traverse(m => { if (m.isMesh) { const k = new THREE.Mesh(m.geometry, m.material); k.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld)); g.add(k); } });
  u.getWorldScale(g.scale);
  return g;
}
function custTick(dt) {
  if (custs.length < custMax() && !frontLock.locked && shiftOpen() && (custArrivals.t -= dt) <= 0) {   // locked: whoever's inside finishes up; nobody new
    if (custs.some(k => Math.hypot(k.c.group.position.x - CUST_DOOR.x, k.c.group.position.z - CUST_DOOR.z) < 1.2)) custArrivals.t = 1;   // someone's in the doorway: give them a sec
    else { custSpawn(); custArrivals.t = (6 + Math.random() * 20) / rushLevel(); }
  }
  if (growth.prospects > 0 && !frontLock.locked && shiftOpen() && custs.length < custMax() + 1 && (growth.pT -= dt) <= 0) {   // somebody new, here to sign up
    growth.pT = (40 + Math.random() * 80) / rushLevel();
    const m = posTerm.prospect(custs.map(k => k.member));
    if (!m) growth.prospects = 0;
    else { const k = custSpawn(m); k.prospect = true; k.thief = false; k.returning = []; k.tickets = 0; growth.prospects--; }
  }
  wisTick(dt);
  for (const k of [...custs]) {
    custHearAlarm(k, dt); custWatched(k, dt);
    if ((k.litterT -= dt) <= 0 && k.path.length && k.state !== "leave") { k.litterT = Infinity; const p = k.c.group.position; messAdd(Math.random() < 0.6 ? "wrapper" : "popcorn", p.x, p.z); }
    custStep(k, dt);
  }
}
// the gate alarm going off: everyone's head snaps round to the gates for a
// moment; let it keep ringing and they get fed up — anyone waiting to pay
// loses patience faster
function custHearAlarm(cust, dt) {
  const c = cust.c; if (!c || cust.state === "out") return;
  if (!gateAlarm.on) { if (cust.heardAlarm) { cust.heardAlarm = cust.fedUp = false; if (cust.alarmLook > 0) { cust.alarmLook = 0; c.lookAt(null); } } return; }
  if (!cust.heardAlarm) {
    cust.heardAlarm = true; cust.alarmLook = 1.4 + Math.random() * 0.6;
    if (!cust.alarmed) { c.setMood("shock"); cust.hi = 1.2; }   // (whoever set it off has their own face on)
  }
  if (cust.alarmLook > 0) {
    const p = c.group.position, rel = Math.atan2(0 - p.x, GATE_Z - p.z) - cust.face, a = Math.atan2(Math.sin(rel), Math.cos(rel));
    c.lookAt(Math.max(-1.3, Math.min(1.3, a)));    // over the shoulder, as far as a neck goes
    if ((cust.alarmLook -= dt) <= 0) c.lookAt(null);
  }
  if (gateAlarm.t > 4 && !cust.fedUp && !cust.alarmed) { cust.fedUp = true; c.setMood("meh"); cust.hi = 2.5; }
  if (["wait", "impatient", "inLine"].includes(cust.state)) cust.t -= dt * 0.5;   // standing there listening to that
}
function custStep(cust, dt) {
  const c = cust.c, p = c.group.position, P = cust.who.persona;
  let speed = 0;
  if (cust.path.length) {                         // walking: follow the path, waiting politely if you (or someone else) is in the way
    const [tx, tz] = cust.path[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) cust.path.shift();
    else if (yieldTo(cust, p, dx, dz, dt, av => custGo(cust, cust.state, cust.spot, av))) {}   // you're in the way
    else if (custBumps(cust, p, dx, dz, dt)) {}                                                 // another shopper is
    else {
      speed = P.speed * (cust.state === "leave" && cust.tagged ? (cust.sneaking && !cust.alarmed ? 1.15 : 1.4) : 1);   // storming (or running) out; a shoplifter walks briskly
      const step = Math.min(d, speed * dt); p.x += dx / d * step; p.z += dz / d * step;
      p.y = floorHeightAt(p.x, p.z);
      cust.ry = Math.atan2(dx, dz);
      if ((cust.stepD = (cust.stepD || 0) + step) > 0.7) { cust.stepD = 0; ambStep(p.x, p.z, 1); }   // footsteps
      // open any unlocked closed door right in front of them
      for (const door of doors) if (!door.open && !door.locked && !door.push) {
        const dcx = (door.shut.x0 + door.shut.x1) / 2, dcz = (door.shut.z0 + door.shut.z1) / 2;
        if (Math.hypot(p.x - dcx, p.z - dcz) < 1.1) toggleDoor(door);
      }
    }
    if (cust.tagged && !cust.alarmed && Math.abs(p.x) < 2 && cust.lastZ >= GATE_Z && p.z < GATE_Z) {   // out through the gates with a tagged tape
      cust.alarmed = true; startGateAlarm(); c.setMood("alarm");
      if (cust.paid && !cust.sneaking) {          // a paying customer: you missed a tag. Back to the counter, not happy about it
        shiftScore(-25); posTerm.loyal(cust.member, -4); cust.hi = 2.5;
        logAct(`${memberName(cust.member)} set off the gates: a tag wasn't desensitized. They're coming back to have it fixed`, "bad", null, -25);
        custGo(cust, "tagBack", TAG_FIX_SPOT);
      }
    }
    if (!cust.path.length && cust.spot?.ry !== undefined) cust.ry = cust.spot.ry;
  } else {                                        // arrived: do this stop's thing
    cust.t -= dt; cust.waitFor = null;
    switch (cust.state) {
      case "repath": if (cust.t <= 0) custGo(cust, cust.repath.state, cust.repath.spot); break;
      case "signedUp": if (cust.t <= 0) { c.holdProp(null); c.setPose("idle"); cust.stopsLeft > 0 ? custNextStop(cust) : custGo(cust, "leave", CUST_DOOR); } break;   // card in hand: now to look around
      case "caught": {                            // caught red-handed: facing you, waiting to hear what happens
        cust.ry = Math.atan2(player.x - p.x, player.z - p.z);
        if (cust.t <= 0 && catchCall === cust) catchDecide(5);
        break;
      }
      case "boot": if (cust.t <= 0) {
        c.setMood("neutral");
        if (cust.moviegoer) { if (!custPickTheaterSeat(cust)) { cust.moviegoer = false; custNextStop(cust); } break; }   // ticket in hand: straight in
        if (cust.prospect) { custLine.push(cust); custToLine(cust); }   // straight to the counter, form in hand
        else if (cust.pickup) { cust.want = { kind: "hold", title: cust.pickup.title, hold: cust.pickup }; custAskGo(cust); }   // here for their hold: they ask at the counter
        else if (cust.returning.length) custGo(cust, "dropoff", custReturnsSpot());
        else if (custWant(cust)) custAskGo(cust);
        else if (Math.random() < (playing ? 0.5 : 0.25) && custPickTheaterSeat(cust)) {}
        else custNextStop(cust);
      } break;
      case "toAsk":                               // at the counter: "excuse me..."
        cust.state = "asking"; cust.t = 75 * P.patience; cust.askAt = clockT; c.setMood("ask"); c.setPose("idle");
        logAct(cust.want.kind === "hold" ? `${memberName(cust.member)} is at the counter to pick up ${tapeName(cust.want.title)}: it's on hold for them`
          : cust.want.kind === "title" ? `${memberName(cust.member)} is at the counter looking for ${tapeName(cust.want.title)}` : `${memberName(cust.member)} is at the counter wanting ${TASTE_ASK[cust.who.persona.taste.name] || "something good"}`);
        break;
      case "asking":
        if (cust.hi <= 0 && c.mood !== "ask") c.setMood("ask");
        if (cust.t <= 0) custAskGiveUp(cust);
        break;
      case "dropoff": c.reachTo(returnSlotMesh.getWorldPosition(new THREE.Vector3())); cust.state = "dropping"; cust.t = 1.2; break;
      case "dropping": if (cust.t <= 0) {
        const owedWas = posTerm.owed(cust.member), nBack = cust.returning.length;
        for (const copy of cust.returning) {
          posTerm.checkIn(copy);
          if (Math.random() < 0.4) setWindFrac(copy, 0.15 + Math.random() * 0.85);
          const k = rentedCopies.indexOf(copy); if (k >= 0) rentedCopies.splice(k, 1);
          returnBin.push(copy);
        }
        shift.stats.returns += cust.returning.length;
        if (returnBin.length + cust.returning.length >= 15 && returnBin.length < 15) logAct(`Returns are piling up: ${returnBin.length + cust.returning.length} in the bin`, "bad");
        { const fee = posTerm.owed(cust.member) - owedWas;
          logAct(`${memberName(cust.member)} returned ${nBack === 1 ? cust.returning[0].title : nBack + " tapes"}${fee > 0 ? `, late: ${money(fee)} fee on their account` : ""}`, fee > 0 ? "bad" : ""); }
        refreshReturnsBin(); cust.returning = []; c.holdTape(0); c.setPose("idle"); c.reachTo(null); c.setMood("happy");
        if (Math.random() < (playing ? 0.45 : 0.2) && custPickTheaterSeat(cust)) {}
        else if (Math.random() < 0.5) custNextStop(cust);
        else custGo(cust, "leave", CUST_DOOR);
      } break;
      case "thAisle": cust.state = "thRow"; break;
      case "thRow": {                             // sidestep from the center ramp into their stadium row
        const s = cust.thSeat, dx = s.x - p.x, dz = s.rowZ - p.z, d = Math.hypot(dx, dz);
        if (d < 0.04) {
          c.setPose("sit"); cust.from = { x: p.x, y: p.y, z: p.z };
          cust.state = "thSitDown"; cust.t = 0.6; cust.ry = 0;
        } else {
          speed = P.speed * 0.85;
          const step = Math.min(d, speed * dt); p.x += dx / d * step; p.z += dz / d * step; p.y = s.y;
          cust.ry = Math.atan2(dx, dz);
        }
        break;
      }
      case "thSitDown": {
        const s = cust.thSeat, k = 1 - Math.max(0, cust.t) / 0.6;
        p.x = cust.from.x + (s.x - cust.from.x) * k;
        p.y = cust.from.y + (s.y - cust.from.y) * k;
        p.z = cust.from.z + (s.z - cust.from.z) * k;
        cust.ry = 0;
        if (cust.t <= 0) {
          cust.state = "thWatch"; cust.t = cust.moviegoer && ["arriving", "late", "on"].includes(show.status) ? Infinity : 40 + cust.who.rnd() * 80; cust.moodT = 4;   // here for the show: till it lets out
          c.setMood(playing ? "watch" : "neutral");
        }
        break;
      }
      case "thWatch": {
        const s = cust.thSeat;
        // if the player sits right in their seat, or their watch timer finishes, stand up
        if (cust.t <= 0 || (seated && seatAt && Math.hypot(seatAt.x - s.x, seatAt.z - s.z) < 0.25)) {
          c.setPose("idle"); c.setMood(playing ? "happy" : "neutral");
          cust.state = "thRowOut"; break;
        }
        if ((cust.moodT -= dt) <= 0) {
          cust.moodT = 5 + cust.who.rnd() * 8;
          c.setMood(playing ? ["watch", "watch", "happy", "love"][Math.floor(cust.who.rnd() * 4)] : ["neutral", "meh", "sleep"][Math.floor(cust.who.rnd() * 3)]);
        }
        break;
      }
      case "thRowOut": {                          // step out of the row back onto the center ramp
        const s = cust.thSeat, tx = -2.87, tz = s.rowZ, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        if (d < 0.05) {
          if (Math.random() < 0.4) messAdd("cup", s.x, s.z, s.y);   // left their cup under the seat
          cust.thSeat = null; cust.watchedTheater = true;
          p.y = floorHeightAt(p.x, p.z);
          if (!cust.holding && !cust.snacks.length && cust.stopsLeft > 0 && Math.random() < 0.5) custNextStop(cust);
          else if (cust.holding || cust.snacks.length) { custLine.push(cust); custToLine(cust); }
          else custGo(cust, "leave", CUST_DOOR);
        } else {
          speed = P.speed * 0.85;
          const step = Math.min(d, speed * dt); p.x += dx / d * step; p.z += dz / d * step; p.y = s.y;
          cust.ry = Math.atan2(dx, dz);
        }
        break;
      }
      case "stop": c.setMood("browse"); cust.state = "browse"; cust.t = custDwell(cust); break;
      case "browse": if (cust.t <= 0) custDecide(cust); break;
      case "snack":
        { const left = cust.spot.units.filter(u => u.visible && u !== heldSnack), cold = left.filter(u => !isDrink(u.userData.snack) || drinkTemp(u) <= DRINK_WARM);
          const from = cold.length ? cold : left, names = [...new Set(from.map(u => u.userData.snack.name))], want = names[Math.floor(Math.random() * names.length)];   // anyone would reach past a warm can for a cold one
          const of = from.filter(u => u.userData.snack.name === want); cust.snackUnit = of[Math.floor(Math.random() * of.length)] || null; }   // pick a product, then one of it (not whichever's got the most packs on the rack)
        if (cust.snackUnit) c.reachTo(cust.snackUnit.getWorldPosition(new THREE.Vector3())); else c.setPose("reach");
        c.setMood("happy"); cust.state = "snacking"; cust.t = 1.4;
        if (cust.spot.drinks && !coolerOpen) { coolerOpen = true; cust.openedCooler = true; }
        break;
      case "snacking": if (cust.t <= 0) {
        const u = cust.snackUnit?.visible && cust.snackUnit !== heldSnack ? cust.snackUnit : null;
        if (u) { c.holdItem(snackProxy(u)); u.visible = false; cust.snacks.push(u); if (isDrink(u.userData.snack) && drinkTemp(u) > DRINK_WARM && !(drinkUnits || []).some(k => k.visible && drinkTemp(k) <= DRINK_WARM)) custWarmDrink(cust, u); }   // in hand, for real. (Warm only counts against you if there wasn't a cold one to be had)
        c.reachTo(null);
        if (cust.openedCooler) { coolerOpen = false; cust.openedCooler = false; }
        c.setPose(cust.holding ? "hold" : "idle");
        if (cust.upsell) { cust.upsell = false; cust.upsellGot = !!u; custGo(cust, "coBack", CUST_COUNTER); }   // talked into it at the register: back to finish paying
        else custDone(cust);
      } break;
      case "reach": if (cust.t <= 0) {
        if (cust.reach !== "take") { const t = cust.tapes.pop(); if (Math.random() < 0.25) misshelve(t, cust.spot); else setOnShelf(t, true); }   // put back: into its slot, or (a quarter of the time) just shoved in anywhere
        const got = cust.reachCopy && !cust.reachCopy.offShelf ? cust.reachCopy : cust.reach !== "return" && custPickCopy(cust);
        if (cust.reach !== "return" && got) { setOnShelf(got, false); cust.tapes.push(got); }
        c.reachTo(null);
        cust.holding = cust.tapes.length;
        c.holdTape(cust.holding); c.setPose(cust.holding ? "hold" : "idle");
        cust.stopsLeft > 0 ? custNextStop(cust) : custDone(cust);
      } break;
      case "coBack":                              // back at the register with the snack
        cust.state = "checkout"; c.setPose("wait"); c.setMood("happy");
        if (co?.cust === cust) {
          co.away = false; co.idle = 0;
          if (cust.upsellGot) { co.pts += 40; co.upsold = true; } else logAct(`${memberName(cust.member)} came back empty-handed: that rack's cleaned out`);
          coRebill(); coProps(); coHud();
        }
        break;
      case "checkout":
        if (co && (co.idle = (co.idle || 0) + dt) > 30) {
          const fill = co.by === "player" && staff.find(e => e.state === "post" && withEmp(e, () => jobPri("register")) < 9);
          if (fill) { co.by = "dana"; co.emp = fill; co.idle = 0; coHud(); }
          else if (co.idle > 45) {
            shift.stats.walkouts++; shiftScore(-100); posTerm.loyal(cust.member, -15); logAct(`${memberName(cust.member)} gave up on the checkout and walked out`, "bad", -co.total, -100);
            c.holdTape(cust.tapes.length);
            cust.tagged = cust.tapes.some(t => !t.desens); drawerOpen = 0; co = null; coHud();
            c.setMood("angry"); c.holdProp(null); c.setPose(cust.tapes.length ? "hold" : "idle"); custGo(cust, "leave", CUST_DOOR);
          }
        }
        break;
      case "queue": c.setPose("wait"); c.setMood("wait"); cust.state = "inLine"; cust.t = 45 * P.patience * linePatience(); break;
      case "inLine": if (cust.t <= 0 && c.mood !== "impatient") c.setMood("impatient"); break;
      case "counter": if (!registerStaffed()) { dingBell(); for (const e of staff) withEmp(e, () => empSummon()); } c.setPose("wait"); c.holdProp(cust.prospect ? "form" : cust.tapes.length ? "card" : "cash");
        c.setMood("wait"); cust.state = "wait"; cust.t = 25 * P.patience * linePatience(); break;
      case "wait": if (cust.t <= 0) { dingBell(); for (const e of staff) withEmp(e, () => empSummon()); c.setMood("impatient"); cust.state = "impatient"; cust.t = 15 * P.patience * linePatience(); } break;
      case "impatient": if (cust.t <= 0) { c.setMood("angry"); cust.state = "angry"; cust.t = 6; } break;
      case "angry": if (cust.t <= 0) { shift.stats.walkouts++; shiftScore(-100); posTerm.loyal(cust.member, -15); logAct(`${memberName(cust.member)} got tired of waiting and walked out`, "bad", null, -100); cust.tagged = cust.tapes.length > 0; cust.alarmed = false; c.setPose("hold"); custGo(cust, "leave", CUST_DOOR); } break;
      case "tagBack": c.setPose("hold"); c.setMood("impatient"); cust.state = "tagWait"; cust.t = 30 * P.patience; break;   // at the end of the counter, tape held out
      case "tagWait": if (cust.t <= 0) {          // nobody fixed it: out they go anyway, alarm or no
        shiftScore(-50); posTerm.loyal(cust.member, -8); c.setMood("angry"); cust.tagged = false;
        logAct(`${memberName(cust.member)} gave up waiting to have their tag fixed and left`, "bad", null, -50);
        custGo(cust, "leave", CUST_DOOR);
      } break;
      case "paid": if (cust.t <= 0) { c.setMood("happy"); custGo(cust, "leave", CUST_DOOR); } break;
      case "leave": c.setMood("off"); cust.state = "out"; cust.t = 0.6; break;
      case "out": if (cust.t <= 0) { window.VaultAmbience?.chime(CUST_DOOR.x, 2.3, 0.2); custGone(cust); } return;
    }
  }
  if (cust.hi > 0 && (cust.hi -= dt) <= 0) c.setMood({ browse: "browse", thWatch: playing ? "watch" : "neutral", wait: "wait", inLine: "wait", impatient: "impatient", angry: "angry" }[cust.state] || (cust.holding ? "happy" : "neutral"));
  cust.lastZ = p.z;
  cust.face += Math.atan2(Math.sin(cust.ry - cust.face), Math.cos(cust.ry - cust.face)) * Math.min(1, dt * 8);
  c.group.rotation.y = cust.face;
  const cr = cust.squeeze > 0 ? 0 : 0.22;
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
const EMP_REWIND = EMP_TOTE;                                         // the rewinders sit on the counter right over the tote
const EMP_ARMFUL = 10;                                              // returns she takes out per trip
// ---------------- skills: six classic stats, levelled by doing the work ----------------
// You and every employee have the same six. Doing a task earns XP in its stat (more for the longer
// or harder ones), XP fills a level, and each level makes that kind of work go better (see lv())
const SKILLS = {
  dex: { name: "DEX", long: "Dexterity", what: "the register, desensitizing, the rewinders" },
  int: { name: "INT", long: "Intelligence", what: "shelving, misshelves, finding requests, holds" },
  cha: { name: "CHA", long: "Charisma", what: "upsells, recommendations, sign-ups, the phone" },
  str: { name: "STR", long: "Strength", what: "restocking the racks, unpacking deliveries" },
  con: { name: "CON", long: "Constitution", what: "cleaning up, being on your feet all day" },
  wis: { name: "WIS", long: "Wisdom", what: "spotting shoplifters, the gate alarm" },
};
const SKILL_IDS = Object.keys(SKILLS), SKILL_MAX = 20;
const xpToNext = L => Math.round(60 * 1.5 ** (L - 1));   // XP from level L to L+1: 60, 90, 135, 203... x1.5 each (~4.5k total to 10, ~260k to 20)
const skillsOf = levels => Object.fromEntries(SKILL_IDS.map(k => [k, { lvl: levels?.[k] ?? 1, xp: 0 }]));
const you = { first: "You", skills: { ...skillsOf(), ...SAVE?.you?.skills } };
const DEBUG_LVL = +new URLSearchParams(location.search).get("lvl");   // debug: index.html?lvl=10 sets all your stats, misshelves a few tapes, and never saves
if (DEBUG_LVL) for (const k of SKILL_IDS) you.skills[k] = { lvl: Math.min(SKILL_MAX, DEBUG_LVL), xp: 0 };
const whoIs = who => who === "you" || who === "player" ? you : who === "dana" ? emp : who;   // "dana": whichever employee is acting (emp)
const lv = (who, k) => whoIs(who)?.skills?.[k]?.lvl ?? 1;
// milestone unlocks on top of the per-level nudges: [name, what it does, staff get it too]
const MILESTONES = {
  dex: { 5: ["Quick Thread", "rewinders you load run 30% faster", true], 10: ["Lucky Spool", "1 in 5 rewinds is done in a blink", true] },
  int: { 5: ["Shelf Sense", "the slot for the tape in your hand glows"], 10: ["Keen Eye", "misshelved tapes glow"] },
  cha: { 5: ["Smooth Talker", "charging late fees never costs goodwill", true], 10: ["Store Favorite", "customers wait 30% longer in line"] },
  str: { 5: ["Strong Grip", "carry a third trash bag"], 10: ["Pack Mule", "carry two more boxes"] },
  con: { 5: ["Second Wind", "sprint 15% faster"], 10: ["Neat Freak", "cleaning a mess sweeps up others within 3m"] },
  wis: { 5: ["Sixth Sense", "shoplifters glow red"], 10: ["Stern Look", "a shoplifter you stare down always gives up"] },
};
const has = (who, k, L) => lv(who, k) >= L;
const linePatience = () => has("you", "cha", 10) ? 1.3 : 1;   // Store Favorite
// glowing markers for the "see it" unlocks (Shelf Sense, Keen Eye, Sixth Sense): a small pool, re-placed every frame
const beacons = [];
function beaconAt(i, pos, ry, color, w = TAPE.w, h = TAPE.h, d = TAPE.d) {
  const b = beacons[i] ||= (() => {
    const m = glow(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false })));
    scene.add(m); return m;
  })();
  b.visible = true; b.position.copy(pos); b.rotation.set(0, ry, 0); b.scale.set(w, h, d); b.material.color.set(color);
  b.material.opacity = 0.35 + 0.25 * Math.sin(performance.now() / 180);   // a slow pulse
}
// ---- light spill through the back-of-house doorways ----
// Each room's lighting stops dead at its walls (see ROOM_FRAG), so a lit room next to a dark one met it in a hard seam.
// Instead, each doorway lets light through both ways: a lit room glows out into the dark hall (and the lit hall into a
// dark room), fading over a few meters, as far as the door is open. [from a zone, to a box, through (x, y, z), reach]
const SPILLS = (() => {
  const HZ = BOH.hallZ, Z = STORE.z, X = STORE.x, hall = [BOH.x0, X, Z, HZ];
  const brk = [BOH.x0, BOH.splitX, HZ, BOH.z1], rr = [BOH.splitX, X, HZ, BOH.z1], cl = [X, CLOSET.x1, Z, HZ], floor = [X - 6, X, Z - 6, Z];
  // a doorway: in a wall along x (z = at) or along z (x = at), centered c, half width hw; the lit side (+1/-1 across the
  // wall), and how far back in there (depth) and how high (y) its light is. The door itself (if any) is found by position
  const dw = (alongX, at, c, hw, side, depth, y, door = true) => ({ alongX, at, c, hw, door,
    src: alongX ? [c, y, at + side * depth] : [at + side * depth, y, c] });
  const brkD = s => dw(true, HZ, BOH_DOORS.breakroom, DOOR_W / 2, s, s > 0 ? 1.3 : 0.9, s > 0 ? 2.4 : 2.55);
  const rrD = s => dw(true, HZ, BOH_DOORS.restroom, DOOR_W / 2, s, s > 0 ? 1.3 : 0.9, s > 0 ? 2.4 : 2.55);
  const clD = s => dw(false, X, BOH_DOORS.closet, CLOSET.doorW / 2, s, s > 0 ? 0.6 : 0.9, s > 0 ? 2.28 : 2.55);
  const opD = s => dw(true, Z, BOH_DOORS.store, BOH_OPENING_W / 2, s, s < 0 ? 3 : 0.9, s < 0 ? 3.4 : 2.55, false);
  return [
    { from: "breakroom", into: "hall", to: hall, ...brkD(1) },
    { from: "restroom", into: "hall", to: hall, ...rrD(1) },
    { from: "closet", into: "hall", to: hall, ...clD(1), warm: true, reach: 2.6 },
    { from: "lounge", into: "hall", to: hall, ...opD(-1), reach: 4.5 },                  // the sales floor through its wide opening
    { from: "hall", into: "breakroom", to: brk, ...brkD(-1) },
    { from: "hall", into: "restroom", to: rr, ...rrD(-1) },
    { from: "hall", into: "closet", to: cl, ...clD(-1), reach: 2 },
    { from: "hall", into: "lounge", to: floor, ...opD(1), reach: 4.5 },
  ];
})();
function spillTick() {                            // the live spills (a lit room, its door open, a darker one through it) into the shader
  const U = TVU, lvl = z => (z === "closet" ? 0.8 : 1) * zoneLvl[z];
  let n = 0;
  for (const s of SPILLS) {
    if (s.door && s.d === undefined) s.d = doors.find(d => d.alongX === s.alongX && Math.abs(d.at - s.at) < 0.01 && Math.abs(d.c - s.c) < 0.01) || null;
    const open = !s.door ? 1 : s.d ? Math.min(1, Math.abs(s.d.a / s.d.openA)) : 0;   // how far its door's swung (a doorway: always open)
    const src = lvl(s.from), k = src > lvl(s.into) + 0.01 ? 0.75 * open * src : 0;
    if (k < 0.005) continue;
    U.uSpillP.value[n].set(...s.src, s.reach || 3.5); U.uSpillB.value[n].set(...s.to);
    U.uSpillD.value[n].set(s.alongX ? 0 : 1, s.at, s.c, s.hw);
    U.uSpillC.value[n].set(k * (s.warm ? 1.12 : 1), k * (s.warm ? 0.95 : 1), k * (s.warm ? 0.74 : 1), 0);
    n++;
  }
  U.uSpillN.value = n;
}
function milestoneTick() {
  let n = 0;
  if (held?.offShelf && held.pos && has("you", "int", 5)) beaconAt(n++, held.pos, held.ry, 0x66ffcc, TAPE.w * 1.4, TAPE.h * 1.1, TAPE.d * 1.1);
  if (has("you", "int", 10)) for (const s of strays) beaconAt(n++, s.mesh.position, s.mesh.rotation.y, 0xffcc33, TAPE.w * 1.3, TAPE.h * 1.2, TAPE.d * 1.3);
  if (has("you", "wis", 5)) for (const k of custs) if (k.sneaking && !k.alarmed && k.c) beaconAt(n++, k.c.group.position.clone().setY(k.c.group.position.y + 2.05), 0, 0xff3030, 0.18, 0.18, 0.18);
  for (let i = n; i < beacons.length; i++) beacons[i].visible = false;
}
function gainXp(who, k, amt) {
  const w = whoIs(who), sk = w?.skills?.[k]; if (!sk || sk.lvl >= SKILL_MAX || !amt) return;
  sk.xp += amt * (w !== you && upg.dana ? 1.5 : 1);   // (staff training: they learn faster)
  while (sk.lvl < SKILL_MAX && sk.xp >= xpToNext(sk.lvl)) {
    sk.xp -= xpToNext(sk.lvl); sk.lvl++;
    logAct(`${w === you ? "Your" : `${w.first}'s`} ${SKILLS[k].long} is up to ${sk.lvl}`, "good");
    const m = MILESTONES[k][sk.lvl];
    if (m && (w === you || m[2])) logAct(`${w === you ? "Unlocked" : `${w.first} unlocked`} ${m[0]}: ${m[1]}`, "good");
    if (w === you) toast(m ? `${SKILLS[k].name} ${sk.lvl}! Unlocked ${m[0]}: ${m[1]}` : `${SKILLS[k].name} up! Level ${sk.lvl}`, true);
  }
  sheetHud();
}
const empSummary = e => SKILL_IDS.map(k => `${SKILLS[k].name} ${e.skills[k].lvl}`).join(" · ");
const avgLevel = e => SKILL_IDS.reduce((a, k) => a + e.skills[k].lvl, 0) / SKILL_IDS.length;
const empWage = e => 35 + 3 * Math.round(avgLevel(e) - 2.5);   // a little more for the better ones
const empRate = e => +(empWage(e) / 5).toFixed(2);   // by the hour: $7 for an average hand
// the schedule: each employee's week, hour by hour from 9 AM (before opening) to midnight, as
// 7 bitmasks (bit n = 9+n o'clock), part-time: up to 25 hours. On the clock they come in the
// front door; off it they finish what they're doing and head out the same way. After close,
// whoever's still in stays till you send them home
const SCHED_H0 = 9, SCHED_SLOTS = 15, SCHED_MAX = 25;
const bits = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };
const schedHours = e => e.sched.reduce((a, m) => a + bits(m), 0);
function defaultSched(i) {                       // five 5-hour shifts, staggered: evenings (the rush), every other hire afternoons
  const sc = Array(7).fill(0), from = i % 2 ? 3 : 8;   // 12-5 PM / 5-10 PM
  for (let k = 0; k < 5; k++) sc[(3 + i * 2 + k) % 7] |= ((1 << 5) - 1) << from;
  return sc;
}

// applicants: a name, a look (gender, height, build, their TV) and stats that always add up to the
// same total, so each one's as good as the others, just good at different things
const FIRST_F = ["Dana", "Tina", "Kim", "Stacy", "Jen", "Lisa", "Amy", "Becky", "Tanya", "Rhonda", "Gina", "Missy", "Carla", "Wendy", "Trish", "Nikki", "Shawna", "Heather"];
const FIRST_M = ["Kevin", "Troy", "Duane", "Chad", "Marcus", "Todd", "Ray", "Eddie", "Jason", "Luis", "Derek", "Kyle", "Brian", "Andre", "Shane", "Gary", "Manny", "Rob"];
const LASTS = ["Reyes", "Kowalski", "Nguyen", "Brennan", "Okafor", "Delgado", "Murphy", "Patel", "Hendricks", "Lund", "Castillo", "Baker", "Ortiz", "Sato", "Fitzgerald", "Novak", "Harlan", "Pruitt"];
const STAT_TOTAL = 15, STAFF_MAX = 4;
function rollApplicant(rnd = Math.random) {
  const pickR = a => a[Math.floor(rnd() * a.length)], female = rnd() < 0.5, first = pickR(female ? FIRST_F : FIRST_M);
  const levels = Object.fromEntries(SKILL_IDS.map(k => [k, 1]));
  for (let left = STAT_TOTAL - SKILL_IDS.length; left > 0;) { const k = pickR(SKILL_IDS); if (levels[k] < 6) { levels[k]++; left--; } }
  const outfit = { ...VaultCustomers.randomOutfit(rnd, female), top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, nameTag: first.toUpperCase(),
    pants: "khaki", pantsColor: "#b9a27a", shoes: "#1e1e1e", hat: null };
  return { first, last: pickR(LASTS), female, outfit, levels };
}
const DANA_APP = { first: "Dana", last: "Reyes", female: true, levels: { dex: 3, int: 3, cha: 3, str: 2, con: 2, wis: 2 },
  outfit: { ...VaultCustomers.randomOutfit(seeded(417), true), top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, nameTag: "DANA",
    pants: "khaki", pantsColor: "#b9a27a", shoes: "#1e1e1e", hat: null, tv: { kind: "black", color: "#1c1c1e", w: 0.46, h: 0.36, d: 0.36, antenna: false, knobs: true }, phosphor: "#c9a8ff" } };
function looksOf(o) {                             // "tall, broad build, a silver TV with an antenna"
  return [o.height > 1.035 ? "tall" : o.height < 0.965 ? "short" : "average height", o.build > 1.07 ? "broad build" : o.build < 0.96 ? "slim" : "average build",
    `a ${o.tv.kind} TV${o.tv.antenna ? " with antennas" : ""}`].join(", ");
}

// the staff: everyone hired, each with their own state (what used to be Dana's alone), skills and job
// priorities. The employee code below runs once a frame per employee with `emp` set to whoever it's
// about; anything that needs a particular employee from outside goes through withEmp
const empState = () => ({ coT: 0, coReached: false, c: null, task: "register", state: "", path: [], ry: 0, face: 0, t: 0, ringT: 0, alarmT: 0, carry: [], rewinding: [], openedFlap: false, stuck: 0,
  box: { x0: 0, x1: 0, z0: 0, z1: 0, shadow: false, staff: true } });
const staff = [];
const NOBODY = { ...empState(), first: "", jobs: [], skills: {}, home: { x: -5.45, z: 3.2, ry: 0 } };   // `emp` between turns
let emp = NOBODY;
function withEmp(e, f) { const prev = emp; emp = e; try { return f(); } finally { emp = prev; } }
const empAt = i => ({ x: EMP_POST.x + 0.72 * i, z: EMP_POST.z, ry: 0 });   // each one's spot behind the counter when there's nothing on
function makeEmployee(a, i, saved) {
  return { ...empState(), id: saved?.id ?? `${Date.now()}-${i}`, first: a.first, last: a.last, female: a.female, outfit: a.outfit,
    skills: saved?.skills ? { ...skillsOf(), ...saved.skills } : skillsOf(a.levels), jobs: defaultJobs(saved?.jobs), home: empAt(i),
    sched: Array.isArray(saved?.sched) && saved.sched.length === 7 ? saved.sched.slice() : defaultSched(i) };
}
function empCoTarget(at) {                     // where Dana's hand goes for each checkout step
  if (at === "pad") return new THREE.Vector3(DESENS_AT.x, 1.12, DESENS_AT.z - 0.02);
  if (at === "printer") return new THREE.Vector3(PRN_AT.x, 1.3, PRN_AT.z - 0.05);
  if (at === "register") return co?.kind !== "signup" && co?.i >= CO_STEPS.findIndex(q => q.id === "ring") ? cashDrawer.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.08, -0.3)) : new THREE.Vector3(-5.45, 1.12, 3.8);   // the drawer / the keyboard
  const q = co.cust.c.group.position; return new THREE.Vector3(q.x, 1.2, 3.95);   // over the counter, where their hand meets hers
}
function empSpawn(arrive = false) {              // into the store in the uniform: at their spot behind the counter, or (arrive) in the front door and over to it
  const c = emp.c = VaultCustomers.build(emp.outfit);
  c.parts.forEach(m => { m.userData.employee = emp; aimables.push(m); });
  c.glows.forEach(glow); scene.add(c.group); colliders.push(emp.box);
  c.group.position.set(emp.home.x, 0, emp.home.z); emp.ry = emp.face = emp.home.ry;
  c.setMood("neutral"); emp.state = "post";
  if (arrive) { c.group.position.set(CUST_DOOR.x, 0, CUST_DOOR.z); emp.ry = Math.PI; empGo("toPost", emp.home); }
}
function empDespawn() {                          // out the door: gone for the day
  const c = emp.c; if (!c) return;
  c.holdItem(null); c.parts.forEach(m => { const i = aimables.indexOf(m); if (i >= 0) aimables.splice(i, 1); });
  c.group.removeFromParent(); c.dispose?.();
  const ci = colliders.indexOf(emp.box); if (ci >= 0) colliders.splice(ci, 1);
  if (stool.by === emp) stool.by = null;
  Object.assign(emp, empState(), { sentHome: emp.sentHome });
}
const weekday = () => shiftDate().getDay();
function onDuty(e) {                             // should they be in the store right now?
  if (e.sentHome) return false;
  if (shift.h >= SHIFT.close) return !!e.c;      // after close: whoever's still here, till you send them home
  const n = Math.floor(shift.h) - SCHED_H0;
  return n >= 0 && n < SCHED_SLOTS && !!(e.sched[weekday()] >> n & 1);
}
function sendHome(e) {                           // after close: E on them
  e.sentHome = true; e.leaving = true;
  if (["watching", "sitDown"].includes(e.state)) { e.state = "standUp"; e.t = 0.6; e.c.setPose("idle"); }
  logAct(`Sent ${e.first} home for the night`);
}
function setSched(id, day, n, on) {              // the POS's schedule screen -> an error, or null
  const e = staff.find(x => x.id === id); if (!e || day < 0 || day > 6 || n < 0 || n >= SCHED_SLOTS) return "NO SUCH SHIFT.";
  const has = !!(e.sched[day] >> n & 1); if (has === on) return null;
  if (on && schedHours(e) >= SCHED_MAX) return `${e.first.toUpperCase()} IS AT ${SCHED_MAX} HOURS (PART TIME).`;
  e.sched[day] ^= 1 << n; saveState(); return null;
}
function empGo(state, spot, avoidPlayer = false) {
  if (emp.fetch && !["fetchGo", "fetchBack", "repath"].includes(state)) empFetchDrop();   // called away mid-fetch: the tape goes back
  if (emp.restock && !["stockGo", "stockTo", "repath"].includes(state)) danaRestockAbort();   // ...or the stock she's carrying
  if (STOOL_STATES.includes(emp.state) && !STOOL_STATES.includes(state)) empLeaveStool();
  const p = emp.c.group.position, r = 0.35;
  const you = avoidPlayer ? [{ x0: player.x - r, x1: player.x + r, z0: player.z - r, z1: player.z + r }] : [];
  const grid = navGrid([emp.box, flapCollider], you); spot = spotBesideYou(spot, grid);
  const path = navPath(grid, p.x, p.z, spot.x, spot.z)   // she can lift the pass-through
    || navPath(navGrid([emp.box, flapCollider, ...custs.map(k => k.box)]), p.x, p.z, spot.x, spot.z);   // through whoever's in the way
  if (!path) { emp.path = []; emp.repath = { state, spot }; emp.state = "repath"; emp.t = 1; emp.spot = spot; return; }
  emp.path = path;
  if (!avoidPlayer) emp.detour = false;
  emp.state = state; emp.spot = spot; emp.stuck = 0;
}
const shelfSpot = copy => ({ x: copy.pos.x + Math.cos(copy.ry) * 0.8, z: copy.pos.z - Math.sin(copy.ry) * 0.8, ry: Math.atan2(-Math.cos(copy.ry), Math.sin(copy.ry)) });
function empNext() {                              // processing returns: what's next with what she's carrying
  const c = emp.c;
  c.reachTo(null);
  c.holdTape(Math.min(3, emp.carry.length)); c.setPose(emp.carry.length ? "hold" : "idle");
  if (emp.carry.some(t => !isRewound(t))) return empGo("toRewinder", rewinderSpot());
  const alerted = emp.carry.find(holdAlertFor);
  if (alerted) { emp.target = alerted; return empGo("toHolds", { x: HOLDS_AT.x, z: HOLDS_AT.z + 0.6, ry: Math.PI }); }   // flagged on the POS: someone's waiting on this one
  if (emp.carry.length) {                         // nearest slot next: one loop through the floor, not a trip per tape
    const p = c.group.position, d = t => Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
    emp.target = emp.carry.reduce((a, b) => d(b) < d(a) ? b : a);   // ponytail: greedy nearest-neighbor, fine for a handful of tapes
    return empGo("toShelf", shelfSpot(emp.target));
  }
  if (!returnBin.length && strays.length) {       // bin's done: straighten up what customers shoved in anywhere
    const p = c.group.position, s = strays.reduce((a, b) => Math.hypot(b.at.pos.x - p.x, b.at.pos.z - p.z) < Math.hypot(a.at.pos.x - p.x, a.at.pos.z - p.z) ? b : a);
    emp.stray = s; return empGo("toStray", shelfSpot(s.at));
  }
  empGo("toTote", EMP_TOTE);
}
function empToggle() {                            // E on Dana: returns <-> register
  const c = emp.c;
  if (emp.state === "watching") { c.setMood("happy"); emp.watch.hold = 1.5; return; }   // just a smile; she's off the clock
  if (emp.task === "register") {
    if (!returnBin.length && !strays.length) { toast(`${emp.first}: returns bin's empty, and the shelves are straight!`, true); c.setMood("happy"); emp.t = 1; return; }
    emp.task = "returns"; c.setMood("happy"); returnBin.length ? empGo("toTote", EMP_TOTE) : empNext();
  } else empBackToRegister();
}
function empFetch(cust) {                         // off to the shelves for them: the title they asked for, or a pick from their kind of thing
  const w = cust.want, cats = cust.who.persona.taste.cats;
  if (w.kind === "hold" && w.hold.copy) {         // right behind her on the holds shelf
    const t = w.hold.copy; w.hold.pulled = t; emp.c.reachTo(HOLDS_AT.clone().setY(HOLDS_AT.y + 0.1)); emp.t = 1.2;
    custHandHold(cust, t, "dana"); return;
  }
  let copy = w.kind !== "rec" ? onShelfCopy(w.title) : null;
  if (w.kind === "hold" && !copy) { custHoldOut(cust, "dana"); emp.t = 1; return; }
  if (w.kind === "title" && !copy) { custAllOut(cust, "dana"); emp.t = 1; return; }   // she checks the screen: all out
  if (!copy) {
    const pool = catalog.filter(t => t.pos && (Math.random() < Math.min(0.95, 0.45 + 0.05 * lv("dana", "int")) ? cats.includes(t.category) : true)).map(onShelfCopy).filter(Boolean);   // (INT: knows the stock)
    copy = pool[Math.floor(Math.random() * pool.length)]; if (!copy) return;
  }
  cust.danaOn = true; emp.fetch = { cust, copy };
  emp.c.setMood("happy"); logAct(`${emp.first} went to find ${w.kind === "title" ? tapeName(w.title) : "something"} for ${memberName(cust.member)}`);
  empGo("fetchGo", shelfSpot(copy));
}
function empFetchDrop() {                          // whatever she was fetching goes back where it came from
  const f = emp.fetch; if (!f) return;
  if (f.got) { setOnShelf(f.copy, true); emp.c.holdTape(0); }
  if (f.cust) f.cust.danaOn = false;
  if (f.hold && !f.hold.copy) f.hold.by = "you";   // (a hold she didn't get to is yours to do)
  emp.fetch = null;
}
// ---- Dana's job board, RimWorld style: each job gets a priority, 1 (first)
// to 4, or off. Whenever she's free she takes the job with work at the best
// priority (ties go in the board's order); a customer-facing job at a better
// priority than what she's on pulls her off background work ----
const JOBS = {
  register: { name: "REGISTER", desc: "ring up customers, sign people up" },
  phone: { name: "PHONES", desc: "answer calls, put holds aside" },
  floor: { name: "FLOOR HELP", desc: "fetch what people ask for at the counter" },
  returns: { name: "RETURNS", desc: "rewind and reshelve, fix misshelved tapes" },
  restock: { name: "RESTOCK", desc: "fill the snack and drink racks from stock" },
  cleanup: { name: "CLEANUP", desc: "litter, spills, theater cups, taking out the trash" },
};
const JOB_DEFAULT = { register: 1, phone: 2, floor: 2, returns: 3, restock: 3, cleanup: 4 };
const defaultJobs = saved => Object.keys(JOBS).map(id => ({ id, pri: saved?.find?.(j => j.id === id)?.pri ?? JOB_DEFAULT[id] }));   // (the board's order is fixed; the priorities are yours)
const jobPri = id => emp.jobs.find(j => j.id === id)?.pri || 9;   // off counts as never
const jobOrder = () => emp.jobs.filter(j => j.pri).sort((a, b) => a.pri - b.pri || emp.jobs.indexOf(a) - emp.jobs.indexOf(b)).map(j => j.id);
// who's on staff: the save's, or (sandbox, or a save from when Dana was the only hire) Dana
if (SAVE?.staff) SAVE.staff.forEach((x, i) => staff.push(makeEmployee(x, i, x)));
else if (!SIM || upg.hireDana) staff.push(makeEmployee(DANA_APP, 0, { jobs: SAVE?.jobs }));

const FRONT_JOBS = ["register", "phone", "floor"];   // the customer-facing ones: these pull her off background work
function jobHasWork(id) {
  switch (id) {
    case "register": return !!custWaiting() && (!co || co.emp === emp);
    case "phone": return !!phone.ring && phone.ring.t > 6;
    case "floor": return custAsks.some(k => k.state === "asking" && !k.danaOn && clockT - k.askAt > 20);
    case "returns": return returnBin.length > 0 || strays.length > 0;
    case "restock": return emptySpots().some(u => (backstock[u.userData.snack.name] || 0) > 0);
    case "cleanup": return messes.length > 0 || !!trashJob();
  }
  return false;
}
const danaBestJob = (above = null) => { for (const id of jobOrder()) { if (above && jobPri(id) >= jobPri(above)) return null; if (jobHasWork(id)) return id; } return null; };   // above: only jobs at a strictly better priority
const danaJobNow = () => emp.task === "returns" && !emp.paused ? "returns" : emp.restock ? "restock" : emp.mess || emp.trash ? "cleanup" : emp.fetch?.cust ? "floor" : emp.fetch?.hold ? "phone" : co?.emp === emp ? "register" : null;
function danaStartJob(id) {                       // from her post: off to do it
  const c = emp.c, p = c.group.position;
  if (id === "floor") { const k = custAsks.find(k => k.state === "asking" && !k.danaOn && clockT - k.askAt > 20); if (k) empFetch(k); return; }
  if (id === "returns") { emp.task = "returns"; c.setMood("happy"); returnBin.length ? empGo("toTote", EMP_TOTE) : empNext(); return; }
  if (id === "restock") { danaRestockStart(); return; }
  if (id === "cleanup") {
    const t = trashJob();                         // a bag on the floor or a nearly-full bin before litter; otherwise litter first
    if (t && (!messes.length || t.mesh || t.n >= t.cap * 0.85)) { empTrashStart(t); return; }
    if (!messes.length) return;
    const m = messes.reduce((a, b) => Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a);
    emp.mess = m; c.setMood("neutral"); empGo("toMess", { x: m.x + 0.45, z: m.z, ry: -Math.PI / 2 });
  }
}
function danaPreempt() {                          // something customer-facing (and ranked above what she's on) needs her
  const now = danaJobNow(); if (!now || FRONT_JOBS.includes(now)) return;
  for (const id of jobOrder()) {
    if (jobPri(id) >= jobPri(now)) return;
    if (!FRONT_JOBS.includes(id) || !jobHasWork(id)) continue;
    if (now === "returns") empSummon(true);
    else if (now === "restock") { danaRestockAbort(); empGo("toPost", emp.home); }
    return;                                       // (cleanup is quick: she finishes it)
  }
}
// ---- restock: from the cupboard to the racks, up to 6 at a time ----
function danaRestockStart() {
  const need = emptySpots().filter(u => (backstock[u.userData.snack.name] || 0) > 0); if (!need.length) return;
  const drinks = need.filter(u => isDrink(u.userData.snack)), food = need.filter(u => !isDrink(u.userData.snack)), kind = drinks.length >= food.length ? "drinks" : "food";
  const units = (kind === "drinks" ? drinks : food).slice(0, Math.min(10, 4 + lv("dana", "str")));   // (STR: a bigger armful)
  emp.restock = { kind, units, got: [], n: 0 }; emp.c.setMood("neutral");
  empGo("stockGo", cupboardSpot(kind));
}
function cupboardSpot(kind) {                     // in front of that kind's cupboard doors, on the staff side
  const doorsOf = aimables.filter(m => m.userData.stock === kind && m.geometry?.parameters?.width > 0.4), v = new THREE.Vector3(), n = new THREE.Vector3();
  const d = doorsOf[Math.floor(doorsOf.length / 2)] || doorsOf[0];
  d.getWorldPosition(v); n.set(0, 0, -1).applyQuaternion(d.getWorldQuaternion(new THREE.Quaternion()));
  return { x: v.x + n.x * 0.6, z: v.z + n.z * 0.6, ry: Math.atan2(-n.x, -n.z), door: v.clone() };
}
function unitSpot(u) {                            // standing in front of a rack spot, facing it
  const v = u.getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(); u.parent.getWorldDirection(n);
  return { x: v.x + n.x * 0.75, z: v.z + n.z * 0.75, ry: Math.atan2(-n.x, -n.z), at: v };
}
function danaRestockNext() {
  const r = emp.restock, u = r.got[0];
  if (!u) {                                       // all out
    if (emp.openedCooler) { coolerOpen = false; emp.openedCooler = false; }
    emp.c.holdItem(null); emp.c.setPose("idle");
    if (r.n) logAct(`${emp.first} restocked ${r.n} item${r.n > 1 ? "s" : ""} on the racks`, "good", null, 3 * r.n);
    emp.restock = null; empGo("toPost", emp.home); return;
  }
  emp.c.holdItem(snackProxy(u)); emp.c.setPose("hold");
  if (!isDrink(u.userData.snack) && emp.openedCooler) { coolerOpen = false; emp.openedCooler = false; }
  empGo("stockTo", unitSpot(u));
}
function danaRestockAbort() {                     // called away: what she's carrying goes back in the cupboard
  const r = emp.restock; if (!r) return;
  for (const u of r.got) backstock[u.userData.snack.name] = (backstock[u.userData.snack.name] || 0) + 1;
  if (emp.openedCooler) { coolerOpen = false; emp.openedCooler = false; }
  emp.c.holdItem(null); emp.c.reachTo(null); emp.c.setPose("idle");
  if (r.n) logAct(`${emp.first} restocked ${r.n} item${r.n > 1 ? "s" : ""} before being needed elsewhere`, "good", null, 3 * r.n);
  emp.restock = null;
}
// ---- the board itself: a grid, employees down the side and jobs across. E on it; ↑↓←→ pick a
// square, 1-4 its priority (Space steps through), 0 or X: that employee doesn't do that job. E closes ----
const board = { open: false, r: 0, c: 0 };
const JOB_SHORT = { register: "REGISTER", phone: "PHONES", floor: "FLOOR", returns: "RETURNS", restock: "RESTOCK", cleanup: "CLEANUP" };
function boardOpen() { board.open = true; keys.clear(); $("hoverTip").style.display = "none"; board.r = Math.min(board.r, Math.max(0, staff.length - 1)); boardHud(); }
function boardClose() { board.open = false; boardHud(); }
function boardKey(e) {
  const k = e.code, J = Object.keys(JOBS);
  if (k === "KeyE" || k === "Escape" || k === "Enter") { if (!e.repeat) boardClose(); return; }
  if (!staff.length) return;
  const cell = () => staff[board.r].jobs.find(j => j.id === J[board.c]);
  if (k === "ArrowUp" || k === "KeyW") board.r = (board.r + staff.length - 1) % staff.length;
  else if (k === "ArrowDown" || k === "KeyS") board.r = (board.r + 1) % staff.length;
  else if (k === "ArrowLeft" || k === "KeyA") board.c = (board.c + J.length - 1) % J.length;
  else if (k === "ArrowRight" || k === "KeyD") board.c = (board.c + 1) % J.length;
  else if (/^Digit[0-4]$/.test(k)) cell().pri = +k[5];
  else if (k === "KeyX" || k === "Backspace" || k === "Delete") cell().pri = 0;
  else if (k === "Space") { const j = cell(); j.pri = j.pri && j.pri < 4 ? j.pri + 1 : j.pri ? 0 : 1; }   // 1, 2, 3, 4, X, 1...
  else return;
  e.preventDefault(); boardHud();
}
function boardHud() {
  const el = $("jobBoard"); if (!board.open) { el.style.display = "none"; return; }
  const J = Object.keys(JOBS);
  el.innerHTML = `<div class="h">STAFF JOBS · 1 FIRST → 4 LAST · ✕ NEVER</div>` + (staff.length ? `<table class="grid"><tr><th></th>${J.map((id, c) => `<th class="${c === board.c ? "on" : ""}" title="${JOBS[id].desc}">${JOB_SHORT[id]}</th>`).join("")}</tr>` +
    staff.map((e, r) => { const now = withEmp(e, danaJobNow);
      return `<tr><td class="who${r === board.r ? " on" : ""}">${e.first} ${e.last}<small>${empSummary(e)}</small></td>` +
        J.map((id, c) => { const p = e.jobs.find(j => j.id === id).pri; return `<td class="cell p${p}${r === board.r && c === board.c ? " sel" : ""}${now === id ? " now" : ""}">${p || "✕"}</td>`; }).join("") + "</tr>"; }).join("") + "</table>"
    : `<div class="warn">Nobody on staff yet: hire someone on the register (U)</div>`) +
    `<div class="keys">↑↓←→ pick a square · 1–4 priority · 0 / X never · SPACE steps through · ▸ = doing it now · E close</div>`;
  el.style.display = "block";
}
// ---- the character sheet: K. You and each of the staff, level and progress in all six ----
const sheet = { open: false };
function sheetToggle() { sheet.open = !sheet.open; sheetHud(); }
function sheetHud() {
  const el = $("charSheet"); if (!el) return; if (!sheet.open) { el.style.display = "none"; return; }
  const row = (w, name) => `<tr><td class="who">${name}</td>${SKILL_IDS.map(k => { const sk = w.skills[k], f = sk.lvl >= SKILL_MAX ? 1 : sk.xp / xpToNext(sk.lvl);
    return `<td><b>${sk.lvl}</b><div class="bar"><i style="width:${Math.round(f * 100)}%"></i></div></td>`; }).join("")}</tr>`;
  el.innerHTML = `<div class="h">SKILLS · K to close</div><table><tr><th></th>${SKILL_IDS.map(k => `<th title="${SKILLS[k].what}">${SKILLS[k].name}</th>`).join("")}</tr>` +
    row(you, "You") + staff.map(e => row(e, e.first)).join("") + `</table>` +
    `<div class="legend">${SKILL_IDS.map(k => `<span><b>${SKILLS[k].name}</b> ${SKILLS[k].what}${Object.entries(MILESTONES[k]).map(([L, m]) =>
      `<br><span style="opacity:${has("you", k, +L) ? 1 : 0.5}">${has("you", k, +L) ? "★" : "☆"} ${L} ${m[0]}: ${m[1]}</span>`).join("")}</span>`).join("")}</div>`;
  el.style.display = "block";
}
// ---- hiring: buying "hire an employee" brings up three applicants to pick from ----
const hiring = { open: false, apps: [], refund: 0 };
const hireCost = () => Math.round(250 * 1.55 ** (upg.hires || 0) / 5) * 5;   // each hire costs more than the last
function hireOpen(paid) {
  hiring.open = true; hiring.refund = paid; hiring.apps = [rollApplicant(), rollApplicant(), rollApplicant()];
  const el = $("hireScreen"), shots = portraits(hiring.apps.map(a => a.outfit));
  el.innerHTML = `<div class="h">THREE APPLICANTS · PICK ONE</div><div class="apps">` + hiring.apps.map((a, i) => `<div class="app">
      <img src="${shots[i]}" alt=""><div class="nm">${a.first} ${a.last}</div><div class="lk">${a.female ? "Woman" : "Man"} · ${looksOf(a.outfit)}</div>
      <table>${SKILL_IDS.map(k => `<tr><td title="${SKILLS[k].what}">${SKILLS[k].name}</td><td><div class="pips">${"<i></i>".repeat(a.levels[k])}</div></td><td>${a.levels[k]}</td></tr>`).join("")}</table>
      <div class="wage">$${empRate({ skills: skillsOf(a.levels) }).toFixed(2)} an hour · up to 25 hrs a week</div><button data-i="${i}">HIRE ${a.first.toUpperCase()}</button></div>`).join("") + `</div>
    <button class="none">NOT NOW (REFUND $${paid.toFixed(2)})</button>`;
  el.querySelectorAll("button[data-i]").forEach(b => b.onclick = () => hirePick(+b.dataset.i));
  el.querySelector("button.none").onclick = () => { posTerm.sale(hiring.refund); hireClose(); logAct("Decided not to hire anyone for now (refunded)"); };
  el.style.display = "flex";
}
function hirePick(i) {
  const a = hiring.apps[i]; if (!a) return;
  const e = makeEmployee(a, staff.length); staff.push(e); upg.hires = (upg.hires || 0) + 1;
  amenities(); hireClose(); logAct(`Hired ${a.first} ${a.last}: starting right now`, "good"); saveState();
}
function hireClose() {
  hiring.open = false; $("hireScreen").style.display = "none";
  if (started && !posTerm?.isOpen() && document.pointerLockElement !== canvas) canvas.requestPointerLock()?.catch?.(() => {});   // the register was closed underneath: back into the store
}
function portraits(outfits) {                     // a head-and-shoulders render of each applicant (their own little renderer, then thrown away)
  const W = 180, H = 220, out = [];
  try {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(W, H); r.setPixelRatio(1);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(1, 2, 3); sc.add(d);
    const cam = new THREE.PerspectiveCamera(28, W / H, 0.1, 10);
    for (const o of outfits) {
      const c = VaultCustomers.build(o); c.setMood("happy"); c.tick(0.016, 0); sc.add(c.group);
      const top = 1.62 * o.height; cam.position.set(0.55, top + 0.05, 2.7); cam.lookAt(0, top - 0.2, 0);
      r.render(sc, cam); out.push(r.domElement.toDataURL()); sc.remove(c.group); c.dispose();
    }
    r.dispose(); r.forceContextLoss();
  } catch { while (out.length < outfits.length) out.push(""); }
  return out;
}
function empSummon(force = false) {              // the bell: drop what she's doing (tapes stay in hand), ring them up, then back to it
  if (emp.task !== "returns" || emp.paused) return;
  if (!force && jobPri("register") >= jobPri("returns")) return;   // the board says the returns matter as much or more
  emp.paused = true; emp.c.setMood("happy"); empGo("toPost", emp.home);
}
function empBackToRegister(msg) {
  emp.paused = false;
  const c = emp.c;
  returnBin.push(...emp.carry); emp.carry = []; refreshReturnsBin();   // anything still in hand goes back in the tote
  emp.rewinding = [];                              // (a tape in a rewinder stays there for whoever's next)
  c.holdTape(0); c.setPose("idle"); c.reachTo(null); c.setMood(msg ? "happy" : "neutral");
  emp.task = "register"; empGo("toPost", emp.home);
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
const empCanWatch = () => frontLock.locked && !custs.length && emp.task === "register" && seated && !seatAt?.toilet;   // what brings her over (the couch, not the restroom)
const inLounge = () => Math.hypot(player.x - TV.x, player.z - (TV.z - 2.5)) < 5.5;
const empKeepWatching = () => frontLock.locked && !custs.length && emp.task === "register" && ((seated && !seatAt?.toilet) || inLounge()) && !gateAlarm.on;   // what keeps her there (the alarm gets her up)
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
const empIdle = () => emp.task === "register" && !emp.paused && !custs.length && !co && !gateAlarm.on && !empCanWatch() && !danaBestJob();   // (work on the board gets her off the stool)
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
  stool.by = emp; emp.stoolPlan = home ? "sit" : "carry";
  emp.c.setMood("happy"); empGo("toStool", side);
}
function empStoolSit() {                         // back onto the seat from wherever she's standing
  const c = emp.c, p = c.group.position;
  c.reachTo(null); c.setPose("sit", STOOL_SIT);
  emp.state = "stoolSitDown"; emp.t = 0.7; emp.from = { x: p.x, z: p.z };
}
function empLeaveStool() {                       // dropped mid-whatever (you called her away): let go of it right now
  if (stool.by !== emp) return;
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
function empTick(dt) { for (const e of staff) withEmp(e, () => empTickOne(dt)); }   // each of them in turn
function empTickOne(dt) {
  if (!emp.c) {                                   // off the clock: in when their shift starts (already at their post if the store's just loaded)
    if (!window.VaultCustomers || !posTerm || shift.report || !onDuty(emp)) return;
    const arrive = clockT > 3; empSpawn(arrive); if (arrive) logAct(`${emp.first} clocked in`);
  }
  if (!emp.leaving && !onDuty(emp)) emp.leaving = true;   // their shift's over (or you sent them home): they finish up, then go
  if (emp.leaving && emp.state === "post" && co?.emp !== emp && !emp.paused && emp.task === "register" && !emp.trash && !emp.mess && !emp.restock && !emp.fetch && emp.t <= 0) {
    empGo("toExit", CUST_DOOR); emp.state = "toExit"; emp.c.setMood("happy");
    if (!emp.sentHome) logAct(`${emp.first} clocked out`);
  }
  const c = emp.c, p = c.group.position;
  danaPreempt();
  // she gets dizzy too: same build-up as yours (twice as fast, so one big bored spin can do it), and it staggers her walk
  emp.dizzy = stool.by === emp && emp.state === "stoolSit" && stool.vel > 5 ? Math.min(1, (emp.dizzy || 0) + dt * stool.vel / STOOL.MAX / 4) : Math.max(0, (emp.dizzy || 0) - dt / 20);
  const dk = Math.max(0, (emp.dizzy - 0.3) / 0.7);
  if (dk > 0.3 && !emp.dizzySaid) { emp.dizzySaid = true; logAct(`${emp.first}'s dizzy from all that spinning`); }
  if (!dk) emp.dizzySaid = false;
  if (gateAlarm.on && gateAlarm.t > 5 && emp.task === "returns" && !emp.paused) {   // you've let it ring: she drops the returns and goes to shut it off
    empSummon(); logAct(`${emp.first}'s leaving the returns to shut off the gate alarm`);
  }
  let speed = 0;
  if (emp.path.length) {                          // walking (same manners as the customers)
    const [tx, tz] = emp.path[0], dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) emp.path.shift();
    else if (yieldTo(emp, p, dx, dz, dt, av => empGo(emp.state, emp.spot, av))) {}
    else {
      speed = 1.45 * (1 + 0.03 * (lv("dana", "con") - 1)) * (1 - 0.45 * dk);   // (CON: quicker on their feet)
      if ((emp.walkD = (emp.walkD || 0) + speed * dt) > 25) { emp.walkD = 0; gainXp("dana", "con", 1); }
      const step = Math.min(d, speed * dt), sw = dk * 0.2 * Math.cos(clockT * 1.7) * dt;   // sw: weaving side to side (it evens out)
      p.x += dx / d * step + dz / d * sw; p.z += dz / d * step - dx / d * sw;
      emp.ry = Math.atan2(dx, dz);
      if ((emp.stepD = (emp.stepD || 0) + step) > 0.72) { emp.stepD = 0; ambStep(p.x, p.z, 1); }
    }
    if (!emp.path.length && emp.spot) emp.ry = emp.spot.ry;
  } else {
    emp.t -= dt;
    switch (emp.state) {
      case "repath": if (emp.t <= 0) empGo(emp.repath.state, emp.repath.spot); break;
      case "fetchGo": c.reachTo(emp.fetch.copy.pos); emp.state = "fetchTake"; emp.t = 0.8; break;
      case "fetchTake": if (emp.t <= 0) {
        const f = emp.fetch; c.reachTo(null);
        if (f.copy.offShelf || (f.cust && f.cust.state !== "asking")) { if (f.hold) f.hold.by = "you"; empFetchDrop(); empGo("toPost", emp.home); break; }   // somebody beat her to it / they've gone (a hold's on you now)
        setOnShelf(f.copy, false); f.got = true; c.holdTape(1); c.setPose("hold");
        if (f.hold) { empGo("fetchBack", { x: HOLDS_AT.x, z: HOLDS_AT.z + 0.6, ry: Math.PI }); break; }   // to the holds shelf
        const a = f.cust.c.group.position; empGo("fetchBack", { x: a.x, z: EMP_POST.z, ry: 0 });   // back behind the counter, across from them
      } break;
      case "fetchBack": {
        const f = emp.fetch;
        if (f.hold) { c.reachTo(HOLDS_AT.clone().setY(HOLDS_AT.y + 0.1)); emp.state = "fetchGive"; emp.t = 0.9; break; }
        if (f.cust.state !== "asking" || !f.cust.c) { empFetchDrop(); empGo("toPost", emp.home); break; }
        c.reachTo(f.cust.c.group.position.clone().setY(1.2)); emp.state = "fetchGive"; emp.t = 0.9; break;
      }
      case "fetchGive": if (emp.t <= 0) {
        const f = emp.fetch; c.reachTo(null); c.holdTape(0); c.setPose("idle");
        if (f.hold) { f.hold.copy = f.copy; f.got = false; holdsRender(); shiftScore(15, "dana"); gainXp("dana", "int", 5); gainXp("dana", "cha", 3); logAct(`${emp.first} put ${f.copy.title} on the holds shelf for ${memberName(f.hold.member)}`, "good", null, 15); }
        else if (f.cust.state === "asking" && custHandTape(f.cust, f.copy, "dana")) { f.got = false; }   // they took it
        empFetchDrop(); empGo("toPost", emp.home);
      } break;
      case "toPost": emp.state = "post"; c.setPose("idle"); c.setMood("neutral"); break;
      case "toExit": empDespawn(); return;      // out the front door
      case "post": {                              // ring up whoever's waiting (if that's her job right now); shut the gates up
        const best = co?.emp === emp ? "register" : danaBestJob();
        if (custWaiting() && best === "register") {
          c.setMood("happy");
          if (!co && (emp.ringT += dt) > 1.5) { emp.ringT = 0; coStart("dana"); if (co) co.emp = emp; }   // their turn: start ringing them up
        } else emp.ringT = 0;
        const mine = co?.emp === emp && co.cust.c;
        // she shuffles over to the pad for the desensitize step and back after — never leans across for it
        const wantX = mine && coStep()?.at === "pad" && onNorthRun(DESENS_AT) ? Math.min(DESENS_AT.x, COUNTER.tops[1].staff - 0.1) : mine && coStep()?.at === "printer" && onNorthRun(PRN_AT) ? Math.min(PRN_AT.x, COUNTER.tops[1].staff - 0.1) : emp.spot?.x ?? EMP_POST.x, gap = wantX - p.x;   // (set down round on the east run: she reaches from her post)   // home = wherever she parked (beside you, if you're on her spot)
        if (Math.abs(gap) > 0.02) { const st = Math.sign(gap) * Math.min(Math.abs(gap), 1.0 * dt); p.x += st; speed = 1.0; }
        if (mine) {                                // chatting while she works: faces them, nods, smiles
          c.talk(true);
          const q = co.cust.c.group.position, rel = Math.atan2(q.x - p.x, q.z - p.z) - emp.face;
          c.lookAt(coStep()?.at === "customer" ? Math.atan2(Math.sin(rel), Math.cos(rel)) : null);
          if ((emp.chatT = (emp.chatT || 0) - dt) <= 0) { emp.chatT = 1.5 + Math.random() * 2; c.setMood(["happy", "happy", "neutral", "love"][Math.floor(Math.random() * 4)]); }
        } else { c.talk(false); if (emp.coWas) c.lookAt(null); }
        emp.coWas = mine;
        if (mine && Math.abs(gap) <= 0.02 && (emp.coT -= dt) <= 0) {   // one step at a time: hand out, then the step happens
          const s = coStep();
          if (emp.coReached) { emp.coReached = false; coAct(s.at); c.reachTo(null); emp.coT = 0.35; }
          else { emp.coReached = true; c.reachTo(empCoTarget(s.at), 1, { lean: false }); emp.coT = (s.at === "customer" ? 0.9 : 0.7) * Math.max(0.45, 1 - 0.04 * (lv("dana", "dex") - 1)); }   // (DEX: quick hands at the register)
        }
        if (co?.by === "dana" && !co.cust.c) { co = null; coHud(); drawerOpen = 0; }
        const tw = !co && emp.t <= 0 && custs.find(k => k.state === "tagWait" && k.t < 30 * k.who.persona.patience - 3);   // (a few seconds: yours if you want it)
        if (tw) { tagFix(tw, "dana"); c.reachTo(new THREE.Vector3(TAG_FIX_SPOT.x, 1.0, TAG_FIX_SPOT.z - 0.4)); emp.t = 0.8; }
        if (gateAlarm.on) { if ((emp.alarmT += dt) > 4) { emp.alarmT = 0; silenceGateAlarm(); gainXp("dana", "wis", 3); logAct(`${emp.first} shut off the gate alarm`); } } else emp.alarmT = 0;   // a few seconds' grace: yours if you want it
        if (emp.t <= 0 && co?.emp !== emp) c.reachTo(null);
        if (emp.t <= 0 && !co && c.mood === "happy" && !custWaiting()) { c.setPose("idle"); c.setMood("neutral"); }
        if (emp.paused && emp.t <= 0 && !co && !gateAlarm.on && !danaBestJob("returns")) { emp.paused = false; empNext(); break; }   // nothing above the returns needs her: back to them
        if (!co && !emp.leaving && empCanWatch()) {                       // closed up and you're on the couch: take the next cushion over
          const side = seatAt.x > 0 ? -1 : seatAt.x < 0 ? 1 : (Math.random() < 0.5 ? -1 : 1);   // the end cushion farthest from you
          emp.seat = { x: side * (Math.abs(SEATS[0].x) - 0.04), z: TV.z - 3.3 }; c.setMood("happy");   // on it, a hair inboard so elbows clear the arm
          empGo("toCouch", { x: emp.seat.x, z: TV.z - 2.425, ry: 0 });   // the strip between the couch and the coffee table
        }
        if (emp.state === "post" && co?.emp !== emp && !emp.paused && emp.t <= 0 && best && !["register", "phone"].includes(best)) {   // the next job on the board (phones: she takes those right here)
          if ((emp.jobT = (emp.jobT || 0) + dt) > 2) { emp.jobT = 0; danaStartJob(best); break; }
        } else emp.jobT = 0;
        if (emp.state === "post" && !best && empIdle() && emp.t <= 0 && stoolFree()) { if ((emp.idleT = (emp.idleT || 0) + dt) > EMP_STOOL_WAIT) { emp.idleT = 0; empFetchStool(); } }
        else emp.idleT = 0;
        break;
      }
      case "toStool":
        if (!empIdle()) { empGo("toPost", emp.home); break; }
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
        if (emp.t <= 0) { stool.by = null; empGo("toPost", emp.home); }
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
          if ((emp.leaveT += dt) > (frontLock.locked && !custs.length ? 8 : 1.5)) { emp.state = "standUp"; emp.t = 0.6; c.setPose("idle"); c.setMood("neutral"); }
        }
        else emp.leaveT = 0;
        break;
      case "standUp": if (emp.t <= 0) { p.z = TV.z - 2.425; c.lookAt(null); empGo("toPost", emp.home); } break;
      case "toStray": c.reachTo(emp.stray.mesh.position); emp.state = "strayTake"; emp.t = 0.8; break;
      case "strayTake": if (emp.t <= 0) {
        const s = emp.stray; emp.stray = null;
        if (strays.includes(s)) { strayTake(s); emp.carry.push(s.copy); shiftScore(5, "dana"); }
        empNext();
      } break;
      case "stockGo": c.reachTo(cupboardSpot(emp.restock.kind).door); emp.state = "stockGrab"; emp.t = 1; break;
      case "stockGrab": if (emp.t <= 0) {         // into the cupboard for what the racks need
        const r = emp.restock; c.reachTo(null);
        const units = r.units; r.units = [];     // (her own plan off the books, so emptySpots sees those spots again)
        const free = new Set(emptySpots());
        for (const u of units) { const nm = u.userData.snack.name; if (free.has(u) && (backstock[nm] || 0) > 0) { backstock[nm]--; r.got.push(u); } }
        danaRestockNext();
      } break;
      case "stockTo": {
        const u = emp.restock.got[0];
        if (isDrink(u.userData.snack) && !coolerOpen) { coolerOpen = true; emp.openedCooler = true; }
        c.reachTo(u.getWorldPosition(new THREE.Vector3())); emp.state = "stockPut"; emp.t = 0.8; break;
      }
      case "stockPut": if (emp.t <= 0) {
        const r = emp.restock, u = r.got.shift(); c.reachTo(null);
        if (!u.visible) { u.visible = true; if (isDrink(u.userData.snack)) u.userData.temp = ROOM_F; shiftScore(3, "dana"); r.n++; gainXp("dana", "str", 2); }
        else backstock[u.userData.snack.name] = (backstock[u.userData.snack.name] || 0) + 1;   // somebody beat her to it
        danaRestockNext();
      } break;
      case "toBin": { const b = emp.trash.t; c.reachTo(new THREE.Vector3(b.x, (b.rimY || 0.9) + 0.05, b.z)); emp.state = "bagging"; emp.t = 2.2 * Math.max(0.5, 1 - 0.03 * (lv("dana", "dex") - 1)); break; }
      case "bagging": if (emp.t <= 0) {
        const b = emp.trash.t; b.claim = null; c.reachTo(null);
        if (!b.n) { emp.trash = null; empGo("toPost", emp.home); break; }   // somebody beat them to it
        emp.trash.bag = bagTie(b); gainXp("dana", "con", 3); empToChute();
      } break;
      case "toBag": c.setPose("crouch"); c.reachTo(new THREE.Vector3(emp.trash.t.x, 0.25, emp.trash.t.z)); emp.state = "bagLift"; emp.t = 0.8; break;
      case "bagLift": if (emp.t <= 0) {
        const g = emp.trash.t; g.claim = null; c.setPose("idle"); c.reachTo(null);
        if (!bagsDown.includes(g)) { emp.trash = null; empGo("toPost", emp.home); break; }
        bagsDown.splice(bagsDown.indexOf(g), 1); g.mesh.removeFromParent(); unaim(g.mesh); g.mesh = makeBag(g.bin, g.n); emp.trash.bag = g; empToChute();
      } break;
      case "toChute": c.reachTo(new THREE.Vector3(...chute.at)); emp.state = "chuting"; emp.t = 1.3; chuteUse(1); break;
      case "chuting":
        if (emp.trash.bag && emp.t < 0.9) {      // in it goes
          c.holdItem(null); emp.trash.bag = null; shiftScore(10, "dana"); gainXp("dana", "str", 3); gainXp("dana", "con", 2);
          logAct(`${emp.first} took a bag of trash down the chute`, "good", null, 10);
        }
        if (emp.t <= 0) { c.reachTo(null); emp.trash = null; empGo("toPost", emp.home); }
        break;
      case "toMess": c.setPose("crouch"); c.reachTo(new THREE.Vector3(emp.mess.x, emp.mess.y + 0.05, emp.mess.z)); emp.state = "cleaning"; emp.t = 1.4; break;
      case "cleaning": if (emp.t <= 0) {
        const m = emp.mess; emp.mess = null; c.reachTo(null); c.setPose("idle");
        if (messes.includes(m)) messClean(m, "dana");
        empGo("toPost", emp.home);
      } break;
      case "toTote":
        if (!returnBin.length) { if (strays.length) { empNext(); break; } empBackToRegister(); logAct(`${emp.first} finished the returns`); break; }
        c.reachTo(new THREE.Vector3(EMP_TOTE.x + 0.55, 0.8, EMP_TOTE.z)); emp.state = "grab"; emp.t = 0.9; break;   // down into the tote
      case "grab": if (emp.t <= 0) { emp.carry = returnBin.splice(-Math.min(20, 6 + 2 * lv("dana", "str"))); refreshReturnsBin(); c.setMood("neutral"); empNext(); } break;
      case "toRewinder": emp.state = "rewind"; break;
      case "rewind": {                              // both machines at once if she's got the tapes for it
        for (const t of [...emp.rewinding]) if (!rewinders.some(rw => rw.tape === t)) {   // someone else took it out: it's theirs now
          emp.carry.splice(emp.carry.indexOf(t), 1); emp.rewinding.splice(emp.rewinding.indexOf(t), 1);
        }
        if (emp.t > 0) break;                      // one hand, one tape at a time
        const out = rewinders.find(rw => rw.done && emp.rewinding.includes(rw.tape));
        if (out) {                                 // out it comes, rewound
          emp.rewinding.splice(emp.rewinding.indexOf(out.tape), 1); c.reachTo(out.tapeMesh.getWorldPosition(new THREE.Vector3()));
          rewinderEmpty(out); emp.t = 0.5; c.setMood("neutral");
          c.holdTape(Math.min(3, emp.carry.length - emp.rewinding.length)); break;
        }
        const t = emp.carry.find(x => !isRewound(x) && !emp.rewinding.includes(x)), free = rewinders.find(rw => !rw.tape);
        if (t && free) {                           // in it goes
          rewinderLoad(free, t, "dana"); emp.rewinding.push(t); c.reachTo(free.tapeMesh.getWorldPosition(new THREE.Vector3())); emp.t = 0.8; c.setMood("wait");
          c.holdTape(Math.min(3, emp.carry.length - emp.rewinding.length)); break;
        }
        if (!emp.rewinding.length) { if (t) c.setMood("impatient"); else { c.reachTo(null); empNext(); } break; }   // nothing of hers running: done, or both machines taken by someone else
        c.reachTo(null); c.setPose("hold");        // waiting on the machines
        break;
      }
      case "toHolds": c.reachTo(HOLDS_AT.clone().setY(HOLDS_AT.y + 0.1)); emp.state = "holdPut"; emp.t = 0.9; break;
      case "holdPut": if (emp.t <= 0) {
        const t = emp.target, h = holdAlertFor(t);   // (still wanted? they may have come and gone while she walked over)
        if (h) {
          emp.carry.splice(emp.carry.indexOf(t), 1); t.fromReturns = t.strayFix = false; h.copy = t; holdsRender(); shiftScore(15, "dana");
          logAct(`${emp.first} spotted the alert and put ${t.title} on the holds shelf for ${memberName(h.member)}`, "good", null, 15);
        }
        empNext();
      } break;
      case "toShelf": c.reachTo(emp.target.pos); emp.state = "shelve"; emp.t = 0.9 * Math.max(0.5, 1 - 0.03 * (lv("dana", "int") - 1)); break;   // into its own slot (INT: knows right where it goes)
      case "shelve": if (emp.t <= 0) {            // back in its slot, tag re-armed
        const t = emp.target; emp.carry.splice(emp.carry.indexOf(t), 1); t.desens = false; t.fromReturns = false; setOnShelf(t, true);
        shiftScore(5, "dana"); emp.shelved = (emp.shelved || 0) + 1; gainXp("dana", "int", 4);
        if (!emp.carry.length) { logAct(`${emp.first} reshelved ${emp.shelved === 1 ? "a return" : emp.shelved + " returns"}`, "good", null, 5 * emp.shelved); emp.shelved = 0; }
        empNext();
      } break;
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
  c.group.rotation.y = emp.face + dk * 0.35 * Math.sin(clockT * 2.3);
  c.group.rotation.z = dk * 0.12 * Math.sin(clockT * 1.7);   // swaying on her feet
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
let co = null;                                  // { by: "player"|"dana", cust, step, tapes, total, bill, change, des }
const money = n => "$" + n.toFixed(2);
const coTotal = cust => cust.tapes.reduce((a, t) => a + posTerm.rentPrice(t), 0) + cust.snacks.reduce((a, u) => a + snackPrice(u.userData.snack), 0) + (cust.tickets || 0) * SHOW.ticket;
const coTapes = () => co.cust.tapes.length === 1 ? co.cust.tapes[0].title : `${co.cust.tapes.length} tapes`;
// signing somebody up: take their form -> type them in at the register -> hand
// them their new card. Then they're a member, and off they go to look around
const SIGNUP_STEPS = [
  { id: "form", at: "customer", need: () => true, tip: () => "take their sign-up form", do() { co.cust.c.holdProp(null); co.hand = "form"; } },
  { id: "enroll", at: "register", need: () => true, tip: () => "enter them into the computer",
    do() { posBeep(1900); setTimeout(() => posBeep(1500), 120); posTerm.enroll(co.cust.member); rushLevel.n = null; co.hand = "newcard"; } },
  { id: "newcard", at: "customer", need: () => true, tip: () => "hand them their new member card",
    do() {
      const k = co.cust, by = co.by === "player" ? "you" : "dana", secs = clockT - co.start, pts = 40 + Math.max(0, Math.round(40 - secs));
      co.hand = null; k.c.holdProp("card"); k.c.setMood("love"); k.hi = 1.8; k.prospect = false;
      shift.stats.signups++; shiftScore(pts, by); posTerm.loyal(k.member, 5); gainXp(co.by === "player" ? "you" : co.emp, "cha", 10);
      logAct(`${by === "dana" ? `${co.emp?.first ?? emp.first} signed up` : "Signed up"} ${memberName(k.member)} (#${k.member.num}): a new member`, "good", null, pts);
      co = null; coHud(); custLeaveLine(k); k.path = []; k.state = "signedUp"; k.t = 1.5;
    } },
];
const CO_STEPS = [
  { id: "card", at: "customer", need: () => co.cust.tapes.length, tip: () => "take their member card",
    do() { co.cust.c.holdProp(null); co.hand = "card"; } },
  { id: "tap", at: "register", need: () => co.cust.tapes.length, tip: () => "tap the member card on the register",
    do() { posBeep(1900); const m = co.cust.member, late = m.rentals.filter(r => posTerm.dueIn(r) < 0).length, owed = posTerm.owed(m);
      logAct(`#${m.num} ${memberName(m)}${owed ? `: ${money(owed)} in late fees due` : ""}${late ? `${owed ? "," : ":"} ${late} tape${late > 1 ? "s" : ""} out late` : ""}${owed || late ? "" : ": account OK"}`, owed || late ? "bad" : ""); } },
  { id: "cardBack", at: "customer", need: () => co.cust.tapes.length, tip: () => "hand their card back",
    do() { co.hand = null; } },
  { id: "fees", at: "customer", need: () => co.cust.tapes.length && posTerm.owed(co.cust.member) > 0,
    tip: () => `charge the ${money(posTerm.owed(co.cust.member))} in late fees`, do() { coFees(true); } },   // Q waives them instead (coQ)
  { id: "tapes", at: "customer", need: () => co.cust.tapes.length, tip: () => `take ${coTapes()}`,
    do() { co.cust.c.holdTape(0); co.hand = "tapes"; } },
  { id: "desens", at: "pad", need: () => co.cust.tapes.some(t => !t.desens), repeat: () => co.cust.tapes.some(t => !t.desens),
    tip: () => { const t = co.cust.tapes.find(t => !t.desens); return `desensitize ${t.title}${co.cust.tapes.length > 1 ? ` (${co.cust.tapes.filter(t => t.desens).length + 1} of ${co.cust.tapes.length})` : ""}`; },
    do() { desensitize(co.cust.tapes.find(t => !t.desens)); } },
  { id: "cash", at: "customer", need: () => true, tip: () => `take the cash · ${money(co.total)} due`,
    do() { co.cust.c.holdProp(null); co.cashIn = co.bill; co.hand = "cash"; } },
  { id: "ring", at: "register", need: () => true, tip: () => `ring it up · ${money(co.bill)} in${co.change ? `, ${money(co.change)} change` : ""}`,
    do() {
      for (const t of co.cust.tapes) { posTerm.checkOut(t, co.cust.member); rentedCopies.push(t); }   // on their account
      if (co.cust.snacks.length) posTerm.sale(co.cust.snacks.reduce((a, u) => a + snackPrice(u.userData.snack), 0));
      const st = shift.stats; st.served++; st.rentals += co.cust.tapes.length;
      st.rentalTake += co.cust.tapes.reduce((a, t) => a + posTerm.rentPrice(t), 0); st.snackTake += co.cust.snacks.reduce((a, u) => a + snackPrice(u.userData.snack), 0);
      co.bought = co.cust.snacks.length;
      if (co.cust.tickets) { const n = co.cust.tickets; posTerm.sale(n * SHOW.ticket); show.sold += n; shift.stats.tickets += n; }           // (sold: their spots on the rack stay empty till restocked)
      drawerOpen = 1; posBeep(1200); co.hand = null; printReceipt();
    } },
  { id: "tear", at: "printer", need: () => true, tip: () => printer.job?.done ? "tear off the receipt" : "wait for the receipt to print",
    do() { receiptTear(); co.hand = co.change ? "change" : "receipt"; } },
  { id: "change", at: "customer", need: () => co.change > 0, tip: () => `give ${money(co.change)} change`,
    do() { co.hand = "receipt"; drawerOpen = 0; } },
  { id: "receipt", at: "customer", need: () => true, tip: () => "hand them the receipt",
    do() { drawerOpen = 0; co.cust.c.holdProp("receipt"); co.hand = co.cust.tapes.length ? "tapes" : null; } },
  { id: "handback", at: "customer", need: () => true, tip: () => co.cust.tapes.length ? `hand over ${coTapes()}` : "hand over their snacks",
    do() {
      drawerOpen = 0; co.hand = null;
      co.cust.c.holdTape(co.cust.tapes.length); co.cust.snacks = [];
      co.cust.tagged = co.cust.tapes.some(t => !t.desens);          // anything still tagged sets the gates off
      co.cust.paid = true;
      {                                                              // how'd that go (yours, or Dana's)
        const secs = clockT - co.start, missed = co.cust.tapes.filter(t => !t.desens).length;
        co.why = [secs < 40 ? "quick" : secs > 110 ? "slow" : "", co.upsold ? "upsold a snack" : "", co.feesIn ? "fees collected" : "", missed ? `${missed} tag${missed > 1 ? "s" : ""} missed` : ""].filter(Boolean);
        co.score = 100 + Math.max(0, Math.round((90 - secs) * 2)) + co.pts - 75 * missed; shiftScore(co.score, co.by === "player" ? "you" : "dana");
        const by = co.by === "player" ? "you" : co.emp; gainXp(by, "dex", 10); if (co.upsold) gainXp(by, "cha", 8);
        if (co.by !== "player") posTerm.loyal(co.cust.member, Math.floor((lv(co.emp, "cha") - 1) / 4));   // a charming clerk leaves them happier
        posTerm.loyal(co.cust.member, secs < 40 ? 7 : 4);
      }
      const nT = co.cust.tapes.length, nS = co.bought || 0;
      logAct(`${co.by === "dana" ? `${co.emp?.first} rang up` : "Rang up"} ${memberName(co.cust.member)}: ${[nT ? `${nT} tape${nT > 1 ? "s" : ""}` : "", nS ? `${nS} snack${nS > 1 ? "s" : ""}` : "", co.cust.tickets ? `${co.cust.tickets} show ticket${co.cust.tickets > 1 ? "s" : ""}` : "", co.fees ? "late fees" : ""].filter(Boolean).join(", ")}${co.why?.length ? ` (${co.why.join(", ")})` : ""}`,
        co.why?.some(w => w.includes("missed")) ? "bad" : "good", co.total, co.score);
      co.cust.c.holdProp("receipt");
      co.cust.c.setMood("thanks"); co.cust.c.setPose("hold"); co.cust.state = "paid"; co.cust.t = 1.8;
      co = null; coHud();
    } },
];
function coStart(by, cust = custLine[0]) {
  if (cust.prospect) {                           // not buying: signing up
    co = { by, cust, kind: "signup", i: 0, total: 0, bill: 0, change: 0, hand: null, start: clockT, pts: 0, fees: 0 };
    cust.state = "checkout"; cust.c.setMood("happy"); cust.c.setPose("wait"); coSkip(); coHud(); return;
  }
  if (!cust.moviegoer && cust.tickets == null) {  // "two for tonight's show while you're at it"
    const want = Math.random() < ticketChance() ? (Math.random() < 0.4 ? 2 : 1) : 0;
    cust.tickets = Math.max(0, Math.min(want, Math.min(10, theaterSeats.length) - show.sold));
  }
  const total = coTotal(cust), bills = [1, 5, 10, 20, 50].filter(b => b >= total);
  const bill = Math.random() < 0.25 ? total : (bills[0] ?? 50);          // exact change now and then
  co = { by, cust, i: 0, total, bill, change: +(bill - total).toFixed(2), hand: null, start: clockT, pts: 0, fees: 0 };
  cust.state = "checkout"; cust.c.setMood("happy"); cust.c.setPose("wait");
  coSkip(); coHud();
}
function coRebill() {                            // the total changed (fees charged, a snack added): new total, what they hand over, the change
  const total = +(coTotal(co.cust) + co.fees).toFixed(2), bills = [1, 5, 10, 20, 50, 100].filter(b => b >= total);
  co.total = total; co.bill = Math.random() < 0.25 ? total : (bills[0] ?? Math.ceil(total / 20) * 20); co.change = +(co.bill - total).toFixed(2);
}
function coFees(charge) {                        // late fees on their account: charge them (money, a grumpier customer) or waive them (goodwill)
  const m = co.cust.member, amt = posTerm.owed(m);
  posTerm.settle(m, charge); co.cust.hi = 1.6;
  const feeBy = co.by === "player" ? "you" : co.emp;
  posTerm.loyal(m, charge ? (has(feeBy, "cha", 5) ? 0 : -Math.max(0, 3 - Math.floor((lv(feeBy, "cha") - 1) / 3))) : 6); gainXp(feeBy, "cha", charge ? 3 : 2);   // (charm takes the sting out of a fee)
  if (charge) { co.fees += amt; co.feesIn = true; coRebill(); shift.stats.feesCollected += amt; co.cust.c.setMood("meh"); co.pts += 20; logAct(`${co.by === "dana" ? `${co.emp?.first} charged` : "Charged"} ${memberName(m)} their late fees`, "good", amt); }
  else { co.feesWaived = amt; shift.stats.feesWaived += amt; co.cust.c.setMood("love"); logAct(`Waived ${memberName(m)}'s ${money(amt)} in late fees`); }
}
const upsellSpot = () => snackSpots().filter(s => s.units.some(u => u.visible && u !== heldSnack))   // the nearest rack with anything left
  .sort((a, b) => Math.hypot(a.x - CUST_COUNTER.x, a.z - CUST_COUNTER.z) - Math.hypot(b.x - CUST_COUNTER.x, b.z - CUST_COUNTER.z))[0];
const coCanOffer = () => co?.by === "player" && co.kind !== "signup" && !co.offered && !co.away && co.hand !== "cash" && co.i <= CO_STEPS.findIndex(q => q.id === "cash") && !!upsellSpot();
function coOffer() {                             // "grab a snack for the movie?" — they'll go get it and come back to pay
  if (!coCanOffer()) return;
  const cust = co.cust, P = cust.who.persona;
  co.offered = true; cust.hi = 1.6;
  const yes = Math.random() < 0.12 + 0.6 * P.sweet + 0.025 * (lv("you", "cha") - 1) - (cust.snacks.length ? 0.3 : 0) - (["impatient", "angry"].includes(cust.c.mood) ? 0.2 : 0);   // (CHA: a better pitch)
  gainXp("you", "cha", yes ? 6 : 1);
  if (!yes) { cust.c.setMood("meh"); logAct(`Offered ${memberName(cust.member)} a snack: \u201cNo thanks, I'm good\u201d`); coHud(); return; }
  shift.stats.upsells++; logAct(`Offered ${memberName(cust.member)} a snack: \u201cOoh, yeah. Hang on a sec\u201d`, "good");
  co.away = true; cust.upsell = true; cust.hi = 0;
  cust.c.holdProp(null); cust.c.setMood("happy"); cust.c.setPose(cust.holding ? "hold" : "idle");
  custGo(cust, "snack", upsellSpot());
  coHud();
}
function coQ() {                                 // Q at the counter: waive their late fees, or offer a snack
  if (aimCustomer?.state === "asking" && aimCustomer.want.kind !== "rec") return custAllOut(aimCustomer);   // (or: sorry, it's all out)
  if (co?.by !== "player" || aimCustomer !== co.cust) return;
  if (coStep()?.id === "fees") { coFees(false); co.i++; coSkip(); coHud(); }
  else coOffer();
}
// ---- the receipt: printed at "ring it up", torn off, handed over ----
function printReceipt() {
  const W = 128, H = 460, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d"), d = shiftDate(), p2 = n => String(n).padStart(2, "0");
  g.fillStyle = "#f4f1e6"; g.beginPath(); g.moveTo(0, 4);                  // thermal paper, torn zigzag at both ends
  for (let x = 0; x <= W; x += 8) g.lineTo(x, x % 16 ? 0 : 4);
  for (let x = W; x >= 0; x -= 8) g.lineTo(x, H - (x % 16 ? 0 : 4));
  g.fill(); g.fillStyle = "#2a2a30"; g.textBaseline = "top";
  let y = 12;
  const ln = (t, x = 6, px = 10, bold = false, align = "left") => { g.font = `${bold ? "bold " : ""}${px}px "Courier New", monospace`; g.textAlign = align; g.fillText(t, align === "center" ? W / 2 : x, y); y += px + 3; };
  const lr = (a, b) => { g.font = `10px "Courier New", monospace`; g.textAlign = "left"; g.fillText(a.slice(0, 13), 6, y); g.textAlign = "right"; g.fillText(b, W - 6, y); y += 13; };
  ln("VAULTBUSTER", 0, 15, true, "center"); ln("VIDEO #0417", 0, 10, false, "center"); y += 4;
  ln(`${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${String(d.getFullYear()).slice(2)}  ${fmtClock(shift.h)}`, 0, 10, false, "center");
  if (co.cust.tapes.length) ln(`MEMBER #${co.cust.member.num}`, 0, 10, false, "center");
  y += 6; g.fillRect(6, y, W - 12, 1); y += 6;
  for (const t of co.cust.tapes) lr(t.title.toUpperCase(), money(posTerm.rentPrice(t)));
  for (const u of co.cust.snacks) lr(u.userData.snack.name.toUpperCase(), money(snackPrice(u.userData.snack)));
  if (co.fees) lr("LATE FEES", money(co.fees));
  if (co.cust.tickets) lr(`SHOW TIX x${co.cust.tickets}`, money(co.cust.tickets * SHOW.ticket));
  y += 4; g.fillRect(6, y, W - 12, 1); y += 6;
  lr("TOTAL", money(co.total)); lr("CASH", money(co.bill)); lr("CHANGE", money(co.change));
  if (co.cust.tapes.length) {
    const due = co.cust.tapes.map(t => t.rental?.due).filter(Boolean).sort((a, b) => a - b)[0];
    if (due) { y += 8; ln(`DUE BACK ${p2(due.getMonth() + 1)}/${p2(due.getDate())}`, 0, 11, true, "center"); ln("BY MIDNIGHT", 0, 9, false, "center"); }
  }
  y += 10; ln("BE KIND, REWIND!", 0, 10, true, "center"); ln("THANK YOU", 0, 10, false, "center");
  printer.tex?.dispose();
  const tex = printer.tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  printer.strip.material.map = tex; printer.strip.material.needsUpdate = true;
  printer.strip.visible = true; printer.strip.scale.y = printer.strip.scale.z = 0.001;
  printer.job = { t: 0, dur: 0.9 * Math.max(0.6, 1 - 0.02 * (lv(co?.by === "player" ? "you" : co?.emp, "dex") - 1)), len: 0.25, done: false };
  printBuzz(0.9);
}
function printerTick(dt) {                       // the slip feeds out; a sale that fell through leaves nothing hanging
  if (printer.strip.visible && !co) { printer.strip.visible = false; printer.job = null; }
  const j = printer.job; if (!j || j.done) return;
  j.t += dt; const f = Math.min(1, j.t / j.dur);
  printer.strip.scale.y = printer.strip.scale.z = Math.max(0.001, j.len * f);
  printer.tex.repeat.set(1, f); printer.tex.offset.set(0, 1 - f);   // only the top of the slip is out so far
  if (f >= 1) { j.done = true; coHud(); }
}
function receiptTear() {
  printer.strip.visible = false; printer.job = null;
  printer.tex.repeat.set(1, 1); printer.tex.offset.set(0, 0);
  posBeep(3200);
}
let printAc = null;
function printBuzz(secs) {                       // dot-matrix: a buzzy rasp, pulsing line by line
  try {
    const ac = printAc ||= new AudioContext(), t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
    o.type = "sawtooth"; o.frequency.value = 118; lfo.type = "square"; lfo.frequency.value = 9; lg.gain.value = 0.012;
    g.gain.value = 0.014; lfo.connect(lg).connect(g.gain); o.connect(g).connect(ac.destination);
    o.start(t); lfo.start(t); o.stop(t + secs); lfo.stop(t + secs);
  } catch {}
}
const coSteps = () => co?.kind === "signup" ? SIGNUP_STEPS : CO_STEPS;   // a sale, or signing somebody up
function coSkip() { while (co && co.i < coSteps().length && !coSteps()[co.i].need()) co.i++; coProps(); }
function coProps() {                              // what the customer's holding out for this step
  if (!co) return;
  const id = coSteps()[co.i]?.id;
  co.cust.c.holdProp(id === "card" ? "card" : id === "cash" ? "cash" : id === "form" ? "form" : null);
}
const coStep = () => co && coSteps()[co.i];
function coWants(at) {
  const s = coStep(); if (!s || co.away) return null;             // away: off getting the snack you talked them into
  if (s.id === "tear" && !printer.job?.done) return null;         // still printing
  if (s.at === at) return s;
  if (s.id === "desens" && at === "customer") return CO_STEPS.find(q => q.id === "cash");   // you can skip the pad... the gates won't
  return null;
}
// the desensitizer works any time. Mid-checkout, from taking their tapes until
// you hand them back, it does theirs, whatever step you're on (skip it for the
// cash, come back after the change); otherwise the next live tape you're
// carrying, the one in hand first. -> { tape, of, co } | {} (all done) | null (nothing to do it to)
function padTarget() {
  const count = list => list.length > 1 ? ` (${list.filter(t => t.desens).length + 1} of ${list.length})` : "";
  if (co?.by === "player" && co.kind !== "signup" && co.i > CO_STEPS.findIndex(q => q.id === "tapes") && co.cust.tapes.length) {
    const t = co.cust.tapes.find(t => !t.desens);
    return t ? { tape: t, of: count(co.cust.tapes), co: true } : {};
  }
  const mine = [...new Set([held, ...inv.filter(e => e.kind === "tape").map(e => e.ref)])].filter(Boolean);
  if (!mine.length) return null;
  const t = mine.find(t => !t.desens);
  return t ? { tape: t, of: count(mine) } : {};
}
function padUse() {
  const p = padTarget();
  if (!p?.tape) { toast(p ? "Everything in hand is already desensitized" : "Nothing to desensitize"); return; }
  if (p.co && coStep()?.id === "desens") { coAct("pad"); return; }   // right on cue: the checkout moves along
  desensitize(p.tape); gainXp("you", "dex", 1);
  if (p.co) { co.idle = 0; coHud(); }             // out of order: same sale, the hand-held stack just updates
}
function coAct(at) {                              // do the current step if it happens at this spot
  const s = coWants(at); if (!s) return false;
  if (s !== coStep()) co.i = coSteps().indexOf(s);    // jumped ahead past the pad
  co.idle = 0;
  const actor = co.by === "player" ? "you" : co.emp, skill = co.kind === "signup" ? "cha" : "dex";
  s.do();
  gainXp(actor, skill, 3);                          // (each step of the work at the counter)
  if (co && !(s.repeat && s.repeat())) { co.i++; coSkip(); }
  coHud();
  return true;
}
function coRing() {                              // what the register's screen shows for this sale (see posTerm.ring)
  if (!co) return null;
  const steps = coSteps(), at = id => steps.findIndex(s => s.id === id), k = co.cust, s = coStep();
  const signup = co.kind === "signup";
  return {
    member: k.member, signup, clerk: co.by === "dana" ? co.emp?.first?.toUpperCase() : null,
    carded: signup ? co.i > at("enroll") : k.tapes.length ? co.i > at("tap") : null,   // (null: snacks only, no card)
    items: signup ? [["NEW MEMBERSHIP", 0]] : [...k.tapes.map(t => [t.title, posTerm.rentPrice(t)]), ...k.snacks.map(u => [u.userData.snack.name, snackPrice(u.userData.snack)]),
      ...(k.tickets ? [[`SHOW TICKET x${k.tickets}`, k.tickets * SHOW.ticket]] : [])],
    feesCharged: co.feesIn ? co.fees : 0, feesWaived: co.feesWaived || 0,
    total: co.total, cashIn: co.cashIn ?? null, change: co.change,
    next: co.by === "player" && s ? (co.away ? "customer is grabbing a snack" : s.tip()) : "",
  };
}
function coHud() {
  coHandShow(); posTerm.ring(coRing());
  const el = $("checkoutTag");
  if (!co) { el.style.display = "none"; return; }
  const s = coStep(), who = co.by === "dana" ? `${co.emp?.first} is ringing up` : "Ringing up";
  el.style.display = "block";
  el.innerHTML = co.kind === "signup" ? `<div class="h">NEW MEMBER</div>${co.by === "dana" ? `${co.emp?.first} is signing up` : "Signing up"} ${memberName(co.cust.member)}` +
    (co.by === "player" && s ? `<div class="next">Next: ${s.tip()}</div>` : "")
    : `<div class="h">CHECKOUT</div>${who} ${memberName(co.cust.member)} · ${money(co.total)}` +
    (co.by === "player" && s ? `<div class="next">${co.away ? "They're grabbing a snack…" : `Next: ${s.tip()}`}</div>` : "");
}
// what you're holding mid-checkout, drawn in your hand like a held tape: their
// card, the stack of tapes (real covers), the cash, the change
const coHand = new THREE.Group(); coHand.visible = false;
let coHandKey = "";
function coHandShow() {
  const want = co?.by === "player" ? co.hand || "" : "";
  const key = want + (want === "tapes" ? co.cust.tapes.map(t => t.desens ? 1 : 0).join("") : "");
  if (key === coHandKey) return; coHandKey = key;
  coHand.clear(); coHand.visible = !!want;
  if (!coHand.parent) camera.add(coHand);
  coHand.position.set(0.26, -0.26, -0.5); coHand.rotation.set(0.1, -0.35, 0.05);
  const card = (m, w, h) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.003), m); o.rotation.x = -0.25; coHand.add(o); };
  if (want === "card") card(coHandMats.card, 0.086, 0.054);
  if (want === "cash" || want === "change") card(coHandMats.cash, 0.156, 0.066);
  if (want === "form") card(coHandMats.form, 0.15, 0.21);
  if (want === "newcard") card(coHandMats.card, 0.086, 0.054);
  if (want === "receipt" && printer.tex) { const o = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.25), new THREE.MeshBasicMaterial({ map: printer.tex, side: THREE.DoubleSide, alphaTest: 0.5 })); o.rotation.set(-0.35, 0.3, 0); o.position.y = 0.04; coHand.add(o); }
  if (want === "tapes") co.cust.tapes.forEach((t, i) => {             // fanned out a little, covers toward you
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
  form: new THREE.MeshLambertMaterial({ map: makeTexture((g, w, h) => { g.fillStyle = "#fbfbf4"; g.fillRect(0, 0, w, h); g.fillStyle = "#00349c"; g.font = `bold ${h * 0.06}px Arial`; g.fillText("VAULTBUSTER VIDEO", w * 0.08, h * 0.1); g.font = `${h * 0.04}px Arial`; g.fillText("MEMBERSHIP APPLICATION", w * 0.08, h * 0.16);
    g.strokeStyle = "#9aa"; g.lineWidth = 2; for (let i = 0; i < 8; i++) { const y = h * (0.26 + i * 0.09); g.beginPath(); g.moveTo(w * 0.08, y); g.lineTo(w * 0.92, y); g.stroke(); }
    g.strokeStyle = "#1b2a6a"; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const y = h * (0.245 + i * 0.09); g.beginPath(); g.moveTo(w * 0.1, y); for (let x = 0.1; x < 0.2 + Math.random() * 0.5; x += 0.03) g.lineTo(w * x, y - Math.random() * h * 0.02); g.stroke(); } }, 180, 256) }),   // filled in, in ballpoint
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
function custTip(k) {                           // what E (and Q) do to this customer right now
  if (catchCall === k) return "Caught · 1–5 to decide";
  if (k.state === "tagWait") return "Their tape set off the gates<br>E — desensitize it";
  if (k.state === "asking") {
    const w = k.want, give = held ? `<br>E — hand them ${tapeName(held)}` : "";
    if (w.kind === "hold") return `Here to pick up <b>${tapeName(w.title)}</b> (on hold)${give || "<br>Get it from the holds shelf"}<br>Q — tell them it's not here`;
    const stock = w.title && lv("you", "int") >= 3 ? (onShelfCopy(w.title) ? " · <i>on the shelf</i>" : " · <i>all out</i>") : "";   // (INT: you know the stock)
    return w.kind === "title" ? `Looking for <b>${tapeName(w.title)}</b> (${w.title.category})${stock}${give}<br>Q — tell them it's all out`
      : `Wants ${TASTE_ASK[k.who.persona.taste.name] || "something good"}${give || "<br>Bring them a tape"}`;
  }
  const mine = co?.cust === k && co.by === "player";
  if (mine && co.away) return "Grabbing a snack…";
  if (mine && coStep()?.id === "fees" && coWants("customer")) return `E — ${coStep().tip()}<br>Q — waive them`;
  let t = co?.cust === k ? (mine && coWants("customer") ? `E — ${coWants("customer").tip()}` : co.by === "dana" ? `${co.emp?.first}'s ringing them up` : `Next: ${coStep().tip()}`)
    : !co && ["wait", "impatient", "angry"].includes(k.state) ? (k.prospect ? "E — they'd like to sign up" : "E — take their member card")
    : k.state === "leave" ? "E — say goodbye" : "E — say hi";
  if (mine && coCanOffer()) t += "<br>Q — offer a snack";
  return t;
}
// where you're aiming, in screen space: the crosshair (0, 0), except while touch.js points at a tapped spot:
// VaultAim.at(x, y) aims there and refreshes the hover tip (what the tap can do), then it's back to the middle
const aimNDC = { x: 0, y: 0 };
window.VaultAim = {
  at(x, y) { aimNDC.x = x; aimNDC.y = y; pickHover(); const tip = $("hoverTip"); return { tip: tip.style.display === "none" ? "" : tip.innerText, dflt: seated || onStool ? "E" : "CLICK" }; },
  center() { aimNDC.x = aimNDC.y = 0; pickHover(); },
};
function pickHover() {
  hovered = null; aimStool = false; aimTV = false; aimLamp = null; aimCouch = false; aimReturns = false; aimSnack = null; aimFlap = null; aimCooler = false; aimPop = null; aimTrash = false; aimDoor = null; aimPOS = false; aimSlot = false; aimRewinder = null; aimBell = false; aimDesens = false; aimCutout = false; aimCustomer = false; aimLock = false; aimEmp = false; aimSwitch = null; aimDrawer = false; aimExit = false; aimPrinter = false; aimStockSlot = null; aimCupboard = null; aimBox = null; aimMess = null; aimStray = null; aimPhone = false; aimHolds = false; aimBoard = false; aimMove = null; aimToilet = false; aimSink = false; aimTowels = false; aimBin = null; aimBag = null; aimChute = false;
  if (document.pointerLockElement !== canvas) { highlight.visible = false; $("hoverTip").style.display = "none"; return; }
  if (inspecting || seated || onStool) { highlight.visible = false; $("hoverTip").style.display = "none"; return; }
  if (cmove.item) {                           // carrying a counter thing: where it'd go
    highlight.visible = false; const tip = $("hoverTip"); tip.style.display = "block";
    tip.innerHTML = (cmove.spot ? cmove.ok ? `Click — set the ${cmove.item.name} down here` : "It won't fit there" : "Aim at a free spot on the counter") + `<div class="cat">Wheel — turn it · Right-click — put it back</div>`;
    return;
  }
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
  raycaster.setFromCamera(aimNDC, camera);
  if (boxCarry.length) {                     // arms full of boxes: a stock cupboard (to unpack) or another box
    highlight.visible = false;
    const a = raycaster.intersectObjects(aimables, false).find(h => h.distance < 2.4 && (h.object.userData.stock || h.object.userData.box));
    aimCupboard = a?.object.userData.stock || null; aimBox = a?.object.userData.box || null;
    const tip = $("hoverTip"); tip.style.display = "block";
    tip.innerHTML = aimCupboard ? `E — unpack ${boxCarry.length === 1 ? "the box" : `all ${boxCarry.length} boxes`}` : aimBox ? (boxCarry.length < 3 ? `E — pick up ${aimBox.name} \u00d7${aimBox.qty} too` : "Arms full") : `Carrying ${boxCarry.length} box${boxCarry.length > 1 ? "es" : ""} · unpack at a stock cupboard behind the counter`;
    return;
  }
  if (bagCarry.length) {                     // hands full of trash bags: the chute, another bin or bag, and doors and switches on the way
    highlight.visible = false;
    let a = raycaster.intersectObjects(aimables, false).find(h => h.distance < 2.4 && ["chute", "trashBin", "trashBag", "door", "lightZone"].some(k => h.object.userData[k]));
    const wall = a && raycaster.intersectObjects(aimBlockers, false)[0]; if (wall && wall.distance < a.distance) a = undefined;
    const u = a?.object.userData || {}, n = bagCarry.length, more = n < bagMax();
    aimChute = !!u.chute; aimBin = u.trashBin || null; aimBag = u.trashBag || null; aimDoor = !aimChute && !aimBin && !aimBag && u.door || null; aimSwitch = !aimDoor && !aimChute && !aimBin && !aimBag && u.lightZone || null;
    const tip = $("hoverTip"); tip.style.display = "block";
    tip.innerHTML = aimChute ? `E — send ${n === 1 ? "the bag" : n === 2 ? "both bags" : "all three bags"} down the chute`
      : aimBin ? (aimBin.n ? (more ? `E — bag the ${aimBin.name} too` : "Hands full") : `The ${aimBin.name} · empty`)
      : aimBag ? (more ? "E — pick up this bag too" : "Hands full")
      : aimDoor ? (aimDoor.locked ? "Locked" : `E — ${aimDoor.open ? "close" : "open"} the door`)
      : aimSwitch ? `E — turn the ${ZONE_NAMES[aimSwitch]} lights ${zoneOn[aimSwitch] ? "off" : "on"}`
      : `Carrying ${n === 1 ? "a trash bag" : `${n} trash bags`} · the chute's in the break room<div class="cat">Right-click — set ${n === 1 ? "it" : "them"} down</div>`;
    return;
  }
  const hit = raycaster.intersectObjects(coverMeshes, false).find(h => h.distance < 3.4);   // a checked-out copy is collapsed out of the mesh, so the ray goes past its slot
  if (hit) hovered = hit.object.userData.tapes[Math.floor(hit.face.a / COVER_V)];
  const sh = strays.length && raycaster.intersectObjects(strays.map(s => s.mesh), false)[0];   // a misshelved tape sticks out in front of the row
  if (sh && sh.distance < 2.6 && (!hit || sh.distance < hit.distance + 0.05)) {
    hovered = null; aimStray = strays.find(s => s.mesh === sh.object); highlight.visible = false;
    const tip = $("hoverTip"); tip.innerHTML = `E — pick up the misshelved ${aimStray.copy.title}`; tip.style.display = "block";
    return;
  }
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
    const aimHits = raycaster.intersectObjects(aimables, false);
    let aim = aimHits.find(h => h.object.userData.mess && h.distance < 2.4) || aimHits[0];   // trash under a seat: the trash, not the seat
    const wall = aim && raycaster.intersectObjects(aimBlockers, false)[0];
    if (wall && wall.distance < aim.distance) aim = undefined;   // it's on the far side of a wall or a rack's back
    aimMove = aim && aim.distance < 2.4 && aim.object.userData.movable || null;   // (a rewinder, the pad, the printer: hold E to move it)
    if ((aim?.object === screenMesh && aim.distance < 4.5) || (aim?.object === theaterScreenMesh && aim.distance < 9) || (aim?.object.userData.theaterDeck && aim.distance < 3.2)) aimTV = true;
    else if (aim?.object.userData.lamp && aim.distance < 2.6) aimLamp = aim.object.userData.lamp;
    else if (aim?.object.userData.sit && aim.distance < 3.2) { aimCouch = true; aimSeatX = aim.point.x; aimSeatObj = aim.object.userData.seatPos || null; }
    else if (aim?.object.userData.returns && aim.distance < 2.4) aimReturns = true;
    else if ((aim?.object.userData.unit || aim?.object.userData.snack) && (aim.object.userData.unit || aim.object).visible && aim.distance < 2.4)
      aimSnack = aim.object.userData.unit || aim.object;   // the exact unit you pointed at (a drink's whole group, not just the label you hit)
    else if ((aim?.object.userData.unit || aim?.object.userData.snack) && aim.distance < 2.4 && stockFor(aim.object.userData.unit || aim.object) >= 0 && (u => !u.visible && (stockCarry.has(u) || emptySpots().includes(u)))(aim.object.userData.unit || aim.object))
      aimStockSlot = aim.object.userData.unit || aim.object;   // an empty spot, and you're carrying one for it
    else if (aim?.object.userData.stock && aim.distance < 2.2) aimCupboard = aim.object.userData.stock;
    else if (aim?.object.userData.box && aim.distance < 2.4) aimBox = aim.object.userData.box;
    else if (aim?.object.userData.mess && aim.distance < 2.4) aimMess = aim.object.userData.mess;
    else if (aim?.object.userData.phone && aim.distance < 2.4) aimPhone = true;
    else if (aim?.object.userData.holds && aim.distance < 2.4) aimHolds = true;
    else if (aim?.object.userData.jobBoard && aim.distance < 2.4) aimBoard = true;
    else if (aim?.object.userData.flush && aim.distance < 2.2) aimToilet = true;   // the lever flushes (the rest of it you sit on)
    else if (aim?.object.userData.sink && aim.distance < 2.2) aimSink = true;
    else if (aim?.object.userData.towels && aim.distance < 2.2) aimTowels = true;
    else if (aim?.object.userData.coolerDoor && aim.distance < 2.6) aimCooler = true;
    else if (aim?.object.userData.popcorn && aim.distance < 2.4 && owned("popcorn")) aimPop = aim.object.userData.popcorn;
    else if (aim?.object.userData.trashBin && aim.distance < 2.4 && (heldSnack || heldPopcorn) && !binFull(aim.object.userData.trashBin)) aimTrash = aim.object.userData.trashBin;
    else if (aim?.object.userData.trashBin && aim.distance < 2.4) aimBin = aim.object.userData.trashBin;
    else if (aim?.object.userData.trashBag && aim.distance < 2.4) aimBag = aim.object.userData.trashBag;
    else if (aim?.object.userData.chute && aim.distance < 2.4) aimChute = true;
    else if (aim?.object.userData.flap && aim.distance < 2.6) aimFlap = aim.object.userData.flap;
    else if (aim?.object.userData.door && aim.distance < 2.4) aimDoor = aim.object.userData.door;
    else if (aim?.object.userData.pos && aim.distance < 2.4) aimPOS = true;
    else if (aim?.object.userData.bell && aim.distance < 2.4) aimBell = true;
    else if (aim?.object.userData.desens && aim.distance < 2.4) aimDesens = true;   // always usable (see padTarget)
    else if (aim?.object.userData.drawer && aim.distance < 2.4) aimDrawer = true;
    else if (aim?.object.userData.rewinder && aim.distance < 2.4 && (held || aim.object.userData.rewinder.tape)) aimRewinder = aim.object.userData.rewinder;
    else if (aim?.object.userData.cutout && aim.distance < 2.6) aimCutout = true;
    else if (aim?.object.userData.frontLock && aim.distance < 2.2) aimLock = true;
    else if (aim?.object.userData.exitDoor && aim.distance < 2.4 && shift.h >= 23) aimExit = true;   // near close: the way home
    else if (aim?.object.userData.lightZone && aim.distance < 2.2) aimSwitch = aim.object.userData.lightZone;
    else if (aim?.object.userData.stool && aim.distance < 2.2) aimStool = true;
    else if (aim?.object.userData.employee && aim.distance < 2.8) aimEmp = aim.object.userData.employee;   // (the employee themself)
    else if (aim?.object.userData.customer?.c && aim.distance < 2.6 && aim.object.userData.customer.state !== "out") { aimCustomer = aim.object.userData.customer; aimCustomer.known = true; }   // walking ones too: a shoplifter doesn't stop. known: you've had their name up
    else if (aim?.object.userData.printer && aim.distance < 2.4) aimPrinter = true;
    const tip = $("hoverTip");
    if (aimLamp) tip.innerHTML = `E — turn lamp ${aimLamp.userData.on ? "off" : "on"}`;
    else if (aimReturns && (held || returnBin.length)) tip.innerHTML = [held && "E — drop tape in Returns",
      returnBin.length && inv.length < INV_MAX && `CLICK — look at a tape from Returns (${returnBin.length})`].filter(Boolean).join("<br>");
    else if (aimPop) tip.innerHTML = popcornStep(aimPop, false);
    else if (aimTrash) tip.innerHTML = `E — throw away ${heldSnack ? heldSnack.userData.snack.name : "the popcorn"}`;
    else if (aimBin) tip.innerHTML = aimBin.n ? `E — bag the trash<div class="cat">${aimBin.name} · ${binFull(aimBin) ? "full" : `${Math.round(100 * aimBin.n / aimBin.cap)}% full`}</div>` : `The ${aimBin.name} · empty`;
    else if (aimBag) tip.innerHTML = "E — pick up the trash bag";
    else if (aimChute) tip.innerHTML = "Trash chute<div class=\"cat\">E — open the hatch · bag up the bins and bring them here</div>";
    else if (aimSnack && inv.length < INV_MAX) tip.innerHTML = `CLICK — grab ${aimSnack.userData.snack.name}${aimSnack.userData.snack.kind ? ` <div class="cat">${aimSnack.userData.snack.kind}</div>` : ""}`;
    else if (aimCooler) tip.innerHTML = `E — ${coolerOpen ? "close" : "open"} the cooler<div class="cat">${Math.round(coolerThermo.temp)}°F inside${(drinkUnits || []).some(u => u.visible && drinkTemp(u) > DRINK_WARM) ? " · some drinks still warm" : ""}</div>`;
    else if (aimFlap) tip.innerHTML = `E — ${flapOpen ? "close" : "open"} the counter pass-through`;
    else if (aimDoor) tip.innerHTML = aimDoor.locked ? "Locked" : `E — ${aimDoor.open ? "close" : "open"} the door`;
    else if (aimRewinder) tip.innerHTML = !aimRewinder.tape ? `E — rewind ${held.title}${isRewound(held) ? " (already rewound)" : ""}`
      : aimRewinder.done ? `E — take out ${aimRewinder.tape.title} · rewound`
      : `Rewinding… ${Math.round(100 * aimRewinder.t / aimRewinder.dur)}% · E — take it out early`;
    else if (aimBell) tip.innerHTML = "E — ring for service";
    else if (aimEmp && (aimEmp.leaving || aimEmp.state === "toExit")) tip.innerHTML = `${aimEmp.first}<div class="cat">Heading home</div>`;
    else if (aimEmp && afterClose()) tip.innerHTML = `E — send ${aimEmp.first} home<div class="cat">The store's closed · ${empSummary(aimEmp)}</div>`;
    else if (aimEmp) tip.innerHTML = withEmp(aimEmp, () => emp.state === "stoolSit" ? `E — give ${emp.first} a spin<div class="cat">On the stool${emp.dizzy > 0.5 ? " · looking a bit green" : ""}</div>` : emp.state === "watching" ? `${emp.first}<div class="cat">Off the clock · watching with you</div>` : emp.task === "register"
      ? (returnBin.length ? `E — ask ${emp.first} to process returns<div class="cat">${returnBin.length} in the bin · on the register</div>` : `${emp.first}<div class="cat">On the register · returns bin is empty</div>`)
      : `E — send ${emp.first} back to the register<div class="cat">Processing returns · ${returnBin.length + emp.carry.length} to go</div>`) + `<div class="cat">${empSummary(aimEmp)}</div>`;
    else if (aimSwitch) tip.innerHTML = `E — turn the ${ZONE_NAMES[aimSwitch]} lights ${zoneOn[aimSwitch] ? "off" : "on"}`
      + (switchPlate[aimSwitch].length > 1 ? `<br>Hold E — turn them all ${zoneOn[switchPlate[aimSwitch][0]] ? "off" : "on"}` : "");
    else if (aimStool) tip.innerHTML = stool.by ? `${stool.by.first}'s using the stool` : eHoldTimer ? "Lifting…" : "E — sit on the stool<br>Hold E — pick it up";
    else if (aimLock) tip.innerHTML = `E — ${frontLock.locked ? "unlock the front doors" : "lock the front doors"}`;
    else if (aimExit) tip.innerHTML = !afterClose() ? "Open till midnight · clock out after close" : custs.length ? "Customers still inside" : "E — clock out and go home";
    else if (aimCustomer) tip.innerHTML = custTip(aimCustomer) + `<div class="cat">${memberName(aimCustomer.member)} · #${aimCustomer.member.num}</div>`;
    else if (aimStockSlot) tip.innerHTML = `E — put out a ${aimStockSlot.userData.snack.name}`;
    else if (aimCupboard) { const n = emptySpots().filter(u => isDrink(u.userData.snack) === (aimCupboard === "drinks")).length;
      const mine = inv.filter(e => stockMine(e, aimCupboard)).length, inHand = heldSnack && stockMine({ kind: "snack", ref: heldSnack }, aimCupboard);
      tip.innerHTML = `${aimCupboard === "drinks" ? "Drink" : "Snack"} stock${n ? `<br>E — grab what the racks need (${n} empty spot${n > 1 ? "s" : ""})` : mine ? `<br>E — put back the ${mine} you're carrying` : " · the racks are full"}${inHand ? "<br>RIGHT-CLICK — put this one back" : ""}`; }
    else if (aimBox) tip.innerHTML = `E — pick up the box: ${aimBox.name} \u00d7${aimBox.qty}`;
    else if (aimToilet) tip.innerHTML = bath.flushT > 0 ? "Flushing…" : "E — flush";
    else if (aimSink) tip.innerHTML = `E — turn the tap ${bath.tap ? "off" : "on"}`;
    else if (aimTowels) tip.innerHTML = "E — take a paper towel";
    else if (aimBoard) tip.innerHTML = `E — the staff job board<div class="cat">${staff.map(e => `${e.first}: ${withEmp(e, () => JOBS[danaJobNow()]?.name.toLowerCase() || "free")}`).join(" · ")}</div>`;
    else if (aimPhone) tip.innerHTML = phone.ring ? "E — answer the phone" : phone.call ? "On the phone: 1 or 2 to answer them" : "The store phone";
    else if (aimHolds) { const h = held && holds.find(h => !h.copy && titleOfCopy(held) === h.title), open = holds.filter(h => !h.copy);
      const ask = !held && custAsks.find(k => k.state === "asking" && k.want.kind === "hold" && k.want.hold.copy);
      tip.innerHTML = h ? `E — put ${tapeName(held)} on hold for ${memberName(h.member)}` : ask ? `E — take down ${tapeName(ask.want.title)} for ${memberName(ask.member)}` : open.length ? `Holds to put aside:<div class="cat">${open.map(h => `${tapeName(h.title)} (${memberName(h.member)}, ~${fmtClock(h.at)})`).join("<br>")}</div>` : holds.length ? `${holds.length} on hold` : "Holds shelf (empty)"; }
    else if (aimMess) tip.innerHTML = `E — clean up the ${MESS[aimMess.kind].label}`;
    else if (aimPrinter) tip.innerHTML = co?.by === "player" && coStep()?.id === "tear" ? (printer.job?.done ? "E — tear off the receipt" : "Printing…") : "Receipt printer";
    else if (aimCutout) tip.innerHTML = eHoldTimer ? "Lifting…" : "Hold E — pick up the standee";
    else if (aimDesens) { const p = padTarget(); tip.innerHTML = p?.tape ? `E — desensitize ${p.tape.title}${p.of}` : `Desensitizer<div class="cat">${p ? "everything in hand is desensitized" : "bring a tape over to desensitize it"}</div>`; }
    else if (aimDrawer) tip.innerHTML = co?.by === "player" && coWants("register") ? `E — ${coWants("register").tip()}` : "Cash drawer";
    else if (aimPOS && co?.by === "player" && coWants("register")) tip.innerHTML = `E — ${coWants("register").tip()}`;
    else if (aimPOS) tip.innerHTML = gateAlarm.on ? "E — log in to the register (silence the gate alarm)" : "E — log in to the register";
    else if (aimMove) tip.innerHTML = eHoldTimer && eHoldMove ? "Lifting…" : `Hold E — move the ${aimMove.name}`;
    else { tip.style.display = "none"; return; }
    if (aimMove && !tip.innerHTML.includes("Hold E")) tip.innerHTML += `<div class="cat">Hold E — move it</div>`;
    tip.style.display = "block";
  }
}
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("mousedown", e => {
  if (document.pointerLockElement !== canvas) return;
  if (cmove.item) { if (e.button === 0) movePlace(); else if (e.button === 2) moveCancel(`The ${cmove.item.name}'s back where it was`); return; }
  if (e.button === 2) {                                    // right click puts down whatever's in hand (and backs out of things, like Escape)
    if (board.open) { boardClose(); return; }             // Dana's job board
    if (sheet.open) { sheetToggle(); return; }            // the skills sheet
    if (tvMenu) { tvMenu = false; return; }                // an open picture menu closes from anywhere...
    if (tvScreenHit()) { tvMenu = true; return; }          // ...but only opens with the crosshair on the screen
    if (bagCarry.length) { bagsSetDown(); return; }       // trash bags: down at your feet
    if (held && held === peek) {                           // only still-being-looked-at tapes go back
      if (peekSrc === "bin") { returnBin.push(held); releaseFromHand(); refreshReturnsBin(); } else putBack();
      peek = null;
    }
    else if (heldSnack) dropSnack();
    else if (heldPopcorn && (heldPopcorn.kind === "kernel" || !heldPopcorn.used)) dropPopcorn();   // a used box only goes in the trash
    return;
  }
  if (e.button !== 0 || cutout.carried || stool.carried || boxCarry.length || bagCarry.length) return;   // arms full carrying the standee / boxes / trash
  if (tvMenu) { const hit = tvScreenHit(); if (hit) { tvMenuClick(hit.x, hit.y); return; } }
  if (held && inspecting) { inspecting = false; peek = null; return; }  // tuck the held-up tape back in hand (it's yours now)
  if (aimSlot) { putBack(); return; }                      // slotted back into its own spot on the shelf
  if (aimReturns && returnBin.length) {                    // Returns works like a shelf: click to look, click again to take, right-click to put it back
    if (invMakeRoom()) { const t = returnBin.pop(); t.fromReturns = true; refreshReturnsBin(); pickup(t); peek = t; peekSrc = "bin"; }
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
  if (stockCarry.has(heldSnack) && !toss && aimCupboard && stockMine({ kind: "snack", ref: heldSnack }, aimCupboard)) { stockReturn.held = inv[invSel]; stockReturn(aimCupboard, true); return; }   // back on the cupboard shelf
  if (stockCarry.has(heldSnack)) { if (!toss) { toast("That's stock: E on an empty spot on the rack to put it out, or right-click the cupboard to put it back"); return; } stockCarry.delete(heldSnack); logAct(`Threw away a ${heldSnack.userData.snack.name} from stock`, "bad"); }
  else if (!toss) heldSnack.visible = true;   // (tossed: its spot on the rack stays empty until someone restocks it)
  heldSnack = null; snackGroup.visible = false; snackGroup.clear(); $("holdingTag").style.display = "none";
}
// ---- eating + drinking: E takes a bite / sip. Snacks get bites by size (volume,
// log-scaled: gum 2 ... a big chip bag 8); drinks get sips by type (always 5+).
// A finished item stays in your hand as its empty wrapper / can / bottle until
// you take it to the trash. (Its spot on the rack stays empty until restocked.)
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
function consumeSnack() {
  if (!snackLeft) return;                    // finished: nothing left but the wrapper — trash it
  if (stockCarry.has(heldSnack)) { toast("That's stock: E on an empty spot on the rack to put it out"); return; }
  if (snackLeft === snackTotal && isDrink(heldSnack.userData.snack) && drinkTemp(heldSnack) > DRINK_WARM) toast(`Ugh. It's warm (${Math.round(drinkTemp(heldSnack))}°F)`);
  snackLeft--; biteAnim = 0.4; biteGroup = snackGroup; biteDrink = isDrink(heldSnack.userData.snack);
  snackTag();
}

// ---------------- snack & drink stock ----------------
// Nothing on the racks refills itself. Backstock lives in the stock cupboards
// behind the counter (drinks / snacks): E on one hands you exactly what the
// racks are missing, up to what's in there and what you can carry. Carried
// stock can't be eaten; E on an empty spot on a rack puts one out. More is
// ordered on the register and arrives next morning as boxes by the entrance:
// carry them (up to 3) to a cupboard and E to unpack
const CASE_QTY = 12;
const stockCarry = new Set();                    // rack units you're carrying as stock (the unit is just its look: any empty spot of that product will take it)
const backstock = {};                            // product name -> count in the cupboards
const deliveries = [];                           // ordered, not here yet: { name, qty } | { tape: copyKey }
const boxes = [];                                // delivered, waiting by the door (or in your arms): { name, qty, mesh }
const boxCarry = [];
const stockProducts = () => {                    // every product on the racks, with its spots
  const m = new Map();
  for (const u of snackUnits()) { const p = u.userData.snack; let e = m.get(p.name); if (!e) m.set(p.name, e = { name: p.name, drink: isDrink(p), units: [] }); e.units.push(u); }
  return [...m.values()];
};
const caseCost = e => +((e.drink ? 0.6 : 0.45) * CASE_QTY).toFixed(2);   // wholesale: about half of what they sell for
function emptySpots() {                          // rack spots with nothing on them, that nobody's holding
  const busy = new Set([heldSnack, ...inv.filter(e => e.kind === "snack").map(e => e.ref), ...stockCarry, ...custs.flatMap(k => k.snacks), ...custs.map(k => k.snackUnit), ...staff.flatMap(e => e.restock ? [...e.restock.units, ...e.restock.got] : [])]);
  return snackUnits().filter(u => !u.visible && !busy.has(u));
}
function stockTake(kind) {                       // E on a stock cupboard
  const need = emptySpots().filter(u => isDrink(u.userData.snack) === (kind === "drinks"));
  if (!need.length) { if (!stockReturn(kind)) toast(`The ${kind === "drinks" ? "drink" : "snack"} racks are full`, true); return; }   // nothing to grab for: whatever you're carrying goes back
  let got = 0; const out = new Set();
  for (const u of need) {
    const name = u.userData.snack.name;
    if (!(backstock[name] > 0)) { out.add(name); continue; }
    if (!invMakeRoom()) break;
    backstock[name]--; stockCarry.add(u);
    showSnack(u); snackLeft = snackTotal = portions(u.userData.snack); snackTag(); invSync(); got++;
  }
  const full = got < need.length - out.size;
  toast(got ? `Grabbed ${got} to restock${kind === "drinks" ? " (room temperature: they'll need time to chill)" : ""}${full ? " (hands full: come back for the rest)" : ""}${out.size ? ` · out of ${[...out].slice(0, 2).join(", ")}${out.size > 2 ? "…" : ""}` : ""}` : `Out of stock: order more on the register`, !!got);
  if (out.size) logAct(`Stock cupboard's out of ${[...out].join(", ")}: order more on the register`, "bad");
}
function stockFor(u) {                           // a carried stock item that would go in this empty spot (in hand first)
  const name = u.userData.snack.name;
  if (heldSnack && stockCarry.has(heldSnack) && heldSnack.userData.snack.name === name) return invSel;
  return inv.findIndex(e => e.kind === "snack" && stockCarry.has(e.ref) && e.ref.userData.snack.name === name);
}
// carried stock back on the cupboard shelf (untouched only: an opened one's yours now). onlyHeld: just the one in hand.
// Its rack spot goes back to being an empty spot. -> how many went back
const stockMine = (e, kind) => e.kind === "snack" && stockCarry.has(e.ref) && isDrink(e.ref.userData.snack) === (kind === "drinks");
function stockReturn(kind, onlyHeld = false) {
  invSync(); invStash();                         // hand empty first: everything's an inventory entry with its bites counted
  const back = {};
  for (let i = inv.length - 1; i >= 0; i--) {
    const e = inv[i]; if (!stockMine(e, kind) || e.left < e.total || (onlyHeld && e !== stockReturn.held)) continue;
    const name = e.ref.userData.snack.name;
    stockCarry.delete(e.ref); backstock[name] = (backstock[name] || 0) + 1; back[name] = (back[name] || 0) + 1;
    inv.splice(i, 1);
  }
  stockReturn.held = null; invRender();
  const n = Object.values(back).reduce((a, b) => a + b, 0);
  if (n) toast(`Put back ${n === 1 ? `a ${Object.keys(back)[0]}` : `${n} items`} in the ${kind === "drinks" ? "drink" : "snack"} cupboard`, true);
  return n;
}
function stockPlace(u) {                         // E on an empty spot: out it goes
  const own = inv.findIndex(e => e.ref === u && stockCarry.has(u));   // the one you took for this very spot, if you've got it
  const i = own >= 0 ? own : stockFor(u); if (i < 0) return;
  gainXp("you", "str", 2);
  const e = inv[i]; stockCarry.delete(e.ref);
  if (i === invSel) { heldSnack = null; snackGroup.visible = false; snackGroup.clear(); $("holdingTag").style.display = "none"; invSync(); }
  else { inv.splice(i, 1); if (i < invSel) invSel--; invRender(); }
  u.visible = true; stockPlace.n = (stockPlace.n || 0) + 1;
  if (isDrink(u.userData.snack)) u.userData.temp = ROOM_F;   // straight from the cupboard: it'll need a while in the cooler
  shiftScore(3, "you");
  if (![...stockCarry].length) { logAct(`Restocked ${stockPlace.n} item${stockPlace.n > 1 ? "s" : ""} on the racks`, "good", null, 3 * stockPlace.n); stockPlace.n = 0; }
}
function stockOrder(name, cases) { deliveries.push({ name, qty: cases * CASE_QTY }); logAct(`Ordered ${cases} case${cases > 1 ? "s" : ""} of ${name}: arrives tomorrow morning`); }
const BOX_AT = i => ({ x: -1.5 + (i % 2) * 0.5, z: 0.75 + Math.floor(i / 2) % 5 * 0.5, y: Math.floor(i / 10) * 0.36 });   // just inside the doors, beside the lane
function boxMake(b) {                            // a brown carton, taped, with a label
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.34), boxMat); g.add(box);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(0.445, 0.005, 0.06), boxTapeMat); tape.position.y = 0.171; g.add(tape);
  const lbl = textPlane(`${b.name.toUpperCase()} \u00d7${b.qty}`, 0.36, 0.08, "#222", "#f2eee2", "Arial", 60);
  lbl.material = new THREE.MeshLambertMaterial({ map: lbl.material.map }); lbl.position.set(0, 0.02, 0.171); g.add(lbl);
  g.traverse(m => { if (m.isMesh) { m.userData.box = b; aimables.push(m); } });
  b.mesh = g; return g;
}
const boxMat = new THREE.MeshLambertMaterial({ color: 0xa87a4a }), boxTapeMat = new THREE.MeshLambertMaterial({ color: 0xc9a86a });
function boxesLayout() {                         // stacked by the door, solid (you and customers go round them)
  for (const b of boxes) if (b.col) { colliders.splice(colliders.indexOf(b.col), 1); b.col = null; }
  boxes.filter(b => !boxCarry.includes(b)).forEach((b, i) => {
    const a = BOX_AT(i); b.mesh.position.set(a.x, 0.17 + a.y, a.z); b.mesh.rotation.set(0, 0.1 * (i % 3 - 1), 0); if (b.mesh.parent !== scene) scene.add(b.mesh);
    if (!a.y) { b.col = { x0: a.x - 0.25, x1: a.x + 0.25, z0: a.z - 0.2, z1: a.z + 0.2 }; colliders.push(b.col); }
  });
}
function boxDeliver() {                          // morning: yesterday's orders are by the door
  const tapes = deliveries.filter(d => d.tape).map(d => copyByKey(d.tape)).filter(Boolean);
  for (const d of deliveries.filter(d => d.name)) { const b = { name: d.name, qty: d.qty }; boxes.push(b); boxMake(b); }
  const nb = deliveries.filter(d => d.name).length, lib = deliveries.find(d => d.lib);
  if (lib) { const n = libUnlock(lib.lib); growth.pending += 4; logAct(`Library upgrade ${lib.lib} came in overnight: ${n} tapes on the shelves`, "good"); }   // (and a bigger library draws new members)
  deliveries.length = 0; boxesLayout();
  for (const c of tapes) { setOnShelf(c, false); returnBin.push(c); } if (tapes.length) refreshReturnsBin();
  if (nb) logAct(`Delivery: ${nb} box${nb > 1 ? "es" : ""} by the front door`);
  if (tapes.length) logAct(`Delivery: ${tapes.length} replacement tape${tapes.length > 1 ? "s" : ""} in the returns bin`);
}
const boxHand = new THREE.Group();
function boxPick(b) {                            // E on a box: into your arms (up to 3, stacked)
  const most = Math.min(6, 3 + Math.floor((lv("you", "str") - 1) / 3)) + (has("you", "str", 10) ? 2 : 0);   // (STR: more boxes at once; Pack Mule)
  if (boxCarry.length >= most) { toast("That's all you can carry"); return; }
  boxCarry.push(b); b.mesh.traverse(m => { const i = aimables.indexOf(m); if (i >= 0) aimables.splice(i, 1); });
  if (!boxHand.parent) camera.add(boxHand);
  boxHand.add(b.mesh); boxHand.position.set(0.3, -0.52, -0.8); boxHand.scale.setScalar(0.75);   // carried low and to the side
  boxCarry.forEach((k, i) => { k.mesh.position.set(0, i * 0.34, 0); k.mesh.rotation.set(0, 0, 0); });
  boxesLayout();
}
function boxUnpack() {                           // E on a stock cupboard with boxes in your arms
  for (const b of boxCarry) { backstock[b.name] = (backstock[b.name] || 0) + b.qty; boxHand.remove(b.mesh); boxes.splice(boxes.indexOf(b), 1); }
  logAct(`Unpacked ${boxCarry.map(b => `${b.name} \u00d7${b.qty}`).join(", ")} into the stock cupboards`, "good");
  shiftScore(5 * boxCarry.length, "you"); gainXp("you", "str", 6 * boxCarry.length); boxCarry.length = 0;
}

// ---- drink temperature: each drink on the rack follows the cooler's air, slowly.
// Fresh stock goes in warm; a door left open warms everything. A customer who
// grabs one over 45°F isn't happy about it ----
const DRINK_WARM = 45, ROOM_F = 70;
const drinkTemp = u => u.userData.temp ?? 36;
let drinkUnits = null;
function drinkTempTick(dt) {
  if ((drinkTempTick.t = (drinkTempTick.t || 0) + dt) < 0.5) return;
  const step = drinkTempTick.t; drinkTempTick.t = 0;
  const air = coolerThermo.temp, k = Math.min(1, step / 150);   // a can takes a few minutes to follow the air
  for (const u of drinkUnits ||= snackUnits().filter(u => isDrink(u.userData.snack))) if (u.visible) u.userData.temp = drinkTemp(u) + (air - drinkTemp(u)) * k;
  if (air > 42 && !drinkTempTick.warned) { drinkTempTick.warned = true; logAct(`The cooler's warming up: ${Math.round(air)}°F${coolerOpen ? ", and the door's open" : ""}`, "bad"); }
  else if (air < 38) drinkTempTick.warned = false;
}
function custWarmDrink(cust, u) {
  shiftScore(-10); posTerm.loyal(cust.member, -3); cust.c.setMood("meh"); cust.hi = 1.8;
  logAct(`${memberName(cust.member)} grabbed a warm ${u.userData.snack.name} (${Math.round(drinkTemp(u))}°F)`, "bad", null, -10);
}

// ---------------- the build-up (simulation): what the store has so far ----------------
function amenities() {
  if (jobBoardMesh) {                              // Dana's job board: only once there's a Dana
    const on = staff.length > 0;
    if (jobBoardMesh.g.visible !== on) {
      jobBoardMesh.g.visible = on;
      for (const m of jobBoardMesh.parts) { const i = aimables.indexOf(m); if (on && i < 0) aimables.push(m); if (!on && i >= 0) aimables.splice(i, 1); }
    }
  }
  const hall = doors.find(d => d.push && !d.alongX);   // the hall -> lobby door: the theater's way in
  const open = owned("theater");
  if (hall && hall.locked !== !open) {
    hall.locked = !open;
    if (!open) colliders.push(hall.shut); else { const i = colliders.indexOf(hall.shut); if (i >= 0) colliders.splice(i, 1); }
    custSpots = custSnackSpots = null;           // the lobby's reachable (or not) now
    for (const z of ["lobby", "theater"]) if (zoneOn[z] !== open) setZone(z, open);   // dark through the porthole till it opens
  }
  if (!open && !theaterSign && hall) {           // chained shut, a sign on both faces
    theaterSign = new THREE.Group(); scene.add(theaterSign);
    for (const f of [1, -1]) {
      const t = textPlane("THEATER \u00b7 COMING SOON", 0.62, 0.16, "#ffd400", "#3a0d12", "Arial Black", 60);
      t.material = new THREE.MeshLambertMaterial({ map: t.material.map }); t.position.set(hall.at + f * 0.07, 1.5, hall.c); t.rotation.y = f * Math.PI / 2; theaterSign.add(t);
    }
  } else if (open && theaterSign) { theaterSign.removeFromParent(); theaterSign = null; }   // (removeFromParent: roomSort may have filed it into a room group)
  if (popcornMachine) {
    const on = owned("popcorn");
    if (popcornMachine.g.visible !== on) {
      popcornMachine.g.visible = on;
      for (const c of popcornMachine.cols) { const i = colliders.indexOf(c); if (on && i < 0) colliders.push(c); if (!on && i >= 0) colliders.splice(i, 1); }
    }
  }
}
function libLock() {                             // simulation: sections you haven't bought come off the shelves
  if (!SIM) return;
  for (const t of catalog) for (const c of [t, ...(t.copies || [])]) {
    if (!libLocked(c)) continue;
    c.libLocked = true;
    if (c.rental) { posTerm.cancel(c); const i = rentedCopies.indexOf(c); if (i >= 0) rentedCopies.splice(i, 1); }   // (a new store's opening rentals don't include them)
    if (!c.offShelf) setOnShelf(c, false);
  }
  signsRefresh();
}
function libUnlock(tier) {                       // -> tapes put out
  let n = 0;
  for (const t of catalog) for (const c of [t, ...(t.copies || [])]) {
    if (!LIBRARY[tier - 1].cats.includes(c.category) || !c.libLocked) continue;
    c.libLocked = false; if (!c.lost && !c.rental) { setOnShelf(c, true); n++; }
  }
  upg.library = tier; custSpots = null; signsRefresh();
  return n;
}

// ---------------- the phone: "do you have ... in?" ----------------
// Every couple of hours it rings. Answer (E) and a member asks after a title:
// 1 — yes, you'll hold one for them; 2 — sorry, all out. Promise a hold and a
// copy had better be on the holds shelf (E with it in hand) by the time they
// come in for it. Customers in the store come first: a call you miss while
// you're with someone costs nothing (they'll call back), but pick up while
// someone's waiting at the counter and they notice. Dana takes calls too, but
// only when nobody in the store needs her
const phone = { next: SAVE?.phone?.next ?? null, ring: null, call: null };   // next: the game hour of the next call
const holds = [];                                // promised holds: { member, title, at (game hour they come in), day, copy (on the shelf) | null, by, alert }
const holdAlertFor = copy => holds.find(h => h.alert && !h.copy && h.title === titleOfCopy(copy));   // a POS alert on a promised hold: the next return of it goes on the holds shelf
const storeBusy = () => !!(co || custWaiting() || custLine.length || custAsks.some(k => k.state === "asking"));   // somebody in the store needs serving
let ringAc = null;
function ringBurst() {                            // a desk-set ringer: a clapper buzzing between two small gongs ~20 times a second for 2 s
  try {                                           // (lowpassed and not too loud: a real bell, but across the room and not in your ear)
    const ac = ringAc ||= new AudioContext(), t = ac.currentTime + 0.02, out = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 3200; out.gain.value = 0.09; out.connect(lp).connect(ac.destination);
    [[1180, 0], [1390, 0.025]].forEach(([f, off]) => {   // the two gongs, struck alternately
      for (const [r, a] of [[1, 1], [2.32, 0.35], [4.1, 0.12]]) {
        const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f * r; o.connect(g).connect(out);
        g.gain.setValueAtTime(0, t);
        for (let s = t + off; s < t + 2; s += 0.05) { const env = Math.min(1, (s - t) / 0.08, (t + 2 - s) / 0.15); g.gain.setValueAtTime(a * env, s); g.gain.setTargetAtTime(a * env * 0.25, s, 0.012); }
        g.gain.setTargetAtTime(0, t + 2, 0.08); o.start(t); o.stop(t + 2.6);
      }
    });
  } catch {}
}
function phoneCaller() {                          // an active member, not in the store, asking after something in their taste
  const ms = posTerm.members.filter(m => m.active !== false && posTerm.canVisit(m) && !custs.some(k => k.member === m) && !holds.some(h => h.member === m));
  const m = ms[Math.floor(Math.random() * ms.length)]; if (!m) return null;
  const cats = customerFor(Math.imul(m.num, 2654435761) >>> 0, m.female).persona.taste.cats;
  const pool = catalog.filter(t => t.pos && !t.libLocked && (!cats.length || cats.includes(t.category)));
  const inNow = pool.filter(onShelfCopy), out = pool.filter(t => !onShelfCopy(t));
  const from = Math.random() < 0.65 || !out.length ? inNow : out;
  return from.length ? { member: m, title: from[Math.floor(Math.random() * from.length)] } : null;
}
function phoneTick(dt) {                          // (runs with the clock)
  if (phone.next == null) phone.next = Math.max(shift.h, SHIFT.open) + 1 + Math.random() * 1.5;
  if (!phone.ring && !phone.call && shiftOpen() && shift.h >= phone.next) {
    phone.next = shift.h + 2 + Math.random() * 1.5;   // semi-infrequent: every two to three and a half hours
    const c = phoneCaller(); if (c) { phone.ring = { ...c, t: 0, rang: 0 }; logAct("The phone's ringing (behind the counter)"); }
  }
  const r = phone.ring; if (!r) { phoneCallTick(dt); return; }
  r.t += dt;
  if (r.t >= r.rang) { r.rang += 6; ringBurst(); }   // US cadence: 2 s on, 4 s off
  const taker = r.t > 6 && staff.find(e => e.c && e.state === "post" && co?.emp !== e && e.t <= 0 && withEmp(e, danaBestJob) === "phone");
  if (taker) return withEmp(taker, danaCall);   // top of someone's list right now: they get it
  if (r.t > 20) {                                 // rang out
    phone.ring = null;
    if (storeBusy()) { logAct(`Missed a call from ${memberName(r.member)} while you were with customers: they'll call back`); phone.next = shift.h + 0.4 + Math.random() * 0.4; }
    else { shiftScore(-10); posTerm.loyal(r.member, -2); logAct(`Missed a call from ${memberName(r.member)}`, "bad", null, -10); }
  }
}
function phoneAnswer() {                          // E on the phone while it's ringing
  const r = phone.ring; if (!r) return;
  gainXp("you", "cha", 4);
  phone.ring = null;
  const waiting = [custWaiting(), ...custAsks.filter(k => k.state === "asking")].filter(Boolean);
  if (waiting.length) {                           // they're standing right there
    for (const k of waiting) { k.t -= 10; posTerm.loyal(k.member, -2); k.c.setMood("impatient"); k.hi = 2; }
    logAct(`Picked up the phone with ${waiting.length === 1 ? "a customer" : waiting.length + " customers"} waiting at the counter`, "bad");
  }
  phone.call = { member: r.member, title: r.title, t: 30 };
  callHud();
}
function phoneCallTick(dt) {
  const c = phone.call; if (!c) return;
  if ((c.t -= dt) <= 0) { phone.call = null; callHud(); shiftScore(-5); logAct(`${memberName(c.member)} got tired of waiting on the line and hung up`, "bad", null, -5); }
}
function callAnswer(key, by = "you") {            // 1: yes, I'll hold one · 2: sorry, all out
  const c = phone.call; if (!c) return;
  phone.call = null; callHud();
  const name = memberName(c.member), inNow = !!onShelfCopy(c.title), Who = by === "dana" ? emp.first : "You";
  if (key === 1) {
    const at = Math.min(SHIFT.lastIn - 0.1, shift.h + 1 + Math.random() * 1.2);
    holds.push({ member: c.member, title: c.title, at, day: shift.day, copy: null, by });
    logAct(`${Who} told ${name} there's a copy of ${tapeName(c.title)} on hold for them: they'll be in around ${fmtClock(at)}${by === "you" ? ". Put a copy on the holds shelf" : ""}`);
    return holds[holds.length - 1];
  }
  if (inNow) { shiftScore(-10, by); posTerm.loyal(c.member, -3); logAct(`${Who} told ${name} ${tapeName(c.title)} was all out, but there's one on the shelf`, "bad", null, -10); }
  else { shiftScore(10, by); posTerm.loyal(c.member, 1); logAct(`${Who} told ${name} ${tapeName(c.title)} is all out`, "", null, 10); }
}
function callHud() {
  const el = $("callPanel"), c = phone.call; if (!c) { el.style.display = "none"; return; }
  el.innerHTML = `<div class="h">ON THE PHONE \u00b7 ${memberName(c.member)} #${c.member.num}</div><div class="q">\u201cHi, do you have <b>${tapeName(c.title)}</b> in?\u201d <span class="cat">(${c.title.category})</span></div>` +
    `<span><b>1</b> Yes, I'll hold one for you</span><span><b>2</b> Sorry, we're all out</span>`;
  el.style.display = "block";
}
function holdPull() {                            // E on the holds shelf, hands free: take down the one someone's at the counter for
  const k = custAsks.find(k => k.state === "asking" && k.want.kind === "hold" && k.want.hold.copy);
  const h = k?.want.hold; if (!h) { toast("Those are for customers who come in for them"); return; }
  if (!invMakeRoom()) { toast("Hands full"); return; }
  const t = h.copy; h.copy = null; h.pulled = t; holdsRender(); showTape(t);
}
function holdPlace(tape) {                        // E on the holds shelf with a tape in hand
  const h = holds.find(h => !h.copy && titleOfCopy(tape) === h.title);
  if (!h) { toast("Nobody's asked for that one to be held"); return; }
  tape.fromReturns = tape.strayFix = false; releaseFromHand(); invSync();
  h.copy = tape; holdsRender(); shiftScore(15, "you"); gainXp("you", "int", 5);
  logAct(`Put ${tape.title} on the holds shelf for ${memberName(h.member)}`, "good", null, 15);
}
let holdMeshes = [];
function holdsRender() {                          // the held tapes, stacked in the tray with a yellow slip on each
  for (const m of holdMeshes) m.removeFromParent(); holdMeshes = [];
  holds.filter(h => h.copy).forEach((h, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(TAPE.h, TAPE.w, TAPE.d), h.copy.sideMat || mat.tapeBody);
    m.position.set(HOLDS_AT.x + (i % 2) * 0.012, HOLDS_AT.y + TAPE.w / 2 + i * TAPE.w, HOLDS_AT.z); scene.add(m); holdMeshes.push(m);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.07), holdSlip); s.position.set(m.position.x, m.position.y + TAPE.w / 2 + 0.001, m.position.z); scene.add(s); holdMeshes.push(s);
  });
}
const holdSlip = new THREE.MeshLambertMaterial({ color: 0xfff59a });
function holdsTick() {                           // callers come in for their holds
  for (const h of holds.filter(h => !h.coming && h.day === shift.day && shift.h >= h.at && shiftOpen() && !frontLock.locked)) {
    if (custs.some(k => k.member === h.member)) continue;
    h.coming = true; const k = custSpawn(h.member); k.pickup = h; k.thief = false; k.returning = [];
  }
}
function danaCall() {                            // Dana picks up: she checks, tells the truth, and fetches it herself if it's in
  const r = phone.ring; phone.ring = null; phone.call = { member: r.member, title: r.title, t: 30 };
  const copy = onShelfCopy(r.title);
  if (!copy) { callAnswer(2, "dana"); return; }
  const h = callAnswer(1, "dana");
  emp.fetch = { copy, hold: h }; emp.c.setMood("happy"); empGo("fetchGo", shelfSpot(copy));
}

// ---------------- the restroom's working parts ----------------
function bathTick(dt) {                          // the bowl drains and refills after a flush; the tap's stream shimmers
  if (bath.flushT > 0 && bath.water) {
    bath.flushT = Math.max(0, bath.flushT - dt); const t = 6 - bath.flushT;
    bath.water.position.y = bath.waterY - 0.07 * (t < 1.3 ? t / 1.3 : Math.max(0, 1 - (t - 1.3) / 3.8));
    bath.water.rotation.z += dt * (t < 2.5 ? 5 : 0);   // swirl
  }
  if (bath.tap && bath.stream) bath.stream.scale.set(1 + Math.sin(clockT * 40) * 0.08, 1, 1 + Math.cos(clockT * 37) * 0.08);
}

// ---------------- moving things around the counter ----------------
// The rewinders, the desensitizer and the receipt printer can be rearranged:
// hold E on one to pick it up, and a see-through copy follows your aim over
// the worktop (it only shows where it could actually sit: on the counter,
// behind the ledge, clear of the register and everything else; red if it
// won't fit). The wheel turns it, a click sets it down, right-click puts it
// back where it was, and walking off puts it back too
const cmove = { item: null, ghost: null, ry: 0, spot: null, ok: false, from: null };
let counterItems = null, eHoldMove = null;
const ghostOk = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.42, depthWrite: false });
const ghostBad = new THREE.MeshBasicMaterial({ color: 0xff5a5a, transparent: true, opacity: 0.38, depthWrite: false });
function footprint(g) {                          // its outline on the worktop, in its own frame
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), b = new THREE.Box3(), mb = new THREE.Box3(), m4 = new THREE.Matrix4();
  g.traverse(o => { if (!o.isMesh || o === printer.strip) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.union(mb.copy(o.geometry.boundingBox).applyMatrix4(m4.multiplyMatrices(inv, o.matrixWorld))); });
  return { cx: (b.min.x + b.max.x) / 2, cz: (b.min.z + b.max.z) / 2, hx: (b.max.x - b.min.x) / 2 + 0.005, hz: (b.max.z - b.min.z) / 2 + 0.005 };
}
function counterItemsList() {
  if (counterItems) return counterItems;
  const reg = (id, name, g) => { const it = { id, name, g, fp: footprint(g) }; g.traverse(o => { if (o.isMesh) o.userData.movable = it; }); return it; };
  counterItems = [...rewinders.map((rw, i) => reg(`rewinder${i}`, "rewinder", rw.g)), reg("desens", "desensitizer", COUNTER.groups.desens), reg("printer", "receipt printer", COUNTER.groups.printer)];
  counterItems.fixed = [{ g: COUNTER.groups.register, fp: footprint(COUNTER.groups.register) }];   // (the register and its keyboard stay put)
  return counterItems;
}
function obb(fp, x, z, ry) {                     // that outline placed in the world: center, axes, half-sizes
  const c = Math.cos(ry), s = Math.sin(ry), ux = [c, -s], uz = [s, c];
  return { x: x + fp.cx * c + fp.cz * s, z: z - fp.cx * s + fp.cz * c, ux, uz, hx: fp.hx, hz: fp.hz };
}
const obbOf = it => obb(it.fp, it.g.position.x, it.g.position.z, it.g.rotation.y);
function obbHit(a, b) {                          // separating axis test, in plan
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [ax, az] of [a.ux, a.uz, b.ux, b.uz]) {
    const ra = a.hx * Math.abs(a.ux[0] * ax + a.ux[1] * az) + a.hz * Math.abs(a.uz[0] * ax + a.uz[1] * az);
    const rb = b.hx * Math.abs(b.ux[0] * ax + b.ux[1] * az) + b.hz * Math.abs(b.uz[0] * ax + b.uz[1] * az);
    if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
  }
  return true;
}
const onTop = (x, z) => COUNTER.tops.some(t => x >= t.x0 && x <= t.x1 && z >= t.z0 && z <= t.z1);
function fits(it, x, z, ry) {                    // all of it on the worktop, and not into anything else
  const o = obb(it.fp, x, z, ry);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (!onTop(o.x + o.ux[0] * o.hx * sx + o.uz[0] * o.hz * sz, o.z + o.ux[1] * o.hx * sx + o.uz[1] * o.hz * sz)) return false;
  return ![...counterItemsList().filter(k => k !== it), ...counterItems.fixed].some(k => obbHit(o, obbOf(k)));
}
function ghostOf(g) {                             // a see-through copy (visible parts only; the receipt strip stays home)
  const copy = o => {
    if (o.isMesh && !o.visible) return null;
    const c = o.isMesh ? new THREE.Mesh(o.geometry, ghostOk) : new THREE.Group();
    c.position.copy(o.position); c.rotation.copy(o.rotation); c.scale.copy(o.scale);
    for (const ch of o.children) if (ch !== printer.strip) { const k = copy(ch); if (k) c.add(k); }
    return c;
  };
  return copy(g);
}
function moveStart(it) {
  if (co && (it.id === "desens" || it.id === "printer")) { toast("Not in the middle of a checkout"); return; }
  cmove.item = it; cmove.ry = it.g.rotation.y; cmove.from = { x: it.g.position.x, z: it.g.position.z, ry: it.g.rotation.y, px: player.x, pz: player.z };
  cmove.ghost = ghostOf(it.g); cmove.ghost.visible = false; scene.add(cmove.ghost);
  cmove.wheel = 0;
  it.g.visible = false; cmove.spot = null; cmove.ok = false;
}
function moveTick() {                            // each frame while carrying one: where would it go?
  if (!cmove.item) return;
  if (Math.hypot(player.x - cmove.from.px, player.z - cmove.from.pz) > 3) return moveCancel(`You walked off: the ${cmove.item.name}'s back where it was`);
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const r = raycaster.ray, t = r.direction.y < -0.02 ? (COUNTER.y - r.origin.y) / r.direction.y : -1;
  const x = r.origin.x + r.direction.x * t, z = r.origin.z + r.direction.z * t;
  if (t < 0 || t > 2.6 || !onTop(x, z)) { cmove.spot = null; cmove.ghost.visible = false; return; }   // not aiming at the worktop: no ghost
  cmove.spot = { x, z }; const ok = fits(cmove.item, x, z, cmove.ry);
  if (ok !== cmove.ok) { cmove.ok = ok; cmove.ghost.traverse(o => { if (o.isMesh) o.material = ok ? ghostOk : ghostBad; }); }
  cmove.ghost.visible = true; cmove.ghost.position.set(x, COUNTER.y + 0.002, z); cmove.ghost.rotation.set(0, cmove.ry, 0);
}
function moveEnd() { cmove.item.g.visible = true; cmove.ghost.removeFromParent(); cmove.item = cmove.ghost = cmove.spot = null; }   // (from wherever it is: in the first seconds roomSort files new things into room groups)
function movePlace() {                           // click: set it down (if it fits)
  if (!cmove.spot) { toast("Aim at a free spot on the counter"); return; }
  if (!cmove.ok) { toast("It won't fit there"); return; }
  const it = cmove.item; it.g.position.set(cmove.spot.x, COUNTER.y, cmove.spot.z); it.g.rotation.y = cmove.ry;
  moveEnd(); counterMoved(it);
}
function moveCancel(msg) { if (!cmove.item) return; moveEnd(); if (msg) toast(msg); }   // right-click / walked off: it never left
function counterMoved(it) {                       // everything that depends on where it sits follows it
  it.g.updateMatrixWorld(true);
  if (it.id === "desens") { DESENS_AT.x = it.g.position.x; DESENS_AT.z = it.g.position.z; }
  if (it.id === "printer") { const v = new THREE.Vector3(0, 0.091, -0.028).applyMatrix4(it.g.matrixWorld); PRN_AT.x = v.x; PRN_AT.z = v.z; }
}
function staffSpotFor(x, z) {                     // where you'd stand behind the counter to reach something at x/z
  const top = COUNTER.tops.find(t => x >= t.x0 - 0.05 && x <= t.x1 + 0.05 && z >= t.z0 - 0.05 && z <= t.z1 + 0.05) || COUNTER.tops[1];
  return top.run === "north" ? { x: Math.max(COUNTER.tops[0].x0 + 0.3, Math.min(x, COUNTER.tops[1].staff - 0.1)), z: top.staff, ry: 0 } : { x: top.staff, z, ry: Math.PI / 2 };
}
function rewinderSpot() {                         // Dana's spot for the rewinders: at the free one nearest her (or the first)
  const p = emp.c.group.position, free = rewinders.filter(rw => !rw.tape), pick = (free.length ? free : rewinders).reduce((a, b) => b.g.position.distanceTo(p) < a.g.position.distanceTo(p) ? b : a);
  return staffSpotFor(pick.g.position.x, pick.g.position.z);
}
const onNorthRun = at => COUNTER.tops[0] && at.z >= COUNTER.tops[0].z0 - 0.05 && at.x <= COUNTER.tops[0].x1;

// ---------------- misshelved tapes ----------------
// A customer putting a tape back sometimes shoves it in wherever they're
// standing: it sits crooked, sticking out of the shelf, until someone puts it
// in its own slot (E to pick it up, then put it back as usual). Dana does
// them as part of the returns
const strays = [];                               // { copy, mesh }
function misshelve(copy, spot, at = null) {
  const near = at || spot?.copies?.find(c => !c.offShelf && c !== copy) || copy;
  const nx = Math.cos(near.ry), nz = -Math.sin(near.ry);
  const m = new THREE.Mesh(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d), copy.sideMat || mat.tapeBody);
  m.position.set(near.pos.x + nx * 0.07, near.pos.y + 0.02, near.pos.z + nz * 0.07); m.rotation.set(0, near.ry, 0.4);   // crooked, half out of the row
  m.userData.stray = copy; scene.add(m);
  strays.push({ copy, mesh: m, at: near });
}
function strayTake(s) {                          // off the shelf and into a hand
  s.mesh.removeFromParent(); strays.splice(strays.indexOf(s), 1);
}
// ---------------- messes ----------------
// Litter from customers (a wrapper, spilled popcorn), cups left in the
// theater. E cleans one up; Dana does too when things are quiet. A messy store
// puts customers off
const messes = [];                               // { kind, mesh, x, y, z }
const MESS = {
  wrapper: { label: "candy wrapper", make: () => new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.05), new THREE.MeshLambertMaterial({ color: [0xd23b3b, 0x3b7bd2, 0xe0b020][Math.floor(Math.random() * 3)] })) },
  popcorn: { label: "spilled popcorn", make: () => { const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color: 0xf6e7a8 });
    for (let i = 0; i < 14; i++) { const k = new THREE.Mesh(new THREE.IcosahedronGeometry(0.018, 0), m); k.position.set((Math.random() - 0.5) * 0.35, 0.012, (Math.random() - 0.5) * 0.35); g.add(k); } return g; } },
  towel: { label: "paper towel", make: () => { const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), new THREE.MeshLambertMaterial({ color: 0xf6f3ea })); t.position.y = 0.03; t.rotation.set(1, 2, 0); return t; } },
  cup: { label: "empty cup", make: () => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.14, 12), new THREE.MeshLambertMaterial({ color: 0xd9d9d9 })); c.rotation.z = Math.PI / 2; c.position.y = 0.045; return c; } },
};
function messAdd(kind, x, z, y = floorHeightAt(x, z)) {
  if (messes.length >= 20) return;
  const mesh = MESS[kind].make(); mesh.position.set(x, y + 0.005 + (mesh.position.y || 0), z); mesh.rotation.y = Math.random() * 6.28;
  const m = { kind, mesh, x, y, z }; mesh.traverse(o => { if (o.isMesh) { o.userData.mess = m; aimables.push(o); } }); if (mesh.isMesh) { mesh.userData.mess = m; }
  scene.add(mesh); messes.push(m);
}
function messClean(m, by = "you") {
  m.mesh.removeFromParent(); m.mesh.traverse(o => { const i = aimables.indexOf(o); if (i >= 0) aimables.splice(i, 1); });
  messes.splice(messes.indexOf(m), 1);
  shiftScore(15, by); gainXp(by, "con", 6); logAct(`${by === "dana" ? `${emp.first} cleaned` : "Cleaned"} up the ${MESS[m.kind].label}`, "good", null, 15);
  trashAdd(binNear(m.x, m.z), 1, false);          // (it goes in the nearest bin)
}

// ---------------- trash: bins fill up, the bags go down the chute ----------------
// Three bins: the lobby receptacle (it fills with the customers: the busier the
// store, the faster), the break room can (the staff's lunches) and the restroom
// wastebasket (paper towels). A full one spills onto the floor. E on a bin ties
// off the bag and puts in a fresh liner; carry up to two to the chute in the
// break room (right-click sets them down). Bins over 3/4 full and bags left
// lying about count against the closing check, and customers notice an
// overflowing bin like any other mess. The staff do it too, under CLEANUP.
const bagMax = () => has("you", "str", 5) ? 3 : 2;   // one in each hand (Strong Grip: a third hugged in front)
const bagCarry = [];                              // in your hands: { bin, n, mesh }
const bagsDown = [];                              // set down somewhere: { bin, n, mesh, x, z, claim }
const bagHand = new THREE.Group();
const binList = () => Object.values(trashBins);
const binFull = b => b.n >= b.cap;
const binNear = (x, z) => z < STORE.z ? trashBins.lobby : x < BOH.splitX ? trashBins.breakroom : trashBins.restroom;
const unaim = o => o.traverse(m => { const i = aimables.indexOf(m); if (i >= 0) aimables.splice(i, 1); });
for (const b of binList()) {
  b.n = Math.min(b.cap, SAVE?.trash?.bins?.[b.id] ?? Math.floor(b.cap * 0.3 * Math.random())); b.acc = 0;
  if (!b.closed) {                                // open-top: a heap of crumpled paper that rises with the fill
    b.heap = new THREE.Group(); b.heap.position.set(b.x, 0, b.z); scene.add(b.heap);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(b.r * 0.97, 20), new THREE.MeshLambertMaterial({ color: b.liner })); disc.rotation.x = -Math.PI / 2; b.heap.add(disc);
    const colors = b.towels ? [0xf6f3ea] : [0xf2f0ea, 0xe8e2d0, 0xc23a32, 0x7a5434, 0xe0b020, 0x3b7bd2];
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, rr = (i ? 0.35 + 0.5 * Math.random() : 0) * b.r * 0.75, sz = b.r * (0.22 + Math.random() * 0.12);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(sz, 0), new THREE.MeshLambertMaterial({ color: colors[i % colors.length] }));
      m.position.set(Math.cos(a) * rr, sz * 0.6 + (i % 3) * sz * 0.4, Math.sin(a) * rr); m.rotation.set(Math.random() * 3, Math.random() * 3, 0); b.heap.add(m);
    }
    b.heap.traverse(o => { if (o.isMesh) b.parts.push(o); });
  }
  for (const o of b.parts) { o.userData.trashBin = b; if (!aimables.includes(o)) aimables.push(o); }
  binShow(b);
}
function binShow(b) {                             // how full it looks
  const f = Math.min(1, b.n / b.cap);
  if (b.heap) { b.heap.visible = b.n > 0; b.heap.position.y = 0.02 + (b.rimY - 0.07) * f; }
  if (b.over) { b.over.visible = f >= 0.85; trashFlapRest = f >= 0.85 ? -0.28 : 0; if (trashFlapT <= 0) trashFlap.rotation.x = trashFlapRest; }   // (pushed out from behind)
}
function trashAdd(b, k = 1, spill = true) {       // something into a bin; a full one spills onto the floor in front of it
  if (!b) return;
  for (let i = 0; i < k; i++) {
    if (b.n < b.cap) { if (++b.n === b.cap && spill) logAct(`The ${b.name} is full: bag it and take it to the chute in the break room`, "bad"); }
    else if (spill) {
      messAdd(b.towels ? "towel" : Math.random() < 0.6 ? "wrapper" : "cup", b.stand.x + (Math.random() - 0.5) * 0.7, b.stand.z + (Math.random() - 0.5) * 0.3);
      if (!b.spilled) { b.spilled = true; logAct(`The ${b.name} is overflowing onto the floor`, "bad"); }
    }
  }
  binShow(b);
}
function makeBag(b, n) {                          // a tied-off liner (black from the lobby, white from the others): the knot at the origin, the bag hanging below it
  const g = new THREE.Group(), r = (b.id === "lobby" ? 0.2 : b.id === "breakroom" ? 0.17 : 0.12) * (0.75 + 0.25 * Math.min(1, n / b.cap));
  const m = new THREE.MeshPhongMaterial({ color: b.liner, specular: 0x777777, shininess: 55 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); body.scale.set(1, 1.15, 0.9); body.position.y = -r * 1.2 - 0.05; g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, r * 0.4, 0.08, 10), m); neck.position.y = -0.055; g.add(neck);   // gathered up
  for (const sx of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.07, 6), m); ear.position.set(sx * 0.022, 0.005, 0); ear.rotation.z = -sx * 1.0; g.add(ear); }   // the tie
  g.userData.r = r; return g;
}
function bagTie(b) {                              // -> the bag out of a bin (and a fresh liner in)
  const bag = { bin: b, n: b.n, mesh: makeBag(b, b.n) };
  b.n = 0; b.acc = 0; b.spilled = false; binShow(b); window.VaultAmbience?.bag(b.x, 0.5, b.z);
  return bag;
}
function bagHandShow() {                          // carried low, one in each hand
  if (!bagHand.parent) camera.add(bagHand);
  bagHand.clear();
  bagCarry.forEach((g, i) => { g.mesh.position.set([0.36, -0.36, 0][i], i > 1 ? -0.34 : -0.24, -0.62); g.mesh.rotation.set(0, 0, i ? 0.08 : -0.08); g.mesh.scale.setScalar(0.8); bagHand.add(g.mesh); });
}
function binBag(b) {                              // E on a bin
  if (!b.n) { toast(`The ${b.name} is empty`); return; }
  if (bagCarry.length >= bagMax()) { toast("Hands full: take these to the chute first"); return; }
  bagCarry.push(bagTie(b)); bagHandShow();
  shiftScore(5, "you"); gainXp("you", "con", 3);
}
function bagPlace(bin, n, x, z) {                 // a bag on the floor
  const g = { bin, n, mesh: makeBag(bin, n), x, z, claim: null };
  g.mesh.position.set(x, floorHeightAt(x, z) + g.mesh.userData.r * 2.35 + 0.05, z); g.mesh.rotation.y = Math.random() * 6.28;
  g.mesh.traverse(o => { if (o.isMesh) { o.userData.trashBag = g; aimables.push(o); } });
  scene.add(g.mesh); bagsDown.push(g); return g;
}
function bagsSetDown() {                          // right-click: at your feet, either side
  bagCarry.splice(0).forEach((g, i) => {
    g.mesh.removeFromParent();
    const side = (i ? -1 : 1) * 0.22, x = player.x + Math.cos(player.yaw) * side, z = player.z - Math.sin(player.yaw) * side;
    bagPlace(g.bin, g.n, x, z);
  });
}
function bagPickUp(g) {                           // E on one on the floor
  if (bagCarry.length >= bagMax()) { toast("Hands full"); return; }
  bagsDown.splice(bagsDown.indexOf(g), 1); g.mesh.removeFromParent(); unaim(g.mesh);
  g.mesh = makeBag(g.bin, g.n); bagCarry.push(g); bagHandShow();
}
function chuteUse(n) { chute.t = 1.3; window.VaultAmbience?.chute(...chute.at, n); }   // the hopper door: down, (bags in), back up
function chuteDrop() {                            // E on the chute
  const n = bagCarry.length; chuteUse(n);
  if (!n) return;                                 // (just a look down it)
  bagCarry.splice(0).forEach(g => g.mesh.removeFromParent());
  shiftScore(10 * n, "you"); gainXp("you", "str", 3 * n); gainXp("you", "con", 2 * n);
  logAct(`Took ${n === 1 ? "a bag" : `${n} bags`} of trash down the chute`, "good", null, 10 * n);
}
// the staff: the fullest bin over 60% (or a bag someone left on the floor), then the chute
const trashJob = () => bagsDown.find(g => !g.claim) || binList().filter(b => !b.claim && b.n >= b.cap * 0.6).sort((a, b) => b.n / b.cap - a.n / a.cap)[0] || null;
const TRASH_STATES = ["toBin", "bagging", "toBag", "bagLift", "toChute", "chuting"];
function empTrashStart(t) {
  emp.trash = { t, bag: null }; t.claim = emp; emp.c.setMood("neutral");
  if (t.mesh) empGo("toBag", { x: t.x + 0.45, z: t.z, ry: -Math.PI / 2 }); else empGo("toBin", t.stand);
}
function empToChute() {
  const g = emp.trash.bag; g.mesh.position.set(0, 0, 0); g.mesh.rotation.set(0, 0, 0); g.mesh.scale.setScalar(1);
  emp.c.holdItem(g.mesh); emp.c.setPose("idle"); emp.c.reachTo(null);
  empGo("toChute", chute.stand);
}
function trashTick(dt) {
  if (shift.h < SHIFT.close && !paused) {          // the day's trash: the customers' through the lobby bin, the staff's lunches, paper towels
    const hrs = dt / SHIFT.hour, inStore = custs.length;
    const rate = { lobby: 0.9 * inStore, breakroom: 0.15 + 0.25 * staff.length, restroom: 0.08 * inStore };
    for (const b of binList()) if ((b.acc += hrs * (rate[b.id] || 0)) >= 1) {
      b.acc -= 1; trashAdd(b);
      if (b.id === "lobby" && custs.some(k => k.c && Math.hypot(k.c.group.position.x - b.x, k.c.group.position.z - b.z) < 2)) trashFlapT = 0.5;   // somebody right there: the flap swings
    }
  }
  if (chute.door) {                               // the hopper door: 0.3 s down, held, 0.3 s back up
    if (chute.t > 0) chute.t = Math.max(0, chute.t - dt);
    const e = 1.3 - chute.t; chute.door.rotation.x = chute.t > 0 ? 0.8 * (e < 0.3 ? e / 0.3 : e < 1 ? 1 : (1.3 - e) / 0.3) : 0;
  }
  for (const e of staff) {                        // staff on a trash run: they get the doors, and an interrupted run puts the bag down
    if (!e.trash) continue;
    if (!TRASH_STATES.includes(e.state) || !e.c) {
      const t = e.trash.t; if (t.claim === e) t.claim = null;
      if (e.trash.bag && e.c) { e.c.holdItem(null); const p = e.c.group.position; bagPlace(e.trash.bag.bin, e.trash.bag.n, p.x, p.z); }
      e.trash = null; continue;
    }
    const p = e.c.group.position;
    for (const d of doors) if (!d.push && !d.locked && !d.open && Math.hypot(p.x - (d.alongX ? d.c : d.at), p.z - (d.alongX ? d.at : d.c)) < 1.2) toggleDoor(d);
  }
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
    if (held.strayFix) { held.strayFix = false; shiftScore(10, "you"); logAct(`Put a misshelved ${held.title} back where it belongs`, "good", null, 10); }
  }
  releaseFromHand();
}

// ---------------- the store TV (plays archive.org streams) ----------------
const video = $("vid"); video.volume = tvSet.volume / 100;
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
  if (aimCouch) {
    stoodAt = { x: player.x, z: player.z, yaw: player.yaw };
    seatAt = aimSeatObj || SEATS.reduce((a, s) => Math.abs(s.x - aimSeatX) < Math.abs(a.x - aimSeatX) ? s : a);
    seated = true; player.yaw = (seatAt.ry || 0) + Math.PI; player.pitch = 0;   // looking the way the seat faces
    return;
  }
  if (cutout.carried) { cutoutPutDown(); return; }
  if (stool.carried) { stoolPutDown(); return; }
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
    const m = aimMess; messClean(m);
    if (has("you", "con", 10)) for (const o of messes.filter(o => Math.hypot(o.x - m.x, o.z - m.z) < 3)) messClean(o);   // Neat Freak: sweep up around it too
    return;
  }
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
    if (heldSnack) dropSnack(true); else if (heldPopcorn) dropPopcorn(); else return;
    trashAdd(aimTrash, 1);
    if (aimTrash.id === "lobby") trashFlapT = 0.5; return;   // swing the flap
  }
  if (aimReturns && held) {                  // drop the tape in hand off (taking one out is a click, like a shelf)
    held.fromReturns = held.strayFix = false; returnBin.push(held); releaseFromHand(); refreshReturnsBin();
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
$("titleScreen").addEventListener("click", e => {
  if (e.target.closest("button, #mainMenu")) return;
  if (started) canvas.requestPointerLock();       // paused: click anywhere to go back in
});
// the main menu: continue the saved store (or resume), or a new game in either
// mode. A new game is set up as a fresh save and the page reloads into it
function slotInfo(n) {                           // what's in a save slot, for the menu
  try {
    const d = JSON.parse(localStorage.getItem(slotKey(n))); if (!d || d.v !== SAVE_V) return null;
    const nice = d.mode === "simulation" ? "Simulation" : "Sandbox";
    if (d.fresh) return { label: `${nice} · new store`, mode: d.mode };
    return { label: `${nice} · day ${d.shift?.day ?? 1} · $${Math.round(d.budget ?? 0).toLocaleString()} · ${starStr(repStars(d.rep ?? 50))}`, mode: d.mode };
  } catch { return null; }
}
function saveSettings() { try { localStorage.setItem("vaultbuster-settings", JSON.stringify(SETTINGS)); } catch {} }
function applySettings() {
  window.VaultAmbience?.setVolume?.(SETTINGS.sound / 100);
  SHIFT.hour = SETTINGS.shiftMin * 60 / 14;
}
// the main menu: continue the store in the active slot (or resume), load another slot, start a new
// store in a slot (then pick the mode), settings. Switching stores reloads the page into that slot
function titleMenu() {
  const nice = MODE === "simulation" ? "SIMULATION" : "SANDBOX";
  const label = () => started ? "RESUME" : SAVE?.fresh ? `START · ${nice} (SLOT ${SLOT})` : `CONTINUE · ${nice} · DAY ${shift.day} (SLOT ${SLOT})`;
  const cont = $("mmContinue"), panels = { main: $("mmMain"), slots: $("mmSlots"), modes: $("mmModes"), settings: $("mmSettings") };
  const show = k => { for (const [n, el] of Object.entries(panels)) el.hidden = n !== k; };
  let newSlot = SLOT;
  const switchTo = (n, fresh) => {               // into slot n (a fresh store if mode given)
    if (started && !fresh) saveState();           // (the store you're leaving keeps where it was)
    if (fresh) { if (n === SLOT) saveOff = true; else if (started) saveState(); try { localStorage.setItem(slotKey(n), JSON.stringify({ v: SAVE_V, mode: fresh, fresh: true })); } catch {} }
    try { localStorage.setItem("vaultbuster-slot", String(n)); } catch {}
    location.reload();
  };
  const slotList = mode => {                      // "load": pick a store; "new": pick where the new one goes
    const list = $("mmSlotList"); list.innerHTML = ""; $("mmSlotsTitle").textContent = mode === "load" ? "LOAD A STORE" : "NEW STORE · WHICH SLOT?";
    for (let n = 1; n <= SLOTS; n++) {
      const info = slotInfo(n), b = document.createElement("button");
      b.innerHTML = `<b>SLOT ${n}${n === SLOT ? " · PLAYING" : ""}</b><small>${info ? info.label + (mode === "new" ? " · (replaced)" : "") : "empty"}</small>`;
      if (mode === "load") { b.disabled = !info; b.onclick = () => n === SLOT ? cont.onclick() : switchTo(n); }
      else b.onclick = () => { newSlot = n; $("mmWarn").textContent = info ? `This replaces the store in slot ${n}.` : `Slot ${n} is empty.`; show("modes"); };
      list.appendChild(b);
    }
    show("slots");
  };
  titleMenu.refresh = () => { cont.textContent = label(); cont.hidden = !SAVE && !started; $("mmLoad").hidden = ![1, 2, 3].some(n => slotInfo(n)); show("main"); };
  titleMenu.refresh();
  cont.onclick = () => canvas.requestPointerLock();
  $("mmLoad").onclick = () => slotList("load");
  $("mmNew").onclick = () => slotList("new");
  $("mmBack").onclick = () => slotList("new");
  $("mmSlotsBack").onclick = () => show("main");
  for (const b of panels.modes.querySelectorAll("button[data-mode]")) b.onclick = () => switchTo(newSlot, b.dataset.mode);
  // settings: sliders and toggles, applied as they change
  const bind = (id, key, fmt, after) => {
    const el = $(id), out = $(id + "V"), sync = () => { if (el.type === "checkbox") el.checked = !!SETTINGS[key]; else el.value = SETTINGS[key]; if (out) out.textContent = fmt(SETTINGS[key]); };
    el.oninput = () => { SETTINGS[key] = el.type === "checkbox" ? el.checked : +el.value; sync(); after?.(); saveSettings(); applySettings(); };
    sync();
  };
  bind("setSound", "sound", v => `${v}%`);
  bind("setSens", "sens", v => `${v}%`);
  bind("setInvert", "invertY", v => v ? "on" : "off");
  bind("setShift", "shiftMin", v => `${v} min`);
  const tv = $("setTv"), tvV = $("setTvV"); tv.value = tvSet.volume; tvV.textContent = `${tvSet.volume}%`;
  tv.oninput = () => { tvSet.volume = +tv.value; tvV.textContent = `${tvSet.volume}%`; applyTv(); };   // (the same setting as the TV's own picture menu)
  $("mmSettingsBtn").onclick = () => { tv.value = tvSet.volume; tvV.textContent = `${tvSet.volume}%`; show("settings"); };
  $("mmSettingsBack").onclick = () => show("main");
  $("enterHint").style.display = "none"; $("mainMenu").hidden = false;
}
let relockOnInput = false;                        // backed out with Escape: the next click or key (not Escape) takes the mouse back
function backToStore() { relockOnInput = true; keys.clear(); $("crosshair").hidden = true; toast("Click or press any key to get back in", true); }
let posEsc = false;                              // the key that closed the POS was Escape
function escClose() {                          // Escape closes whatever's open over the store; true if something was
  if (cmove.item) { moveCancel(`The ${cmove.item.name}'s back where it was`); return true; }
  if (held && inspecting) { inspecting = false; peek = null; return true; }
  if (tvMenu) { tvMenu = false; return true; }
  if (board.open) { boardClose(); return true; }
  if (sheet.open) { sheetToggle(); return true; }
  return false;
}
canvas.addEventListener("click", () => { relockOnInput = false; if (started && document.pointerLockElement !== canvas && !posTerm?.isOpen() && !shift.report && !hiring.open) canvas.requestPointerLock(); });
document.addEventListener("fullscreenchange", () => document.fullscreenElement ? navigator.keyboard?.lock?.(["Escape"]).catch(() => {}) : navigator.keyboard?.unlock?.());   // fullscreen: Escape comes to us as a key (hold it to leave fullscreen)
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && (posTerm?.isOpen() || shift.report || hiring.open)) { keys.clear(); $("crosshair").hidden = true; return; }   // the mouse was freed for the terminal / the shift slip, not a pause
  if (!locked && started && escClose()) return backToStore();   // Escape backed out of a sub-screen, not a pause
  $("titleScreen").style.display = locked ? "none" : "flex";
  $("crosshair").hidden = !locked;
  paused = !locked && started;
  if (paused && playing && !video.paused) { video.pause(); pausedTape = true; }
  if (locked) { relockOnInput = false; if (pausedTape) { pausedTape = false; video.play().catch(() => {}); } }
  if (locked) {
    if (DEBUG_LVL && !started) for (let i = 0; i < 8; i++) { const c = onShelfCopy(catalog[Math.floor(Math.random() * catalog.length)]); if (c) { setOnShelf(c, false); misshelve(c, null, onShelfCopy(catalog[Math.floor(Math.random() * catalog.length)])); } }   // something for Keen Eye to find
    started = true; window.VaultAmbience?.start();
    if (resumePlay) { const r = resumePlay; resumePlay = null; playEpisode(r.idx, r.tape); }   // restored tape: rolls now that there's been a click
    $("titleScreen").classList.add("paused");
    titleMenu.refresh?.();
  } else { keys.clear(); titleMenu.refresh?.(); if (board.open) boardClose(); }
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  bloomComposer.setSize(innerWidth, innerHeight);
  finalComposer.setSize(innerWidth, innerHeight);   // (each composer sizes its own passes, the glow at its half resolution)
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
  catalog, rented: rentedCopies, budget: SAVE?.budget ?? (SIM ? 300 : 5000),
  activeMembers: SAVE?.members, startMembers: SIM && !SAVE?.members ? 25 : null,   // simulation: a small base to start
  savedOwed: SAVE?.owed, savedRecords: SAVE?.records,
  today: +shiftDate(), clock: () => { const m = Math.floor(shift.h * 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; },   // the shift's date and clock on the screen
  savedRental: c => SAVE?.rentals?.[copyKey(c)],
  unrent(c) { setOnShelf(c, true); const i = rentedCopies.indexOf(c); if (i >= 0) rentedCopies.splice(i, 1); },   // nobody had room for it: back on the shelf
  replace(c) { deliveries.push({ tape: copyKey(c) }); logAct(`Ordered a replacement ${c.title}: arrives tomorrow morning`); },
  supplies: () => stockProducts().map(e => ({ name: e.name, drink: e.drink, spots: e.units.length, out: e.units.filter(u => u.visible).length, back: backstock[e.name] || 0,
    ordered: deliveries.filter(d => d.name === e.name).reduce((a, d) => a + d.qty, 0) + boxes.filter(b => b.name === e.name).reduce((a, b) => a + b.qty, 0), caseCost: caseCost(e), caseQty: CASE_QTY })),
  order: (name, cases) => stockOrder(name, cases),
  schedInfo: { h0: SCHED_H0, slots: SCHED_SLOTS, max: SCHED_MAX },
  staffSched: () => staff.map(e => ({ id: e.id, first: e.first, last: e.last, sched: e.sched, hours: schedHours(e), rate: empRate(e), on: !!e.c })),
  setSched,
  upgrades: () => UPGRADES.filter(u => SIM || !u.sim).map(u => ({ ...u, cost: u.id === "hire" ? hireCost() : u.cost, owned: !u.repeat && owned(u.id),
    ranToday: u.id === "ad" && upg.adDay === shift.day, desc: u.id === "hire" ? (staff.length >= STAFF_MAX ? "THE STAFF ROOM'S FULL" : `3 APPLICANTS · ${staff.length} ON STAFF`) : u.desc })), buyUpgrade: upgBuy,
  theaterOpen: () => owned("theater"), mode: MODE,
  reputation: () => ({ stars: repStars(), v: rep.v }),
  feature: () => show.title && { title: show.title.title, day: show.day === shift.day ? "TONIGHT" : "TOMORROW", sold: show.sold, status: show.status },
  featureChoices: () => catalog.filter(t => t.seasons.length === 1 && t.seasons[0].episodes.length === 1 && onShelfCopy(t))
    .sort((a, b) => (window.VAULT_META?.[b.id]?.[1] || 0) - (window.VAULT_META?.[a.id]?.[1] || 0)).slice(0, 15),
  setFeature: t => showSet(t),
  returnBin: () => returnBin, held: () => held, playing: () => playing,
  requests: t => holds.filter(h => !h.copy && h.title === t).map(h => ({ name: memberName(h.member), at: fmtClock(h.at), alert: !!h.alert })),
  setAlert: (t, on) => { for (const h of holds) if (!h.copy && h.title === t) h.alert = on; },
  alarm: () => gateAlarm.on, silenceAlarm: silenceGateAlarm, resetSave: () => resetSave(),
  gatesArmed: () => gateAlarm.armed, armGates,
  onRedraw(c) {
    if (posTex.image !== c) { posTex.image = c; posScreen.material.map = posTex; posScreen.material.needsUpdate = true; }
    posTex.needsUpdate = true;
  },
  onClose() {                                      // straight back into the store: F10 / Enter count as the gesture, Escape doesn't
    if (hiring.open) return;                     // the applicants are still up: keep the mouse for them
    if (posEsc) return backToStore();
    canvas.requestPointerLock()?.catch?.(() => backToStore());
  },
});
posTerm.idle();
// right-click backs out of the register just like Escape (a screen back, or log off from the main menu);
// being a click, closing it takes the mouse straight back instead of waiting for the next input
$("posTerm").addEventListener("contextmenu", e => e.preventDefault());
$("posTerm").addEventListener("mousedown", e => { if (e.button !== 2 || !posTerm.isOpen()) return; e.preventDefault(); posEsc = false; posTerm.key({ key: "Escape", preventDefault() {} }); });
function openPOS() {
  keys.clear(); $("hoverTip").style.display = "none";
  posTerm.open();
  document.exitPointerLock();
}

// ---------------- clocking out: after close, E on the front doors ----------------
// ends the day: the shift slip (what came in, what walked out, a grade), then
// the next morning, 9:00 with the doors still locked (an hour to get things ready)
function clockOut() {
  keys.clear(); shift.report = true; $("hoverTip").style.display = "none";
  document.exitPointerLock();
  const chk = { bin: returnBin.length, strays: strays.length, messes: messes.length, empty: emptySpots().length, trash: binList().filter(b => b.n >= b.cap * 0.75).length + bagsDown.length + bagCarry.length };   // the closing walk-through: what's been left undone
  const chkPts = -10 * (chk.bin + chk.strays + chk.messes + chk.trash) - 2 * chk.empty;
  const hrs = staff.reduce((a, e) => a + bits(e.sched[weekday()]), 0);
  const wages = SIM ? +staff.reduce((a, e) => a + bits(e.sched[weekday()]) * empRate(e), 0).toFixed(2) : 0; if (wages) posTerm.sale(-wages);   // the staff's pay for the day: their scheduled hours
  if (posTerm.budget() < 0) logAct(`The store's in the red: -$${(-posTerm.budget()).toFixed(2)}. Nothing on the register can be bought until it's back up`, "bad");
  if (chkPts) { shiftScore(chkPts); logAct(`Closing check: ${[chk.bin && `${chk.bin} in the returns bin`, chk.strays && `${chk.strays} misshelved`, chk.messes && `${chk.messes} messes`, chk.trash && `${chk.trash} lots of trash not taken out`, chk.empty && `${chk.empty} empty rack spots`].filter(Boolean).join(", ")}`, "bad", null, chkPts); }
  const s = shift.stats, d = shiftDate(), W = 34, money = n => "$" + n.toFixed(2);
  const row = (k, v) => k + " " + ".".repeat(Math.max(1, W - k.length - String(v).length - 2)) + " " + v;
  const tried = s.served + s.walkouts, score = (tried ? 100 * s.served / tried : 100) - 15 * s.stolen;
  const gradeOf = sc => sc >= 93 ? "A" : sc >= 85 ? "B" : sc >= 75 ? "C" : sc >= 60 ? "D" : "F";
  const repD = !s.visitors ? 0 : Math.max(-10, Math.min(8, { A: 5, B: 3, C: 1, D: -2, F: -5 }[gradeOf(score)] - 2 * s.stolen - Math.floor((chk.messes + chk.trash) / 2) - (s.refunds ? 3 : 0) + (show.status === "done" && show.sold ? 2 : 0)));
  const repWas = repStars(); rep.v = Math.max(0, Math.min(100, rep.v + repD));
  const wom = SIM && s.visitors ? ({ A: 3, B: 2, C: 1 }[gradeOf(score)] || 0) + (repStars() >= 4) + (repStars() >= 5) : 0;   // a good night gets talked about
  growth.pending += wom; growth.prospects = Math.floor(growth.prospects / 2);   // whoever meant to come in today and didn't: half of them lose interest
  if (repD) logAct(`Reputation ${repD > 0 ? "up" : "down"}: ${starStr(repStars())}${repStars() !== repWas ? (repStars() > repWas ? " (a star up!)" : " (a star down)") : ""}`, repD > 0 ? "good" : "bad");
  const grade = !s.visitors ? "-" : score >= 93 ? "A" : score >= 85 ? "B" : score >= 75 ? "C" : score >= 60 ? "D" : "F";
  const line = "-".repeat(W), date = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  $("shiftSlip").textContent = [
    "VAULTBUSTER VIDEO #0417".padStart(28), "END OF SHIFT".padStart(23), "",
    row(`${WEEKDAYS[d.getDay()]} ${date}`, `DAY ${shift.day}`), row("CLOCKED OUT", fmtClock(shift.h)), line,
    row("CUSTOMERS IN", s.visitors), row("RUNG UP", s.served), row("WALKED OUT", s.walkouts),
    row("TAPES RENTED", s.rentals), row("RETURNS CHECKED IN", s.returns), row("SNACK UPSELLS", s.upsells),
    row("SHOPLIFTERS CAUGHT", s.caught), row("TAPES STOLEN", s.stolen), line,
    row("RENTALS", money(s.rentalTake)), row("SNACKS", money(s.snackTake)), row("SHOW TICKETS", money(s.tickets * SHOW.ticket - s.refunds)), row("LATE FEES", money(s.feesCollected)),
    row("FEES WAIVED", money(s.feesWaived)), row("TOTAL TAKE", money(s.rentalTake + s.snackTake + s.feesCollected + s.tickets * SHOW.ticket - s.refunds)),
    ...(wages ? [row(`STAFF WAGES (${hrs} HRS)`, "-" + money(wages))] : []), row("STORE BUDGET", money(posTerm.budget())), line, "CLOSING CHECK",
    row("  LEFT IN RETURNS BIN", chk.bin), row("  MISSHELVED TAPES", chk.strays), row("  MESSES", chk.messes), row("  TRASH NOT TAKEN OUT", chk.trash), row("  EMPTY RACK SPOTS", chk.empty),
    row("  POINTS", chkPts.toLocaleString()), line, "",
    row("REPUTATION", `${starStr(repStars())} ${repD > 0 ? "+" : ""}${repD || "="}`), ...repProgress(),
    ...(SIM ? [row("NEW MEMBERS SIGNED UP", s.signups), row("WORD OF MOUTH: TOMORROW", `+${growth.pending}`)] : []),
    row("STORE SCORE", s.score.toLocaleString()), row("  YOURS", s.you.toLocaleString()), row("  THE STAFF'S", s.dana.toLocaleString()),
    row("  LOST (WALKOUTS, THEFT)", (s.score - s.you - s.dana).toLocaleString()), "", `SHIFT GRADE:  ${grade}`.padStart(22), "", "THANK YOU - BE KIND, REWIND".padStart(30),
  ].join("\n");
  $("shiftReport").style.display = "flex";
}
function beginShift() {                        // first thing in the morning: 9:00, doors locked, you just inside them
  shift.h = SHIFT.start; shift.warp = 0; shift.stats = shiftStats();
  for (const e of staff) { withEmp(e, empDespawn); e.sentHome = false; }   // (they went home overnight: in when their shifts start)
  posTerm.setDate(shiftDate());
  logAct(`— ${WEEKDAYS[shiftDate().getDay()]}, day ${shift.day} —`);
  boxDeliver();                                // yesterday's orders, by the front door
  for (const h of holds) if (h.day < shift.day) { h.day = shift.day; h.at = 11 + Math.random() * 3; h.coming = false; }   // didn't make it in: they'll come today
  phone.next = null;
  if (SIM && growth.pending) {                 // word got around: people will be in today to sign up at the counter
    growth.prospects = (growth.prospects || 0) + growth.pending; growth.pending = 0; growth.pT = 30;
    logAct(`Word's getting around: ${growth.prospects} ${growth.prospects > 1 ? "people" : "person"} might come in to sign up today`, "good");
  }
  setFrontLock(true);
  Object.assign(player, { x: 0, z: 1.4, yaw: Math.PI, pitch: 0 }); gateLastZ = player.z;
  shift.greet = `${WEEKDAYS[shiftDate().getDay()]} · day ${shift.day}. Doors open at 10 — unlock them when you're ready`;
  if (SIM && shift.day === 1) {                // a new simulation: where it goes from here
    logAct("Your store's bare bones for now: no staff, the theater's locked, and part of the library's still to come");
    logAct("Everything it earns goes in the budget. Spend it on the register: U for upgrades, O to order snacks");
    logAct("Reputation builds a night at a time: an A shift moves it most, and a new star takes a few good nights in a row");
  }
  shiftHudTxt = "";
}
function nextShift() {
  shift.report = false; $("shiftReport").style.display = "none";
  shift.day++; beginShift(); saveState();
  const p = canvas.requestPointerLock();
  p?.catch?.(() => { $("titleScreen").style.display = "flex"; });
}
$("shiftNext").addEventListener("click", nextShift);
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
let resumePlay = null, saveOff = !!DEBUG_LVL;
const snackUnits = () => [...new Set(aimables.map(o => o.userData.unit || (o.userData.snack ? o : null)).filter(Boolean))];
function saveState() {
  if (saveOff || !started) return;           // nothing worth keeping until you've been in the store
  const units = snackUnits();
  const item = (e, i) => e.kind === "tape" ? { kind: "tape", key: copyKey(e.ref) }
    : e.kind === "snack" ? { kind: "snack", i: units.indexOf(e.ref), left: i === invSel ? snackLeft : e.left, total: i === invSel ? snackTotal : e.total }
    : { kind: "popcorn", pop: e.ref };
  const data = {
    v: SAVE_V, mode: MODE, log: logData.slice(-60), player: { x: onStool ? stoodAt.x : player.x, z: onStool ? stoodAt.z : player.z, yaw: player.yaw, pitch: player.pitch },   // off the stool: its spot is inside a collider
    phone: { next: phone.next }, holds: holds.map(h => ({ member: h.member.num, title: copyKey(h.title), at: h.at, day: h.day, copy: h.copy && copyKey(h.copy), by: h.by, alert: h.alert })),
    staff: staff.map(e => ({ id: e.id, first: e.first, last: e.last, female: e.female, outfit: e.outfit, skills: e.skills, jobs: e.jobs.map(j => ({ id: j.id, pri: j.pri })), sched: e.sched })),
    you: { skills: you.skills }, rep: rep.v, upg,
    counterItems: Object.fromEntries(counterItemsList().map(it => { const f = cmove.item === it ? cmove.from : null; return [it.id, f ? [f.x, f.z, f.ry] : [+it.g.position.x.toFixed(3), +it.g.position.z.toFixed(3), +it.g.rotation.y.toFixed(3)]]; })), members: SIM ? posTerm.activeNums() : undefined, signups: growth.pending, prospects: growth.prospects, show: show.title && { title: copyKey(show.title), day: show.day, sold: show.sold, status: show.status, spawned: show.spawned },
    lights: zoneOn, shift: { day: shift.day, h: shift.h, date0: shift.date0, stats: shift.stats }, gatesArmed: gateAlarm.armed, frontLocked: frontLock.locked, lamps: lamps.map(l => !!l.userData.on), doors: doors.map(d => d.open), flap: flapOpen, cooler: coolerOpen,
    desens: catalog.flatMap(t => [t, ...(t.copies || [])]).filter(c => c.desens).map(copyKey),
    rented: rentedCopies.map(copyKey), rentals: Object.fromEntries(rentedCopies.map(c => [copyKey(c), posTerm.rentalOf(c)])),
    lost: catalog.flatMap(t => [t, ...(t.copies || [])]).filter(c => c.lost).map(copyKey), budget: posTerm.budget(), owed: posTerm.owedAll(), records: posTerm.recordsAll(),
    stock: { back: backstock, deliveries, boxes: boxes.map(b => ({ name: b.name, qty: b.qty })), empty: snackUnits().map((u, i) => !u.visible && !stockCarry.has(u) && !inv.some(e => e.ref === u) ? i : -1).filter(i => i >= 0),
      carry: inv.map((e, i) => stockCarry.has(e.ref) ? i : -1).filter(i => i >= 0),
      air: +coolerThermo.temp.toFixed(1), warm: snackUnits().map((u, i) => isDrink(u.userData.snack) && drinkTemp(u) > 37 ? [i, +drinkTemp(u).toFixed(1)] : null).filter(Boolean) },
    trash: { bins: Object.fromEntries(binList().map(b => [b.id, b.n])),   // bags in anyone's hands are saved where they're standing
      bags: [...bagsDown.map(g => [g.bin.id, g.n, g.x, g.z]), ...bagCarry.map(g => [g.bin.id, g.n, player.x, player.z]),
        ...staff.filter(e => e.trash?.bag && e.c).map(e => [e.trash.bag.bin.id, e.trash.bag.n, e.c.group.position.x, e.c.group.position.z])].map(([id, n, x, z]) => [id, n, +x.toFixed(2), +z.toFixed(2)]) },
    strays: strays.map(s => [copyKey(s.copy), copyKey(s.at)]), messes: messes.map(m => [m.kind, +m.x.toFixed(2), +m.z.toFixed(2), +m.y.toFixed(2)]), returns: returnBin.map(copyKey), rewinders: rewinders.map(rw => rw.tape && copyKey(rw.tape)),
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
    if (S.lights) for (const z of LIGHT_ZONES) { if (S.lights[z] === false) setZone(z, false); else if (S.lights[z] && !zoneOn[z]) setZone(z, true); }
    else if (S.lightsOut) for (const z of ["front", "aisles", "lounge"]) setZone(z, false);   // an older save: lights out = the sales floor dark...
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
    (S.rewinders || [S.rewinder]).forEach((k, i) => {   // (older saves had the one)
      const c = k && copyByKey(k);
      if (c && rewinders[i]) { setOnShelf(c, false); rewinderLoad(rewinders[i], c, "load"); }   // picks up rewinding from wherever it had got to
    });
    const units = snackUnits();
    for (const it of S.inv || []) {          // re-pick each item up in order, exactly as if you'd grabbed it
      const c = it.kind === "tape" && copyByKey(it.key), u = it.kind === "snack" && units[it.i];
      if ((it.kind === "tape" && !c) || (it.kind === "snack" && !u) || !invMakeRoom()) continue;
      if (c) { setOnShelf(c, false); showTape(c); }
      else if (u) { u.visible = false; showSnack(u); snackLeft = it.left; snackTotal = it.total; snackTag(); }
      else { heldPopcorn = it.pop; popcornVisual(); }
      invSync();
    }
    const st = S.stock;
    if (st) {
      Object.assign(backstock, st.back); deliveries.push(...(st.deliveries || []));
      for (const b of st.boxes || []) { boxes.push(b); boxMake(b); } boxesLayout();
      for (const i of st.empty || []) if (units[i]) units[i].visible = false;
      for (const i of st.carry || []) if (inv[i]?.kind === "snack") stockCarry.add(inv[i].ref);   // (re-picked above: still stock)
      if (st.air != null) { coolerThermo.temp = st.air; coolerThermo.tick(0); }
      for (const [i, t] of st.warm || []) if (units[i]) units[i].userData.temp = t;
    }
    if (S.show) { const t = copyByKey(S.show.title); if (t) Object.assign(show, S.show, { title: t }); }
    upgVisuals();
    for (const it of counterItemsList()) { const c = S.counterItems?.[it.id]; if (c) { it.g.position.set(c[0], COUNTER.y, c[1]); it.g.rotation.y = c[2]; counterMoved(it); } }   // where you'd put the counter things
    for (const h of S.holds || []) {             // promised holds (and what's on the shelf for them)
      const m = posTerm.members.find(m => m.num === h.member), t = copyByKey(h.title), c = h.copy && copyByKey(h.copy);
      if (m && t) { if (c) setOnShelf(c, false); holds.push({ member: m, title: t, at: h.at, day: h.day, copy: c || null, by: h.by, alert: h.alert }); }
    }
    holdsRender();
    for (const [k, at] of S.strays || []) { const c = copyByKey(k), a = copyByKey(at); if (c && a?.pos) { setOnShelf(c, false); misshelve(c, null, a); } }
    for (const [kind, x, z, y] of S.messes || []) if (MESS[kind]) messAdd(kind, x, z, y);
    for (const [id, n, x, z] of S.trash?.bags || []) if (trashBins[id]) bagPlace(trashBins[id], n, x, z);
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
if (!SAVE?.stock) for (const e of stockProducts()) backstock[e.name] ??= CASE_QTY;   // a new store: a case of everything in the cupboards
if (!SAVE?.shift) beginShift();              // a new store (or one saved before the shift clock): day 1, first thing
gateLastZ = player.z;                        // restored position isn't a walk through the gates
counterItemsList();                          // (marks the rewinders, pad and printer as movable)
libLock(); amenities();                     // simulation: what the store hasn't got yet
applySettings();
if (SAVE?.log) { const fresh = logData.splice(0); for (const r of SAVE.log) logAct(r[1], r[2], r[3], r[4], r[0]); for (const r of fresh) logAct(r[1], r[2], r[3], r[4], r[0]); }   // the log picks up where it left off
titleMenu();
setInterval(saveState, 2000);
addEventListener("beforeunload", saveState);
document.addEventListener("visibilitychange", () => { if (document.hidden) saveState(); });

// ---------------- main loop ----------------
const clock = new THREE.Clock();
// ---------------- room culling ----------------
// three.js only culls what's outside the camera's view, not what's behind a
// wall, so from the lobby it still drew the whole store. Every static object
// sits in one room (by its bounding box; anything straddling two stays
// always-on) under that room's group, and a room is drawn only if you're in
// it or can see into it: the hall is open to the store, the store to the
// street, and the lobby and auditorium only while their push doors swing open.
// Lights and anything that moves (you, Dana, customers, the stool, the
// standee) are left alone
const ROOMS = ["out", "store", "boh", "lobby", "theater"];
const roomGroups = Object.fromEntries(ROOMS.map(r => { const g = new THREE.Group(); scene.add(g); return [r, g]; }));
function roomAt(x, z) {
  if (z < 0 || x < WALL_L || x > STORE.x) return "out";
  if (z < STORE.z) return "store";
  if (z < BOH.z1) return x >= BOH.x0 ? "boh" : "lobby";
  return "theater";
}
const roomBox = new THREE.Box3(), roomSeen = new WeakSet(), roomGroupSet = new Set(Object.values(roomGroups));
function roomOf(o) {
  roomBox.setFromObject(o); if (roomBox.isEmpty()) return null;
  const { min, max } = roomBox, e = 0.05;
  const rs = new Set([roomAt(min.x + e, min.z + e), roomAt(max.x - e, min.z + e), roomAt(min.x + e, max.z - e), roomAt(max.x - e, max.z - e)]);
  return rs.size === 1 ? [...rs][0] : null;
}
function roomSort() {                          // file new top-level objects into their rooms (posters load late, so this runs a few times)
  const movers = new Set([me.group, stool.g, cutout.g, ...staff.map(e => e.c?.group), ...custs.map(k => k.c?.group)]);
  for (const o of [...scene.children]) {
    if (roomSeen.has(o) || roomGroupSet.has(o)) continue;
    roomSeen.add(o);
    if (movers.has(o)) continue;
    let skip = false; o.traverse(k => { if (k.isLight || k.isCamera) skip = true; });   // hiding a light would change everyone's lighting (and recompile shaders)
    if (skip) continue;
    const r = roomOf(o); if (r) roomGroups[r].add(o);   // the room groups sit at the origin: world transforms don't change
  }
}
const roomFrustum = new THREE.Frustum(), roomProj = new THREE.Matrix4(), roomPort = new THREE.Vector3();
const roomSortAt = [0.5, 2, 5, 10, 20];       // seconds in
let hallDoor, cinemaDoor;
function regionTick() {
  if (roomSortAt.length && clockT >= roomSortAt[0]) { roomSortAt.shift(); roomSort(); }
  hallDoor ??= doors.find(d => d.push && !d.alongX); cinemaDoor ??= doors.find(d => d.push && d.alongX);
  const open = d => !d || Math.abs(d.a) > 0.01;
  let nearPort = false;                          // the hall door's porthole is a window, shut or not: it counts as open while it's close and on screen
  if (hallDoor && Math.hypot(camera.position.x - hallDoor.at, camera.position.z - hallDoor.c) < STORE.x - BOH.x0 + 1) {   // "close": anywhere down the hall
    camera.updateMatrixWorld(); roomFrustum.setFromProjectionMatrix(roomProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    nearPort = roomFrustum.containsPoint(roomPort.set(hallDoor.at, PORT.y, hallDoor.c));
  }
  const links = [["store", "out", true], ["store", "boh", true], ["boh", "lobby", open(hallDoor) || nearPort], ["lobby", "theater", open(cinemaDoor)]];
  const seen = new Set([roomAt(camera.position.x, camera.position.z)]);
  for (let grew = true; grew;) { grew = false; for (const [a, b, on] of links) if (on && seen.has(a) !== seen.has(b)) { seen.add(a); seen.add(b); grew = true; } }
  for (const r of ROOMS) roomGroups[r].visible = seen.has(r);
}
let clockT = 0;
const ambFwd = new THREE.Vector3(), coolerSndAt = new THREE.Vector3();
let coolerWas = false;
const AMB_ZONES = [["front", 0, 3.45, 3.5], ["aisles", -4, 3.45, 13], ["aisles", 5, 3.45, 16], ["lounge", 0, 3.45, 22.5], ["hall", 6, 2.6, 29], ["breakroom", 5, 2.6, 31.5],
  ["restroom", 9.6, 2.6, 31.5], ["lobby", -2.5, 3, 30.5], ["theater", -3, 5, 38]].map(([zone, x, y, z]) => ({ zone, x, y, z, level: 0 }));   // a hum over each light zone
let paused = false, pausedTape = false;          // the pause screen's up: nothing moves
function ambTick(dt) {
  if (!window.VaultAmbience) return;             // the store's sound: where you're listening from, which lights are humming
  camera.getWorldDirection(ambFwd);
  AMB_ZONES.forEach(z => z.level = zoneLvl[z.zone] ?? 0);
  VaultAmbience.tick({ dt, cam: { x: camera.position.x, y: camera.position.y, z: camera.position.z, fx: ambFwd.x, fy: ambFwd.y, fz: ambFwd.z }, zones: AMB_ZONES,
    night: 1 - tod.level, active: !paused && started && !shift.report && (document.pointerLockElement === canvas || posTerm.isOpen()) });
}
let pausedDrawAt = 0;
renderer.setAnimationLoop(() => {
  if (paused) {                                 // (the store sounds fade out; the frame just sits there, so it's redrawn 4 times a second, not 60)
    clock.getDelta(); ambTick(0);
    const now = performance.now(); if (now - (pausedDrawAt || 0) > 250) { pausedDrawAt = now; renderWithBloom(); }
    return;
  }
  const dt = Math.min(clock.getDelta(), 0.05);
  if (keys.size) lastActive = performance.now();                          // walking counts as moving
  if (trashFlapT > 0) { trashFlapT = Math.max(0, trashFlapT - dt); trashFlap.rotation.x = trashFlapRest + 1.1 * Math.sin((1 - trashFlapT / 0.5) * Math.PI); }    // push flap swings in (bottom edge into the bin) and back
  if (biteGroup) {                                                          // bite / sip: up to the mouth and back
    biteAnim = Math.max(0, biteAnim - dt);
    const k = Math.sin((1 - biteAnim / 0.4) * Math.PI), drink = biteDrink;
    biteGroup.position.set(handGroup.position.x - 0.22 * k, handGroup.position.y + 0.2 * k, handGroup.position.z + 0.12 * k);
    biteGroup.rotation.set(handGroup.rotation.x + (drink ? 1.0 : 0.35) * k, handGroup.rotation.y, handGroup.rotation.z);
    if (!biteAnim) biteGroup = null;
  }
  document.body.classList.toggle("idle", performance.now() - lastActive > 2500);
  clockT += dt;
  for (const m of marquee) {              // marquee chase around the posters
    if (!m.mesh.parent?.parent?.visible) continue;   // its room's culled (see regionTick)
    m.phases.forEach((ph, j) => {
      const v = 0.5 + 0.5 * Math.sin(clockT * 7 + ph);
      m.mesh.setColorAt(j, bulbTmp.setRGB(0.3 + 0.7 * v, 0.27 + 0.62 * v, 0.03 + 0.09 * v));
    });
    m.mesh.instanceColor.needsUpdate = true;
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
  if (!playing) {
    screenMesh.material = tvMenu ? videoMat : screensaverMat;
    if (theaterScreenMesh) theaterScreenMesh.material = tvMenu ? videoMat : screensaverMat;
  }                                               // menu over a blank screen when no tape's in
  if (tvMenu) {                                   // what the crosshair (the remote) is pointing at on the menu
    const hit = tvScreenHit();
    tvHover = hit ? tvMenuHit(hit.x, hit.y) : null;
  }   // pauses while a tape's actually in, like a real screensaver would
  lightingTick(dt);
  shiftTick(dt);
  printerTick(dt);
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
    {                                              // theater sconces: up while nothing's showing, a slow fade out once a film runs
      const want = playing && !video.paused ? 0 : 1, u = TVU.uThSconce;
      u.value += Math.sign(want - u.value) * Math.min(Math.abs(want - u.value), dt / (want ? 2 : 6));   // 2 s up, 6 s down
      if (thSconceMat) thSconceMat.emissiveIntensity = 0.85 * u.value;
    }
    if (projBeamMat) {
      beamU.uBeamOn.value = tvLight.base ? 1 : 0;              // playing: the shader tints by picture section
      projBeamMat.color.setHex(tvLight.base ? 0xffffff : 0xd8e8ff);
      const lookBack = Math.max(0, (Math.cos(player.yaw) + 0.05) / 1.05);     // 0 when facing the screen, >0 when turning back
      const lookUp = Math.max(0, (player.pitch - 0.20) / 0.45);               // 0 at normal viewing pitch, >0 when looking up
      const attention = Math.min(1, Math.max(lookBack, lookUp));
      const darkRoom = 0.45 + 0.55 * (1 - (zoneLvl.theater ?? 1));
      const flicker = 0.95 + 0.05 * Math.sin(clockT * 44) * Math.cos(clockT * 19);
      projBeamMat.opacity = (0.004 + 0.09 * attention * attention) * darkRoom * flicker;
    }
    if (tvBake) { const t0 = performance.now(); while (performance.now() - t0 < 6) if (tvBake.next().done) { tvBake = null; break; } }   // startup shadow bake, a slice per frame
  }
  for (const p of lampPools) p.material.opacity = lightsOut ? 1 : 0;   // overhead fluorescents drown the lamps' own floor pools out entirely
  flapPivot.rotation.z += ((flapOpen ? Math.PI / 2 * 0.97 : 0) - flapPivot.rotation.z) * Math.min(1, dt * 6);   // leaf lifts up against the wall
  flapGate.rotation.y += ((flapOpen ? Math.PI / 2 : 0) - flapGate.rotation.y) * Math.min(1, dt * 5);          // gate swings in behind the counter
  coolerDoor.rotation.y += ((coolerOpen ? 1.75 : 0) - coolerDoor.rotation.y) * Math.min(1, dt * 5);        // cooler door swings out ~100°
  coolerThermo.tick(dt); drinkTempTick(dt); phoneLook(performance.now());
  if (window.VaultAmbience && coolerDoor) {        // its door, and the compressor working (pulling the temperature down, or its idle cycle)
    const at = coolerDoor.getWorldPosition(coolerSndAt);
    if (coolerOpen !== coolerWas) { coolerWas = coolerOpen; VaultAmbience.door("cooler", coolerOpen ? "open" : "close", at.x, 1.1, at.z); }
    VaultAmbience.compressor(at.x, 0.3, at.z, coolerThermo.temp > 36.4 || clockT % 150 < 45);
  }
  for (const d of doors) {                   // doors ease open/closed; a locked one rattles briefly when tried
    if (d.push) { pushDoorTick(d, dt); continue; }
    d.a += ((d.open ? d.openA : 0) - d.a) * Math.min(1, dt * 5);
    if (d.closing && Math.abs(d.a) < 0.04) { d.closing = false; doorSnd(d, "wood", "close"); }
    d.rattle = Math.max(0, d.rattle - dt);
    d.pivot.rotation.y = d.base + d.a + (d.rattle ? 0.012 * Math.sin(d.rattle * 70) : 0);
  }
  move(dt); moveTick(); bathTick(dt);
  if (inv.some(e => e.kind === "tape" && !e.ref.desens) && Math.abs(player.x) < 2 && (gateLastZ - GATE_Z) * (player.z - GATE_Z) < 0) startGateAlarm();   // carried a tape through the gates
  gateLastZ = player.z;
  if (gateAlarm.on) { gateAlarm.t += dt; gateLed.color.set(Math.floor(gateAlarm.t * 5) % 2 ? 0x2a0000 : 0xff1a1a); }
  stoolTick(dt);
  thSeatTick(dt);
  meTick(dt);
  if (onStool) camera.position.copy(me.rig.head.getWorldPosition(meEye)).add(meEye.set(-Math.sin(stool.angle) * 0.06, 0.03, -Math.cos(stool.angle) * 0.06));   // over the collar, a touch forward of it
  else if (seated) camera.position.copy(me.rig.head.getWorldPosition(meEye)).add(meEye.set(Math.sin(seatAt.ry || 0) * 0.06, 0.03, Math.cos(seatAt.ry || 0) * 0.06));   // eyes just above the collar, a touch forward
  else {
    eyeY += ((keys.has("KeyC") ? 1.06 : 1.65) - eyeY) * Math.min(1, dt * 10);   // crouched: just above the squatting body's collar
    camera.position.set(player.x, eyeY + floorHeightAt(player.x, player.z), player.z);
  }
  if (!seated) seatFov = 70;                     // walking resets the couch zoom
  const fovTarget = seated ? seatFov : 70;
  if (Math.abs(camera.fov - fovTarget) > 0.01) { // eased so it feels like leaning in/out
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }
  const dk = dizzyTick(dt);
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch + dk * 0.04 * Math.sin(dizzy.t * 2.1);
  camera.rotation.z = dk * 0.09 * Math.sin(dizzy.t * 1.3);   // the world tipping side to side
  invSync();
  cutoutCarryTick();
  stoolCarryTick();
  custTick(dt);
  empTick(dt);
  trashTick(dt);
  milestoneTick();
  spillTick();
  pickHover();
  if (held) {                               // held-up view is a DOM overlay now, so it can't clip shelves
    handGroup.visible = !inspecting && !coHand.visible;   // 3D box only for the carried-at-your-side pose; hands full with a sale: your own tape waits
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
    ? (seatAt?.toilet ? "Press E to stand up (and pull your pants up)" : "Press E to stand up · right-click the screen for picture settings")
    : aimCouch
      ? (aimSeatObj?.toilet ? "Press E to sit on the toilet" : aimSeatObj ? "Press E to take a seat" : "Press E to sit on the couch")
      : held
        ? `Press E to insert “${held.title}” into the TV`
        : (playing ? "Press E to eject the tape · right-click for picture settings" : "Pick up a tape from the shelves to play it here · right-click for picture settings");
  regionTick();
  cullDarkLights(dt);
  ambTick(dt);
  renderWithBloom();
});
window.__t = {
  catalog, pickup, onE, player,
  held: () => held, playing: () => playing, returnBin,
  setAim: v => { aimTV = v; },
  flapOpen: () => flapOpen, aimFlap: () => !!aimFlap, pickHover,
  doors, toggleDoor, colliders, cutout, cutoutPickUp, cutoutPutDown, cutoutCarryTick, cutoutSpot: () => cutoutSpot,
  setFrontLock, me, stool, stoolPickUp, stoolPutDown, stoolSit, stoolPush, stoolStand, onStool: () => onStool, sitOn: i => { seatAt = SEATS[i]; seated = true; player.yaw = Math.PI; player.pitch = 0; },
  stopSaving: () => { saveOff = true; }, setZone, zoneOn, bath, seatAt: () => seatAt, seated: () => seated, meBody: () => me, cmove, counterItemsList, moveStart, movePlace, roomSort, scene, DESENS_AT, PRN_AT, player, camera, holdPull, jobBoardMesh: () => jobBoardMesh, aimables, JOBS, board, boardOpen, boardKey, danaBestJob, danaJobNow, phone, holds, phoneAnswer, callAnswer, holdPlace, phoneTick, growth, doors, colliders, show, rep, upg, upgBuy, showSet, coStart, coolerThermo: () => coolerThermo, drinkTempTick, drinkTemp, stockTake, stockPlace, emptySpots, backstock, boxes, boxCarry, boxPick, boxUnpack, stockOrder, strays, misshelve, messes, messAdd, messClean, snackUnits, inv: () => inv, stockCarry, custAsks, custWant, custAskGo, custHandTape, custAllOut, rushLevel, custMax, catchDecide, catchCall: () => catchCall, navGrid, navPath, shift, clockOut, beginShift, gateAlarm, startGateAlarm, co: () => co, coAct, coOffer, coFees, coStep: () => coStep(), printer, custSneak, custCatch, custs, custLine, empTick, custTick, empToggle, custSpawn, custGo, CUST_COUNTER, setOnShelf, refreshReturnsBin, rewinders, posTerm, rentedCopies, custInteract, custGone, snackSpots, custDone,
  staff, you, gainXp, lv, xpToNext, onDuty, sendHome, setSched, schedHours, weekday, SHIFT, trashBins, trashAdd, binBag, bagCarry, bagsDown, bagsSetDown, bagPickUp, chuteDrop, chute, trashTick, trashJob, hiring, hireOpen, hirePick, hireCost, sheet, sheetToggle, rollApplicant, STAT_TOTAL,
};