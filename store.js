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
const frontAt = y => BAY.depth - (BAY.depth - BAY.top) * y / BAY.h;
const LEAN = 10 * Math.PI / 180;                  // tapes tip back against each shelf's backing board
const CAP = BAY.rows * BAY.perRow;                 // 44 tapes per bay face (face-out covers)
const SLOT_W = 0.13, TAPE = { w: 0.032, h: 0.192, d: 0.105 }; // slot = cover + ≤1/4-tape spread
const AISLE = { z0: 5.5, segBays: 2, segBaysTV: 4, gap: 3.3, corridor: 3 }; // split bands, center corridor; segBays caps Movies chains (compact 2x2 clusters — far fewer titles), segBaysTV caps TV Shows chains
// Movies' side wall pulled in from the original symmetric ±STORE.x so its gap
// to the nearest shelf endcap (-4.76) matches TV Shows' gap to its wall
// (2.98, from its endcap at 8.02) — see the aisle-layout section for that math.
// Right/back/front-right stay at the original STORE.x scale.
const WALL_L = -7.74;
const WALL_SHIFT = WALL_L + STORE.x;       // how far the movie-side wall (and everything anchored to it) moves in, ~3.26
const SNACKS = [["#e63946", "STARBITES"], ["#2a9d8f", "MINT CHILL"], ["#f4a300", "CHOC BOMB"], ["#8e44ad", "GRAPE ZAP"],
  ["#e76f51", "FRUIT POP"], ["#3d5a80", "LICORICE"], ["#ff6b6b", "RED HOTZ"], ["#457b9d", "BLUE RAZZ"]];
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
let setExteriorDay;                        // (isDay) => ... — swaps the exterior's own day/night rig; wired up below, called from setLights
const exteriorClouds = [];                 // drifted a little each frame, see the main loop
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

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
// subtle by default (lights on) — setLights() turns it up a bit for the dark
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
function renderWithBloom() {
  scene.traverse(o => {
    if (o.isMesh && !bloomLayer.test(o.layers)) { hiddenMaterials.set(o, o.material); o.material = darkMaterial; }
  });
  bloomComposer.render();
  hiddenMaterials.forEach((m, o) => o.material = m);
  hiddenMaterials.clear();
  finalComposer.render();
}

const catalog = window.VAULT_CATALOG || [];
// video-store shelving: alphabetical ignoring a leading The/A/An, then seasons
// 1,2,3… with specials (season 0) and uncoded "Episodes" (-1) after the last
const shelfKey = t => t.title.replace(/^(the|an?)\s+/i, "");
const seasonRank = t => (t.season ?? 0) > 0 ? t.season : 1000 - (t.season ?? 0);
// covers.js (fetch-covers.mjs): this season's TMDB poster, else the show's, else the old VaultVision art
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
const ceilTex = makeTexture((ctx, W, H) => {
  ctx.fillStyle = "#cdd3da"; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#aab2bd"; ctx.lineWidth = 6;
  ctx.strokeRect(0, 0, W, H); ctx.strokeRect(W / 2, 0, W / 2, H);
}, 256, 256);
ceilTex.repeat.set(22, 28);

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
let panelMats = [];                        // ceiling panel groups — dimmed in lights-out, flicker independently on warm-up
const allLights = [];                      // every light that lights-out kills (base intensity in userData.on)
const aimables = [];                       // E targets: TV screen, couch, lamps, returns counter, snack stand
const lampPools = [];                      // side-lamp floor pools — drowned out whenever the overhead lights are on
const lamps = [];                          // the two side lamps — holding L toggles both together

// ---------------- store shell ----------------
function box(w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z); scene.add(b); return b;
}
{
  // interior footprint is asymmetric: movies' side wall (XL) is pulled in from
  // the original -STORE.x; the right/back/front-right stay at the original scale
  const XL = WALL_L, XR = STORE.x, XC = (XL + XR) / 2, XW = XR - XL;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(XW, STORE.z), mat.carpet);
  floor.rotation.x = -Math.PI / 2; floor.position.set(XC, 0, STORE.z / 2); scene.add(floor);
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
  box(XW, H, T, mat.wall, XC, H / 2, Z);                                    // back
  box(T, H, Z, mat.wall, XL, H / 2, Z / 2);                                 // left
  box(T, H, Z, mat.wall, XR, H / 2, Z / 2);                                 // right
  // blue stripe around the walls at eye height
  [[XC, 2.25, Z - T / 2 - 0.012, XW, 0], [XC, 2.25, T / 2 + 0.012, XW, 0],
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
  }

  // fluorescent ceiling panels (merged per group, emissive) — split into a
  // handful of independently-lit groups so warm-up flicker (see setLights)
  // can hit some panels and not others, like real fluorescents restriking
  const PANEL_GROUPS = 6;
  const panelBuckets = Array.from({ length: PANEL_GROUPS }, () => []);
  for (let x = -10; x <= 10; x += 2.7) for (let z = 3; z <= 27; z += 3.7) {
    if (x < XL + 1) continue;                // don't float panels past the pulled-in movie-side wall
    const p = new THREE.PlaneGeometry(1.2, 0.6); p.rotateX(Math.PI / 2); p.translate(x, STORE.h - 0.03, z);
    panelBuckets[Math.floor(Math.random() * PANEL_GROUPS)].push(p);
  }
  panelMats = panelBuckets.filter(b => b.length).map(bucket => {
    const m = new THREE.MeshBasicMaterial({ color: 0xf8fbff });
    scene.add(new THREE.Mesh(mergeGeometries(bucket), m));
    return m;
  });

  // lighting
  const dir = new THREE.DirectionalLight(0xffffff, 0.55); dir.position.set(3, 10, -6);
  const lobby = new THREE.PointLight(0xfff2cc, 0.7, 14, 2); lobby.position.set(0, 3.2, 3);
  [new THREE.HemisphereLight(0xdfe8ff, 0x223355, 1.15), new THREE.AmbientLight(0xffffff, 0.32),
   dir, lobby].forEach(l => { l.userData.on = l.intensity; allLights.push(l); scene.add(l); });
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
  const sodiumLens = glowMat(0x3a2e1c, 0xffae4a, 1.6);
  const streetLamp = (x, z) => {
    const armLen = 1.6, hy = 6.0, hz = z + armLen + 0.25;
    ecyl(0.26, 0.3, 0.5, mat.sidewalk, x, 0.25, z, 14);                     // concrete footing
    ecyl(0.06, 0.08, 5.6, poleMat, x, 0.5 + 2.8, z, 10);                    // pole
    eb(0.08, 0.08, armLen, poleMat, x, hy, z + armLen / 2);                 // arm out over the stalls
    eb(0.46, 0.16, 0.8, poleMat, x, hy - 0.02, hz);                         // head housing
    eb(0.36, 0.02, 0.62, sodiumLens, x, hy - 0.11, hz).layers.enable(BLOOM_LAYER);
    const spot = nightLight(new THREE.SpotLight(0xffae4a, 0, 16, 0.72, 0.55, 1.5), 16);
    spot.position.set(x, hy - 0.15, hz);
    spot.target.position.set(x, 0, hz); scene.add(spot.target);
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
    nightLight(new THREE.PointLight(0xffcf7a, 0, 9, 1.5), 4).position.set(px, 3.15, pz);
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
  // Warm sun by day, cool pale-blue moon by night; setLights() below picks
  // which one's live, in sync with the store's own lights toggle.
  const sun = new THREE.DirectionalLight(0xfff3d9, 0.95); sun.position.set(12, 30, -8);
  const sunFill = new THREE.HemisphereLight(0xaed4f5, 0x4c6a3c, 0.75);
  const moon = new THREE.DirectionalLight(0xaec2e8, 0.5); moon.position.set(-14, 26, -10);
  const moonFill = new THREE.HemisphereLight(0x2c3d68, 0x05070f, 0.55);
  [sun, sunFill, moon, moonFill].forEach(l => { l.layers.set(EXTERIOR_LAYER); scene.add(l); });
  setExteriorDay = isDay => {
    sun.intensity = isDay ? 0.95 : 0; sunFill.intensity = isDay ? 0.75 : 0;
    moon.intensity = isDay ? 0 : 0.5; moonFill.intensity = isDay ? 0 : 0.55;
    const sky = isDay ? DAY_SKY : MOON_SKY;
    scene.background.set(sky); backdrop.material.color.set(sky);
    for (const l of nightLights) l.intensity = isDay ? 0 : l.userData.on;         // street + park lamps: night only
    for (const m of nightGlows) m.emissiveIntensity = isDay ? 0 : m.userData.on;
  };
  setExteriorDay(true);          // matches lightsOut's default (false) — moon/moonFill start off, not double-lit with the sun
}

