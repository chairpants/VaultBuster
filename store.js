// VaultBuster — a first-person 90s video store. Tapes come from catalog.json
// (built from the VaultVision library by build.mjs) and play on the in-store
// CRT via archive.org streams, exactly like VaultVision's viewer does.
// Classic script (not a module) so it also runs from a file:// page;
// index.html's inline module sets window.THREE / window.mergeGeometries first.
const artUrl = a => (window.VAULT_ART && window.VAULT_ART[a]) || a;  // embedded covers when file://

// ---------------- palette / constants ----------------
const BLUE = 0x00349c, BLUE_DK = 0x001f5c, YELLOW = 0xffd400;
const STORE = { x: 11, z: 28, h: 3.6 };            // interior half-width / depth / height
const BAY = { len: 1.6, rows: 4, perRow: 11, depth: 0.55, boardY: [0.18, 0.63, 1.08, 1.53] };
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
    new THREE.MeshBasicMaterial({ map: t, transparent: true }));
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
  couch: new THREE.MeshLambertMaterial({ color: 0x2857b0 }),
  tapeBody: new THREE.MeshLambertMaterial({ color: 0x101318 }),
};
let panelMats = [];                        // ceiling panel groups — dimmed in lights-out, flicker independently on warm-up
const allLights = [];                      // every light that lights-out kills (base intensity in userData.on)
const aimables = [];                       // E targets: TV screen, couch, lamps, returns counter, snack stand

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

  // walls (front wall split around the entrance doors)
  const Z = STORE.z, H = STORE.h, T = 0.2;
  box(-0.8 - XL, H, T, mat.wall, (XL - 1 - 1.8) / 2, H / 2, 0);              // front-left (overlaps 1m past XL, hidden)
  box(2 * XR - 3.6, H, T, mat.wall, 1.8 + (XR - 1.8) / 1, H / 2, 0);         // front-right
  box(3.6, H - 2.6, T, mat.wall, 0, 2.6 + (H - 2.6) / 2, 0);                 // above doors
  box(XW, H, T, mat.wall, XC, H / 2, Z);                                    // back
  box(T, H, Z, mat.wall, XL, H / 2, Z / 2);                                 // left
  box(T, H, Z, mat.wall, XR, H / 2, Z / 2);                                 // right
  // blue stripe around the walls at eye height
  [[XC, 2.25, Z - T / 2 - 0.012, XW, 0], [XC, 2.25, T / 2 + 0.012, XW, 0],
   [XL + T + 0.01, 2.25, Z / 2, T, Z], [XR - T - 0.01, 2.25, Z / 2, T, Z]]
    .forEach(([x, y, z, w, d]) => box(w, 0.22, d, mat.stripe, x, y, z));

  // entrance: white door frame + two dark glass panes
  box(0.12, 2.7, 0.35, mat.frame, -1.86, 1.35, 0.1); box(0.12, 2.7, 0.35, mat.frame, 1.86, 1.35, 0.1);
  box(3.84, 0.12, 0.35, mat.frame, 0, 2.66, 0.1); box(0.06, 2.56, 0.3, mat.frame, 0, 1.28, 0.1);
  const g1 = box(1.76, 2.56, 0.06, mat.glass, -0.9, 1.28, 0.12);
  const g2 = box(1.76, 2.56, 0.06, mat.glass, 0.9, 1.28, 0.12);
  g1.rotation.y = 0.5; g2.rotation.y = -0.5;                                  // doors ajar
  g1.geometry.translate(0.9, 0, 0); g2.geometry.translate(-0.9, 0, 0);

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

