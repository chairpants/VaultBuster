// Build: scan the VaultVision library and emit catalog.js for the store.
// One tape = one show-season (parsed from " - SxxEyy - " episode codes);
// movies / collections / shows without season codes = one tape.
// No deps: node build.mjs [path-to-VaultVision]
import fs from "node:fs";
import path from "node:path";

const ROOT = process.argv[2] ?? process.env.VAULTVISION_ROOT ?? "../VaultVision";
const showsJs = fs.readFileSync(path.join(ROOT, "shows.js"), "utf8");

// shows.js is `window.SHOWS_CSV = \`Title,FolderId,Category,ext\n...\``
const csv = showsJs.match(/SHOWS_CSV\s*=\s*`([\s\S]*?)`/)[1];

// minimal CSV reader (titles can contain commas, e.g. "Ed, Edd N Eddy Series")
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length === 4 && r[1]);
}

const shows = parseCsv(csv);

// extract a window.SHOW field or array from a data.js file without eval
function readShow(id) {
  const src = fs.readFileSync(path.join(ROOT, "shows", id, "data.js"), "utf8");
  const title = src.match(/title:\s*(["'])((?:(?!\1)[^\\]|\\.)*)\1/)?.[2];
  // a few data.js files hoist item ids into consts used bare in episodes
  const consts = {};
  for (const c of src.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])((?:(?!\2)[^\\]|\\.)*)\2/g))
    consts[c[1]] = c[3];
  // episodes: doublets/triplets of quoted strings (either quote style),
  // possibly spread across lines, possibly with a trailing comma; the first
  // field may be a bare const name, the file hint may be absent entirely
  // (the viewer then falls back to the item's first .mp4)
  const eps = [];
  const Q = (a, b) => `(?<${a}>["'])(?<${b}>(?:(?!\\k<${a}>)[^\\\\]|\\\\.)*)\\k<${a}>`;
  const re = new RegExp(`\\[\\s*(?:${Q("q1", "v1")}|(?<id>[A-Za-z_$][\\w$]*))\\s*,\\s*${Q("q2", "v2")}(?:\\s*,\\s*${Q("q3", "v3")})?\\s*,?\\s*\\]`, "g");
  const body = src.slice(src.indexOf("episodes:"));
  let m;
  while ((m = re.exec(body))) eps.push([m.groups.v1 ?? consts[m.groups.id] ?? null, m.groups.v2, m.groups.v3 ?? null]);
  return { title, eps };
}

// season code from the middle " - " segment, e.g. "THE SIMPSONS - S01E01 - Bart"
function seasonOf(epTitle) {
  const bits = epTitle.split(" - ");
  const m = (bits[1] || "").match(/S(\d{1,2})E\d{1,2}/i);
  if (m) return +m[1];
  // some shows put the code inline without " - " separators
  const m2 = epTitle.match(/S(\d{1,2})E\d{1,2}/i);
  return m2 ? +m2[1] : -1;
}

const catalog = [];
let missing = [], noCode = [];
for (const [title, id, category, ext] of shows) {
  if (!fs.existsSync(path.join(ROOT, "shows", id, "data.js"))) { missing.push(id); continue; }
  const { title: dataTitle, eps } = readShow(id);
  const seasons = new Map(); // season# -> episodes
  let coded = 0;
  for (const [iaId, epTitle, file] of eps) {
    const s = seasonOf(epTitle);
    if (s < 0) { noCode.push(id); (seasons.get(-1) ?? seasons.set(-1, []).get(-1)).push([iaId, epTitle, file]); }
    else { coded++; (seasons.get(s) ?? seasons.set(s, []).get(s)).push([iaId, epTitle, file]); }
  }
  const finalTitle = dataTitle || title;
  const art = `art/${id}.${ext.trim()}`;
  if (!fs.existsSync(path.join(ROOT, art))) { missing.push(art); continue; }
  if (seasons.size === 0) { missing.push(id + " (0 episodes parsed)"); continue; }
  if (coded === 0) {
    // flat: movies, collections, un-coded shows -> single tape
    catalog.push({ id, title: finalTitle, category, art,
      seasons: [{ label: "", episodes: eps }] });
  } else {
    // any un-coded stragglers join a "specials" tape (S00 exists in this data)
    const keys = [...seasons.keys()].filter(k => k >= 0).sort((a, b) => a - b);
    for (const s of keys) {
      const eps2 = seasons.get(s);
      if (s === 0 && seasons.get(-1)) eps2.push(...seasons.get(-1));
      catalog.push({ id, title: finalTitle, category, art, season: s,
        seasons: [{ label: `Season ${s}`, episodes: eps2 }] });
    }
    if (seasons.has(-1) && !seasons.has(0)) {
      catalog.push({ id, title: finalTitle, category, art, season: -1,
        seasons: [{ label: "Episodes", episodes: seasons.get(-1) }] });
    }
  }
}

// --- self-check: fail loudly if the scan lost data ---
const epsTotal = catalog.reduce((n, t) => n + t.seasons[0].episodes.length, 0);
console.assert(catalog.length > 700, `suspiciously few tapes: ${catalog.length}`);
console.assert(missing.length === 0, `missing data: ${missing.slice(0, 10)}`);
if (missing.length) console.log("MISSING:", missing);

fs.writeFileSync("catalog.js", `window.VAULT_CATALOG = \n${JSON.stringify(catalog)};\n`);
const cats = [...new Set(catalog.map(t => t.category))].sort();
console.log(`${catalog.length} tapes, ${epsTotal} episodes, ${cats.length} categories`);
console.log("categories:", cats.join(" | "));