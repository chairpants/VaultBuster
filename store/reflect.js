// ---- the rooms' reflections and the light they throw back. Each room is caught once from somewhere in the middle of it, all six
// ways (a cube), with every light in the building on, and folded into one atlas (ENV_GLSL in store/core.js reads it): per
// room, the picture sharp, glossy and rough, for shiny things to reflect, and what colour of light comes back off its surfaces
// each way a surface can face, which tints what's lit in there (the blue carpet up under the shelves, the warm lobby). Lights
// switched off just scale it (uEnvPos.w); the outdoors and the rooms with windows are caught again, a face a frame, as the day
// turns or the weather changes. Nothing's drawn for it otherwise ----
const ENV_T = LOWMEM ? 64 : 128;                   // an atlas tile's size, and the cube's
const avgLvl = (...z) => z.reduce((s, k) => s + (zoneLvl[k] ?? 1), 0) / z.length;
const ENV = {
  probes: [   // at: where it's caught from; box: the room (reflections are projected onto its walls), or none (outdoors: as far off as the sky); rooms: what's drawn for it
    { name: "out", at: [1.5, 1.6, -9], rooms: ["out", "store"], lvl: () => 1, day: true },
    { name: "store", at: [1.6, 2.5, 14], box: [WALL_L, -0.06, -0.05, STORE.x, STORE.h + 0.05, STORE.z], rooms: ["store", "out", "hall"], lvl: () => Math.max(0.04 + 0.96 * avgLvl("front", "aisles", "lounge"), 0.45 * tod.level), day: true },
    { name: "hall", at: [(BOH.x0 + CLOSET.x0) / 2, 1.5, (STORE.z + BOH.hallZ) / 2], box: [BOH.x0, -0.06, STORE.z, CLOSET.x0, BOH.h + 0.05, BOH.hallZ], rooms: ["hall", "store"], lvl: () => 0.03 + 0.97 * avgLvl("hall") },
    { name: "women's", at: [(BOH.x0 + BOH.rrX) / 2, 1.5, (BOH.hallZ + BOH.z1) / 2], box: [BOH.x0, -0.06, BOH.hallZ, BOH.rrX, BOH.h + 0.05, BOH.z1], rooms: ["restroom"], lvl: () => 0.03 + 0.97 * avgLvl("restroom") },
    { name: "men's", at: [(BOH.rrX + BOH.splitX) / 2, 1.5, (BOH.hallZ + BOH.z1) / 2], box: [BOH.rrX, -0.06, BOH.hallZ, BOH.splitX, BOH.h + 0.05, BOH.z1], rooms: ["restroom"], lvl: () => 0.03 + 0.97 * avgLvl("restroom") },
    { name: "break room", at: [(BOH.splitX + STORE.x) / 2, 1.5, (BOH.hallZ + BOH.officeZ) / 2], box: [BOH.splitX, -0.06, BOH.hallZ, STORE.x, BOH.h + 0.05, BOH.officeZ], rooms: ["breakroom", "hall"], lvl: () => 0.03 + 0.97 * avgLvl("breakroom") },
    { name: "office", at: [(BOH.splitX + STORE.x) / 2, 1.5, (BOH.officeZ + BOH.z1) / 2], box: [BOH.splitX, -0.06, BOH.officeZ, STORE.x, BOH.h + 0.05, BOH.z1], rooms: ["office", "breakroom", "out"], lvl: () => Math.max(0.03 + 0.97 * avgLvl("office"), 0.3 * tod.level), day: true },
    { name: "lobby", at: [(WALL_L + BOH.x0) / 2, 1.5, (STORE.z + BOH.z1) / 2], box: [WALL_L, -0.06, STORE.z, BOH.x0, BOH.h + 0.05, BOH.z1], rooms: ["lobby", "hall"], lvl: () => 0.03 + 0.97 * avgLvl("lobby") },
    { name: "Tony's", at: [(TONY.x0 + TONY.x1) / 2, 1.6, (TONY.z0 + TONY.z1) / 2], box: [TONY.x0, -0.06, TONY.z0 + 0.08, TONY.x1, 3.6, TONY.z1], rooms: ["out"], lvl: () => Math.max(0.05 + 0.95 * tonyOnK, 0.4 * tod.level), day: true, boost: 0 },   // (boost 0: its white is the tin ceiling, not a light: its lamps are dim pendants)   // (its glass is at z 0.075: in front of that's out of doors)
  ],
  none: [   // inside, but no probe of their own: nothing reflected, no bounce, rather than the outdoors' (the auditorium's lit by its screen, live; the closet; the booth over the lobby)
    [WALL_L - 0.3, -1, BOH.z1, BOH.x0 + 0.3, TALL.ceil + 0.1, 48.8],
    [CLOSET.x0, -1, STORE.z, STORE.x + 0.2, BOH.h + 0.1, BOH.hallZ],
    [WALL_L - 0.3, BOH.h + 0.05, STORE.z, BOH.x0 + 0.3, TALL.ceil + 0.1, BOH.z1],
  ],
  queue: [], face: 0, tick: 0, ready: false, started: false, at: { tod: -1, wx: "", wet: 0, cover: 0 },
};
{
  const u = TVU;
  ENV.probes.forEach((p, i) => { u.uEnvPos.value[i].set(...p.at, 1); if (p.box) { u.uEnvBoxA.value[i].set(p.box[0], p.box[1], p.box[2], i); u.uEnvBoxB.value[i].set(p.box[3], p.box[4], p.box[5], 0); } });
  ENV.none.forEach((b, j) => { const i = ENV.probes.length + j; u.uEnvBoxA.value[i].set(b[0], b[1], b[2], -1); u.uEnvBoxB.value[i].set(b[3], b[4], b[5], 0); });
  // (probe 0 has no box: its slot's left empty, so nothing's found in it)
  u.uEnvRows.value = ENV_PROBES; u.uEnvTexel.value = 0.5 / ENV_T;
}
ENV.cube = new THREE.WebGLCubeRenderTarget(ENV_T, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
ENV.cam = new THREE.CubeCamera(0.05, 120, ENV.cube);
ENV.atlas = new THREE.WebGLRenderTarget(4 * ENV_T, ENV_PROBES * ENV_T, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
TVU.uEnvAtlas.value = ENV.atlas.texture;
// the cube, folded flat (octahedral) into its row of the atlas, four tiles across: sharp; glossy and rough (a cone of looks
// round each way, from a blurrier mip); and the bounce: the light coming back onto a surface facing each way (cosine-weighted
// over 64 looks round the whole room), as a colour against the room's average, alpha its brightness against the average
ENV.fold = (() => {
  const lod = Math.log2(ENV_T / 128);              // (a smaller cube: the same blur at a lower mip)
  const m = new THREE.ShaderMaterial({
    uniforms: { uCube: { value: ENV.cube.texture }, uBoost: { value: 7 } }, depthTest: false, depthWrite: false,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform samplerCube uCube; uniform float uBoost;
      vec3 octDec(vec2 u) {
        vec2 e = u * 2.0 - 1.0; vec3 n = vec3(e.x, 1.0 - abs(e.x) - abs(e.y), e.y);
        if (n.y < 0.0) n.xz = (1.0 - abs(n.zx)) * vec2(n.x >= 0.0 ? 1.0 : -1.0, n.z >= 0.0 ? 1.0 : -1.0);
        return normalize(n);
      }
      vec3 look(vec3 d, float l) { return textureLod(uCube, d, max(l + ${lod.toFixed(2)}, 0.0)).rgb; }
      vec3 lit(vec3 d, float l) {                  // (the lamps, the panels, signs, a lit window: caught as white, where they're many times brighter than the walls; given that back, for reflecting)
        vec3 c = look(d, l); return c * (1.0 + uBoost * smoothstep(0.72, 0.98, max(c.r, max(c.g, c.b))));
      }
      void main() {
        float lx = vUv.x * 4.0, lvl = floor(lx); vec3 d = octDec(vec2(fract(lx), vUv.y));
        if (lvl < 0.5) { gl_FragColor = vec4(lit(d, 0.5), 1.0); return; }
        vec3 tx = normalize(cross(abs(d.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), d)), ty = cross(d, tx);
        if (lvl < 2.5) {
          float spread = lvl < 1.5 ? 0.08 : 0.3, l = lvl < 1.5 ? 2.0 : 3.5; vec3 s = vec3(0.0); float w = 0.0;
          for (int i = 0; i < 16; i++) {
            float a = float(i) * 2.39996, r = sqrt((float(i) + 0.5) / 16.0), wt = 1.0 - 0.5 * r;
            s += lit(normalize(d + (tx * cos(a) + ty * sin(a)) * r * spread), l) * wt; w += wt;
          }
          gl_FragColor = vec4(s / w, 1.0); return;
        }
        vec3 E = vec3(0.0), A = vec3(0.0); float ws = 0.0; const vec3 lum = vec3(0.2126, 0.7152, 0.0722);
        for (int i = 0; i < 64; i++) {
          float y = 1.0 - (float(i) + 0.5) / 32.0, r = sqrt(1.0 - y * y), a = float(i) * 2.39996;
          vec3 s = vec3(cos(a) * r, y, sin(a) * r), c = look(s, 4.0) + 0.002; float w = max(dot(s, d), 0.0);
          E += c * w; ws += w; A += c;
        }
        E /= max(ws, 1e-4); A /= 64.0;
        float lE = dot(E, lum), lA = dot(A, lum);
        gl_FragColor = vec4((E / lE + 0.02) / (A / lA + 0.02), lE / lA);
      }`,
  });
  const sc = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
  q.frustumCulled = false; sc.add(q);
  return i => {
    m.uniforms.uBoost.value = ENV.probes[i].boost ?? 7;
    const a = ENV.atlas; a.viewport.set(0, i * ENV_T, 4 * ENV_T, ENV_T); a.scissor.copy(a.viewport); a.scissorTest = true;
    renderer.setRenderTarget(a); renderer.render(sc, cam);
    a.viewport.set(0, 0, a.width, a.height); a.scissor.copy(a.viewport); a.scissorTest = false; renderer.setRenderTarget(null);
  };
})();
// one face of probe i's cube. The room's drawn as it'd look with every light in it on (the switches put back after), and
// without the people in it, or you: they'd be stuck in the reflection
function envFace(i, f) {
  const p = ENV.probes[i], c = ENV.cam;
  if (c.coordinateSystem !== renderer.coordinateSystem) { c.coordinateSystem = renderer.coordinateSystem; c.updateCoordinateSystem(); }
  for (const k of c.children) k.layers.mask = camera.layers.mask;   // (the outdoors is on a layer of its own: EXTERIOR_LAYER)
  c.position.set(...p.at); c.updateMatrixWorld(true);
  const was = ROOMS.map(r => roomGroups[r].visible), booth = BOOTH.g.visible, r0 = roof.g.visible;
  for (const r of ROOMS) roomGroups[r].visible = p.rooms.includes(r);
  BOOTH.g.visible = false; roof.g.visible = false;
  const movers = [me.group, together.g, handGroup, ...custs.map(k => k.c?.group), ...staff.map(e => e.c?.group)].filter(o => o?.visible);
  movers.forEach(o => o.visible = false);
  const lv = { ...zoneLvl }, pc = panelMats.map(m => m.color.getHex());
  for (const z in zoneLvl) zoneLvl[z] = 1; panelMats.forEach(m => m.color.set(0xf8fbff)); applyLighting();
  const tOn = tonyU.uTOn.value; tonyU.uTOn.value = 1;   // (Tony's too: its own light, tonys/light.js)
  const on = TVU.uEnvOn.value, fog = TVU.uFogCam.value; TVU.uEnvOn.value = 0; TVU.uFogCam.value = i === 0 ? 1 : 0;   // (none of the last catch in this one)
  ENV.cube.texture.generateMipmaps = f === 5;      // (the mips once the sixth's in)
  renderer.setRenderTarget(ENV.cube, f); renderer.render(scene, c.children[f]); renderer.setRenderTarget(null);
  TVU.uEnvOn.value = on; TVU.uFogCam.value = fog; tonyU.uTOn.value = tOn;
  Object.assign(zoneLvl, lv); panelMats.forEach((m, j) => m.color.setHex(pc[j])); applyLighting();
  movers.forEach(o => o.visible = true);
  ROOMS.forEach((r, j) => { roomGroups[r].visible = was[j]; }); BOOTH.g.visible = booth; roof.g.visible = r0;
}
function envNote() { ENV.at = { tod: tod.level, wx: WX.kind, wet: WX.wet, cover: WX.cover }; }
// each frame: how lit each room is now (against all on, as it was caught); and, the day or the weather moved on far enough,
// the rooms that see it caught again, a face at a time (the seventh step: folded into the atlas). The first time, every
// room's caught that way, from the first frame drawn: none of it holds up the loading (it's a few seconds, before you're in)
function envStep() {
  if (!ENV.started) { ENV.started = true; envNote(); ENV.queue = ENV.probes.map((p, i) => i); ENV.face = 0; }
  TVU.uEnvOn.value = ENV.ready && SETTINGS.reflect !== false ? 1 : 0;
  ENV.probes.forEach((p, i) => { TVU.uEnvPos.value[i].w = p.lvl(); });
  if (ENV.ready && !TVU.uEnvOn.value) return;
  if (!ENV.queue.length) {
    if (!ENV.ready) { ENV.ready = true; return; }
    const a = ENV.at;
    if (Math.abs(tod.level - a.tod) > 0.08 || WX.kind !== a.wx || Math.abs(WX.wet - a.wet) > 0.25 || Math.abs(WX.cover - a.cover) > 0.25) {
      envNote(); ENV.probes.forEach((p, i) => { if (p.day) ENV.queue.push(i); }); ENV.face = 0;
    }
    return;
  }
  if (++ENV.tick % 3) return;                      // (a face every third frame: 1-4 ms each, spread thin)
  const i = ENV.queue[0];
  if (ENV.face < 6) envFace(i, ENV.face++);
  else { ENV.fold(i); ENV.queue.shift(); ENV.face = 0; }
}