// ---------------- lobby + back wall dressing ----------------
const colliders = [];
function solid(w, h, d, m, x, y, z) { colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 }); return box(w, h, d, m, x, y, z); }
let returnSlotMesh;                          // the E target for the returns counter, set below
{
  // checkout cluster shifts in from the wall by the same amount the movie-side
  // wall was pulled in, so it keeps its original ~0.4m clearance from it
  const CX = -9 + WALL_SHIFT;
  solid(3.2, 1.0, 0.7, mat.counter, CX, 0.5, 4);                             // checkout counter
  solid(3.2, 0.08, 0.78, mat.counterTop, CX, 1.04, 4);
  box(0.5, 0.3, 0.4, mat.dark, CX, 1.23, 4);                                 // register
  const co = textPlane("CHECK OUT", 2.2, 0.5); co.position.set(CX, 2.3, 4); co.rotation.y = Math.PI; scene.add(co);
  const hours = textPlane("OPEN 10A-12A DAILY", 0.9, 0.22, "#001f5c", "#fff");  // little tented countertop placard
  hours.position.set(CX - 0.9, 1.16, 3.85); hours.rotation.x = -0.3; hours.rotation.y = Math.PI; scene.add(hours);  // clear of the register (x=CX, w=0.5)

  // returns counter — same height/shape as checkout, butted right up against
  // it so the two read as one continuous front counter, with a drop slot on top
  const RX = -6.7 + WALL_SHIFT;
  solid(1.3, 1.0, 0.7, mat.counter, RX, 0.5, 4);
  solid(1.3, 0.08, 0.78, mat.counterTop, RX, 1.04, 4);
  returnSlotMesh = box(0.7, 0.03, 0.1, mat.dark, RX, 1.085, 3.75);
  returnSlotMesh.userData.returns = true; aimables.push(returnSlotMesh);
  const rb = textPlane("RETURNS", 1.1, 0.32, "#001f5c", "#ffd400"); rb.position.set(RX, 1.85, 4); rb.rotation.y = Math.PI; scene.add(rb);

  const kind = textPlane("BE KIND, REWIND", 1.6, 0.55); kind.position.set(0, 3.1, 0.16); scene.add(kind);

  // mural stays centered on the corridor/TV-lounge axis (x=0), not the now-
  // asymmetric wall's own center — that's the sightline it's actually built for
  const logo = textPlane("VAULTBUSTER", 6, 1.2, "#ffd400", "#00349c");        // back-wall mural
  logo.position.set(0, 3.0, STORE.z - 0.15); logo.rotation.y = Math.PI;      // up where the couch can see it
  logo.material = new THREE.MeshLambertMaterial({ map: logo.material.map }); // lit by the room, dims in lights-out
  scene.add(logo);
  const tag = textPlane("WOW! WHAT A SELECTION.", 3.2, 0.4, "#fff", "#001f5c");
  tag.position.set(0, 1.45, STORE.z - 0.15); tag.rotation.y = Math.PI; scene.add(tag);
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
  const picks = catalog.filter((_, i) => i % 67 === 0).slice(0, 24);
  const loader = new THREE.TextureLoader();
  const bulbGeo = new THREE.SphereGeometry(0.022, 6, 5);
  const pts = [];                          // bulb ring around one poster, wall-local coords
  for (let j = 0; j < 7; j++) { pts.push([-0.485 + (j + 0.5) * 0.97 / 7, 0.695]); pts.push([-0.485 + (j + 0.5) * 0.97 / 7, -0.695]); }
  for (let j = 0; j < 9; j++) { pts.push([-0.485, -0.695 + (j + 0.5) * 1.39 / 9]); pts.push([0.485, -0.695 + (j + 0.5) * 1.39 / 9]); }
  function placePoster(tape, x, y, z, ry, i) {  // group faces +z local; wall sits just behind
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
  const spots = [[-7.4, 2.1, 0], [-4.6, 2.1, 0], [4.6, 2.1, 0], [7.4, 2.1, 0],
                 [-6.75, 2.1, 1], [-3.9, 2.1, 1], [3.9, 2.1, 1], [6.75, 2.1, 1]];
  spots.forEach(([x, y, back], i) => placePoster(picks[i], x, y, back ? STORE.z - 0.26 : 0.26, back ? Math.PI : 0, i));
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
  return new THREE.MeshBasicMaterial({ map: t });
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
function buildFace(tapes, ax, az, s, m, headers = []) {   // s: faces ±z, m: extends ±x along the band; headers: mid-run category signs on an otherwise-empty row
  const nBays = Math.max(1, Math.ceil(tapes.length / CAP));
  const covers = [], bodies = [], boards = [], uprights = [];
  tapes.forEach((tape, k) => {
    if (!tape) { covers.push(null); bodies.push(null); return; }   // reserved gap: header row or unused slot
    const bay = Math.floor(k / CAP), rem = k % CAP;
    const row = BAY.rows - 1 - Math.floor(rem / BAY.perRow), slot = rem % BAY.perRow; // fill top-down: partial faces keep tapes at eye level
    const lx = BAY.depth - 0.018, ly = BAY.boardY[row] + 0.02 + TAPE.h / 2;
    const lz = m * (bay * BAY.len + 0.08 + (slot + 0.5) * SLOT_W);
    const p = new THREE.PlaneGeometry(TAPE.d, TAPE.h);                          // face-out cover
    const [u0, v0, u1, v1] = cellUV(tape.cell);
    const uv = p.attributes.uv;
    uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
    p.rotateY(Math.PI / 2); p.translate(lx, ly, lz);
    covers.push(p);
    const b = new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d); b.translate(lx - 0.017, ly, lz);
    bodies.push(b);
  });
  for (let bay = 0; bay < nBays; bay++) {
    for (const y of BAY.boardY) { const g = new THREE.BoxGeometry(BAY.depth - 0.03, 0.04, BAY.len - 0.1); g.translate(0.275, y, m * (bay * BAY.len + BAY.len / 2)); boards.push(g); }
  }
  for (let b = 0; b <= nBays; b++) {        // blue endcap uprights at every bay boundary
    const u = new THREE.BoxGeometry(BAY.depth, 2.0, 0.05); u.translate(0.275, 1.0, m * b * BAY.len); uprights.push(u);
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
    const bm = new THREE.Mesh(g, mat.tapeBody);
    tapes[k].bodyMesh = bm;
    group.add(bm);
  });
  boards.forEach(g => group.add(new THREE.Mesh(g, mat.board)));
  uprights.forEach(g => group.add(new THREE.Mesh(g, mat.upright)));
  // header strip on the shelf edge; genre labels live on the endcaps instead
  const cat = tapes.find(Boolean).category;
  if (!catStripMat[cat]) catStripMat[cat] = stripTexture(cat);
  for (let bay = 0; bay < nBays; bay++) {
    const h = new THREE.Mesh(new THREE.PlaneGeometry(BAY.len - 0.1, 0.16), catStripMat[cat]);
    h.position.set(BAY.depth + 0.002, 1.83, m * (bay * BAY.len + BAY.len / 2)); // above the top row of tapes
    h.rotation.y = Math.PI / 2; group.add(h);
  }
  // mid-run sign: a slim category riding the leftover shelf space gets its
  // own small placard on the empty row, right above where its tapes start
  headers.forEach(({ index, label }) => {
    if (!catStripMat[label]) catStripMat[label] = stripTexture(label);
    const bay = Math.floor(index / CAP), rem = index % CAP;
    const row = BAY.rows - 1 - Math.floor(rem / BAY.perRow);
    const lx = BAY.depth - 0.018, ly = BAY.boardY[row] + 0.02 + TAPE.h / 2;
    const lz = m * (bay * BAY.len + 0.08 + BAY.perRow * SLOT_W / 2);
    const hp = new THREE.PlaneGeometry(BAY.perRow * SLOT_W - 0.1, TAPE.h);
    hp.rotateY(Math.PI / 2); hp.translate(lx, ly, lz);
    group.add(new THREE.Mesh(hp, catStripMat[label]));
  });
  scene.add(group);
  group.updateMatrixWorld(true);
  // world-space slot position per tape (for hover highlight)
  tapes.forEach((tape, k) => {
    if (!tape) return;
    const bay = Math.floor(k / CAP), rem = k % CAP;
    const row = BAY.rows - 1 - Math.floor(rem / BAY.perRow), slot = rem % BAY.perRow; // fill top-down: partial faces keep tapes at eye level
    tape.pos = new THREE.Vector3(BAY.depth - 0.018, BAY.boardY[row] + 0.02 + TAPE.h / 2,
      m * (bay * BAY.len + 0.08 + (slot + 0.5) * SLOT_W)).applyMatrix4(group.matrixWorld);
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
    for (const f of chain) x += h * (buildFace(f.tapes, x, az, dir, m, f.headers) + 0.06); // 6cm section break
    // stacked genre list on both blue endcaps of the run, facing down the aisle
    const cats = [...new Set(chain.map(f => f.tapes.find(Boolean).category))]; // faces are per-genre chunks, in shelf order
    const tag = tagPlane(cats, 0.5, 0.16);
    const far = x - h * 0.06;               // wall end of the run
    [[h * AISLE.corridor / 2 - h * 0.028, -h * Math.PI / 2], [far + h * 0.028, h * Math.PI / 2]]
      .forEach(([tx, ry], i) => {
        const t = i ? tag.clone() : tag;
        t.position.set(tx, 1.4, az + dir * BAY.depth / 2); t.rotation.y = ry; scene.add(t);
      });
  });
  build(west, -1);                          // movies
  build(east, +1);                          // shows
  // just a couple of ceiling signs for the major sections
  for (const [x, txt] of [[-2.7, "MOVIES"], [2.7, "TV SHOWS"]]) {
    const s = textPlane(txt, 2.6, 0.6);
    s.position.set(x, 2.95, AISLE.z0 + BAY.depth); s.rotation.y = Math.PI; scene.add(s); // faces the door
  }
}