// ---------------- lobby + back wall dressing ----------------
const colliders = [];
function solid(w, h, d, m, x, y, z) { colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); return box(w, h, d, m, x, y, z); }
let returnSlotMesh;                          // the E target for the returns counter, set below
let flapPivot, flapCollider;                  // the register pass-through flap, set below
{
  // checkout cluster shifts in from the wall by the same amount the movie-side
  // wall was pulled in, so it keeps its original ~0.4m clearance from it
  const CX = -9 + WALL_SHIFT;
  solid(3.2, 1.0, 0.7, mat.counter, CX, 0.5, 4);                             // checkout counter
  solid(3.2, 0.08, 0.78, mat.counterTop, CX, 1.04, 4);
  box(0.5, 0.3, 0.4, mat.dark, CX, 1.23, 4);                                 // register

  // returns counter — rotated 90° off the checkout's line so it turns the
  // corner instead of extending it, tucked flush behind checkout's east edge
  // (not jutting out over the shop floor) and running south from that same
  // corner — toward the door — instead of north, so it sits close to the
  // entrance rather than deep in the register nook
  const RX = -4.49, RZ0 = 3.65, RLEN = 1.3;    // RX flush with checkout's east edge; RZ0 = checkout's south (customer) edge
  const RCZ = RZ0 - RLEN / 2;                  // returns' own center z — its north end touches RZ0, it runs south from there
  solid(0.7, 1.0, RLEN, mat.counter, RX, 0.5, RCZ);
  solid(0.78, 0.08, RLEN, mat.counterTop, RX, 1.04, RCZ);
  returnSlotMesh = box(0.1, 0.03, 0.7, mat.dark, RX + 0.3, 1.085, RCZ);   // east face, facing the shop floor
  returnSlotMesh.userData.returns = true; aimables.push(returnSlotMesh);
  // mounted right on the counter's own blue face, not floating on a riser above it
  const rb = textPlane("RETURNS", 1.1, 0.32, "#001f5c", "#ffd400"); rb.position.set(RX + 0.36, 0.55, RCZ); rb.rotation.y = Math.PI / 2;
  rb.material = new THREE.MeshLambertMaterial({ map: rb.material.map }); // lit by the room, no unlit glow in the dark
  scene.add(rb);

  // second counter, touching the front (door) wall, in line with returns —
  // the gap between the two (now much shorter, since returns moved toward
  // the wall) is the register's only way in, gated by a hinged pass-through
  // flap rather than an open doorway
  const FRONT = 0.1;                           // front wall's inner face
  const GAP = 0.9;                             // walkway + flap width
  const returnsSouthZ = RZ0 - RLEN;            // returns' own south edge, where the flap picks up
  solid(0.7, 1.0, returnsSouthZ - GAP - FRONT, mat.counter, RX, 0.5, FRONT + (returnsSouthZ - GAP - FRONT) / 2);
  solid(0.78, 0.08, returnsSouthZ - GAP - FRONT, mat.counterTop, RX, 1.04, FRONT + (returnsSouthZ - GAP - FRONT) / 2);
  const hours = textPlane("OPEN 10A-12A DAILY", 0.9, 0.22, "#001f5c", "#fff");  // little tented countertop placard
  hours.position.set(RX, 1.22, FRONT + 0.25); hours.rotation.x = -0.3; hours.rotation.y = Math.PI; scene.add(hours);  // faces the doors, first thing you see coming in
  const flapZ0 = returnsSouthZ - GAP;          // hinge line — the flap swings up from here
  flapPivot = new THREE.Group(); flapPivot.position.set(RX, 1.04, flapZ0); scene.add(flapPivot);
  const flapMesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, GAP), mat.counterTop);
  flapMesh.position.set(0, 0, GAP / 2);        // closed: lies flush, flush with the counters on either side
  flapPivot.add(flapMesh);
  flapMesh.userData.flap = flapPivot; aimables.push(flapMesh);
  flapCollider = { x0: RX - 0.35, x1: RX + 0.35, z0: flapZ0, z1: returnsSouthZ };
  colliders.push(flapCollider);                // starts closed/blocked; toggleFlap() adds/removes this

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

