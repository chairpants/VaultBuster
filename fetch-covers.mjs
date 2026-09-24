// Fetch real posters from TMDB for every tape and embed them in covers.js
// (file:// can't load local images into WebGL, so they ride along as data
// URIs), plus art.js's old VaultVision art for the few shows TMDB can't match. TV tapes get their own season's poster when TMDB has one —
// usually the DVD season art — else the show poster; movies get the poster.
// Matching: VaultVision's CREDITS.md TMDB link when present, else a search.
// Review/override bad matches in OVERRIDES, then rerun. No deps:
//   TMDB_API_KEY=... node fetch-covers.mjs [path-to-VaultVision]
import fs from "node:fs";
import path from "node:path";

const KEY = process.env.TMDB_API_KEY;
if (!KEY) throw new Error("set TMDB_API_KEY (v3 key or v4 read token)");
const ROOT = process.argv[2] ?? "../VaultVision";
const IMG = "https://image.tmdb.org/t/p/w185";   // ~185x278, cell is 144x288 — no resize needed

// manual fixes for wrong/missing matches: show id -> "tv/1234" | "movie/5678" | null (keep old art)
const OVERRIDES = {
  MuppetBabies: "tv/565", WackyRacesSeries: "tv/985", TeenageMutantNinjaTurtles: "tv/2284", TheTick: "tv/14540",
  WhoseLineIsItAnyway: "tv/61018", SpiderManTAS: "tv/888", TheMaskAnimatedSeries: "tv/9957", MostExtremeEliminationChallenge: "tv/2995", NickArcade: "tv/6758", AeonFlux: "tv/406", RockyandBullwinkleShow: "tv/1025", NedAndStacey: null, PoliceAcademyTheAnimatedSeries: "tv/5645", CharmedtheSeries: "tv/1981",
  DarkShadowsTheSeries: "tv/2883", It1990: "tv/19614", TheStand1994: "tv/9045", StormOfTheCentury: "tv/5028",
  LippytheLionandHardyHarHar: "tv/247869", ALFtheSeries: "tv/4658", CattanoogaCatstheSeries: "tv/12451",
  BubblegumCrisistheSeriesDualAudioHD: "tv/42882", DarkwingDucktheSeries: "tv/3319", DextersLaboratorytheSeries: "tv/4229",
  DuckTalesSeriesWorkinProgress: "tv/720", EdEddNEddySeriesAllEpisodesandSpecials: "tv/606",
  HeathcliffandtheCatillacCatsTVSeries: "tv/13781", JosieandthePussycatsTVseries: "tv/4489",
  LodossWarSeriesEnglishDub: "tv/42713", MotorcityTVseries: "tv/46995", SpawntheAnimatedSeriesSeries480x480: "tv/10331",
  TeenTitansSeries: "tv/604", TMNTNextMutation: "tv/3909", LeaveIttoBeavertheSeries: "tv/5133", DallastheSeries: "tv/40",
  TheNetAmericanTVseries: "tv/13777", Space1999: "tv/134", RoboCopliveactionTVseries: "tv/5191",
  CliffordtheBigRedDogSeriesSeries: "tv/8379", WonderPetsEpisodeswithMissingEpisodes: "tv/10867", Y2KTheMovie: "movie/17122",
  PopeyetheSailorMan: null,        // 1933 theatrical shorts; TMDB only has the 1960 TV series
  PokemonOrangeIslands: null,      // our S1 is TMDB's season 2 — season posters would be off by one
};

const v4 = KEY.length > 40;                      // v4 read tokens are long JWTs; v3 keys are 32 hex
async function tmdb(p, params = {}) {
  const u = new URL("https://api.themoviedb.org/3/" + p);
  for (const [k, v] of Object.entries(params)) if (v != null) u.searchParams.set(k, v);
  if (!v4) u.searchParams.set("api_key", KEY);
  for (let tries = 0; ; tries++) {
    const r = await fetch(u, { headers: v4 ? { Authorization: `Bearer ${KEY}` } : {} });
    if (r.status === 429 && tries < 5) { await new Promise(r => setTimeout(r, 1000 * (tries + 1))); continue; }
    if (!r.ok) throw new Error(`${r.status} ${p}`);
    return r.json();
  }
}