// ---------------- TV lounge (living room, center of the back half) ----------------
const TV = { x: 0, z: 24.6 };
// decay 1.5 (softer than physically-correct inverse-square) so it actually
// reaches the couch/floor/cabinet around it instead of dying a foot out —
// there's no bounce lighting here, so the direct throw has to do the work
const tvGlow = new THREE.PointLight(0x8899bb, 0, 16, 1.5); tvGlow.position.set(TV.x, 1.0, TV.z - 1.3); scene.add(tvGlow);
tvGlow.userData.base = 0;                  // set by playEpisode/eject; boosted for lights-out each frame, below
// soft ambilight pool on the rug, tinted to match the screen — same trick as
// the lamps' floor pools, but color-tracks whatever's actually on screen
const tvPoolTex = makeTexture((ctx, W, H) => {
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, "rgba(255,255,255,.65)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}, 256, 256);
const tvPool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6),
  new THREE.MeshBasicMaterial({ map: tvPoolTex, color: 0x8899bb, transparent: true, depthWrite: false, opacity: 0 }));
tvPool.rotation.x = -Math.PI / 2; tvPool.position.set(TV.x, 0.02, TV.z - 1.7); scene.add(tvPool);
const screenGeo = new THREE.PlaneGeometry(1.8, 1.2);   // big-screen TV, ~4:3

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
let screenMesh, videoMat, miniScreens;
const crtGlows = [];                       // one real light per ceiling CRT cluster — bloom alone doesn't light the shelves under it
{
  // the preview living room: rug, coffee table, couch facing the TV
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(7, 9), new THREE.MeshLambertMaterial({ color: 0x23124f }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.01, 22.9); scene.add(rug);
  solid(1.0, 0.35, 0.5, mat.wood, 0, 0.175, 22.6);                       // coffee table
  const couchSeat = solid(2.2, 0.45, 0.9, mat.couch, 0, 0.24, TV.z - 3.4); // couch facing the TV
  const couchBack = box(2.2, 0.65, 0.22, mat.couch, 0, 0.75, TV.z - 3.78);
  couchSeat.userData.sit = couchBack.userData.sit = true;
  const ps = textPlane("PREVIEW STATION", 1.7, 0.35);                     // on the back of the couch
  ps.position.set(0, 0.78, TV.z - 3.915); ps.rotation.y = Math.PI; scene.add(ps);
  // classic floor-standing big-screen projection TV
  const bezelMat = new THREE.MeshLambertMaterial({ color: 0x2a2e35 });
  solid(2.4, 1.55, 0.95, mat.dark, 0, 0.775, TV.z);                       // cabinet on the floor
  box(2.05, 1.35, 0.08, bezelMat, 0, 0.95, TV.z - 0.515);                  // protruding bezel
  box(0.55, 0.1, 0.35, mat.dark, 0.8, 1.6, TV.z - 0.1);                   // VCR on top
  screenMesh = new THREE.Mesh(screenGeo, screensaverMat);
  screenMesh.position.set(0, 0.95, TV.z - 0.558);
  screenMesh.rotation.y = Math.PI;                 // faces the couch
  scene.add(glow(screenMesh));
  aimables.push(screenMesh, couchSeat, couchBack);
  const poolTex = makeTexture((ctx, W, H) => {   // soft warm pool on the floor under each lamp
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
    g.addColorStop(0, "rgba(255,223,158,.5)"); g.addColorStop(1, "rgba(255,223,158,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }, 256, 256);
  for (const lx of [-2.8, 2.8]) {                                        // lamps flanking the room
    const lampP = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.5), mat.dark);
    lampP.position.set(lx, 0.75, TV.z - 0.4); scene.add(lampP);
    const shadeMat = new THREE.MeshLambertMaterial({ color: 0xffe9b0, emissive: 0xffdf9e, emissiveIntensity: 0.85 });
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 16, 1, true), shadeMat);
    shade.position.set(lx, 1.6, TV.z - 0.4); scene.add(glow(shade));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7),
      new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.03, TV.z - 0.4); scene.add(pool);
    const lampL = new THREE.PointLight(0xffdf9e, 0.6, 7, 2); lampL.position.set(lx, 1.5, TV.z - 0.5);
    lampL.userData.on = 0.6; lampL.userData.shadeMat = shadeMat; lampL.userData.pool = pool;
    scene.add(lampL);   // not in allLights — survives lights-out
    for (const m of [lampP, shade]) { m.userData.lamp = lampL; aimables.push(m); }
  }

  // every screen shares ONE decode: the single <video> feeds a VideoTexture
  // that any number of meshes can sample for free
  videoMat = new THREE.MeshBasicMaterial({ map: new THREE.VideoTexture($("vid")) });
  videoMat.map.colorSpace = THREE.SRGBColorSpace;
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
const SEAT = { x: 0, y: 0.98, z: TV.z - 3.45 };
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
  bloomPass.threshold = out ? 0.2 : 0.4;
}