// ---------------- lobby extras: tile entry, snacks, popcorn ----------------
// real video stores tiled the entry/checkout zone and carpeted the aisles —
// same trick here: a checkerboard plane laid right over the carpet up front.
{
  const tileTex = makeTexture((ctx, W, H) => {
    const n = 8;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#c9ccd1" : "#eef0f3"; ctx.fillRect(x * W / n, y * H / n, W / n, H / n);
    }
  }, 256, 256);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping; tileTex.repeat.set(11, 3);
  const XC = (WALL_L + STORE.x) / 2, XW = STORE.x - WALL_L;
  const tile = new THREE.Mesh(new THREE.PlaneGeometry(XW, AISLE.z0), new THREE.MeshLambertMaterial({ map: tileTex }));
  tile.rotation.x = -Math.PI / 2; tile.position.set(XC, 0.003, AISLE.z0 / 2); scene.add(tile);
}
{
  // snack rack against the (moved) movie-side wall, out on the carpet past the
  // checkout — the strip between the doors and the counter is employees-only,
  // so customer fixtures live on the shop-floor side instead. Sits in aisle 1's
  // empty stretch (west has no shelving there), facing the center of the store.
  const SX = WALL_L + 0.35, SZ = 7.2;
  const candyTex = makeTexture((ctx, W, H) => {
    ctx.fillStyle = "#0f1116"; ctx.fillRect(0, 0, W, H);
    const cols = 2, rows = 4, pad = 10, cw = (W - pad * (cols + 1)) / cols, ch = (H - pad * (rows + 1)) / rows;
    SNACKS.forEach(([c, label], i) => {
      const cx = i % cols, cy = Math.floor(i / cols), x = pad + cx * (cw + pad), y = pad + cy * (ch + pad);
      ctx.fillStyle = c; ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = "#ffffff88"; ctx.lineWidth = 2; ctx.strokeRect(x, y, cw, ch);
      ctx.fillStyle = "#fff"; ctx.font = "bold 17px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(label, x + cw / 2, y + ch / 2);
    });
  }, 256, 512);
  solid(0.3, 1.1, 1.0, mat.counter, SX, 0.55, SZ);                           // cabinet (collider)
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.06), new THREE.MeshBasicMaterial({ map: candyTex }));
  face.position.set(SX + 0.16, 0.55, SZ); face.rotation.y = Math.PI / 2; scene.add(face);
  face.userData.snackStand = true; aimables.push(face);
  const label = textPlane("SNACKS", 0.9, 0.22, "#001f5c", "#ffd400"); label.position.set(SX + 0.17, 1.22, SZ);
  label.rotation.y = Math.PI / 2; scene.add(label);

  // popcorn cart, further along the same empty stretch of wall
  const PX = WALL_L + 0.52, PZ = 8.8;
  const popTex = makeTexture((ctx, W, H) => {
    for (let x = 0; x < 8; x++) { ctx.fillStyle = x % 2 ? "#e63946" : "#fff8e7"; ctx.fillRect(x * W / 8, 0, W / 8, H); }
  }, 256, 256);
  solid(0.62, 0.72, 0.62, new THREE.MeshLambertMaterial({ map: popTex }), PX, 0.36, PZ);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.3, 0.32, 16),
    new THREE.MeshLambertMaterial({ color: 0xfff3d0, transparent: true, opacity: 0.4 }));
  dome.position.set(PX, 0.88, PZ); scene.add(dome);
  const corn = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 10),
    new THREE.MeshLambertMaterial({ color: 0xffd76b })); corn.position.set(PX, 0.63, PZ); scene.add(corn);
  const psign = textPlane("POPCORN", 0.5, 0.18); psign.position.set(PX + 0.33, 0.5, PZ); psign.rotation.y = Math.PI / 2; scene.add(psign);
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
      const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
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
  const backXs = [...spread(WALL_L + CORNER, -3.2, 2), ...spread(3.2, STORE.x - CORNER, 2)];
  frontXs.forEach((x, i) => placePoster(picks[i], x, 2.1, 0.26, 0, i));
  backXs.forEach((x, i) => placePoster(picks[4 + i], x, 2.1, STORE.z - 0.26, Math.PI, 4 + i));
  for (let s = 0; s < 16; s++) {           // regular run down both bare side walls, mounted on the beam
    const side = s < 8 ? -1 : 1, i = 8 + s;
    const wx = side < 0 ? WALL_L + 0.36 : STORE.x - 0.36;   // hug whichever wall (movie side pulled in)
    placePoster(picks[i], wx, 2.1, 2.6 + (s % 8) * 3.25, -side * Math.PI / 2, i);
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
const tapeByCell = []; // cell index -> tape
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
  tapeByCell[cell] = tape; tape.cell = cell;
  // real cover art from art/, painted over the placeholder once it loads
  if (tape.art) artLoader.load(artUrl(tape.art), tex => {
    const img = tex.image;                    // TextureLoader hands back a Texture, not an <img>
    const s = Math.max((CW - 4) / img.width, (CH - 4) / img.height);
    const sw = (CW - 4) / s, sh = (CH - 4) / s;
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x0 + 2, y0 + 2, CW - 4, CH - 4);
    a.texture.needsUpdate = true;
    tape.sideMat = sideMatFor(img);
    if (tape.bodyMesh) tape.bodyMesh.material = tape.sideMat;   // art usually lands after the shelves are built
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
const faceMeshes = [];
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
function mergeIntoTail(tail, next, label) {
  const rowsUsed = Math.ceil(tail.length / BAY.perRow);
  const headerStart = rowsUsed * BAY.perRow;
  const contentStart = headerStart + BAY.perRow;
  const avail = Math.max(0, CAP - contentStart);
  const headCount = tail.length ? Math.min(next.length, avail) : 0;   // no tail = no leftover row to share
  const arr = new Array(CAP).fill(null);
  tail.forEach((t, i) => arr[i] = t);
  for (let i = 0; i < headCount; i++) arr[contentStart + i] = next[i];
  return { arr, header: headCount ? { index: headerStart, label } : null, leftover: next.slice(headCount) };
}
// cover-face center of a tape leaning back LEAN on shelf row r, its top resting
// on that row's backing (which stands where the next row's front edge is)
function leanAt(r) {
  const y0 = BAY.boardY[r] + 0.02, back = frontAt(BAY.boardY[r + 1] ?? BAY.h);
  const sn = Math.sin(LEAN), cs = Math.cos(LEAN);
  const xb0 = back + TAPE.h * sn + 0.002;          // bottom-back corner, so the top-back corner just touches
  return { cx: xb0 - TAPE.h / 2 * sn + (TAPE.w + 0.001) * cs, cy: y0 + TAPE.h / 2 * cs + (TAPE.w + 0.001) * sn };
}
function buildFace(tapes, ax, az, s, m, headers = []) {   // s: faces ±z, m: extends ±x along the band; headers: mid-run category signs on an otherwise-empty row
  const nBays = Math.max(1, Math.ceil(tapes.length / CAP));
  // +m runs to the shopper's left on m>0 faces (either rotation), so mirror
  // bay and slot order there — every face then reads left→right, top→bottom
  const flip = m > 0;
  const place = k => {
    const rem = k % CAP, row = BAY.rows - 1 - Math.floor(rem / BAY.perRow); // fill top-down: partial faces keep tapes at eye level
    let bay = Math.floor(k / CAP), slot = rem % BAY.perRow;
    if (flip) { bay = nBays - 1 - bay; slot = BAY.perRow - 1 - slot; }
    return { row, bay, lz: m * (bay * BAY.len + 0.08 + (slot + 0.5) * SLOT_W) };
  };
  const covers = [], bodies = [], boards = [], uprights = [], backings = [];
  tapes.forEach((tape, k) => {
    if (!tape) { covers.push(null); bodies.push(null); return; }   // reserved gap: header row or unused slot
    const { row, lz } = place(k);
    const { cx, cy } = leanAt(row);
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
  const riseTo = r => BAY.boardY[r + 1] ?? BAY.h;
  for (let bay = 0; bay < nBays; bay++) {
    const zc = m * (bay * BAY.len + BAY.len / 2), zl = BAY.len - 0.05;
    BAY.boardY.forEach((y, r) => {
      const d = frontAt(y);
      const g = new THREE.BoxGeometry(d, 0.04, zl); g.translate(d / 2, y, zc); boards.push(g);
      // spans top of this board → underside of the next board/cap (overlap z-fights)
      const xb = frontAt(riseTo(r)), y0 = y + 0.02, y1 = riseTo(r) - (r < BAY.rows - 1 ? 0.02 : 0.04);
      const w = new THREE.BoxGeometry(0.015, y1 - y0, zl); w.translate(xb - 0.0075, (y0 + y1) / 2, zc); backings.push(w);
    });
    const cap = new THREE.BoxGeometry(BAY.top, 0.04, zl); cap.translate(BAY.top / 2, BAY.h - 0.02, zc); uprights.push(cap);
    const kick = new THREE.BoxGeometry(0.02, BAY.boardY[0], zl);                  // toe kick under the bottom shelf
    kick.translate(frontAt(0) - 0.03, BAY.boardY[0] / 2, zc); uprights.push(kick);
  }
  const side = new THREE.Shape([[0, 0], [BAY.depth, 0], [BAY.top, BAY.h], [0, BAY.h]].map(([x, y]) => new THREE.Vector2(x, y)));
  for (let b = 0; b <= nBays; b++) {        // blue wedge end panels at every bay boundary
    const u = new THREE.ExtrudeGeometry(side, { depth: 0.05, bevelEnabled: false }); u.translate(0, 0, m * b * BAY.len - 0.025); uprights.push(u);
  }

  const group = new THREE.Group();
  // s>0 face looks +z (front of store), s<0 looks -z; both span ax → ax±len along x
  group.rotation.y = s > 0 ? -Math.PI / 2 : Math.PI / 2;
  group.position.set(ax, 0, az);
  // covers can live in different atlases — merge per atlas, one mesh each
  const bucket = new Map();
  tapes.forEach((tape, k) => {
    if (!tape) return;
    const a = Math.floor(tape.cell / CELLS);
    if (!bucket.has(a)) bucket.set(a, []);
    bucket.get(a).push(k);
  });
  for (const [a, ks] of bucket) {
    // ponytail: replaced mergeGeometries with individual meshes for file:// support
    ks.forEach(k => {
      const m = new THREE.Mesh(covers[k], atlases[a].material);
      m.userData.face = { group, tapes, atlas: a };
      tapes[k].coverMesh = m;
      faceMeshes.push(m); group.add(m);
    });
  }
  bodies.forEach((g, k) => {
    if (!g) return;
    const bm = new THREE.Mesh(g, tapes[k].sideMat || mat.tapeBody);
    tapes[k].bodyMesh = bm;
    group.add(bm);
  });
  boards.forEach(g => group.add(new THREE.Mesh(g, mat.board)));
  backings.forEach(g => group.add(new THREE.Mesh(g, mat.backing)));
  uprights.forEach(g => group.add(new THREE.Mesh(g, mat.upright)));
  // header strip on the top backing, above the top row of tapes; genre labels live on the endcaps
  const cat = tapes.find(Boolean).category;
  if (!catStripMat[cat]) catStripMat[cat] = stripTexture(cat);
  for (let bay = 0; bay < nBays; bay++) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(BAY.len - 0.1, 0.16), catStripMat[cat]);
    h.position.set(BAY.top + 0.002, 1.85, m * (bay * BAY.len + BAY.len / 2));
    h.rotation.y = Math.PI / 2; group.add(h);
  }
  // mid-run sign: a slim category riding the leftover shelf space gets its
  // own small placard on the empty row, right above where its tapes start
  headers.forEach(({ index, label }) => {
    if (!catStripMat[label]) catStripMat[label] = stripTexture(label);
    const { row, bay } = place(index);
    const { cx, cy } = leanAt(row);
    const lz = m * (bay * BAY.len + 0.08 + BAY.perRow * SLOT_W / 2);
    const hp = new THREE.PlaneGeometry(BAY.perRow * SLOT_W - 0.1, TAPE.h);
    hp.rotateY(Math.PI / 2); hp.rotateZ(LEAN); hp.translate(cx, cy, lz);
    group.add(new THREE.Mesh(hp, catStripMat[label]));
  });
  scene.add(group);
  group.updateMatrixWorld(true);
  // world-space slot position per tape (for hover highlight)
  tapes.forEach((tape, k) => {
    if (!tape) return;
    const { row, lz } = place(k);
    const { cx, cy } = leanAt(row);
    tape.pos = new THREE.Vector3(cx, cy, lz).applyMatrix4(group.matrixWorld);
  });
  const dx = (s > 0 ? -m : m) * nBays * BAY.len;
  colliders.push({ x0: Math.min(ax, ax + dx), x1: Math.max(ax, ax + dx),
                   z0: s > 0 ? az : az - BAY.depth, z1: s > 0 ? az + BAY.depth : az });
  return nBays * BAY.len;
}

// ---------------- aisle layout ----------------
// movies (single-episode tapes) west, shows east, split by a center corridor
{
  const chunk = ts => { const out = []; for (let i = 0; i < ts.length; i += CAP * 2) out.push({ tapes: ts.slice(i, i + CAP * 2), headers: [] }); return out; }; // ≤2 bays per face
  const nbays = f => Math.max(1, Math.ceil(f.tapes.length / CAP));
  // Group a tape list into per-category units (bay count + ≤2-bay chunk
  // faces), in orderList sequence. Any [prev, next] pair in merges folds
  // next's tapes into the leftover shelf space at the end of prev's last
  // (partial) bay — see mergeIntoTail — instead of next getting its own faces.
  const buildUnits = (list, orderList, merges) => {
    const byCat = new Map();
    for (const t of list) { if (!byCat.has(t.category)) byCat.set(t.category, []); byCat.get(t.category).push(t); }
    const mergedAway = new Set(merges.map(([, next]) => next));
    const order = [...orderList.filter(c => byCat.has(c)), ...[...byCat.keys()].filter(c => !orderList.includes(c) && !mergedAway.has(c))];
    const units = [];
    for (const c of order) {
      if (mergedAway.has(c)) continue;                  // folded into its predecessor's tail, below
      const ts = byCat.get(c);
      const merge = merges.find(([prev]) => prev === c);
      if (!merge || !byCat.has(merge[1])) { units.push({ bays: nbays({ tapes: ts }), faces: chunk(ts) }); continue; }
      const tailCount = ts.length % CAP;
      const main = ts.slice(0, ts.length - tailCount), tail = ts.slice(ts.length - tailCount);
      const { arr, header, leftover } = mergeIntoTail(tail, byCat.get(merge[1]), merge[1]);
      const faces = [...chunk(main), { tapes: arr, headers: header ? [header] : [] }, ...chunk(leftover)];
      units.push({ bays: faces.reduce((a, f) => a + nbays(f), 0), faces });
    }
    return units;
  };
  // A category (or merge-pair) larger than one aisle's cap gets its own
  // dedicated chain(s), filled front-to-back so it never has to resume in a
  // later aisle; whatever's left in its last chain is offered up as slack.
  // Smaller categories then best-fit into that slack (tightest gap first)
  // before opening a fresh chain, so slim categories like Reality TV land in
  // the room a bigger one left behind instead of needing shelving of their own.
  const packTight = (units, hardCap) => {
    const big = units.filter(u => u.bays > hardCap);
    const small = units.filter(u => u.bays <= hardCap).sort((a, b) => b.bays - a.bays);
    const chains = [];                      // [{ used, faces }]
    const gaps = [];                        // [{ ci, room }] leftover room in a chain
    for (const u of big) {
      let rem = u.faces.slice();
      while (rem.length) {
        const c = { used: 0, faces: [] };
        while (rem.length && c.used + nbays(rem[0]) <= hardCap) { const f = rem.shift(); c.used += nbays(f); c.faces.push(f); }
        chains.push(c);
        if (c.used < hardCap) gaps.push({ ci: chains.length - 1, room: hardCap - c.used });
      }
    }
    for (const u of small) {
      gaps.sort((a, b) => a.room - b.room);
      const g = gaps.find(g => g.room >= u.bays);
      if (g) {
        chains[g.ci].faces.push(...u.faces); chains[g.ci].used += u.bays; g.room -= u.bays;
        if (!g.room) gaps.splice(gaps.indexOf(g), 1);
      } else {
        const c = { used: u.bays, faces: u.faces.slice() };
        chains.push(c);
        if (c.used < hardCap) gaps.push({ ci: chains.length - 1, room: hardCap - c.used });
      }
    }
    return chains.map(c => c.faces);
  };
  // movies west, shows east — but a genre with fewer movies than a full row
  // joins its shows section instead of stranding across the store; two
  // Stephen King TV-movie miniseries (multi-part, so not caught by the
  // single-episode movie check) join the Movies shelf by name instead
  const TV_MOVIE_IDS = new Set(["TheShining1997", "Tommyknockers"]);
  const mvCount = new Map();
  for (const t of catalog) if (t.seasons[0].episodes.length === 1) mvCount.set(t.category, (mvCount.get(t.category) || 0) + 1);
  const westList = [], eastList = [];
  for (const t of catalog) {
    const isMovie = t.seasons[0].episodes.length === 1 && mvCount.get(t.category) >= BAY.perRow;
    (isMovie || TV_MOVIE_IDS.has(t.id) ? westList : eastList).push(t);
  }

  // east categories: three slim ones (Anime, Music, Broadcast Blocks) fold into
  // the leftover shelf space at the end of the bigger category right before
  // them — see mergeIntoTail — instead of each claiming a whole extra bay
  const EAST_ORDER = ["Music", "Animation", "Anime", "Kids & Educational", "Sitcoms", "Classic Sitcoms",
    "Drama & Adventure", "Horror & Anthology", "Sketch Comedy & Late Night", "Broadcast Blocks", "Reality TV"];
  const eastUnits = buildUnits(eastList, EAST_ORDER,
    [["Animation", "Anime"], ["Horror & Anthology", "Music"], ["Sketch Comedy & Late Night", "Broadcast Blocks"]]);

  // movies side: same leftover-shelf treatment for its two slim genres —
  // Action & Adventure's overflow (past Comedy's last bay) and all of
  // Holiday ride into Comedy's and Horror's leftover shelf space respectively
  const WEST_ORDER = ["Comedy", "Action & Adventure", "Sci-Fi & Fantasy", "Horror", "Drama", "Family & Kids", "Holiday"];
  const westUnits = buildUnits(westList, WEST_ORDER, [["Comedy", "Action & Adventure"], ["Horror", "Holiday"]]);

  const eastChains = packTight(eastUnits, AISLE.segBaysTV);
  // movies have far fewer titles: pack them tight into 2-bay-deep double-sided
  // clusters, and don't start until the 2nd aisle (an empty aisle 1 on the
  // movies side, matching how sparse it is relative to TV Shows)
  const westChains = [[], [], ...packTight(westUnits, AISLE.segBays)];
  const maxLen = Math.max(eastChains.length, westChains.length);
  const nCh = maxLen % 2 ? maxLen + 1 : maxLen;
  while (eastChains.length < nCh) eastChains.push([]);   // pad so west/east bands stay aligned
  while (westChains.length < nCh) westChains.push([]);
  const west = westChains, east = eastChains;
  const build = (chains, h) => chains.forEach((chain, ci) => {
    if (!chain.length) return;
    const az = AISLE.z0 + Math.floor(ci / 2) * (2 * BAY.depth + AISLE.gap) + BAY.depth; // band plane
    const dir = ci % 2 ? 1 : -1;            // odd = south face (+z)
    const m = -h * dir;                     // every run extends corridor → wall
    let x = h * AISLE.corridor / 2;         // anchor flush against the center corridor
    // m>0 runs read toward the corridor (same flip buildFace does within a face),
    // so lay their faces out last-first — then every run reads left→right, and
    // consecutive runs join end-to-end: a genre snakes down one side of an
    // aisle and back up the other instead of jumping back to a run's start
    for (const f of m > 0 ? [...chain].reverse() : chain) x += h * (buildFace(f.tapes, x, az, dir, m, f.headers) + 0.06); // 6cm section break
    // stacked genre list on both blue endcaps of the run, facing down the aisle
    const cats = [...new Set(chain.map(f => f.tapes.find(Boolean).category))]; // faces are per-genre chunks, in shelf order
    const tag = tagPlane(cats, frontAt(1.4 + cats.length * 0.08) - 0.04, 0.16);   // fits the wedge where its top edge is
    const far = x - h * 0.06;               // wall end of the run
    [[h * AISLE.corridor / 2 - h * 0.028, -h * Math.PI / 2], [far + h * 0.028, h * Math.PI / 2]]
      .forEach(([tx, ry], i) => {
        const t = i ? tag.clone() : tag;
        t.position.set(tx, 1.4, az + dir * frontAt(1.4) / 2); t.rotation.y = ry; scene.add(t);
      });
  });
  build(west, -1);                          // movies
  build(east, +1);                          // shows
  // just a couple of ceiling signs for the major sections — two back-to-back
  // panels (not one double-sided plane, which mirrors the text on the far
  // side) so both faces read correctly, hung from a pair of thin cables
  // rather than just floating, and lit by the room instead of glowing
  for (const [x, txt] of [[-2.7, "MOVIES"], [2.7, "TV SHOWS"]]) {
    const signZ = AISLE.z0 + BAY.depth;
    const tex = textPlane(txt, 2.6, 0.6).material.map;
    const signMat = new THREE.MeshLambertMaterial({ map: tex });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), signMat);
    front.position.set(x, 2.95, signZ); front.rotation.y = Math.PI; scene.add(front); // faces the door
    const back = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), signMat);
    back.position.set(x, 2.95, signZ); scene.add(back);                              // faces into the store
    const cableLen = STORE.h - 3.25;
    for (const cx of [x - 1.0, x + 1.0]) {
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, cableLen), mat.dark);
      cable.position.set(cx, 3.25 + cableLen / 2, signZ); scene.add(cable);
    }
  }
}

