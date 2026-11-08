// ---------------- playing together ----------------
// Two players on the same network, each in their own copy of the store: what's shared is where you are, the time and
// weather (either can change them from the wheel), the tape in the VCR, and the store's doors and lights. The host plays
// their game as usual. Whoever joins reloads as a guest (GUEST, store/core.js): a customer in a store that's never saved,
// every tape free, who isn't thrown out at closing and whose clock is the host's. There's no server: the two swap codes,
// and after that it's a direct WebRTC link between the two browsers. (From JellyBuster, where Jellyfin passed the codes.)
//   - pairing: the host's code (an offer) and the guest's reply (its answer), each shown as a QR code for the other's
//     camera to read, or as text to send over any way you like. A code is only what the other side can't work out for
//     itself: see tgPack / tgUnpack. The store's built for who you are as the page loads, so joining's a reload: the guest
//     reads the host's code, reloads, and only then makes the reply.
//   - the link: no STUN or TURN servers, so it only comes up if the two can reach each other directly.
//   - the other player: a body like a customer's, with a name over it, eased toward where they last said they were.
const TOGETHER = { v: "VB1", addrMax: 4, connectIn: 30000, replyFor: 180000, sendEvery: 50, silentFor: 15000 };   // ms. replyFor: how long a guest's reply waits to be read. silentFor's long because a tab in the background only sends about once a second
const together = {
  g: new THREE.Group(), state: "off",           // off | hosting | joining | connected
  pc: null, pos: null, ctl: null, peer: null,   // pos: position updates, none resent. ctl: what has to arrive. peer: the other player, once they've said hello
  try: 0,                                       // up on every new try: what's left over from an earlier one sees it's changed and stops
  id: null, code: null,                         // id: which pairing this is (the reply carries the host's), code: the one on screen
  seed: crypto.getRandomValues(new Uint32Array(1))[0], up: false, sender: null,
  host: false, timeAt: 0, skyPick: -1, skyDay: 0,   // skyPick: the wheel's weather today, if it's been touched (the plain day's weather comes from the day: the same on both)
};
scene.add(together.g);

const tgSleep = ms => new Promise(r => setTimeout(r, ms));
function tgStatus(text, bad = false) { const el = $("tgStatus"); el.textContent = text; el.style.color = bad ? "#ffb3b3" : ""; el.style.opacity = bad || text ? 1 : ""; }
function tgButtons() {
  const st = together.state, off = st === "off";
  $("tgHost").hidden = $("tgJoin").hidden = !off || !!GUEST || tgCam.want === "o";
  $("tgStop").hidden = off && !GUEST && tgCam.want !== "o";
  $("tgStop").textContent = GUEST && st === "connected" ? "LEAVE THE STORE" : st === "connected" ? "DISCONNECT" : "CANCEL";
  $("tgNameRow").hidden = !off || !!GUEST;
  $("tgAbout").hidden = !off;
  $("tgBack").hidden = !!GUEST && st !== "connected";   // (a guest's reply is the only thing to do till it's read)
}

// ---- your name, over your head on their screen ----
const TG_NAME_KEY = "vaultbuster-name";
function tgMyName() { let n = ""; try { n = localStorage.getItem(TG_NAME_KEY) || ""; } catch {} return n.replace(/[<>]/g, "").trim().slice(0, 24) || "Player"; }
{ const el = $("tgName"); el.placeholder = "Player"; try { el.value = localStorage.getItem(TG_NAME_KEY) || ""; } catch {}
  el.oninput = () => { try { localStorage.setItem(TG_NAME_KEY, el.value.trim()); } catch {} }; }

