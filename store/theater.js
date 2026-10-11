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
const troffer = (x, z, y, snapZ = true) => {      // -> where it ended up
  x = Math.round((x - CEIL_TILE.x / 2) / CEIL_TILE.x) * CEIL_TILE.x + CEIL_TILE.x / 2;   // centered in a tile slot
  if (snapZ) z = Math.round((z - CEIL_TILE.z / 2) / CEIL_TILE.z) * CEIL_TILE.z + CEIL_TILE.z / 2;   // (the hall's grid is its own: its lights go where they're told)
  const p = new THREE.PlaneGeometry(CEIL_TILE.x - 0.02, CEIL_TILE.z - 0.02); p.rotateX(Math.PI / 2); p.translate(x, y - 0.02, z);
  const key = `${lightZoneAt(x, z)}:${Math.floor(Math.random() * PANEL_GROUPS)}`;
  if (!panelBuckets.has(key)) panelBuckets.set(key, []);
  panelBuckets.get(key).push(p);
  return { x, z, y: y - 0.02 };
};
for (const [x, z] of [[-5.4, 30.15], [-1.8, 30.15]]) troffer(x, z, BOH.h);   // movie theater lobby troffers
// every other tile slot across, every fourth along — a tile or more of
// plain ceiling on every side, so no two fixtures ever touch
for (let x = -9.9; x <= STORE.x - 1; x += 2 * CEIL_TILE.x) for (let z = 3.15; z <= STORE.z - 1; z += 4 * CEIL_TILE.z) {
  if (x - CEIL_TILE.x / 2 < XL + 0.3) continue;   // don't float panels past the pulled-in movie-side wall
  TROFFERS.push(troffer(x, z, STORE.h));
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

