# VaultBuster

A first-person 90s video store in three.js. No build: `index.html` loads plain scripts, and it has to keep working from `file://`.

## How the game's code is laid out

The game is three folders, `store/` (VaultBuster itself, plus the game's rules), `tonys/` (the pizza place next door) and `exterior/` (the lot, the grounds, the sky): one program cut into files, not modules. They share one global scope and run in the order listed in the loader at the bottom of `index.html`. A file can only use, while it loads, what earlier files have made (inside functions that run later, anything goes). A new file has to be added to that list.

`store/roof.js` builds inside one big block with its own helpers (`put`, `bx`, `lam`, ...). The grounds and Tony's outside are built from that block too, but live in their own folders as functions (`buildGrounds`, `tonyOutside`, `tonyRoof`) that the block calls, handing over the helpers they use.

Sections inside a file start with a `// ---- name ----` comment; grep for the name below to land on it.

## Where things are

**The world (what's built and where)**

| For | Look in |
|---|---|
| Sizes and positions everything else is built from (`WALL_L`, `DOOR_W`, `LOT`, colours) | `store/core.js`: palette / constants |
| `box` / `solid` / `wall` / `makeDoor`, the outer walls, the back hall | `store/shell.js` |
| Janitor's closet, break room (lockers, table, kitchenette), restroom (toilet, sink) | `store/backrooms.js` |
| Theater lobby, the auditorium and its seats | `store/theater.js` |
| The lot, stalls, curbs, driveways, the road, street lamps, parked cars | `exterior/lot.js` |
| Grass and paving round the building, the dumpster, the cardboard bed out back | `exterior/grounds.js` |
| Employee counter, returns, back cabinet, entry lane and gates, trash receptacle, snack center (cooler, popcorn machine, snack rack) | `store/lobby.js` |
| Posters, cover atlases, shelves and the store layout (walls, kids, center, Staff Picks, MonsterVision, standee, candy aisle) | `store/shelves.js` |
| TV lounge (couch, TV, lamps), the light switches | `store/lounge.js` |
| The roof and everything on it (AC units, dish, sign, lawn chairs, projector), golf, and at the end of the file how it all works (`roofClimb`, `roofTick`, `cineTick`) | `store/roof.js` |
| Tony's building from outside (brick, awning, glass front), Tony's roof | `tonys/outside.js` |
| Inside Tony's: dining room, counter, kitchen | `tonys/inside.js` |
| Tony's arcade cabinets (Space Invaders, Asteroids) | `tonys/arcade.js` |
| Phone, post-its, calendar, corkboard, holiday decorations | `store/phone.js` |
| Weather, the sky | `exterior/sky.js` |
| Trees | `exterior/trees.js` · the couch model: `couch.js` · people's bodies: `customers.js` |

**How it behaves**

| For | Look in |
|---|---|
| The player, the stool, aiming and picking up, carrying the standee | `store/player.js` |
| What E does (`onE`), holding a tape up, the store TV | `store/tv.js` |
| What the crosshair is on (the `aim*` flags), checkout, the receipt, eating and drinking, snack stock | `store/checkout.js` |
| Customers: who they are, what they want, how they walk; people and cars going by out front | `store/shoppers.js` |
| Dana and the staff, skills, job board, hiring | `store/staff.js` |
| The shift, log, day goals, reputation, upgrades | `store/shift.js` |
| Restroom fixtures working, moving counter gear, messes, the ladder, trash, popcorn, inventory | `store/chores.js` |
| Title screen, pointer lock, gate alarm, clocking out | `store/title.js` |
| Customer mode | `store/customer-mode.js` |
| Saving, the main loop, room culling, loading, the `__t` test hooks | `store/main.js` |
| TV picture settings, screensaver | `store/lounge.js` |
| Renderer, TV-light shader, bloom, rewinding, canvas-texture helpers | `store/core.js` |
| The register terminal | `pos.js` · sound: `ambience.js` · touch controls: `touch.js` |

## Testing

`npm test` runs `tests/smoke.mjs` (several minutes, software-rendered). `node tests/shot.mjs out.png x,z,yaw,pitch` takes a screenshot from anywhere.
