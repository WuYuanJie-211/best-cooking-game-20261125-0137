// Ember & Thyme — Lunch Rush: entry program (Node 22, standard library only).
// Hands the game in: copies game/ and screenshots/ from this repository into
// the output directory and writes dossier.json with the vendored make.fun
// library. Unlike a bare copy it first validates the entry against the
// competition gate (screenshots 3-4, each <= 256 KiB; game/index.html present
// and <= 1 MiB; game/ <= 993 entries and <= 48 MiB) and prints a short
// report, so a broken hand-in fails loudly here instead of on the server.
// Run:  MAKEFUN_OUTPUT_DIR=out node main.ts        (outside the grader)
//        node main.ts                               (grader: writes /output)
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO = fileURLToPath(new URL('.', import.meta.url));
const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
const GAME_DIR = join(REPO, 'game');
const SHOTS_DIR = join(REPO, 'screenshots');

const MAX_SHOT_BYTES = 262144;
const MAX_GAME_FILES = 993;
const MAX_GAME_BYTES = 50331648;

function fail(message) { throw new Error('main.ts: ' + message); }
function kb(n) { return (n / 1024).toFixed(1) + ' KiB'; }

function countTree(dir) {
  let files = 0, bytes = 0;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) { const sub = countTree(p); files += sub.files; bytes += sub.bytes; }
    else if (name.isFile()) { files += 1; bytes += statSync(p).size; }
    files += 1; // every entry counts toward the gate's file cap
  }
  return { files, bytes };
}

function checkEntry() {
  const index = join(GAME_DIR, 'index.html');
  if (!existsSync(index)) fail('game/index.html is missing');
  if (statSync(index).size > 1048576) fail('game/index.html is over 1 MiB');
  const game = countTree(GAME_DIR);
  if (game.files > MAX_GAME_FILES) fail('game/ has ' + game.files + ' entries (cap ' + MAX_GAME_FILES + ')');
  if (game.bytes > MAX_GAME_BYTES) fail('game/ is ' + kb(game.bytes) + ' (cap 48 MiB)');
  if (!existsSync(SHOTS_DIR)) fail('screenshots/ is missing');
  const shots = readdirSync(SHOTS_DIR).filter((n) => !n.startsWith('.')).sort();
  if (shots.length < 3 || shots.length > 4) fail('screenshots/ holds ' + shots.length + ' images (need 3 or 4)');
  for (const name of shots) {
    const size = statSync(join(SHOTS_DIR, name)).size;
    if (size > MAX_SHOT_BYTES) fail('screenshots/' + name + ' is ' + kb(size) + ' (cap 256 KiB)');
  }
  return { game, shots };
}

const checked = checkEntry();

mkdirSync(OUT, { recursive: true });
cpSync(GAME_DIR, join(OUT, 'game'), { recursive: true });
mkdirSync(join(OUT, 'screenshots'), { recursive: true });
cpSync(SHOTS_DIR, join(OUT, 'screenshots'), { recursive: true });

writeFileSync(
  join(OUT, 'dossier.json'),
  buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: MAX_SHOT_BYTES },
    game_max_files: MAX_GAME_FILES,
    game_max_bytes: MAX_GAME_BYTES,
    game_path_max_bytes: 1000,
  }),
);

const dossierBytes = statSync(join(OUT, 'dossier.json')).size;
console.log('ember-and-thyme: entry written to ' + OUT);
console.log('  game/: ' + checked.game.files + ' entries, ' + kb(checked.game.bytes));
console.log('  screenshots/: ' + checked.shots.join(', '));
console.log('  dossier.json: ' + kb(dossierBytes));