// ---- the connection details, as short as they'll go ----
const tgToB64 = hex => btoa(String.fromCharCode(...hex.match(/../g).map(x => parseInt(x, 16)))).replace(/=+$/, "");
const tgToHex = s => [...atob(s)].map(c => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
const TG_MDNS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.local$/i;   // how browsers hide a device's address
const tgHostOut = h => TG_MDNS.test(h) ? tgToB64(h.replace(/\.local$/i, "").replace(/-/g, "")) : h;
function tgHostIn(h) {
  if (!/^[A-Za-z0-9+/]{22}$/.test(h)) return h;
  const x = tgToHex(h);
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}.local`;
}
function tgPack(sdp) {                          // -> the ICE username and password, the certificate's fingerprint, and the first few addresses
  const field = k => { const m = sdp.match(new RegExp(`^a=${k}:(.*)$`, "m")); if (!m) throw new Error(`The browser's connection details have no ${k}.`); return m[1].trim(); };
  const [algo, print] = field("fingerprint").split(" ");
  if (algo.toLowerCase() !== "sha-256") throw new Error("This browser's connection details aren't a kind this can send.");
  const found = [...new Set(sdp.split(/\r?\n/).filter(l => l.startsWith("a=candidate")).map(l => l.split(" "))
    .filter(p => p[2].toLowerCase() === "udp" && p[7] === "host" && p[5] !== "9").map(p => `${tgHostOut(p[4])}|${p[5]}`))]
    .sort((a, b) => /^\d+\.\d+\.\d+\.\d+\|/.test(b) - /^\d+\.\d+\.\d+\.\d+\|/.test(a));   // (a plain IPv4 address first: the likeliest to reach, and the shortest)
  if (!found.length) throw new Error("The browser found no network address to offer. Is this device on the network?");
  return `${field("ice-ufrag")} ${field("ice-pwd")} ${tgToB64(print.replace(/:/g, ""))} ${found.slice(0, TOGETHER.addrMax).join(",")}`;
}
function tgUnpack(text, type) {
  const bad = () => new Error("The other player's code doesn't look right.");
  const parts = String(text).split(" "); if (parts.length !== 4) throw bad();
  const [ufrag, pwd, print, list] = parts;
  if (!/^[A-Za-z0-9+/]{4,64}$/.test(ufrag) || !/^[A-Za-z0-9+/]{22,64}$/.test(pwd) || !/^[A-Za-z0-9+/]{43}$/.test(print)) throw bad();
  const lines = list.split(",").map((c, i) => {
    const [h, port] = c.split("|"), host = tgHostIn(h);
    if (!/^[A-Za-z0-9.:_-]+$/.test(host) || !/^\d{1,5}$/.test(port)) throw bad();
    return `a=candidate:${i + 1} 1 udp ${2113937151 - i} ${host} ${port} typ host\r\n`;
  }).join("");
  const fp = tgToHex(print).toUpperCase().match(/../g).join(":");
  return `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\n${lines}a=ice-ufrag:${ufrag}\r\na=ice-pwd:${pwd}\r\na=fingerprint:sha-256 ${fp}\r\na=setup:${type === "offer" ? "actpass" : "active"}\r\na=mid:0\r\na=sctp-port:5000\r\n`;
}
// a whole code: VB1 <o: the host's | a: the reply> <id> <name> <ufrag> <pwd> <fingerprint> <addresses>
const tgCode = (kind, id, sdp) => `${TOGETHER.v} ${kind} ${id} ${encodeURIComponent(tgMyName())} ${tgPack(sdp)}`;
function tgReadCode(text) {                     // -> { kind, id, who, text }, or null if it isn't one of ours
  const p = String(text || "").trim().split(/\s+/);
  if (p.length !== 8 || p[0] !== TOGETHER.v || !/^[oa]$/.test(p[1]) || !/^[a-z0-9]{4}$/.test(p[2])) return null;
  let who; try { who = decodeURIComponent(p[3]).replace(/[<>]/g, "").slice(0, 24) || "Player"; } catch { return null; }
  return { kind: p[1], id: p[2], who, text: p.slice(4).join(" ") };
}
const tgId = () => [...crypto.getRandomValues(new Uint8Array(4))].map(b => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");

// ---- showing your code: a QR, and the text to copy ----
function tgShowCode(code) {
  together.code = code;
  const qr = qrcode(0, "M"); qr.addData(code); qr.make();
  const n = qr.getModuleCount(), quiet = 4, px = 6, cv = $("tgQR"), g = cv.getContext("2d");
  cv.width = cv.height = (n + quiet * 2) * px;
  g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = "#000";
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
  $("tgGive").hidden = false;
}
function tgHideCode() { together.code = null; $("tgGive").hidden = true; }
$("tgCopy").onclick = async () => {
  const code = together.code; if (!code) return;
  try { await navigator.clipboard.writeText(code); }
  catch {                                       // (no clipboard API here: the old way)
    const t = document.createElement("textarea"); t.value = code; document.body.append(t); t.select();
    try { document.execCommand("copy"); } catch {} t.remove();
  }
  $("tgCopy").textContent = "COPIED"; setTimeout(() => { $("tgCopy").textContent = "COPY CODE"; }, 1500);
};

// ---- reading theirs: the camera, or pasted ----
// BarcodeDetector where the browser has one (Chrome), jsQR (vendor/) where it doesn't. The camera's only on while a code's wanted
const tgCam = { want: null, stream: null, det: null, cv: null };   // want: "o" (a host's code) | "a" (the reply to ours) | null
async function tgScanStart(want) {
  tgCam.want = want; $("tgTake").hidden = false; $("tgPaste").value = ""; tgButtons();
  $("tgPaste").placeholder = want === "o" ? "…or paste the host's code here" : "…or paste their reply here";
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } } });
    if (tgCam.want !== want || tgCam.stream) { s.getTracks().forEach(t => t.stop()); return; }
    tgCam.stream = s;
    const v = $("tgCam"); v.srcObject = s; v.hidden = false; await v.play().catch(() => {});
    if (!tgCam.det && window.BarcodeDetector) try { if ((await BarcodeDetector.getSupportedFormats()).includes("qr_code")) tgCam.det = new BarcodeDetector({ formats: ["qr_code"] }); } catch {}
    while (tgCam.want === want && tgCam.stream === s) {
      const text = await tgScanFrame(v);
      if (text && tgCam.want === want) tgGotCode(text, true);
      await tgSleep(200);
    }
  } catch { /* no camera, or it wasn't allowed: pasting still works */ }
}
async function tgScanFrame(v) {
  if (v.readyState < 2 || !v.videoWidth) return null;
  try {
    if (tgCam.det) return (await tgCam.det.detect(v))[0]?.rawValue || null;
    if (!window.jsQR) return null;
    const k = Math.min(1, 800 / v.videoWidth), w = Math.round(v.videoWidth * k), h = Math.round(v.videoHeight * k);
    const cv = tgCam.cv ||= document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(v, 0, 0, w, h);
    return jsQR(g.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" })?.data || null;
  } catch { return null; }
}
function tgScanStop() {
  tgCam.want = null; tgCam.stream?.getTracks().forEach(t => t.stop()); tgCam.stream = null;
  const v = $("tgCam"); v.srcObject = null; v.hidden = true; $("tgTake").hidden = true;
}
function tgGotCode(text, fromCam = false) {     // a code read off the camera or pasted: is it the one we're after?
  const want = tgCam.want, T = together; if (!want || !String(text).trim()) return;
  const c = tgReadCode(text);
  if (!c) { if (!fromCam) tgStatus("That isn't a VaultBuster code.", true); return; }
  if (want === "a" && c.kind === "o") return tgStatus(c.id === T.id ? "That's your own code. Show this camera the reply on their screen." : "That's a host's code. They need to choose JOIN, then show you their reply.", true);
  if (want === "o" && c.kind === "a") return tgStatus("That's somebody's reply. You want the host's code: the one on their screen after they choose HOST.", true);
  if (want === "a" && c.id !== T.id) return tgStatus("That reply's to a different code. Have them read the one on your screen now.", true);
  try { tgUnpack(c.text, c.kind === "o" ? "offer" : "answer"); } catch (e) { return tgStatus(e.message, true); }
  tgScanStop();
  if (want === "o") tgBecomeGuest({ id: c.id, text: c.text }, c.who);
  else tgAnswered(c);
}
$("tgPaste").addEventListener("input", e => tgGotCode(e.target.value));

// ---- the link ----
// A browser hides its address in what it offers (a made-up name.local, for the other side to look up on the network), and on
// plenty of networks that lookup never comes back: the two never find each other. A page allowed the camera (or the
// microphone) is trusted with the real address, so the camera's asked for, and let go straight away, before anything's
// offered. It's wanted for reading the other's code anyway. Turned down: it goes ahead with the made-up name, and may still work
async function tgRevealAddress(say) {
  if (!navigator.mediaDevices?.getUserMedia) return false;
  for (const name of ["camera", "microphone"]) try { if ((await navigator.permissions?.query({ name }))?.state === "granted") return true; } catch {}
  say("Your browser will ask to use the camera. Allow it: it reads the other player's code, and it's what lets the browser tell the other device where this one is. Nothing's recorded.");
  try { (await navigator.mediaDevices.getUserMedia({ video: true })).getTracks().forEach(t => t.stop()); return true; }
  catch (e) { if (e.name !== "NotFoundError") return false; }
  try { (await navigator.mediaDevices.getUserMedia({ audio: true })).getTracks().forEach(t => t.stop()); return true; }   // (no camera: the microphone does the same)
  catch { return false; }
}
function tgNewPeer() {
  const T = together, mine = T.try;
  if (!window.RTCPeerConnection) throw new Error("This browser doesn't have WebRTC.");
  const pc = T.pc = new RTCPeerConnection({ iceServers: [] });
  // both channels are agreed on ahead (negotiated): neither side has to wait to be told about them
  T.pos = pc.createDataChannel("pos", { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
  T.ctl = pc.createDataChannel("ctl", { negotiated: true, id: 1 });
  T.pos.onmessage = e => tgOnPos(e.data, mine);
  T.ctl.onmessage = e => tgOnCtl(e.data, mine);
  T.ctl.onopen = () => { if (mine === T.try) tgLinked(); };
  T.ctl.onclose = () => { if (mine === T.try) tgLost(); };
  // (before it's up, "failed" isn't the end: a guest's reply can sit a while before the host reads it, and the checks
  // that went unanswered meanwhile come good once it has. The timeouts decide when to give up)
  pc.addEventListener("connectionstatechange", () => { if (mine === T.try && T.up && pc.connectionState === "failed") tgLost(); });
  return pc;
}
function tgGathered(pc) {
  return new Promise(res => {
    if (pc.iceGatheringState === "complete") return res();
    const t = setTimeout(res, 6000);            // whatever's been found by then will have to do
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); res(); } });
  });
}
function tgClose() {
  const T = together;
  clearInterval(T.sender); T.sender = null;
  try { T.pos?.close(); } catch {} try { T.ctl?.close(); } catch {} try { T.pc?.close(); } catch {}
  T.pc = T.pos = T.ctl = null; T.up = false; T.host = false; T.id = null;
  tgPeerGone();
}
function tgStop(status = "", bad = false) {     // back to not being connected to anybody
  const T = together;
  T.try++; T.state = "off"; tgClose(); tgScanStop(); tgHideCode();
  if (GUEST) {                                  // a guest with nobody to be the guest of: told so, then back to their own menu, where it says why
    if (started) { toast(status || "The other player left", !bad); setTimeout(() => tgGuestLeaves(status || "The other player left.", bad), 4000); }
    else tgGuestLeaves(status || "The other player left.", bad);
    return;
  }
  tgStatus(status, bad); tgButtons();
}
async function tgDiagnose(pc) {                // why it never came up, in a line: what each side offered, whether the other's address was found, whether anything answered
  if (!pc) return "";
  try {
    const st = [...(await pc.getStats()).values()], by = t => st.filter(s => s.type === t);
    const where = c => c.address || "(hidden)";
    const local = by("local-candidate").map(c => `${c.candidateType} ${where(c)} ${c.protocol}`);
    const remote = by("remote-candidate").map(c => `${c.candidateType} ${where(c)}`);
    const pairs = by("candidate-pair"), sent = pairs.reduce((n, p) => n + (p.requestsSent || 0), 0), got = pairs.reduce((n, p) => n + (p.responsesReceived || 0) + (p.requestsReceived || 0), 0);
    const states = [...new Set(pairs.map(p => p.state))].join("/") || "none";
    return `[this device offered: ${local.join(", ") || "nothing"} · theirs, as found here: ${remote.join(", ") || "nothing"} · checks sent ${sent}, heard back ${got} · pairs ${states} · ice ${pc.iceConnectionState}]`;
  } catch (e) { return `[no details: ${e.message}]`; }
}
function tgLost(why) {                          // the link's ended: it never came up, or it did and now it's gone
  if (!together.up) { const T = together, mine = T.try; return void tgDiagnose(T.pc).then(d => { if (mine !== T.try) return; console.warn("Play together:", d); tgStop((why || "Couldn't connect directly. Usual causes: a guest network or your router's AP isolation setting, a firewall blocking UDP, a VPN, or the other device being on another network. On a Mac, the browser needs Local Network access: System Settings, Privacy & Security, Local Network.") + " " + d, true); }); }
  toast(together.peer ? `${together.peer.name} left` : "The other player left");
  tgStop("The other player left.");
}
function tgArmTimeout(mine, ms = TOGETHER.connectIn, why) {
  setTimeout(() => { if (mine === together.try && !together.up) tgLost(why); }, ms);
}
async function togetherHost() {
  const T = together, mine = ++T.try;
  T.id = tgId(); T.state = "hosting"; T.host = true; tgButtons(); tgStatus("Getting ready…");
  try {
    await tgRevealAddress(t => tgStatus(t)); if (mine !== T.try) return;
    tgStatus("Getting ready…");
    const pc = tgNewPeer();
    await pc.setLocalDescription(await pc.createOffer());
    await tgGathered(pc);
    if (mine !== T.try) return;
    tgShowCode(tgCode("o", T.id, pc.localDescription.sdp));
    tgStatus("On the other device, choose PLAY TOGETHER, then JOIN, and hold its camera up to this code (or send them the code). Then show this camera the reply on their screen.");
    tgScanStart("a");
  } catch (e) { if (mine === T.try) tgStop(e.message, true); }
}
async function tgAnswered(c) {                  // (the host) their reply's in: on to connecting
  const T = together, mine = T.try;
  tgHideCode(); tgStatus(`Connecting to ${c.who}…`);
  try {
    await T.pc.setRemoteDescription({ type: "answer", sdp: tgUnpack(c.text, "answer") });
    tgArmTimeout(mine);
  } catch (e) { if (mine === T.try) tgStop(e.message, true); }
}
async function togetherJoin(offer, who) {       // (the guest, just reloaded) the reply, for the host to read
  const T = together, mine = ++T.try;
  T.id = offer.id; T.state = "joining"; tgButtons(); tgStatus(`Getting a reply ready for ${who}…`);
  try {
    await tgRevealAddress(t => tgStatus(t)); if (mine !== T.try) return;
    const pc = tgNewPeer();
    await pc.setRemoteDescription({ type: "offer", sdp: tgUnpack(offer.text, "offer") });
    await pc.setLocalDescription(await pc.createAnswer());
    await tgGathered(pc);
    if (mine !== T.try) return;
    tgShowCode(tgCode("a", offer.id, pc.localDescription.sdp));
    tgStatus(`Now hold this up to ${who}'s camera (or send them the code). You're in as soon as they've read it.`);
    tgArmTimeout(mine, TOGETHER.replyFor, `${who} didn't read the reply in time.`);
  } catch (e) { if (mine === T.try) tgStop(e.message, true); }
}
function tgLinked() {
  const T = together;
  T.up = true; T.state = "connected";
  tgScanStop(); tgHideCode();
  tgButtons(); tgStatus("Connected. Waiting to hear from them…");
  if (GUEST && !started) titleMenu.refresh?.();  // (off the reply, and in through the door at a click)
  T.ctl.send(JSON.stringify({ t: "hi", name: tgMyName(), seed: T.seed, uniform: !CUSTOMER, guest: !!GUEST, outfit: ME_OUTFIT }));
  if (T.host && T.skyPick >= 0 && T.skyDay === shift.day) T.ctl.send(JSON.stringify({ t: "wheel", i: T.skyPick }));   // (they've missed what's already been picked today)
  // on a timer, not the frame loop: a tab in the background stops drawing, and it still has to say it's there
  T.sender = setInterval(tgSend, TOGETHER.sendEvery);
}
function tgSend() {
  const T = together; if (T.pos?.readyState !== "open") return;
  if (T.host && T.ctl?.readyState === "open" && performance.now() - T.timeAt > 2000) {
    T.timeAt = performance.now();
    if (T.skyDay !== shift.day) { T.skyDay = shift.day; T.skyPick = -1; }   // (a picked weather's only for that day)
    T.ctl.send(JSON.stringify({ t: "time", h: shift.h, day: shift.day }));
    if (playing && T.peer) tgVcrSend(true);      // (where the tape's got to: the other's put right if it's wandered)
  }
  tgWorldTick();
  const g = me.group.position, r = v => Math.round(v * 1000) / 1000;
  const sit = onStool ? STOOL_SIT : seated ? (seatAt?.hipY ? { hipY: seatAt.hipY } : {}) : null;
  const pose = fall ? 3 : sit ? 2 : keys.has("KeyC") ? 1 : 0;
  try { T.pos.send(JSON.stringify([r(g.x), r(g.y), r(g.z), r(me.group.rotation.y), pose, fall ? r(fall.prone ? -fall.tilt : fall.tilt) : sit?.hipY ?? 0, sit?.tuck ?? 0, jump.air || mantle ? 1 : 0])); } catch {}
}
function tgOnCtl(data, mine) {
  const T = together; if (mine !== T.try) return;
  let d; try { d = JSON.parse(data); } catch { return; }
  if (d.t === "bye") return tgLost();
  if (d.t === "wheel") { const o = WHEEL_OPTS[d.i]; if (o) wheelPick(o, true); return; }
  if (d.t === "time") {                         // (the host's clock, every couple of seconds)
    if (!GUEST || !(d.h >= 0 && d.h < 48) || !(d.day >= 1)) return;
    shift.warp = 0; shift.h = d.h; shift.day = d.day >>> 0;
    return;
  }
  if (d.t === "vcr") return tgVcrApply(d);
  if (d.t === "world") return tgWorldApply(d);
  if (d.t !== "hi" || T.peer) return;
  tgPeerArrives(String(d.name || "Player").replace(/[<>]/g, "").slice(0, 24), d.seed >>> 0, !!d.uniform, !!d.guest, d.outfit);
  if (T.host && playing) tgVcrSend();           // (a tape's already going: on theirs too)
  tgWorld.last = {}; tgWorld.touched = {}; tgWorld.fullAt = 0;   // (the host's whole store goes over first thing; the guest's own changes after that)
  if (!T.host) for (const [k, p] of Object.entries(TG_PARTS)) tgWorld.last[k] = p.get();   // (the guest's store as it loaded isn't news: the host's is what counts)
  toast(`${T.peer.name} is here`, true);
  tgStatus(`Connected to ${T.peer.name}. You can go into the store now.`);
}
function tgOnPos(data, mine) {
  const T = together, P = T.peer; if (mine !== T.try || !P) return;
  let a; try { a = JSON.parse(data); } catch { return; }
  if (!Array.isArray(a) || a.length !== 8 || !a.every(Number.isFinite)) return;
  P.heard = performance.now();
  if (Math.abs(a[0]) > 500 || Math.abs(a[1]) > 100 || Math.abs(a[2]) > 500) return;   // (nowhere in this world)
  P.to = { x: a[0], y: a[1], z: a[2], ry: a[3] };
  P.c.setAir(!!a[7]);
  P.tilt = a[4] === 3 ? Math.max(0, Math.min(1, Math.abs(a[5]))) : 0; P.prone = a[4] === 3 && a[5] < 0;   // (down on their back, or their face: see fall, store/player.js)
  if (a[4] !== P.pose || (a[4] !== 3 && (a[5] !== P.hipY || a[6] !== P.tuck))) {
    P.pose = a[4]; P.hipY = a[5]; P.tuck = a[6];
    P.c.setPose(a[4] === 2 ? "sit" : a[4] === 1 ? "crouch" : "idle", a[4] === 2 ? { ...(a[5] && { hipY: a[5] }), ...(a[6] && { tuck: a[6] }) } : undefined);
  }
}

