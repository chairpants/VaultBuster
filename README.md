# VaultBuster

**Clock in for a shift at a 90s video store.**

**▶ [Play it in your browser](https://chairpants.github.io/VaultBuster/)**

![Walking into VaultBuster](screenshots/entrance.jpg)

It's a Friday night and the store is yours. Work the counter, run the register, keep the shelves straight, and deal with whatever the night throws at you. It's a first-person sim of life behind the counter at a neighborhood rental store, down to the rewinder and the security gates.

---

## Screenshots

| | |
|---|---|
| ![The checkout counter](screenshots/counter.jpg) | ![Behind the counter: register, rewinder and receipt printer](screenshots/behind-counter.jpg) |
| ![The POS terminal's main menu](screenshots/pos.jpg) | ![The POS after a tape sets off the security gates](screenshots/alarm.jpg) |
| ![The MonsterVision section and its Dracula standee](screenshots/monstervision.jpg) | ![A New Releases wall](screenshots/aisle.jpg) |

| Lights on | Lights out |
|---|---|
| ![The lounge](screenshots/lounge.jpg) | ![The lounge after dark](screenshots/lounge-night.jpg) |
| ![Looking out the front doors by day](screenshots/outside-day.jpg) | ![The lot at night under the sodium lights](screenshots/outside-night.jpg) |

---

## Features

- **A real store to run:** 1,600+ tapes on the shelves, a counter, a back room, and a parking lot out front.
- **A working register:** a 90s DOS-style point-of-sale system with inventory, members, and reports. Log in and poke around.
- **Counter gear that works:** rewind tapes, desensitize them at checkout, ring the bell, and work the returns slot.
- **Security gates** that do exactly what you'd expect when a tagged tape walks out the door.
- **Almost everything is interactive.** Pick things up, carry them around, restock, eat the snacks. Most of it is yours to find.
- **MonsterVision:** Joe Bob Briggs' late-night movies get a section of their own, with a guest who's happy to be moved around.
- **Real light switches:** the store is wired in zones, and the back rooms have their own. Daylight comes in through the front windows.
- **Two ways to play:** *Simulation* starts you in a bare-bones store (no staff, the theater chained shut, no popcorn machine, part of the library off the shelves) and you build it up out of what it earns: hire Dana, open the theater, and buy Library Upgrades 1–3. It starts with a small member base: new people come in to sign up at the counter (take their form, enter them on the register, hand them a card), drawn by word of mouth from good shifts, newspaper ads and what you've built. *Sandbox* has everything open, Dana on staff and $5,000 in the budget. The main menu continues your saved store or starts a new one.
- **Work the counter well:** checkouts score points for speed and getting every step right. Late fees owed get charged or waived at the register, a snack can be upsold, and the receipt printer prints a slip you tear off and hand over. Watch for shoplifters: a customer with darting eyes heading for the door has something under their jacket. A friendly hello (or an obvious eye on them) can change their mind. Stop one before the gates and decide what happens: a ban, a cancelled membership, the police, or a warning, all of which go on their account. One who gets away is only named if you'd seen who they were.
- **Dana's job board:** a cork board behind the counter sets her priorities, RimWorld style: register, phones, floor help, returns, restock and cleanup each get a 1 (first) to 4, or off. She works the highest-priority job that has work, and customer-facing jobs pull her off background work when they outrank it. Restocking the racks from the stock cupboards is one of her jobs now too.
- **The phone:** every couple of hours a member calls to ask if you have something in. Say you'll hold it and a copy had better be on the holds shelf when they come in for it. Customers in the store come first: a call missed while you're busy costs nothing, but picking up with someone waiting at the counter does. Dana takes calls when the store's quiet.
- **Customers who want something:** some come to the counter asking for a title, others for "something scary". Find it, bring it, hand it over (E with the tape in hand), or tell them it's all out (Q). Leave them waiting and Dana goes to find it. How members are treated builds their loyalty: regulars visit more and wait longer, and the unhappy ones stop coming. The day has a rhythm too: slow mornings, the after-school wave, a big Friday night.
- **Keep the place in shape:** snacks and drinks don't refill themselves. The stock cupboards behind the counter hand you what the racks are missing, and you put it out. Order more on the register; it arrives next morning as boxes by the front door. Customers shove tapes back in the wrong place and drop litter; straighten up, or let Dana do it. Whatever's left undone at close costs you on the closing check.
- **Run the business:** a star rating that rises and falls with each night's shift and brings in more (or fewer) customers. Pick tonight's feature on the register; customers buy tickets at checkout and show up at 7:45, and the film had better be in the VCR by 8. Spend the budget on upgrades: security cameras, anti-theft signs, high-speed rewinders, a better cooler compressor, training for Dana, or an ad in the paper.
- **A shift on the clock:** the store's open 10 AM to midnight, about 21 minutes of play, and the sky outside slides from morning through golden hour and sunset into night. At midnight the clock slows to real time, and the day ends only when you lock up and walk out the front doors. Each shift ends with a printed slip and a grade.
- **The store remembers.** Clock out, come back, and everything is where you left it.

---

## Running it

You need an internet connection, because three.js loads from a CDN.

**Easiest:** play the hosted version at **https://chairpants.github.io/VaultBuster/**.

**Locally:** open `index.html` in a browser. It works from `file://` with no server needed.

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
| **Right-click** | Put back a tape you're still looking at (straight off the shelf or out of Returns) · put down an untouched snack |
| **Click** a snack, drink or popcorn in hand | Take a bite or a sip |
| **E** | Interact: doors, lamps, the register, the counter gear, and plenty more. Some things want E held down. On the stool behind the counter, each tap spins you (tap fast to spin harder) and WASD gets you up; hold E on it to carry it somewhere else |
| **Q** | At the counter: offer the customer a snack (they'll go grab it and come back), or waive their late fees |
| **L** | Skip ahead an hour (until close). The store lights are real switches on the walls: E flips one, and holding E on the panel by the register turns the whole panel on or off |
| **Mouse wheel** | Zoom while seated · otherwise switch the item in hand when carrying several |
| **1–9** | Pick an inventory slot (carry up to 9 items; the bar appears once you hold 2+) |
| **H** | Hide the HUD |
| **J** | Show or hide the log (bottom left) · **PgUp / PgDn** scroll it |
| **1–5** | When you've caught a shoplifter: ban a week / a month, cancel their membership, call the police, or let them off with a warning |
| **F** | Fullscreen |

---

## How it's put together

Everything runs as plain `<script>` files loaded in order. There are no ES modules, so the page works from `file://`. The one exception is a small inline module in `index.html` that imports three.js and its post-processing add-ons from the CDN, puts them on `window`, and then loads `store.js`.

| File | What it is |
|---|---|
| `index.html` | The page, the HUD, and the three.js bootstrap |
| `store.js` | The whole game: the building, shelving and packing, the lounge, lighting, the exterior, and the TVs |
| `couch.js` | The procedurally built parlor sofa |
| `pos.js` | The register's DOS-style POS terminal |
| `monstervision.js` | Splits the single MonsterVision broadcast tape into one tape per film, with each airing mapped to its real title and year |
| `mv-covers.js` | Generated TMDB posters for the MonsterVision films (kept out of `covers.js`, which is near GitHub's 50 MB warning) |
| `catalog.js` | Generated tape catalog (`window.VAULT_CATALOG`) |
| `covers.js` | Generated TMDB cover art, embedded as data URIs (`window.VAULT_ART`) |
| `meta.js` | Generated release year and TMDB vote count per title (`window.VAULT_META`), used to sort the New Releases walls |
| `art.js` | The older embedded cover art. `fetch-covers.mjs` falls back to it for the few shows TMDB can't match |
| `server.js`, `server.mjs` | Optional static servers, no dependencies |
| `drive.mjs` | Headless Playwright smoke test that walks in, picks a tape, and plays it |

### Rebuilding the data

The catalog and covers are generated from a local VaultVision library, which the scripts expect at `../VaultVision` unless you pass a different path.

```sh
node build.mjs [path-to-VaultVision]                         # -> catalog.js
TMDB_API_KEY=... node fetch-covers.mjs [path-to-VaultVision] # -> covers.js, meta.js
TMDB_API_KEY=... node fetch-mv-covers.mjs                    # -> mv-covers.js
```

`fetch-covers.mjs` has an `OVERRIDES` table for fixing wrong TMDB matches. The raw source images in `art/` are gitignored. The game doesn't need them at runtime.
