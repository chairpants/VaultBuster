# VaultBuster

**A first-person 90s video store you can actually rent from.**

![Walking into VaultBuster](screenshots/entrance.jpg)

Walk the aisles of a fluorescent-lit rental store, pull a tape off the shelf, and play it on the big-screen TV in the lounge. Every one of the 1,600+ tapes streams real episodes and movies from the Internet Archive. It's built in three.js with no build step and no dependencies, and it runs straight from a `file://` URL.

---

## Screenshots

| Lights on | Lights out |
|---|---|
| ![The TV lounge](screenshots/lounge.jpg) | ![The TV lounge after dark](screenshots/lounge-night.jpg) |
| ![Looking out the front doors by day](screenshots/outside-day.jpg) | ![The lot at night under the sodium lights](screenshots/outside-night.jpg) |

![Down a TV Shows aisle](screenshots/aisle.jpg)

---

## Features

**The store**
- 1,607 tapes on gondola shelving, one tape per movie or per TV season, grouped by genre. Movies are on the left, TV Shows on the right.
- Real TMDB poster art on every cover. TV tapes get their own season's poster when TMDB has one.
- Shelving is packed with no half-empty bays. Slim genres (Anime, Music, Broadcast Blocks, Holiday) share the leftover space at the end of a bigger genre, under their own shelf sign.
- A checkout and returns counter, a snack rack you can grab from, a popcorn cart, and movie posters in blinking marquee frames.

**The TV lounge**
- Put a tape in the big projection TV and every screen in the store plays it, including the ceiling CRTs over each aisle.
- When nothing is playing, the screens run a bouncing **VAULTBUSTER** logo screensaver, DVD-logo style.
- A couch for sitting and watching, with mouse-wheel zoom to lean in toward the screen.

**Lighting**
- Tap **L** for lights out. The overhead fluorescents flicker back on when you turn them back on, and a few of them stutter before they settle.
- In the dark, the TV lights up the room in whatever colors are on screen, and the ceiling CRTs light the shelves under them.
- The screens, marquee bulbs, and lamps glow. Signs never do.

**Outside**
- The storefront is glass. Outside there's a sidewalk, a striped parking lot with three parked cars, a road, a bench under an iron park lamp, and a treeline.
- The time of day follows the store lights. Lights on means blue sky, sun, and drifting clouds. Lights out means a moonlit midnight-blue night, with sodium street lights glowing orange over the lot.

---

## Running it

You need an internet connection. three.js loads from a CDN, and the tapes stream from archive.org.

**Easiest:** open `index.html` in a browser. It works from `file://` with no server needed.

**Or serve it locally:**

```sh
node server.js          # http://localhost:5000
node server.mjs [port]  # http://localhost:8123 by default
```

Neither server has any dependencies.

---

## Controls

| Key | Action |
|---|---|
| **W A S D** | Walk |
| **Mouse** | Look |
| **Shift** | Hustle |
| **C** | Crouch |
| **Click** a tape | Pick it up and hold it up to look at it |
| **Click** again | Tuck it in your hand |
| **Right-click** / **Esc** | Put it back |
| **E** | Put the tape in the TV · sit or stand at the couch · switch a lamp on or off · use the returns counter |
| **Space** | Pause / play |
| **, .** | Previous / next episode |
| **L** (tap) | Store lights on/off, which also switches day and night |
| **L** (hold) | Both side lamps on/off |
| **Mouse wheel** | Zoom while seated |
| **H** | Hide the HUD |
| **F** | Fullscreen |

---

## How it's put together

Everything runs as plain `<script>` files loaded in order. There are no ES modules, so the page works from `file://`. The one exception is a small inline module in `index.html` that imports three.js and its post-processing add-ons from the CDN, puts them on `window`, and then loads `store.js`.

| File | What it is |
|---|---|
| `index.html` | The page, the HUD, and the three.js bootstrap |
| `store.js` | The whole game: the building, shelving and packing, the lounge, lighting, the exterior, and playback |
| `couch.js` | The procedurally built parlor sofa |
| `catalog.js` | Generated tape catalog (`window.VAULT_CATALOG`) |
| `covers.js` | Generated TMDB cover art, embedded as data URIs (`window.VAULT_ART`) |
| `art.js` | The older embedded cover art. `fetch-covers.mjs` falls back to it for the few shows TMDB can't match |
| `server.js`, `server.mjs` | Optional static servers, no dependencies |
| `drive.mjs` | Headless Playwright smoke test that walks in, picks a tape, and plays it |

### Rebuilding the data

The catalog and covers are generated from a local VaultVision library, which the scripts expect at `../VaultVision` unless you pass a different path.

```sh
node build.mjs [path-to-VaultVision]                         # -> catalog.js
TMDB_API_KEY=... node fetch-covers.mjs [path-to-VaultVision] # -> covers.js
```

`fetch-covers.mjs` has an `OVERRIDES` table for fixing wrong TMDB matches. The raw source images in `art/` are gitignored. The game doesn't need them at runtime.