function togetherSkyPicked(o, fromOtherPlayer) {   // (from the wheel) a pick on either side's a pick on both
  const T = together, i = WHEEL_OPTS.indexOf(o);
  if (o[1] === "sky") { T.skyPick = i; T.skyDay = shift.day; }
  if (T.host) T.timeAt = 0;                     // (the new hour goes straight over)
  if (!fromOtherPlayer && T.ctl?.readyState === "open") T.ctl.send(JSON.stringify({ t: "wheel", i }));
}

// ---- the tape: whatever's in one VCR is in the other's, at the same place, playing or paused ----
// Either can put a tape in, pause it, wind it or take it out: each change goes over as where the tape is now (which tape,
// which episode, how far in, paused or not), and the other's VCR is put the same. What that does to the other's own video
// (it starts, it seeks, it pauses) would come straight back as a change of theirs: for a moment after, those aren't sent.
// A tape put in from the other side plays from the catalog's copy (nothing's off your shelves), and comes out of the VCR
// into nobody's hand. The host says where its tape's got to every couple of seconds; more than a second out, it's put right
const tgVcr = { loading: null, theirs: null, want: null, mineAt: -1e9 };   // loading: their tape, still coming in (its starting isn't news). want: their newest word, and when it came. mineAt: when you last put a tape in or took one out
const tgVcrNow = () => playing ? { key: tapeKey(titleOfCopy(playing.tape)), ep: playing.idx, at: media.on ? media.t : video.currentTime, paused: video.paused || media.on } : { key: null };
function tgVcrEcho(s) {                          // is this just what they told us, being done? (then it's not ours to send back)
  const w = tgVcr.want; if (!w) return false;
  if (!s.key || !w.d.key) return !s.key && !w.d.key;
  const expect = w.d.paused ? w.d.at : w.d.at + (performance.now() - w.got) / 1000;
  return s.key === w.d.key && s.ep === w.d.ep && s.paused === !!w.d.paused && Math.abs(s.at - expect) < 1.2;
}
function tgVcrSend(drift = false) {
  const T = together; if (T.ctl?.readyState !== "open" || !T.peer) return;
  if (tgVcr.loading && playing?.tape === tgVcr.loading) return;   // (their tape still coming in: whatever it does meanwhile is just the loading)
  const s = tgVcrNow();
  if (drift ? !playing : tgVcrEcho(s)) return;
  try { T.ctl.send(JSON.stringify({ t: "vcr", ...s, at: s.key ? Math.round(s.at * 100) / 100 : undefined, drift })); } catch {}
}
function tgVcrMine() {                           // (store/tv.js: you put a tape in, or took it out. Said at once, whatever's just come from them; a tape where it went in, rolling)
  tgVcr.mineAt = performance.now(); tgVcr.loading = null; tgVcr.want = null;
  const T = together; if (T.ctl?.readyState !== "open" || !T.peer) return;
  try { T.ctl.send(JSON.stringify(playing ? { t: "vcr", key: tapeKey(titleOfCopy(playing.tape)), ep: playing.idx, at: Math.round((playing.from || 0) * 100) / 100, paused: false } : { t: "vcr", key: null })); } catch {}
}   // (store/tv.js: you put a tape in, or took it out. Said at once, whatever's just come from them)
for (const ev of ["play", "pause", "seeked"]) video.addEventListener(ev, () => { if (!paused && !media.on) tgVcrSend(); });   // (not the pause screen pausing it: that's just you)
function tgVcrApply(d) {
  const T = together;
  if (d.drift && d.key && playing && tapeKey(titleOfCopy(playing.tape)) !== d.key && performance.now() - tgVcr.mineAt < 6000) return;   // (the host's reminder, crossing your own new tape on its way: yours is news to them)
  tgVcr.want = { d, got: performance.now() };
  if (!d.key) { if (playing) eject(playing.tape !== tgVcr.theirs); tgVcr.theirs = null; return; }   // (yours comes out into your hand; theirs just goes)
  const t = catalog.find(x => tapeKey(x) === d.key);
  if (!t) { toast(`${T.peer?.name || "They"} put on a tape this store doesn't have`); return; }
  const at = (w = tgVcr.want) => w.d.paused ? w.d.at : w.d.at + (performance.now() - w.got) / 1000;   // (how far it'll have got while this one caught up)
  const line = (w = tgVcr.want) => {
    if (canSeek() && Math.abs(video.currentTime - at(w)) > (w.d.drift ? 1 : 0.5)) video.currentTime = at(w);   // (most archive.org streams can't be wound: those just play from the start on each side)
    if (w.d.paused && !video.paused) video.pause(); else if (!w.d.paused && video.paused) video.play().catch(() => {});
  };
  if (playing && tapeKey(titleOfCopy(playing.tape)) === d.key && playing.idx === d.ep) { if (!media.on && tgVcr.loading !== playing.tape) line(); return; }
  if (playing && playing.tape !== tgVcr.theirs) eject();   // yours comes out into your hand, as when you swap tapes
  tgVcr.theirs = t; t.tapePos = { ep: d.ep, t: at() }; tgVcr.loading = t;
  playEpisode(d.ep, t).then(() => {
    if (tgVcr.loading !== t) return;             // (something else went in meanwhile)
    const w = tgVcr.want; if (playing?.tape === t && w?.d.key === d.key && w.d.ep === d.ep) line(w);
    setTimeout(() => { if (tgVcr.loading === t) tgVcr.loading = null; }, 800);
  });
}