global.window = {};
await import("./catalog.js");
const shows = new Map();                         // id -> { title, seasons: Set, flat, eps }
for (const t of window.VAULT_CATALOG) {
  const s = shows.get(t.id) ?? { title: t.title, category: t.category, seasons: new Set(), flat: t.season == null, eps: t.seasons[0].episodes.length };
  if (t.season != null) s.seasons.add(t.season);
  shows.set(t.id, s);
}

const norm = s => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
function creditsLink(id) {
  try {
    const m = fs.readFileSync(path.join(ROOT, "shows", id, "CREDITS.md"), "utf8").match(/themoviedb\.org\/(tv|movie)\/(\d+)/);
    return m && `${m[1]}/${m[2]}`;
  } catch { return null; }
}
async function search(id, s) {
  const year = s.title.match(/\((\d{4})\)/)?.[1] ?? id.match(/(19|20)\d\d$/)?.[0];
  // full title first ("Batman: The Animated Series" is the real name), then with
  // uploader suffixes dropped: "the Series", "(The Series)", "TV series"…
  const full = s.title.replace(/\(\d{4}\)/, "").trim();
  const queries = [...new Set([full, full.replace(/\s*\(?(the\s+)?(animated\s+)?(tv\s+)?(mini)?series\)?\s*$/i, "").trim()])];
  // coded seasons = TV; a single-episode flat tape = movie; anything else tries TV first
  const kinds = !s.flat ? ["tv"] : s.eps === 1 ? ["movie", "tv"] : ["tv", "movie"];
  for (const q of queries) for (const kind of kinds) {
    const res = (await tmdb(`search/${kind}`, { query: q, [kind === "tv" ? "first_air_date_year" : "year"]: year })).results
      .filter(r => r.poster_path);
    if (!res.length) continue;
    // exact name match, else TMDB's top hit only if one name starts or ends the
    // other ("Nickelodeon GUTS", "Captain N: The Game Master") — a looser top hit
    // is usually a different title entirely (SNICK → "Arga snickaren")
    const nq = norm(q), n0 = norm(res[0].name ?? res[0].title);
    const edge = (a, b) => a.startsWith(b) || a.endsWith(b);
    const best = res.find(r => norm(r.name ?? r.title) === nq) ?? (edge(n0, nq) || edge(nq, n0) ? res[0] : null);
    if (best) return `${kind}/${best.id}`;
  }
  return null;
}

const manifest = {}, art = {}, hi = {};         // hi: art key -> TMDB image path, for the full-res inspect view
const toData = async url => "data:image/jpeg;base64," + Buffer.from(await (await fetch(url)).arrayBuffer()).toString("base64");
const ids = [...shows.keys()];
let done = 0;
async function work() {
  for (let id; (id = ids.shift()); ) {
    const s = shows.get(id);
    try {
      const via = id in OVERRIDES ? "override" : creditsLink(id) ? "credits" : "search";
      const ref = id in OVERRIDES ? OVERRIDES[id] : creditsLink(id) ?? await search(id, s);
      if (!ref) { manifest[id] = { title: s.title, match: null }; continue; }
      const d = await tmdb(ref);
      const name = d.name ?? d.title, year = (d.first_air_date ?? d.release_date ?? "").slice(0, 4);
      manifest[id] = { title: s.title, match: `${name} (${year})`, ref, via, votes: d.vote_count ?? 0, poster: d.poster_path, seasons: [] };
      if (d.poster_path) { art[`tmdb/${id}.jpg`] = await toData(IMG + d.poster_path); hi[`tmdb/${id}.jpg`] = d.poster_path; }
      for (const n of s.seasons) {
        const sp = d.seasons?.find(x => x.season_number === n)?.poster_path;
        if (sp && sp !== d.poster_path) { art[`tmdb/${id}-s${n}.jpg`] = await toData(IMG + sp); hi[`tmdb/${id}-s${n}.jpg`] = sp; manifest[id].seasons.push(n); }
      }
    } catch (e) { manifest[id] = { title: s.title, error: String(e.message) }; }
    if (++done % 50 === 0) console.log(done, "/", shows.size);
  }
}
await Promise.all(Array.from({ length: 8 }, work));   // 8 in flight stays well under TMDB's rate limit