// ---------------- player ----------------
const player = { x: 0, z: 2.6, yaw: Math.PI, pitch: 0, r: 0.32 };
let eyeY = 1.65;                            // eased toward standing/crouch height
camera.position.set(player.x, 1.65, player.z);
camera.rotation.y = player.yaw;
const keys = new Set();
addEventListener("keydown", e => {
  if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === "Escape" && held) putBack();
  if (e.code === "KeyE") onE();
  if (e.code === "Space") togglePause();
  if (e.code === "Comma") stepEpisode(-1);
  if (e.code === "Period") stepEpisode(1);
  if (e.code === "KeyL") setLights(!lightsOut);
  if (e.code === "KeyH") document.body.classList.toggle("nohud");
  if (e.code === "KeyF") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
});
addEventListener("keyup", e => keys.delete(e.code));
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
let hovered = null, held = null, heldSnack = null, aimTV = false, aimLamp = null, aimCouch = false, aimReturns = false, aimSnack = false;
let returnBin = [];                          // tapes dropped in the returns slot — carry-only, never auto-reshelved
function pickHover() {
  hovered = null; aimTV = false; aimLamp = null; aimCouch = false; aimReturns = false; aimSnack = false;
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
    else if (aim?.object.userData.sit && aim.distance < 3.2) aimCouch = true;
    else if (aim?.object.userData.returns && aim.distance < 2.4) aimReturns = true;
    else if (aim?.object.userData.snackStand && aim.distance < 2.4) aimSnack = true;
    const tip = $("hoverTip");
    if (aimLamp) tip.innerHTML = `E — turn lamp ${aimLamp.userData.on ? "off" : "on"}`;
    else if (aimReturns && held) tip.innerHTML = "E — drop tape in Returns";
    else if (aimReturns && returnBin.length) tip.innerHTML = `E — take a tape from Returns (${returnBin.length})`;
    else if (aimSnack && !held && !heldSnack) tip.innerHTML = "CLICK — grab a snack";
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
tableBoxGroup.position.set(0, 0.368, 22.6); tableBoxGroup.rotation.z = -Math.PI / 2;  // lies flat, art facing up
const tableBody = new THREE.Mesh(new THREE.BoxGeometry(TAPE.w, TAPE.h, TAPE.d), mat.tapeBody);
const tableArt = new THREE.Mesh(new THREE.PlaneGeometry(TAPE.d, TAPE.h), new THREE.MeshBasicMaterial({ color: 0x333333 }));
tableArt.rotation.y = -Math.PI / 2; tableArt.position.x = -TAPE.w / 2 - 0.001;
tableBoxGroup.add(tableBody, tableArt);
tableBoxGroup.visible = false;
scene.add(tableBoxGroup);
function showTableBox(tape) {
  tableBoxGroup.visible = true;
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
    console.log("VaultBuster: Attempting to load video:", `https://archive.org/cors/${iaId}/${encodePath(fileStr)}`);

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
function onE() {
  if (seated) {                             // E always stands you up
    player.x = stoodAt.x; player.z = stoodAt.z; player.yaw = stoodAt.yaw; seated = false; return;
  }
  if (aimCouch) {                            // aim at the couch from any side to sit
    stoodAt = { x: player.x, z: player.z, yaw: player.yaw };
    seated = true; player.yaw = Math.PI; player.pitch = 0;   // facing the TV
    return;
  }
  if (aimLamp) {                             // E on an aimed lamp flips just that one
    const l = aimLamp;
    l.userData.on = l.userData.on ? 0 : 0.6;
    l.intensity = l.userData.on;
    l.userData.shadeMat.emissiveIntensity = l.userData.on ? 0.85 : 0;
    l.userData.pool.visible = !!l.userData.on;
    return;
  }
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
// CRT glow tinted by the video (4x4 pixel sample, VaultVision ambilight trick)
const glowCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
glowCtx.canvas.width = glowCtx.canvas.height = 4;
setInterval(() => {
  if (!playing || video.paused || !video.videoWidth) return;
  try {
    glowCtx.drawImage(video, 0, 0, 4, 4);
    const d = glowCtx.getImageData(0, 0, 4, 4).data;
    let r = 0, g = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    tvGlow.color.setRGB(r / n / 255, g / n / 255, b / n / 255);
  } catch { /* tainted frame: keep the last tint */ }
}, 400);

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
  if (!playing) updateScreensaver(dt);    // pauses while a tape's actually in, like a real screensaver would
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
  tvGlow.intensity = tvGlow.userData.base * (lightsOut ? 2.2 : 1);
  tvGlow.distance = lightsOut ? 24 : 16;
  tvPool.material.color.copy(tvGlow.color);
  tvPool.material.opacity = tvGlow.userData.base ? (lightsOut ? 0.55 : 0.3) : 0;
  const crtBase = tvGlow.userData.base ? 0.9 : 0;   // ceiling CRTs tint/dim with whatever's actually playing
  crtGlows.forEach(cg => { cg.color.copy(tvGlow.color); cg.intensity = crtBase * (lightsOut ? 1.8 : 1); });
  move(dt);
  if (seated) camera.position.set(SEAT.x, SEAT.y, SEAT.z);
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
};