// ---- the store's moving parts: doors, lights, lamps, blinds, the counter's flap, the cooler, the stool, the standee ----
// Each side looks at them a few times a second and sends the parts that have changed since it last said; the other puts its
// own the same. What's just been put to the other's word counts as already said, so it isn't sent straight back. The host
// sends the lot every few seconds too (whatever didn't take the first time, someone in a doorway, say, takes then), but
// not over anything the guest's only just changed. Customers and staff are each side's own: a door one of theirs opens opens on both
const tgWorld = { last: {}, touched: {}, at: 0, fullAt: 0 };
const TG_PARTS = {
  doors: { get: () => doors.map(d => d.push ? null : d.open), set: v => v.forEach((o, i) => { const d = doors[i]; if (d && !d.push && o != null && d.open !== o) tgDoorSet(d, o); }) },
  lights: { get: () => LIGHT_ZONES.map(z => !!zoneOn[z]), set: v => LIGHT_ZONES.forEach((z, i) => { if (v[i] != null && !!zoneOn[z] !== v[i]) setZone(z, v[i]); }) },
  lamps: { get: () => lamps.map(l => !!l.userData.on), set: v => v.forEach((on, i) => { if (lamps[i] && !!lamps[i].userData.on !== on) setLamp(lamps[i], on); }) },
  blinds: { get: () => officeFx.blinds.map(b => !!b.open), set: v => v.forEach((o, i) => { const b = officeFx.blinds[i]; if (b && !!b.open !== o) blindsToggle(b); }) },
  flap: { get: () => !!flapOpen, set: v => { if (!!flapOpen !== v) toggleFlap(); } },
  cooler: { get: () => !!coolerOpen, set: v => { coolerOpen = v; } },
  exits: { get: () => [!!fireExit.open, !!storeExit.open],   // the emergency exits: a push on the bar is shared; each side's closer shuts it once neither of you is near
    set: v => v.forEach((o, i) => { const E = [fireExit, storeExit][i]; if (o && E.leaf && !E.open) fireExitUse("in", E); }) },
  stool: { get: () => stool.carried || stool.by || onStool ? tgWorld.last.stool : [+stool.x.toFixed(2), +stool.z.toFixed(2)],   // (in someone's hands: where it was)
    set: v => { if (!v || stool.carried || stool.by || onStool) return; stool.x = v[0]; stool.z = v[1]; stoolFit(stool.x, stool.z, stool.box); stool.g.position.set(stool.x, 0, stool.z); } },
  cutout: { get: () => cutout.carried ? tgWorld.last.cutout : [+cutout.x.toFixed(2), +cutout.z.toFixed(2), +cutout.ry.toFixed(3)],
    set: v => { if (!v || cutout.carried) return; [cutout.x, cutout.z, cutout.ry] = v; cutoutFit(cutout.x, cutout.z, cutout.ry, cutout.box); cutout.g?.position.set(cutout.x, 0, cutout.z); cutout.g?.rotation.set(0, cutout.ry, 0); tvBake = bakeTvVis(); } },
};
function tgDoorSet(d, open) {                    // as if it were swung here: you step out of its way. A lock (customer mode's) doesn't stop it: it's open over there
  if (!open && playerIn(d.shut)) return;         // (you're in the doorway: it'll go when the host next says, once you're through)
  const was = d.locked; d.locked = false; toggleDoor(d); d.locked = was;
}
function tgWorldTick() {                         // (from tgSend, so it goes on in a background tab)
  const T = together, now = performance.now(); if (T.ctl?.readyState !== "open" || !T.peer || now - tgWorld.at < 250) return;
  tgWorld.at = now;
  const full = T.host && now - tgWorld.fullAt > 3000, out = {};
  for (const [k, p] of Object.entries(TG_PARTS)) {
    const v = p.get(), j = JSON.stringify(v);
    if (j !== JSON.stringify(tgWorld.last[k])) { tgWorld.last[k] = v; tgWorld.touched[k] = now; out[k] = v; }
    else if (full && v !== undefined) out[k] = v;
  }
  if (full) tgWorld.fullAt = now;
  if (Object.keys(out).length) try { T.ctl.send(JSON.stringify({ t: "world", s: out, full })); } catch {}
}
function tgWorldApply(d) {
  const now = performance.now();
  for (const [k, v] of Object.entries(d.s || {})) {
    const p = TG_PARTS[k]; if (!p) continue;
    if (d.full && now - (tgWorld.touched[k] || 0) < 1500) continue;   // (changed here a moment ago: what's on its way over is newer)
    try { p.set(v); } catch (e) { console.warn("Play together: couldn't set", k, e); }
    tgWorld.last[k] = v;                         // (said: not to be sent back)
  }
}