// unmatched shows keep their old art.js cover; everything else in art.js is shadowed
await import("./art.js");
for (const t of window.VAULT_CATALOG) if (!art[`tmdb/${t.id}.jpg`] && window.VAULT_ART?.[t.art]) art[t.art] = window.VAULT_ART[t.art];
// wall posters, most-voted first: a few TV shows in their original VaultVision
// poster art (the -tall variant — TMDB season/box art isn't poster art), no
// cartoons (anime's fine), and movies in their real TMDB poster at w500
const byVotes = ids => ids.filter(id => manifest[id]?.votes).sort((a, b) => manifest[b].votes - manifest[a].votes);
const isMovie = id => shows.get(id).flat && shows.get(id).eps === 1;
const tvPosters = byVotes([...shows.keys()].filter(id => !isMovie(id) && !["Animation", "Broadcast Blocks"].includes(shows.get(id).category)
  && window.VAULT_ART?.[`art/${id}-tall.jpg`]))
  // ponytail: one per franchise by 8-char id prefix (DragonBall/Z/Super took 3 of 6) — crude but enough here
  .filter((id, i, a) => !a.slice(0, i).some(p => p.slice(0, 8) === id.slice(0, 8))).slice(0, 6);
const moviePosters = byVotes([...shows.keys()].filter(id => isMovie(id) && manifest[id]?.poster)).slice(0, 18);
for (const id of tvPosters) {                    // full-res original when it's small enough, else art.js's downscale
  const f = path.join(ROOT, "art", `${id}-tall.jpg`);
  art[`art/${id}-tall.jpg`] = fs.existsSync(f) && fs.statSync(f).size < 200e3   // ponytail: size cap keeps covers.js < 50 MB (GitHub warns past it)
    ? "data:image/jpeg;base64," + fs.readFileSync(f).toString("base64") : window.VAULT_ART[`art/${id}-tall.jpg`];
}
for (const id of moviePosters) art[`poster/${id}.jpg`] = await toData("https://image.tmdb.org/t/p/w500" + manifest[id].poster);
const posters = moviePosters.map(id => `poster/${id}.jpg`);
tvPosters.forEach((id, i) => posters.splice(i * 4, 0, `art/${id}-tall.jpg`));   // a show every 4th poster
console.log("posters:", posters.join(", "));
fs.writeFileSync("covers.js", `window.VAULT_ART = ${JSON.stringify(art)};\nwindow.VAULT_POSTERS = ${JSON.stringify(posters)};\n` +
  `window.VAULT_ART_HI = ${JSON.stringify(hi)};\n`);
fs.writeFileSync("tmdb-covers.json", JSON.stringify(manifest, null, 1));
// year + TMDB vote count per matched title — the store sorts its New Releases
// walls by these (release year cutoff, and more copies of the more-voted hits)
const meta = Object.fromEntries(Object.entries(manifest).filter(([, m]) => m.match)
  .map(([id, m]) => [id, [+(m.match.match(/\((\d{4})\)/)?.[1] ?? 0), m.votes ?? 0]]));
fs.writeFileSync("meta.js", `window.VAULT_META = ${JSON.stringify(meta)};\n`);
const vals = Object.values(manifest);
console.log(`${vals.filter(m => m.match).length} matched, ${vals.filter(m => m.match === null).length} unmatched, ` +
  `${vals.filter(m => m.error).length} errors; ${Object.keys(art).length} images, ` +
  `${(fs.statSync("covers.js").size / 1e6).toFixed(1)} MB`);
