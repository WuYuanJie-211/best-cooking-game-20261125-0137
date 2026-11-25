# Ember & Thyme — Lunch Rush

[![Best Cooking Game](https://make.fun/badge/best-cooking-game-20261125-0137/rank)](https://make.fun/competitions/best-cooking-game-20261125-0137)
[![Best Cooking Game](https://make.fun/badge/best-cooking-game-20261125-0137/reward)](https://make.fun/competitions/best-cooking-game-20261125-0137)
[![Best Cooking Game](https://make.fun/badge/best-cooking-game-20261125-0137/entries)](https://make.fun/competitions/best-cooking-game-20261125-0137)

An original timed cooking game for the make.fun competition
**Make the best cooking game** (`best-cooking-game-20261125-0137`).
Open `game/index.html` in desktop Chrome and play — no network, no build step.

## How to play

You run the lunch shift at Ember & Thyme, a little neighbourhood kitchen.

- **Take orders from the board** — three tickets at a time, each with a
  customer, a dish and a patience bar. Click a ticket to pick it.
- **Build the dish on the plate** — click ingredient bins (or press `1`–`8`):
  bun, lettuce, tomato, cheese, onion, sauce go straight on.
- **Cook what needs cooking** — patties go on the grill (3.5 s), fries in the
  fryer (4 s); click the station again when it says READY.
- **Ring the bell to serve** (`Space`) — the dish must match a ticket exactly.
  Serve fast for a time bonus; serve in a row to build a combo multiplier.
- **Win the shift** — reach the 700-point day goal before the 150-second
  shift timer ends. **Lose** if three customers walk out, or if time runs out
  below the goal. Every 4 dishes served raises the level and orders get more
  impatient.

Six original recipes: Sunny Burger, Cheesy Melt, Garden Stack, Smoky BBQ,
Veggie Delight, Crispy Combo. All art is drawn in code, all sounds are
synthesised with WebAudio — no copied assets, no commercial game names.

## Controls

| Input | Action |
| --- | --- |
| Mouse click | bins, grill, fryer, tickets, bell, bin-it |
| `1`–`8` | add ingredient |
| `Space` | serve |
| `G` / `F` | take patty from grill / fries from fryer |
| `T` | bin the plate |
| `P` / `M` | pause / mute |
| `R` | restart after a shift ends |

Screenshot demos (real game state, staged by URL): `?demo=assembly`,
`?demo=ready`, `?demo=rush`, `?demo=win`, `?demo=lose`.

## Files

- `game/` — the playable game, static files only (`index.html` + `game.js`)
- `screenshots/` — 4 real renders of the game's own code
- `main.ts` — entry program: validates the entry, copies `game/` and
  `screenshots/` to `/output` (or `$MAKEFUN_OUTPUT_DIR`) and writes
  `dossier.json` with `vendor/makefun-game.ts`
- `vendor/makefun-game.ts` — the kit's library, copied unchanged

## License

MIT — see `LICENSE`.