// ---- the other player ----
function tgPeerArrives(name, seed, uniform, guest, outfit) {   // outfit: what they see when they look down (an older copy of the game didn't send it: made up from the seed, then)
  const rnd = seeded(seed), female = !guest && rnd() < 0.5, theirs = outfit && typeof outfit === "object" && !Array.isArray(outfit) ? JSON.parse(JSON.stringify(outfit)) : null;
  const c = VaultCustomers.build({ ...VaultCustomers.randomOutfit(rnd, female), hat: null, ...(guest ? GUEST_LOOK : {}), ...(theirs || {}),
    ...(uniform ? { top: "uniform", topA: "#1b3fa0", topB: "#ffd400", longSleeves: false, nameTag: name.split(" ")[0].toUpperCase() } : {}) });
  c.glows.forEach(glow); c.setMood("happy");
  const label = tgLabel(name); label.position.y = 2.2 * (c.group.scale.y || 1); c.group.add(label);
  c.group.visible = false;                      // (till the first word of where they are)
  together.g.add(c.group);
  together.peer = { name, c, label, to: null, ry: 0, speed: 0, pose: 0, hipY: 0, tuck: 0, heard: performance.now() };
}
function tgLabel(name) {                        // a name over their head: there's nothing else to tell them from a customer
  const cv = document.createElement("canvas"); cv.width = 512; cv.height = 96;
  const g = cv.getContext("2d"), font = "bold 56px Verdana, sans-serif"; g.font = font;
  const w = Math.min(500, g.measureText(name).width + 40);
  g.fillStyle = "rgba(10,26,69,0.85)"; g.beginPath(); g.roundRect(256 - w / 2, 8, w, 80, 16); g.fill();
  g.fillStyle = "#ffd400"; g.font = font; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(name, 256, 50, 470);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(1.1, 0.206, 1);
  return s;
}
function tgPeerGone() {
  const T = together, P = T.peer; if (!P) return;
  T.peer = null; T.g.remove(P.c.group); P.c.dispose();
  P.label.material.map.dispose(); P.label.material.dispose();
}
function togetherTick(dt) {                     // the main loop: eases them to where they last said they were
  const T = together, P = T.peer; if (!P) return;
  if (performance.now() - P.heard > TOGETHER.silentFor) return tgLost();
  const g = P.c.group; if (!P.to) return;
  g.rotation.order = "YXZ"; g.rotation.x += ((P.prone ? 1 : -1) * (P.tilt || 0) * Math.PI / 2 - g.rotation.x) * Math.min(1, dt * 12);
  if (P.tilt > 0.4) {                            // (down: folded round what's there, in this copy of the store too. Their head's the far end from the feet)
    const dn = P.prone ? -1 : 1, fx = dn * Math.sin(P.to.ry), fz = dn * Math.cos(P.to.ry), b = bodyBend(P.to.x - fx * FALL.long, P.to.z - fz * FALL.long, fx, fz, P.to.ry); P.c.setBend(b.legs, b.arm0, b.arm1);
  } else P.c.setBend();
  const dx = P.to.x - g.position.x, dy = P.to.y - g.position.y, dz = P.to.z - g.position.z, d = Math.hypot(dx, dz);
  if (!g.visible || d > 6 || Math.abs(dy) > 3) {   // first seen, or they've gone further than anybody walks in a moment: no sliding over there
    g.position.set(P.to.x, P.to.y, P.to.z); P.ry = P.to.ry; g.visible = true; P.c.tick(dt, 0); return;
  }
  const k = 1 - Math.exp(-dt * 12);
  g.position.x += dx * k; g.position.y += dy * k; g.position.z += dz * k;
  P.ry += Math.atan2(Math.sin(P.to.ry - P.ry), Math.cos(P.to.ry - P.ry)) * k; g.rotation.y = P.ry;
  P.speed += (d * k / Math.max(dt, 1e-4) - P.speed) * Math.min(1, dt * 10);   // smoothed, or the legs flicker between updates
  P.c.tick(dt, P.speed < 0.15 || P.tilt > 0.05 ? 0 : P.speed);
}