// ---------------- TV lounge (living room, center of the back half) ----------------
const TV = { x: 0, z: 26.8 };   // whole lounge (rug, table, couch, lamps, TV lights) is placed relative to this
const LAMP_ON = 0.32;               // mood lighting only — barely reaches past its own pool
const SHADE_GLOW = 0.45;                   // lit-fabric glow on the lamp shades — higher blows them out to a white blob under bloom
// AMBI_N x AMBI_N sample of the screen, row-major top-left..bottom-right;
// fallback bluish-grey until the first real sample
const AMBI_N = 10;
const screenCells = Array.from({ length: AMBI_N * AMBI_N }, () => ({ r: 0.53, g: 0.6, b: 0.73 }));
// decay 1.5 (softer than physically-correct inverse-square) so it actually
// reaches the couch/floor/cabinet around it instead of dying a foot out —
// there's no bounce lighting here, so the direct throw has to do the work
const tvGlow = new THREE.PointLight(0x8899bb, 0, 26, 1.5); tvGlow.position.set(TV.x, 0.85, TV.z - 1.3); scene.add(tvGlow);
tvGlow.userData.base = 0;                  // set by playEpisode/eject; boosted for lights-out each frame, below
// a real TV throws light behind itself too — a short, sharp-falloff light on
// the back-wall side gives that "wash behind the cabinet" tell without
// needing actual bounce lighting; short distance = obvious dropoff, not a flat wash
const tvBackGlow = new THREE.PointLight(0x8899bb, 0, 6, 2); tvBackGlow.position.set(TV.x, 1.3, TV.z + 0.6); scene.add(tvBackGlow);
// ambilight pool on the rug — a cone fanning out from the screen's own width,
// losing intensity continuously the whole way down the room (real light
// doesn't just stop), not cut off at any one object. Painted (not a plain
// gradient) from the AMBI_N x AMBI_N screen sample below: each cell's color
// lands mirrored left/right (a reflection flips, like a real ambilight) and
// near/far by screen row, so the pool actually shows what's on screen. A
// finer grid just means more (cheap) fillRects — the blur is what does the
// real work blending them, so it stays soft rather than a visible checkerboard
function drawPoolGrid(ctx, W, H, cells) {
  ctx.filter = "none"; ctx.clearRect(0, 0, W, H);
  const nearW = W * 0.4, farW = W * 0.85;        // screen-width at the TV, fanning out down the room
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W / 2 - nearW / 2, H); ctx.lineTo(W / 2 + nearW / 2, H);
  ctx.lineTo(W / 2 + farW / 2, 0); ctx.lineTo(W / 2 - farW / 2, 0);
  ctx.closePath(); ctx.clip();
  ctx.filter = "blur(30px)";                      // this stays soft — only the shadow trapezoids need crisp edges
  const N = AMBI_N;
  for (let sr = 0; sr < N; sr++) {                // screen row 0 (top) = far/dim .. N-1 (bottom) = near/bright
    const y0 = sr * H / N, y1 = y0 + H / N, alpha = 0.06 + 0.54 * sr / (N - 1);
    for (let sc = 0; sc < N; sc++) {               // mirrored left/right, like a reflection
      const col = cells[sr * N + sc], dc = N - 1 - sc, x0 = dc * W / N;
      ctx.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${alpha})`;
      ctx.fillRect(x0, y0, W / N, y1 - y0);
    }
  }
  ctx.restore();
  ctx.filter = "none";
}
const tvPoolTex = makeTexture((ctx, W, H) => drawPoolGrid(ctx, W, H, screenCells), 256, 320);
function paintTvPool() {
  drawPoolGrid(tvPoolTex.image.getContext("2d"), tvPoolTex.image.width, tvPoolTex.image.height, screenCells);
  tvPoolTex.needsUpdate = true;
}
const tvPoolLen = 5.2;                             // cabinet base out past the couch
const tvPool = new THREE.Mesh(new THREE.PlaneGeometry(3.6, tvPoolLen),
  new THREE.MeshBasicMaterial({ map: tvPoolTex, transparent: true, depthWrite: false, opacity: 0 }));
tvPool.rotation.x = -Math.PI / 2; tvPool.position.set(TV.x, 0.02, TV.z - 0.06 - tvPoolLen / 2); scene.add(tvPool);

// the table and the couch are both big enough to actually block that light —
// each gets a real trapezoid shadow on the floor directly behind it (away
// from the screen), same shape logic as the light cone above just inverted:
// a solid, crisp-edged cutout, not another soft blob
function shadowTrapezoid(nearFrac, farFrac, alpha) {
  return makeTexture((ctx, W, H) => {
    const nearW = W * nearFrac, farW = W * farFrac;
    ctx.beginPath();
    ctx.moveTo(W / 2 - nearW / 2, H); ctx.lineTo(W / 2 + nearW / 2, H);
    ctx.lineTo(W / 2 + farW / 2, 0); ctx.lineTo(W / 2 - farW / 2, 0);
    ctx.closePath();
    ctx.fillStyle = `rgba(0,0,0,${alpha})`; ctx.fill();
  }, 256, 256);
}
function shadowPatch(tex, w, d, z) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, depthWrite: false, opacity: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.set(TV.x, 0.03, z); m.renderOrder = 1;   // drawn after tvPool, so it darkens it
  scene.add(m); return m;
}
// table's shadow: narrow at the table, fanning out slightly toward the couch —
// fills the whole gap between them, floor to floor
const tvTableShadow = shadowPatch(shadowTrapezoid(0.6, 0.9, 0.8), 2.0, 1.0, TV.z - 2.4);
// couch's shadow: wide right behind the couch (it's the widest blocker in the
// room) and keeps fanning out further into the walkway behind it — the near
// (narrow) end runs forward under the couch itself so there's no lit sliver
// between the couch's back and where the shadow starts
const tvCouchShadow = shadowPatch(shadowTrapezoid(0.75, 1.0, 0.82), 3.2, 3.0, TV.z - 4.8);
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
const tapeFilter = tape => BW_SHOWS.has(tape.id) ? "grayscale(1)" : "none";

function updateVideoFrame() {
  if (!video.videoWidth) return;
  const W = videoCanvas.width, H = videoCanvas.height;
  const c = tapeFix(playing.tape).crop || { x: 0, y: 0, w: 1, h: 1 };
  const sx = c.x * video.videoWidth, sy = c.y * video.videoHeight;
  const sw = c.w * video.videoWidth, sh = c.h * video.videoHeight;
  const scale = Math.min(W / sw, H / sh);
  const dw = sw * scale, dh = sh * scale;
  videoCtx.fillStyle = "#000"; videoCtx.fillRect(0, 0, W, H);
  videoCtx.filter = tapeFilter(playing.tape);
  videoCtx.drawImage(video, sx, sy, sw, sh, (W - dw) / 2, (H - dh) / 2, dw, dh);
  videoCtx.filter = "none";
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
const crtGlows = [];                       // one real light per ceiling CRT cluster — bloom alone doesn't light the shelves under it
{
  // the preview living room: rug, coffee table, couch facing the TV
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), new THREE.MeshLambertMaterial({ color: 0x23124f }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, TV.z - 1.7); scene.add(rug);
  // vintage coffee table, 0.78 m clear of the couch front (room — player is 0.64
  // wide — to reach the middle seat). Same 1.0 x 0.5 x 0.35 block as before, so
  // the tape case on top and tvTableShadow still line up; the TV-facing side
  // stays one solid flat panel since that shadow assumes a solid blocker.
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
    colliders.push({ x0: -W / 2 - 0.03, x1: W / 2 + 0.03, z0: zc - D / 2 - 0.03, z1: zc + D / 2 });
  }
  const couch = buildCouch();                                             // ornate orange sofa facing the TV (couch.js)
  const cs = 1.12;                                                        // model is built life-size; scaled up a touch (SEATS below match)
  couch.scale.setScalar(cs);
  couch.position.set(0, 0, TV.z - 3.89 - couch.userData.zRange[0] * cs); scene.add(couch);   // back edge stays at TV.z - 3.89
  const couchMeshes = couch.children.filter(c => c.isMesh);              // every mesh carries userData.sit
  { const [z0, z1] = couch.userData.zRange, w = couch.userData.footprint.w * cs;
    colliders.push({ x0: -w / 2, x1: w / 2, z0: couch.position.z + z0 * cs, z1: couch.position.z + z1 * cs }); }
  const ps = textPlane("PREVIEW STATION", 1.2 * cs, 0.25 * cs);          // on the back of the couch
  const sg = couch.userData.sign;
  ps.position.set(0, sg.y * cs, couch.position.z + sg.z * cs); ps.rotation.set(sg.tilt, Math.PI, 0);
  ps.material = new THREE.MeshLambertMaterial({ map: ps.material.map }); // lit by the room, no unlit glow in the dark
  scene.add(ps);
  // classic floor-standing big-screen projection TV
  const bezelMat = new THREE.MeshLambertMaterial({ color: 0x2a2e35 });
  solid(2.4, 1.55, 0.95, mat.dark, 0, 0.775, TV.z);                       // cabinet on the floor
  box(2.05, 1.35, 0.08, bezelMat, 0, 0.95, TV.z - 0.515);                  // protruding bezel
  box(0.55, 0.1, 0.35, mat.dark, 0.8, 1.6, TV.z - 0.1);                   // VCR on top
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
  videoTex.colorSpace = THREE.SRGBColorSpace;
  videoMat = new THREE.MeshBasicMaterial({ map: videoTex, color: 0xd9d9d9 }); // -15%, blown-out whites were blinding
  miniScreens = [screenMesh];
  // ceiling CRT clusters at the wall end of each aisle, pairs side by side
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
  const bandStep = 2 * BAY.depth + AISLE.gap;
  for (let k = 1; ; k++) {                 // one cluster per aisle, at its wall end
    const z = AISLE.z0 + k * bandStep - AISLE.gap / 2;   // mid-aisle z
    if (z > TV.z - 5) break;               // stop at the lounge
    for (const x of [WALL_L + 0.9, STORE.x - 0.9]) {        // hugging the side walls (movie side pulled in)
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
}
// one seat per couch cushion (cushion centers ±0.6 m in couch.js, × the 1.12 couch scale)
const SEATS = [-0.672, 0, 0.672].map(x => ({ x, y: 0.98, z: TV.z - 3.45 }));
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

let lightsOut = false;
let warmup = null;                           // { t, duration, schedules } while panels are flickering on
function setLights(out) {
  lightsOut = out;
  if (out) {
    warmup = null;
    for (const l of allLights) l.intensity = 0;
    panelMats.forEach(m => m.color.set(0x0d1016));
  } else {
    const duration = 1.4 + Math.random() * 0.6;
    warmup = { t: 0, duration, schedules: panelMats.map(() => buildFlickerSchedule(duration)) };
  }
  for (const m of posterMats) m.emissiveIntensity = out ? 0.22 : 0;   // marquees and screens glow on their own
  bloomPass.strength = out ? 0.55 : 0.28;    // barely-there with the lights on; a bit more presence in the dark
  // threshold raised from .2/.4 — screen whites (menus, bright scenes) were blooming
  // too readily; this only raises the bar for what counts as "glowing", it doesn't
  // touch the real PointLights doing the room-ambience work above
  bloomPass.threshold = out ? 0.34 : 0.52;
  setExteriorDay(!out);                      // store lights on = daytime outside, off = moonlit night
}

// ---------------- player ----------------
const player = { x: 0, z: 2.6, yaw: Math.PI, pitch: 0, r: 0.32 };
let eyeY = 1.65;                            // eased toward standing/crouch height
camera.position.set(player.x, 1.65, player.z);
camera.rotation.y = player.yaw;
const keys = new Set();
const HOLD_MS = 450;                       // tap L = overhead lights, hold L = both side lamps
let lHoldTimer = null, lHeld = false;
addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "Escape" && held) putBack();
  if (e.code === "KeyE") onE();
  if (e.code === "Space") togglePause();
  if (e.code === "Comma") stepEpisode(-1);
  if (e.code === "Period") stepEpisode(1);
  if (e.code === "KeyL" && !e.repeat) {
    lHeld = false;
    lHoldTimer = setTimeout(() => { lHeld = true; toggleBothLamps(); }, HOLD_MS);
  }
  if (e.code === "KeyH") document.body.classList.toggle("nohud");
  if (e.code === "KeyF") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
addEventListener("keyup", e => {
  keys.delete(e.code);
  if (e.code === "KeyL") {
    clearTimeout(lHoldTimer);
    if (!lHeld) setLights(!lightsOut);       // released before the hold threshold: a plain tap
  }
});
let seatFov = 70;
canvas.addEventListener("wheel", e => {          // lean in on the couch — zoom for sitting only
  if (seated) seatFov = Math.max(28, Math.min(70, seatFov + e.deltaY * 0.02));
});
addEventListener("mousemove", e => {
  if (document.pointerLockElement !== canvas) return;
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
  player.x = Math.max(WALL_L + 0.5, Math.min(STORE.x - 0.5, player.x));
  player.z = Math.max(0.45, Math.min(STORE.z - 0.45, player.z));
}

// ---------------- picking / inspecting ----------------
const raycaster = new THREE.Raycaster();
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d)),
  new THREE.LineBasicMaterial({ color: YELLOW }));
highlight.visible = false; highlight.rotation.y = Math.PI / 2; // tapes lie rotated on the bands
scene.add(highlight);
let hovered = null, held = null, heldSnack = null, aimTV = false, aimLamp = null, aimCouch = false, aimReturns = false, aimSnack = false, aimFlap = null;
let returnBin = [];                          // tapes dropped in the returns slot — carry-only, never auto-reshelved
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
function pickHover() {
  hovered = null; aimTV = false; aimLamp = null; aimCouch = false; aimReturns = false; aimSnack = false; aimFlap = null;
  if (document.pointerLockElement !== canvas) { highlight.visible = false; $("hoverTip").style.display = "none"; return; }
  if (inspecting || seated) { highlight.visible = false; $("hoverTip").style.display = "none"; return; }
  raycaster.setFromCamera({ x: 0, y: 0 }, camera);
  const hit = raycaster.intersectObjects(faceMeshes, false)
    .find(h => h.distance < 3.4 && h.uv);
  if (hit) {
    const a = hit.object.userData.face.atlas;
    const cell = a * CELLS + Math.floor((1 - hit.uv.y) * 2048 / CH) * COLS + Math.floor(hit.uv.x * 2048 / CW);
    const t = tapeByCell[cell] ?? null;
    hovered = (t && t.coverMesh && !t.coverMesh.visible) ? null : t;   // slot's empty — already checked out
  }
  if (hovered) {
    highlight.visible = true; highlight.position.copy(hovered.pos);
    const tip = $("hoverTip");
    const season = hovered.seasons?.[0]?.label;             // "Season 1", "Episodes", or "" for a movie
    tip.innerHTML = `${hovered.title}<div class="cat">${hovered.category}${season ? " · " + season : ""}</div>`;
    tip.style.display = "block";
  } else {
    highlight.visible = false;
    const aim = raycaster.intersectObjects(aimables, false)[0];
    if (aim?.object === screenMesh && aim.distance < 4.5) aimTV = true;         // TV/couch hints show in tvHint
    else if (aim?.object.userData.lamp && aim.distance < 2.6) aimLamp = aim.object.userData.lamp;
    else if (aim?.object.userData.sit && aim.distance < 3.2) { aimCouch = true; aimSeatX = aim.point.x; }
    else if (aim?.object.userData.returns && aim.distance < 2.4) aimReturns = true;
    else if (aim?.object.userData.snackStand && aim.distance < 2.4) aimSnack = true;
    else if (aim?.object.userData.flap && aim.distance < 2.6) aimFlap = aim.object.userData.flap;
    const tip = $("hoverTip");
    if (aimLamp) tip.innerHTML = `E — turn lamp ${aimLamp.userData.on ? "off" : "on"}`;
    else if (aimReturns && held) tip.innerHTML = "E — drop tape in Returns";
    else if (aimReturns && returnBin.length) tip.innerHTML = `E — take a tape from Returns (${returnBin.length})`;
    else if (aimSnack && !held && !heldSnack) tip.innerHTML = "CLICK — grab a snack";
    else if (aimFlap) tip.innerHTML = `E — ${flapOpen ? "close" : "open"} the counter pass-through`;
    else { tip.style.display = "none"; return; }
    tip.style.display = "block";
  }
}
canvas.addEventListener("contextmenu", e => e.preventDefault());
canvas.addEventListener("mousedown", e => {
  if (document.pointerLockElement !== canvas) return;
  if (e.button === 2) {                                    // right click puts down whatever's in hand
    if (held) putBack();
    else if (heldSnack) dropSnack();
    return;
  }
  if (e.button !== 0) return;
  if (held) { inspecting = !inspecting; return; }          // hold it up / tuck it in hand
  if (heldSnack) return;                                   // hands full
  if (hovered) pickup(hovered);
  else if (aimSnack) grabSnack();
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

// held snack in hand — same hand slot as a tape, plain colored box, no inspect
const snackGroup = new THREE.Group();
snackGroup.position.copy(handGroup.position); snackGroup.rotation.copy(handGroup.rotation);
camera.add(snackGroup);
const snackMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }));
snackGroup.add(snackMesh);
snackGroup.visible = false;
function grabSnack() {
  const [color, label] = SNACKS[Math.floor(Math.random() * SNACKS.length)];
  heldSnack = label; snackMesh.material.color.set(color); snackGroup.visible = true;
  $("holdingTag").style.display = "block"; $("holdingName").textContent = `Snack — ${label}`;
}
function dropSnack() {
  heldSnack = null; snackGroup.visible = false; $("holdingTag").style.display = "none";
}

// ---------------- hold a tape up to look at it ----------------
let inspecting = false;                      // true = box held up in view, false = carried in hand
function releaseFromHand() {                 // clears the hand WITHOUT touching the shelf (TV insert / returns drop-off)
  held = null; inspecting = false; handGroup.visible = false; $("holdingTag").style.display = "none";
}
function pickup(tape) {                      // from a shelf slot OR out of the returns bin — either way, into your hand
  held = tape; inspecting = true;
  if (tape.coverMesh) tape.coverMesh.visible = false;   // gone from the shelf while it's in your hand
  if (tape.bodyMesh) tape.bodyMesh.visible = false;
  $("holdingTag").style.display = "block"; $("holdingName").textContent = tape.title;
  $("inspectArt").src = artUrl(tape.art);
  handBody.material = tape.sideMat || mat.tapeBody;
  loadCoverTexture(tape, t => { handArt.material.map = t; handArt.material.needsUpdate = true; });
  handGroup.visible = true;
}
function putBack() {                         // manual reshelve — always goes home, never to the returns bin
  if (held) {
    if (held.coverMesh) held.coverMesh.visible = true;
    if (held.bodyMesh) held.bodyMesh.visible = true;
  }
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
async function playEpisode(idx) {
  const tape = held || playing?.tape;
  if (!tape) return;
  const eps = tape.seasons[0].episodes;
  idx = Math.max(0, Math.min(eps.length - 1, idx));
  playing = { tape, idx, eps };
  inspecting = false;                        // into the TV — box drops to your side
  const [iaId, epTitle] = eps[idx];
  const bits = epTitle.split(" - ");
  const code = /S\d+E\d+/i.test(bits[1] || "") ? bits[1] + " · " : "";
  const name = code ? bits.slice(2).join(" - ") : bits.slice(1).join(" - ") || epTitle;
  $("tvBar").style.display = "flex";
  $("nowPlaying").innerHTML = `LOADING <b>${tape.title}</b>…`;
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
    tvGlow.userData.base = 1.6;
    $("nowPlaying").innerHTML = `NOW PLAYING <b>${tape.title}</b> — ${code}${name}`;
  } catch (err) {
    $("nowPlaying").innerHTML = `⚠ ${err.message}`;
  }
}
function eject() {
  const tape = playing?.tape;
  video.pause(); video.removeAttribute("src"); video.load();
  playing = null; tvGlow.userData.base = 0;
  miniScreens.forEach(m => m.material = screensaverMat);   // back to the bouncing-logo screensaver
  $("tvBar").style.display = "none";
  tableBoxGroup.visible = false;
  if (tape) {                              // the tape comes back out into your hand, not the shelf
    if (heldSnack) dropSnack();            // make room if a snack's in the way
    pickup(tape);
  }
}
function togglePause() {
  if (!playing || !video.src) return;
  video.paused ? video.play().catch(() => {}) : video.pause();
  $("tvPause").textContent = video.paused ? "▶" : "⏯";
}
function stepEpisode(d) { if (playing) playEpisode(playing.idx + d); }
video.addEventListener("ended", () => stepEpisode(1));
$("tvPrev").onclick = () => stepEpisode(-1);
$("tvNext").onclick = () => stepEpisode(1);
$("tvPause").onclick = togglePause;
$("tvEject").onclick = eject;
function setLamp(l, on) {
  l.userData.on = on ? LAMP_ON : 0;
  l.intensity = l.userData.on;
  l.userData.shadeMat.emissiveIntensity = on ? SHADE_GLOW : 0;
  const b = l.userData.bulbMat; b.color.copy(on ? b.userData.onColor : b.userData.offColor);
  l.userData.pool.visible = on;
}
function toggleBothLamps() {              // holding L: if either's off, turn both on; otherwise both off
  const on = lamps.some(l => !l.userData.on);
  lamps.forEach(l => setLamp(l, on));
}
function onE() {
  if (seated) {                             // E always stands you up
    player.x = stoodAt.x; player.z = stoodAt.z; player.yaw = stoodAt.yaw; seated = false; return;
  }
  if (aimCouch) {                            // aim at the couch from any side to sit
    stoodAt = { x: player.x, z: player.z, yaw: player.yaw };
    seatAt = SEATS.reduce((a, s) => Math.abs(s.x - aimSeatX) < Math.abs(a.x - aimSeatX) ? s : a);   // cushion nearest the aim point
    seated = true; player.yaw = Math.PI; player.pitch = 0;   // facing the TV
    return;
  }
  if (aimLamp) { setLamp(aimLamp, !aimLamp.userData.on); return; }   // E on an aimed lamp flips just that one
  if (aimFlap) { toggleFlap(); return; }
  if (aimReturns) {                          // drop a held tape off, or take one back out
    if (held) { returnBin.push(held); releaseFromHand(); }
    else if (returnBin.length) pickup(returnBin.pop());
    return;
  }
  if (aimTV) {                               // must actually be looking at the screen
    if (held) {
      const tape = held;
      if (playing) returnBin.push(playing.tape);  // swap: whatever was already in the TV goes to Returns
      playEpisode(0);
      releaseFromHand();                     // the tape leaves your hand...
      showTableBox(tape);                    // ...and its case lands on the coffee table
    }
    else if (playing) eject();
  }
}
// CRT/floor-pool glow tinted by the video: an AMBI_N x AMBI_N sample
// (VaultVision ambilight trick) — drawImage's own downscale does the
// per-cell averaging, one pixel per cell, so no manual bucketing needed.
// The overall average drives the plain point lights (tvGlow/tvBackGlow/
// crtGlows); the full grid repaints the floor pool (see drawPoolGrid above)
// with real per-region color
const glowCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
glowCtx.canvas.width = glowCtx.canvas.height = AMBI_N;
setInterval(() => {
  if (!playing || video.paused || !video.videoWidth) return;
  try {
    glowCtx.filter = tapeFilter(playing.tape);
    glowCtx.drawImage(video, 0, 0, AMBI_N, AMBI_N);
    const d = glowCtx.getImageData(0, 0, AMBI_N, AMBI_N).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < screenCells.length; i++) {
      const c = screenCells[i] = { r: d[i * 4] / 255, g: d[i * 4 + 1] / 255, b: d[i * 4 + 2] / 255 };
      r += c.r; g += c.g; b += c.b;
    }
    tvGlow.color.setRGB(r / screenCells.length, g / screenCells.length, b / screenCells.length);
    paintTvPool();
  } catch { /* tainted frame: keep the last colors */ }
}, 200);

// ---------------- pointer lock / title screen ----------------
let started = false;
$("titleScreen").addEventListener("click", () => {
  if ($("enterHint").textContent.startsWith("LOADING")) return;
  canvas.requestPointerLock();
});
document.addEventListener("pointerlockchange", () => {
  const locked = document.pointerLockElement === canvas;
  $("titleScreen").style.display = locked ? "none" : "flex";
  $("crosshair").hidden = $("keysHint").hidden = !locked;
  if (locked) {
    started = true;
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

// ---------------- main loop ----------------
const clock = new THREE.Clock();
let clockT = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  clockT += dt;
  for (const b of marquee) {              // marquee chase around the posters
    const v = 0.5 + 0.5 * Math.sin(clockT * 7 + b.phase);
    b.mat.color.setRGB(0.3 + 0.7 * v, 0.27 + 0.62 * v, 0.03 + 0.09 * v);
  }
  const cloudSpan = (STORE.x + 20) - (WALL_L - 20);
  for (const c of exteriorClouds) {       // a slow drift so the sky doesn't feel static
    c.position.x += dt * 0.15;
    if (c.position.x > STORE.x + 20) c.position.x -= cloudSpan;
  }
  if (!playing) updateScreensaver(dt); else updateVideoFrame();   // pauses while a tape's actually in, like a real screensaver would
  if (warmup) {                           // fluorescents restriking after lights-on
    warmup.t += dt;
    const done = warmup.t >= warmup.duration;
    let litCount = 0;
    panelMats.forEach((m, i) => {
      const lit = done || flickerLit(warmup.schedules[i], warmup.t);
      if (lit) litCount++;
      m.color.set(lit ? 0xf8fbff : 0x30343d);
    });
    const frac = litCount / panelMats.length;
    for (const l of allLights) l.intensity = l.userData.on * frac;
    if (done) warmup = null;
  }
  // the TV(s) read as real light sources reaching the couch/floor/shelves
  // nearby — not just bloom's screen-only glow, which doesn't light anything
  // kept fairly short: this is what lights the table's near/top faces up
  // close, not what lights the floor — the floor's falloff (and the table's
  // and couch's shadows) is owned by the decals below, which can actually
  // respect where the furniture blocks it; a real point light can't
  tvGlow.intensity = tvGlow.userData.base * (lightsOut ? 2.2 : 1);
  tvGlow.distance = lightsOut ? 16 : 11;
  tvBackGlow.color.copy(tvGlow.color);
  tvBackGlow.intensity = tvGlow.userData.base * (lightsOut ? 1.1 : 0.4);
  tvPool.material.opacity = tvGlow.userData.base && lightsOut ? 0.55 : 0;   // carpet effects are a lights-out-only trick — color is baked into the texture by paintTvPool
  const shadowOp = tvGlow.userData.base && lightsOut ? 0.95 : 0;
  tvTableShadow.material.opacity = tvCouchShadow.material.opacity = shadowOp;
  const crtBase = tvGlow.userData.base ? 0.9 : 0;   // ceiling CRTs tint/dim with whatever's actually playing
  crtGlows.forEach(cg => { cg.color.copy(tvGlow.color); cg.intensity = crtBase * (lightsOut ? 1.8 : 1); });
  for (const p of lampPools) p.material.opacity = lightsOut ? 1 : 0;   // overhead fluorescents drown the lamps' own floor pools out entirely
  flapPivot.rotation.x += ((flapOpen ? -Math.PI / 2 : 0) - flapPivot.rotation.x) * Math.min(1, dt * 6);   // eases open/closed
  move(dt);
  if (seated) camera.position.set(seatAt.x, seatAt.y, seatAt.z);
  else {
    eyeY += ((keys.has("KeyC") ? 0.95 : 1.65) - eyeY) * Math.min(1, dt * 10);
    camera.position.set(player.x, eyeY, player.z);
  }
  if (!seated) seatFov = 70;                     // walking resets the couch zoom
  const fovTarget = seated ? seatFov : 70;
  if (Math.abs(camera.fov - fovTarget) > 0.01) { // eased so it feels like leaning in/out
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }
  camera.rotation.y = player.yaw; camera.rotation.x = player.pitch;
  pickHover();
  if (held) {                               // held-up view is a DOM overlay now, so it can't clip shelves
    handGroup.visible = !inspecting;        // 3D box only for the carried-at-your-side pose
    handGroup.position.set(0.3, -0.28, -0.55); handGroup.rotation.set(0.05, -0.4, 0.06); handGroup.scale.setScalar(1);
  }
  $("inspect").style.display = inspecting ? "flex" : "none";

  const showTvHint = started && !inspecting
    && (seated || aimTV || aimCouch)
    && document.pointerLockElement === canvas;
  $("tvHint").style.display = showTvHint ? "block" : "none";
  if (showTvHint) $("tvHint").textContent = seated
    ? "Press E to stand up"
    : aimCouch
      ? "Press E to sit on the couch"
      : held
        ? `Press E to insert “${held.title}” into the TV`
        : (playing ? "Press E to eject the tape" : "Pick up a tape from the shelves to play it here");
  renderWithBloom();
});
window.__t = {
  catalog, pickup, onE, player,
  held: () => held, playing: () => playing, returnBin,
  setAim: v => { aimTV = v; },
  flapOpen: () => flapOpen, aimFlap: () => !!aimFlap, pickHover,
};
