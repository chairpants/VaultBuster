// VaultBuster POS/NET — the register's green-screen terminal: a telnet
// session into the store's (SCO Unix, naturally) back-office box, running a
// menu-driven rental system. Classic script, like couch.js: store.js calls
// window.createPOS(api) once the shelves are stocked.
//
// api: {
//   catalog,            every title (copies hang off t.copies)
//   rented,             the copies store.js pulled off the shelves as "out on rental"
//   savedRental(copy),  [member #, out ms] from last visit, if this copy's rental was saved
//   budget,             store budget from last visit (a fresh store starts with $300)
//   replace(copy),      a replacement for a lost copy arrived: store.js puts it in the returns bin
//   returnBin(), held(), playing(),   live store state, read on demand
//   alarm(), silenceAlarm(),          security gate alarm: is it going off / shut it up
//   gatesArmed(), armGates(on),       the gate system itself: armed or switched off entirely
//   resetSave(),                      wipe the saved store and reload (SYSRESET)
//   onClose(),          player logged off / backed out
//   onRedraw(canvas),   the screen changed — mirror it onto the in-world monitor
// }
// -> { open(), close(), isOpen(), key(e), canvas, members, dueIn(rental), checkIn(copy), checkOut(copy, member), sale(amount), budget(), rentalOf(copy) }
window.createPOS = function createPOS(api) {
  const COLS = 80, ROWS = 25;
  // DOS-app palette: blue screen, light grey text, cyan title/key bars, grey
  // highlight bar for the arrow-key selection. VT323 (Google Fonts, loaded in
  // index.html) with a monospace fallback offline
  const C = { bg: "#0000aa", fg: "#c8c8d8", bar: "#00aaaa", barFg: "#000000", sel: "#c8c8d8", selFg: "#0000aa" };
  const FONT = "VT323, 'Courier New', monospace";

  // ---- seeded randomness: the same customers every visit within a session ----
  let seed = 0x5eed1996;
  const rnd = () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  // ---- formatting ----
  const DAY = 864e5;
  const TODAY = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();   // real date: the shelves hold titles into the 2000s
  const fmtD = d => `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  const clock = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`; };
  const money = n => "$" + n.toFixed(2);
  const L = (s, n) => (String(s) + " ".repeat(n)).slice(0, n);
  const R = (s, n) => (" ".repeat(n) + String(s)).slice(-n);
  const up = s => String(s).toUpperCase();

  // ---- the store's data ----
  const meta = window.VAULT_META || {};
  const yearOf = t => meta[t.id]?.[0] || "";
  const copiesOf = t => [t, ...(t.copies || [])];
  // a copy is Object.create(title) (see store.js); the title itself is copy #1
  const titleOf = c => Object.hasOwn(c, "copies") || Object.getPrototypeOf(c) === Object.prototype ? c : Object.getPrototypeOf(c);
  const isTV = t => t.seasons.length > 1 || t.seasons[0].episodes.length > 1;
  const priceOf = t => t.newRelease ? { cls: "NEW RELEASE", nights: 2, rate: 3.99, late: 2.00 } : { cls: "CATALOG", nights: 5, rate: 1.99, late: 1.00 };
  const FIRST = ["JOHN", "MARY", "DAVID", "LISA", "MIKE", "KAREN", "STEVE", "SUSAN", "CHRIS", "AMY", "BRIAN", "DONNA", "KEVIN", "TINA", "JASON",
    "HEATHER", "SCOTT", "WENDY", "TODD", "DAWN", "GREG", "SHANNON", "RAY", "TRACY", "DOUG", "ANGELA", "PHIL", "KIM", "ERIC", "MELISSA", "RON", "JILL",
    "DANNY", "STACY", "TROY", "APRIL", "GARY", "NICOLE", "DEREK", "JENNY", "MARCUS", "BECKY", "LUIS", "ROSA", "ANDRE", "KEISHA", "DALE", "PAM"];
  const LAST = ["SMITH", "JOHNSON", "MILLER", "DAVIS", "GARCIA", "WILSON", "ANDERSON", "TAYLOR", "THOMAS", "MOORE", "MARTIN", "JACKSON", "THOMPSON",
    "WHITE", "LOPEZ", "HARRIS", "CLARK", "LEWIS", "ROBINSON", "WALKER", "YOUNG", "ALLEN", "KING", "WRIGHT", "SCOTT", "HILL", "GREEN", "ADAMS",
    "BAKER", "NELSON", "CARTER", "MITCHELL", "ROBERTS", "TURNER", "PHILLIPS", "CAMPBELL", "PARKER", "EVANS", "EDWARDS", "COLLINS", "STEWART",
    "MORRIS", "MURPHY", "COOK", "ROGERS", "REED", "BAILEY", "KOWALSKI", "NGUYEN", "OKAFOR", "BRENNAN", "DELUCA"];
  const STREETS = ["MAPLE AVE", "OAK ST", "ELM ST", "CEDAR LN", "PINE RIDGE RD", "LAKEVIEW DR", "2ND ST", "MAIN ST", "HIGHLAND AVE", "SUNSET BLVD",
    "WILLOW CT", "BIRCH WAY", "PARK PL", "RIVER RD", "HILLCREST DR", "ORCHARD LN", "MILL ST", "CHESTNUT ST", "FAIRVIEW AVE", "BROOKSIDE DR"];
  const NOTES = ["", "", "", "", "", "PAYS IN QUARTERS", "DAMAGED TAPE 03/96 - PAID", "NO R-RATED (PARENT REQUEST)", "HORROR FAN - CALL ON NEW ARRIVALS",
    "BOUNCED CHECK 11/95 - CASH ONLY", "EMPLOYEE FAMILY", "REWIND FEE WAIVED 2X - LAST WARNING", "ON RESERVE LIST FOR NEW RELEASES",
    "ALWAYS ASKS FOR STAFF PICKS", "RETURNED TAPE IN WRONG CASE 2X", "ACCT FROZEN ONCE - FEES PAID 07/96"];
  const customers = [];
  const usedNums = new Set();
  for (let i = 0; i < 140; i++) {
    let num; do num = int(10001, 48999); while (usedNums.has(num)); usedNums.add(num);
    customers.push({
      num, first: pick(FIRST), last: pick(LAST), phone: `555-${String(int(0, 9999)).padStart(4, "0")}`,
      addr: `${int(12, 9870)} ${pick(STREETS)}`, since: int(1987, 1996), lifetime: int(3, 640),
      notes: pick(NOTES), heavy: rnd() < 0.2, rentals: [],
    });
  }
  customers.sort((a, b) => a.last.localeCompare(b.last) || a.first.localeCompare(b.first));
  const heavy = customers.filter(c => c.heavy);
  const fullName = c => `${c.last}, ${c.first}`;
  // every copy store.js pulled off the shelf is checked out to somebody —
  // regulars take the lion's share
  const rentals = api.rented.map(copy => {
    const saved = api.savedRental?.(copy), p = priceOf(copy);
    const cust = saved && customers.find(c => c.num === saved[0]) || (rnd() < 0.55 ? pick(heavy) : pick(customers));
    const out = saved ? new Date(saved[1]) : new Date(TODAY - int(0, p.nights + 4) * DAY), due = new Date(+out + p.nights * DAY);
    const r = { copy, cust, out, due };
    copy.rental = r; cust.rentals.push(r); return r;
  });
  const daysLate = r => Math.max(0, Math.round((TODAY - r.due) / DAY));
  const lateFee = r => daysLate(r) * priceOf(r.copy).late;
  const custFees = c => c.rentals.reduce((a, r) => a + lateFee(r), 0);
  let budget = api.budget ?? 300;
  const replaceCost = t => t.newRelease ? 64.95 : 24.95;   // studio pricing: new releases come in at rental-market prices
  const copyStatus = c => c.lost ? "LOST - STOLEN" : c === api.held() ? "IN HAND (STAFF)" : api.returnBin().includes(c) ? "IN RETURNS BIN"
    : api.playing()?.tape === c ? "IN LOUNGE VCR" : c.rental ? `OUT #${c.rental.cust.num} DUE ${fmtD(c.rental.due)}${daysLate(c.rental) ? ` LATE ${daysLate(c.rental)}D` : ""}`
    : c.offShelf ? "UNACCOUNTED" : "ON SHELF";
  const copyIn = t => copiesOf(t).filter(c => !c.offShelf).length;

  // ---- terminal state ----
  const canvas = document.createElement("canvas"); canvas.width = 800; canvas.height = 600;   // ~the monitor glass's 4:3
  const ctx = canvas.getContext("2d");
  const el = document.createElement("div"); el.id = "posTerm"; el.hidden = true;
  const pre = document.createElement("pre"); el.appendChild(pre); document.body.appendChild(el);
  let open = false, mode = "boot", input = "", user = "";
  let scroll = ["Starting MS-DOS...", "", "MS-DOS Version 6.22", "", "VAULTBUSTER VIDEO #0417 - REGISTER 01", "", "C:\\>"];   // scroll: raw console lines before the app starts
  let screen = null;                               // app screen: { title, lines(), prompt, submit(v), back() }
  const stack = [];
  let msg = "";                                    // one-line status message under the body

  function blankApp() { return Array.from({ length: ROWS }, () => ({ t: "", inv: false })); }
  function frame() {                               // -> ROWS rows of { t, inv }
    if (mode !== "app") {
      const rows = blankApp(), lines = [...scroll];
      if (mode === "login" || mode === "pass") lines.push((mode === "login" ? "vbpos!login: " : "Password: ") + (mode === "pass" ? "" : input) + "\u2588");
      lines.slice(-ROWS).forEach((l, i) => rows[i].t = l);
      return rows;
    }
    const rows = blankApp();
    rows[0] = { t: L(` VAULTBUSTER VIDEO  POS/NET 2.3    STORE #0417  TERM 01  ${user}`, COLS - 16) + R(`${fmtD(TODAY)} ${clock()} `, 16), inv: true };
    rows[1].t = " " + screen.title;
    rows[2].t = " " + "-".repeat(COLS - 2);
    screen.lines().slice(0, ROWS - 7).forEach((l, i) => rows[3 + i].t = l);
    const pk = screen.pick;
    if (pk && pk.count()) { pk.cur = Math.min(pk.cur, pk.count() - 1); const r = rows[3 + pk.line(pk.cur)]; if (r) r.sel = true; }
    rows[ROWS - 4].t = " " + "-".repeat(COLS - 2);
    rows[ROWS - 3].t = msg ? " " + msg : "";
    rows[ROWS - 2].t = ` ${screen.prompt || "SELECTION"}: ${input}\u2588`;
    rows[ROWS - 1] = { t: L((screen.pick ? " \u2191\u2193=MOVE  " : " ") + "ENTER=SELECT   ESC=BACK   F10=LOG OFF" + (screen.pager ? "   N/P=PAGE" : ""), COLS), inv: true };
    return rows;
  }
  function draw() {
    const rows = frame();
    pre.innerHTML = rows.map(r => {
      const t = L(r.t, COLS).replace(/&/g, "&amp;").replace(/</g, "&lt;");
      return r.inv ? `<span class="inv">${t}</span>` : r.sel ? `<span class="sel">${t}</span>` : t;
    }).join("\n");
    // in-world monitor mirror
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cw = canvas.width / COLS, ch = canvas.height / ROWS;
    ctx.font = `${ch * 1.05}px ${FONT}`; ctx.textBaseline = "top";
    rows.forEach((r, i) => {
      if (r.inv || r.sel) { ctx.fillStyle = r.inv ? C.bar : C.sel; ctx.fillRect(0, i * ch, canvas.width, ch); }
      ctx.fillStyle = r.inv ? C.barFg : r.sel ? C.selFg : C.fg;
      [...L(r.t, COLS)].forEach((c, k) => { if (c !== " ") ctx.fillText(c, k * cw, i * ch + ch * 0.05); });
    });
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.5)"); ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    api.onRedraw(canvas);
  }

  // ---- console (pre-login) ----
  let bootTimers = [];
  function boot(first) {
    mode = "boot"; scroll = []; input = ""; bootTimers.forEach(clearTimeout); bootTimers = [];
    const lines = first
      ? ["C:\\>telnet vbpos", "", "Trying 192.168.4.17...", "Connected to vbpos.", "Escape character is '^]'.", "",
         "SCO UNIX System V/386 Release 3.2", "Copyright (C) 1976-1989 UNIX System Laboratories, Inc.", "Copyright (C) 1980-1989 Microsoft Corporation",
         "Copyright (C) 1983-1992 The Santa Cruz Operation, Inc.", "All Rights Reserved", "", "vbpos", ""]
      : ["C:\\>telnet vbpos", "", "Trying 192.168.4.17...", "Connected to vbpos.", "Escape character is '^]'.", ""];
    lines.forEach((l, i) => bootTimers.push(setTimeout(() => { scroll.push(l); draw(); }, 90 * i + (i > 2 ? 350 : 0))));
    bootTimers.push(setTimeout(() => { mode = "login"; draw(); }, 90 * lines.length + 450));
    draw();
  }
  let booted = false;

  // ---- app screens ----
  function go(s) { if (screen) stack.push(screen); screen = s; input = ""; msg = ""; draw(); }
  function back() { input = ""; msg = ""; if (stack.length) { screen = stack.pop(); draw(); } else logoff(); }
  // a paged, numbered pick list
  function listScreen(title, head, items, row, onPick, empty = "NO RECORDS FOUND.") {
    const per = ROWS - 9; let page = 0;
    const pages = () => Math.max(1, Math.ceil(items.length / per));
    const scr = {
      title: `${title}  (${items.length} RECORD${items.length === 1 ? "" : "S"})`, pager: true, prompt: onPick ? "RECORD # OR N/P" : "N/P OR ESC",
      lines: () => items.length ? [head, ...items.slice(page * per, page * per + per).map((it, i) => row(it, page * per + i + 1)),
        ...Array(Math.max(0, per - (items.length - page * per))).fill(""), R(`PAGE ${page + 1} OF ${pages()} `, COLS - 1)] : ["", " " + empty],
      submit(v) {
        if (v === "N") { if (page < pages() - 1) page++; else msg = "LAST PAGE."; return draw(); }
        if (v === "P") { if (page > 0) page--; else msg = "FIRST PAGE."; return draw(); }
        const n = parseInt(v, 10);
        if (onPick && n >= 1 && n <= items.length) return onPick(items[n - 1]);
        msg = "INVALID SELECTION."; draw();
      },
    };
    // arrow keys walk the records (turning pages as needed); ENTER opens the highlighted one
    if (onPick && items.length) scr.pick = { cur: 0, count: () => items.length, value: i => String(i + 1),
      line: i => 1 + i - page * per, moved: i => { page = Math.floor(i / per); } };
    return scr;
  }
  function prompt(title, label, help, onValue) {
    return { title, prompt: label, lines: () => ["", ...help.map(h => " " + h)], submit(v) { if (v) onValue(v); else { msg = "ENTRY REQUIRED."; draw(); } } };
  }

  const titleRow = (t, n) => ` ${R(n, 3)}  ${L(up(t.title), 36)} ${L(up(t.category), 20)} ${L(yearOf(t), 4)} ${R(copiesOf(t).length, 3)} ${R(copyIn(t), 3)}`;
  const titleHead = `      ${L("TITLE", 36)} ${L("SECTION", 20)} YEAR CPY  IN`;
  function titleDetail(t) {
    const p = priceOf(t), eps = t.seasons.reduce((a, s) => a + s.episodes.length, 0);
    const cs = copiesOf(t);
    go({
      title: `TITLE INQUIRY - ${up(t.title)}`.slice(0, COLS - 2), prompt: "COPY # FOR RENTER, ESC",
      lines: () => [
        ` TITLE....: ${up(t.title)}`.slice(0, COLS),
        ` SECTION..: ${up(t.category)}${isTV(t) ? `        FORMAT: TV SERIES, ${t.seasons.length} VOL / ${eps} EP` : "        FORMAT: FEATURE"}`,
        ` YEAR.....: ${yearOf(t) || "N/A"}       SKU: VB-${(t.id.split("").reduce((a, c) => a * 31 + c.charCodeAt(0) >>> 0, 7) % 900000 + 100000)}`,
        ` CLASS....: ${p.cls}  ${p.nights}-NIGHT ${money(p.rate)}   LATE ${money(p.late)}/DAY`,
        ` STOCK....: ${cs.length} COPIES, ${copyIn(t)} IN / ${cs.length - copyIn(t)} OUT`, "",
        "  COPY  STATUS", ...cs.slice(0, 12).map((c, i) => `  ${String(i + 1).padStart(2, "0")}    ${copyStatus(c)}`),
        ...(cs.length > 12 ? [`  ... ${cs.length - 12} MORE`] : []),
      ],
      submit(v) {
        const c = cs[parseInt(v, 10) - 1];
        if (c?.rental) return custDetail(c.rental.cust);
        msg = c ? "COPY IS NOT CHECKED OUT." : "INVALID SELECTION."; draw();
      },
    });
  }
  function custDetail(c) {
    go({
      title: `MEMBER INQUIRY - #${c.num}`, prompt: "RENTAL # FOR TITLE, ESC",
      lines: () => [
        ` MEMBER #.: ${c.num}                 MEMBER SINCE: ${c.since}`,
        ` NAME.....: ${fullName(c)}`,
        ` ADDRESS..: ${c.addr}`,
        ` PHONE....: ${c.phone}                LIFETIME RENTALS: ${c.lifetime + c.rentals.length}`,
        ` STATUS...: ${custFees(c) ? `FEES DUE ${money(custFees(c))} - COLLECT BEFORE RENTAL` : c.rentals.length ? "ACTIVE" : "GOOD STANDING"}`,
        ` NOTES....: ${c.notes || "-"}`, "",
        c.rentals.length ? `  #   ${L("OUT", 9)}${L("DUE", 9)}${L("TITLE", 38)}LATE FEE` : "  NO RENTALS OUT.",
        ...c.rentals.slice(0, 9).map((r, i) => `  ${i + 1}   ${L(fmtD(r.out), 9)}${L(fmtD(r.due), 9)}${L(up(r.copy.title), 38)}${daysLate(r) ? money(lateFee(r)) : "-"}`),
      ],
      submit(v) { const r = c.rentals[parseInt(v, 10) - 1]; if (r) titleDetail(titleOf(r.copy)); else { msg = "INVALID SELECTION."; draw(); } },
    });
  }
  const custRow = (c, n) => ` ${R(n, 3)}  ${R(c.num, 6)}  ${L(fullName(c), 26)} ${L(c.phone, 9)} ${R(c.rentals.length, 3)}  ${custFees(c) ? R(money(custFees(c)), 8) : R("-", 8)}`;
  const custHead = `       MEMBR  ${L("NAME", 26)} ${L("PHONE", 9)} OUT      FEES`;
  const findTitles = q => api.catalog.filter(t => up(t.title).includes(q));
  const findCusts = q => customers.filter(c => String(c.num) === q || fullName(c).includes(q) || c.phone.endsWith(q));

  const MENU = [
    ["1", "INVENTORY - TITLE SEARCH", () => go(prompt("INVENTORY - TITLE SEARCH", "TITLE (OR PART)", ["ENTER ANY PART OF A TITLE.  EXAMPLE: ALIEN"],
      q => go(listScreen(`TITLE SEARCH: ${q}`, titleHead, findTitles(q), titleRow, titleDetail))))],
    ["2", "INVENTORY - BROWSE BY SECTION", () => {
      const cats = [...new Set(api.catalog.map(t => t.category))].sort();
      go(listScreen("SECTIONS", `      ${L("SECTION", 30)} TITLES  COPIES  OUT`, cats,
        (c, n) => { const ts = api.catalog.filter(t => t.category === c), cp = ts.reduce((a, t) => a + copiesOf(t).length, 0), inn = ts.reduce((a, t) => a + copyIn(t), 0);
          return ` ${R(n, 3)}  ${L(up(c), 30)} ${R(ts.length, 6)}  ${R(cp, 6)}  ${R(cp - inn, 3)}`; },
        c => go(listScreen(up(c), titleHead, api.catalog.filter(t => t.category === c), titleRow, titleDetail))));
    }],
    ["3", "MEMBERS - LOOKUP (NAME / MEMBER # / PHONE)", () => go(prompt("MEMBER LOOKUP", "NAME, MEMBER # OR PHONE", ["LAST NAME, PART OF A NAME, 5-DIGIT MEMBER #, OR LAST 4 OF PHONE."],
      q => go(listScreen(`MEMBER SEARCH: ${q}`, custHead, findCusts(q), custRow, custDetail))))],
    ["4", "MEMBERS - ALL ACCOUNTS", () => go(listScreen("ALL MEMBERS", custHead, customers, custRow, custDetail))],
    ["5", "REPORTS - OVERDUE / LATE FEES", () => {
      const od = customers.filter(c => custFees(c) > 0).sort((a, b) => custFees(b) - custFees(a));
      go(listScreen("OVERDUE ACCOUNTS", custHead, od, custRow, custDetail, "NO OVERDUE ACCOUNTS. NICE."));
    }],
    ["6", "REPORTS - RENTALS OUT", () => {
      const out = [...rentals].sort((a, b) => a.due - b.due);
      go(listScreen("RENTALS OUT", `      ${L("TITLE", 34)} ${L("MEMBER", 20)} DUE      LATE`, out,
        (r, n) => ` ${R(n, 3)}  ${L(up(r.copy.title), 34)} ${L(fullName(r.cust), 20)} ${fmtD(r.due)} ${daysLate(r) ? R(daysLate(r) + "D", 4) : "   -"}`,
        r => custDetail(r.cust)));
    }],
    ["7", "RETURNS BIN - CHECK-IN QUEUE", () => go(listScreen("RETURNS BIN", titleHead, api.returnBin().map(titleOf),
      titleRow, titleDetail, "RETURNS BIN IS EMPTY."))],
    ["8", "REPORTS - DAILY SUMMARY", () => {
      const allC = api.catalog.reduce((a, t) => a + copiesOf(t).length, 0), inC = api.catalog.reduce((a, t) => a + copyIn(t), 0);
      const today = rentals.filter(r => Math.round((TODAY - r.out) / DAY) === 0);
      const od = rentals.filter(r => daysLate(r));
      const fees = rentals.reduce((a, r) => a + lateFee(r), 0);
      const top = [...api.catalog].filter(t => t.copies?.length).sort((a, b) => (copiesOf(b).length - copyIn(b)) - (copiesOf(a).length - copyIn(a))).slice(0, 5);
      go({ title: `DAILY SUMMARY - ${fmtD(TODAY)}`, prompt: "ESC TO RETURN", lines: () => [
        ` TITLES IN SYSTEM........ ${R(api.catalog.length, 8)}      MEMBERS............ ${R(customers.length, 8)}`,
        ` COPIES IN SYSTEM........ ${R(allC, 8)}      ACCOUNTS W/ FEES... ${R(customers.filter(c => custFees(c)).length, 8)}`,
        ` COPIES ON SHELF......... ${R(inC, 8)}      LATE FEES OWED..... ${R(money(fees), 8)}`,
        ` COPIES OUT.............. ${R(allC - inC, 8)}      RETURNS BIN........ ${R(api.returnBin().length, 8)}`,
        ` OVERDUE COPIES.......... ${R(od.length, 8)}`, "",
        ` RENTALS TODAY........... ${R(today.length, 8)}      GROSS TODAY........ ${R(money(today.reduce((a, r) => a + priceOf(r.copy).rate, 0)), 8)}`, "",
        "  MOST RENTED RIGHT NOW:", ...top.map((t, i) => `   ${i + 1}. ${L(up(t.title), 40)} ${copiesOf(t).length - copyIn(t)} OF ${copiesOf(t).length} OUT`),
      ], submit() { back(); } });
    }],
    ["9", "LOUNGE - PREVIEW STATION STATUS", () => go({ title: "PREVIEW STATION", prompt: "ESC TO RETURN", lines: () => {
      const p = api.playing();
      return p ? ["", ` VCR......: PLAYING`, ` TAPE.....: ${up(p.tape.title)}`, ` SECTION..: ${up(p.tape.category)}`]
        : ["", " VCR......: EMPTY", "", " INSERT A TAPE AT THE LOUNGE TV TO PREVIEW IT."];
    }, submit() { back(); } })],
    ["H", "HELP / COMMANDS", () => go({ title: "HELP", prompt: "ESC TO RETURN", lines: () => [
      " FROM THE MAIN MENU YOU CAN TYPE A NUMBER, OR A COMMAND:", "",
      "   FIND <TITLE>     TITLE SEARCH            MEMBER <NAME|#>   MEMBER LOOKUP",
      "   OVERDUE          LATE FEE REPORT         OUT               RENTALS OUT",
      "   RETURNS          RETURNS BIN             REPORT            DAILY SUMMARY",
      "   VER              VERSION                 LOGOFF / EXIT     END SESSION",
      "   SYSRESET         WIPE THE SAVED STORE AND START FRESH", "",
      " ESC GOES BACK ONE SCREEN. F10 LOGS OFF FROM ANYWHERE.", "",
      " SYSTEM PROBLEMS? CALL DENNIS (DISTRICT) - DO NOT REBOOT THE SERVER.",
    ], submit() { back(); } })],
    ["S", "SECURITY - GATE SYSTEM", () => go({ title: "SECURITY GATE SYSTEM", prompt: "Y TO CHANGE, ESC TO CANCEL", lines: () => {
      const armed = api.gatesArmed();
      return ["", ` SYSTEM STATUS..: ${armed ? "ARMED" : "*** DISARMED ***"}`, " ZONE...........: ENTRY LANE (3 PEDESTALS)",
        ` ALARM..........: ${api.alarm() ? "SOUNDING" : "QUIET"}`, "",
        armed ? " DISARM THE GATES? TAGGED TAPES WILL PASS THROUGH WITHOUT AN ALARM." : " RE-ARM THE GATES?",
        "", armed ? " STORE POLICY: GATES STAY ARMED DURING BUSINESS HOURS." : " REMEMBER TO RE-ARM BEFORE OPENING."];
    }, submit(v) {
      if (v !== "Y") { msg = "TYPE Y TO CHANGE."; return draw(); }
      const arm = !api.gatesArmed(); api.armGates(arm); back(); msg = arm ? "GATES ARMED." : "GATES DISARMED - NO ALARMS WILL SOUND."; draw();
    } })],
    ["B", "BUDGET - ORDER REPLACEMENT COPIES", () => {
      const lost = api.catalog.flatMap(copiesOf).filter(c => c.lost);
      go(listScreen(`LOST / STOLEN COPIES - BUDGET ${money(budget)}`, `      ${L("TITLE", 44)} ${L("CLASS", 12)}    COST`, lost,
        (c, n) => ` ${R(n, 3)}  ${L(up(c.title), 44)} ${L(priceOf(c).cls, 12)} ${R(money(replaceCost(c)), 7)}`,
        c => go({ title: "ORDER REPLACEMENT", prompt: "Y TO ORDER, ESC TO CANCEL", lines: () => ["",
          ` TITLE....: ${up(c.title)}`.slice(0, COLS), ` COST.....: ${money(replaceCost(c))}`, ` BUDGET...: ${money(budget)}`, "",
          budget >= replaceCost(c) ? " SHIPS WITH TODAY'S DELIVERY - CHECK THE RETURNS BIN." : " *** INSUFFICIENT BUDGET ***"],
          submit(v) {
            if (v !== "Y") { msg = "TYPE Y TO ORDER."; return draw(); }
            if (!c.lost) { back(); return; }
            if (budget < replaceCost(c)) { msg = "INSUFFICIENT BUDGET."; return draw(); }
            budget -= replaceCost(c); c.lost = false; api.replace(c);   // ponytail: arrives instantly; add a delivery delay if it should take a day
            back(); back(); msg = `ORDERED: ${up(c.title)}. BUDGET NOW ${money(budget)}.`; draw();
          } }),
        "NO LOST COPIES ON FILE."));
    }],
    ["0", "LOG OFF", () => logoff()],
    // only listed while the entry gates are going off
    ["A", "*** SECURITY - SILENCE GATE ALARM ***", () => go({ title: "SECURITY GATE CONTROL", prompt: "Y TO SILENCE, ESC TO CANCEL", lines: () => [
      "", " GATE STATUS....: ALARM", " ZONE...........: ENTRY LANE (3 PEDESTALS)", ` TRIGGERED......: ${clock()}`, " CAUSE..........: ACTIVE SECURITY TAG DETECTED", "",
      " SILENCE THE ALARM AND RESET THE GATES?", "", " REMEMBER: CHECK THE CUSTOMER'S RECEIPT BEFORE THEY LEAVE."],
      submit(v) { if (v !== "Y") { msg = "TYPE Y TO SILENCE."; return draw(); } api.silenceAlarm(); back(); msg = "GATE ALARM SILENCED. GATES RE-ARMED."; draw(); },
    }), () => api.alarm()],
  ];
  const menuItems = () => MENU.filter(m => !m[3] || m[3]());
  const mainMenu = {
    title: "MAIN MENU", prompt: "SELECTION OR COMMAND",
    pick: { cur: 0, count: () => menuItems().length, value: i => menuItems()[i][0], line: i => 1 + i },
    lines: () => ["", ...menuItems().map(([k, label]) => `      ${k}.  ${label}`), "",
      `      ${rentals.filter(r => daysLate(r)).length} OVERDUE RENTALS ON FILE.  RETURNS BIN: ${api.returnBin().length}.  BUDGET: ${money(budget)}.${api.gatesArmed() ? "" : "  GATES: DISARMED."}`],
    submit(v) {
      const [cmd, ...rest] = v.split(/\s+/), arg = rest.join(" ");
      const m = menuItems().find(([k]) => k === v);
      if (m) return m[2]();
      if ((cmd === "FIND" || cmd === "INV") && arg) return go(listScreen(`TITLE SEARCH: ${arg}`, titleHead, findTitles(arg), titleRow, titleDetail));
      if ((cmd === "MEMBER" || cmd === "CUST") && arg) return go(listScreen(`MEMBER SEARCH: ${arg}`, custHead, findCusts(arg), custRow, custDetail));
      const alias = { OVERDUE: "5", OUT: "6", RETURNS: "7", REPORT: "8", HELP: "H", "?": "H", LOGOFF: "0", EXIT: "0", LOGOUT: "0" }[cmd];
      if (alias) return MENU.find(([k]) => k === alias)[2]();
      if (cmd === "SYSRESET") return go({ title: "SYSTEM RESET", prompt: "TYPE RESET TO CONFIRM, ESC TO CANCEL", lines: () => ["",
        " THIS WIPES THE SAVED STORE: INVENTORY, RETURNS, RENTALS, LIGHTS, WHERE YOU", " ARE STANDING, THE TAPE IN THE VCR. THE STORE RELOADS FRESH.", "",
        " TV PICTURE SETTINGS ARE KEPT."],
        submit(v) { if (v === "RESET") api.resetSave(); else { msg = "TYPE RESET TO CONFIRM."; draw(); } } });
      if (cmd === "VER") { msg = "POS/NET 2.3 (C) 1993 VIDEOTRAK SYSTEMS INC.  LICENSED TO VAULTBUSTER VIDEO #0417"; return draw(); }
      msg = `UNKNOWN COMMAND: ${v}.  TYPE H FOR HELP.`; draw();
    },
    back() { logoff(); },
  };

  function logoff() {
    mode = "boot"; screen = null; stack.length = 0; input = ""; msg = "";
    scroll = ["", "Connection closed by foreign host.", "", "C:\\>"];
    draw(); open = false; el.hidden = true; api.onClose();
  }

  // ---- input ----
  function key(e) {
    e.preventDefault();
    if (e.key === "F10") return mode === "app" ? logoff() : close();
    if (e.key === "Escape") {
      if (mode === "app") return screen === mainMenu && !stack.length ? logoff() : back();
      return close();
    }
    if (mode === "boot") return;
    if (e.key === "Backspace") { input = input.slice(0, -1); return draw(); }
    const pk = mode === "app" && screen.pick;
    if (pk && (e.key === "ArrowUp" || e.key === "ArrowDown") && pk.count()) {
      pk.cur = Math.max(0, Math.min(pk.count() - 1, pk.cur + (e.key === "ArrowDown" ? 1 : -1)));
      pk.moved?.(pk.cur); return draw();
    }
    if (pk && e.key === "Enter" && !input.trim() && pk.count()) { msg = ""; input = ""; return screen.submit(pk.value(pk.cur)); }
    if (e.key === "Enter") {
      const v = input.trim(); input = "";
      if (mode === "login") {
        scroll.push("vbpos!login: " + v);
        if (!v) { draw(); return; }
        user = up(v).slice(0, 8); mode = "pass"; return draw();
      }
      if (mode === "pass") {
        scroll.push("Password:");
        mode = "app"; stack.length = 0; screen = mainMenu; msg = `WELCOME, ${user}. LAST LOGIN: ${fmtD(new Date(TODAY - DAY))} 21:47 ON TTY01`;
        return draw();
      }
      if (mode === "app") { msg = ""; screen.submit(up(v)); }
      return;
    }
    if (e.key.length === 1 && input.length < 40) { input += e.key; draw(); }
  }

  function close() { bootTimers.forEach(clearTimeout); open = false; el.hidden = true; api.onClose(); }
  document.fonts?.load("20px VT323").then(() => draw(), () => {});   // repaint the monitor once the web font arrives
  return {
    canvas, key, isOpen: () => open,
    open() {
      open = true; el.hidden = false;
      if (mode === "app") return draw();       // came back mid-session (e.g. after a pause): pick up where you were
      boot(!booted); booted = true;
    },
    close,
    idle() { draw(); },                          // paint the monitor once at startup
    // for store.js's walk-in customers: every member is somebody who might come in
    members: customers,
    dueIn: r => Math.round((r.due - TODAY) / DAY),   // days until a rental's due (negative = late)
    checkOut(copy, cust) {                       // a walk-in rented this copy: on their account, and the money in the budget
      const p = priceOf(copy), out = new Date(), r = { copy, cust, out, due: new Date(+out + p.nights * DAY) };
      copy.rental = r; cust.rentals.push(r); rentals.push(r); budget += p.rate;
      if (open && mode === "app") draw();
    },
    budget: () => budget,
    sale(amount) { budget += amount; if (open && mode === "app") draw(); },   // snacks and drinks at the counter
    rentalOf: c => c.rental && [c.rental.cust.num, +c.rental.out],
    checkIn(copy) {                              // a member dropped this copy back off: close out the rental
      const r = copy.rental; if (!r) return;
      r.cust.rentals.splice(r.cust.rentals.indexOf(r), 1); rentals.splice(rentals.indexOf(r), 1); delete copy.rental;   // off their account and out of the reports
      if (open && mode === "app") draw();
    },
  };
};