// ---- the menu ----
function togetherOpen() { tgButtons(); if (together.state === "off" && !tgCam.want) tgStatus(""); }
function togetherJoinScan() {                   // JOIN: the camera on, for the host's code
  tgStatus("Hold this device's camera up to the code on the host's screen, or paste the code they sent you.");
  tgScanStart("o");
}
// ---- the guest ----
function tgBecomeGuest(offer, who) {            // the store's built for who you are as the page loads, so joining's a reload: the reply goes from the other side of it
  try {
    sessionStorage.setItem("vaultbuster-guest", JSON.stringify({ who, offer }));
    sessionStorage.setItem("vaultbuster-play", "1");
  } catch { return tgStatus("This browser won't let the page remember it's joining.", true); }
  if (started) saveState();                     // (your own store, where you left it)
  saveOff = true; location.reload();
}
function guestSetup() {                         // (from main.js, as the store's restored) just inside the door, the store open, till the host's clock comes through
  shift.h = 14; setFrontLock(false); armGates(false);
  shift.greet = `You're ${GUEST.who}'s guest. Tapes are free: take one to a TV and press E`;
}
function tgGuestLeaves(note, bad = false) {     // note: what to say on Play Together once the menu's back (why it ended)
  try { sessionStorage.removeItem("vaultbuster-guest"); if (note) sessionStorage.setItem("vaultbuster-tg-note", JSON.stringify({ note, bad })); } catch {}
  location.reload();
}
function tgNoteShown() {                        // (from the title menu) -> what to say, if a guest's just been sent home, once
  try { const n = JSON.parse(sessionStorage.getItem("vaultbuster-tg-note")); sessionStorage.removeItem("vaultbuster-tg-note"); return n; } catch { return null; }
}
if (GUEST?.offer) {                             // just reloaded to join. (Once: a reload after this is a guest with nobody to connect to, free to leave)
  const { offer, who } = GUEST;
  try { sessionStorage.setItem("vaultbuster-guest", JSON.stringify({ who })); } catch {}
  togetherJoin(offer, who);
} else if (GUEST) tgStatus("The link to your host is gone (the page was reloaded). Leave, and join again from a new code.", true);
$("tgHost").onclick = togetherHost;
$("tgJoin").onclick = togetherJoinScan;
$("tgStop").onclick = () => GUEST ? tgGuestLeaves() : tgStop();
addEventListener("pagehide", () => {
  const T = together;
  try { if (T.ctl?.readyState === "open") T.ctl.send('{"t":"bye"}'); } catch {}
});
