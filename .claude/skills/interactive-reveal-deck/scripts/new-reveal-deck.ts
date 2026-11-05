#!/usr/bin/env node
/**
 * Scaffold an interactive reveal.js deck from the skill's assets.
 *
 * Copies assets/ to the target folder and installs reveal.js and http-server
 * locally, so the deck presents with no network. Refuses to overwrite an
 * existing deck unless --force, and never touches node_modules.
 *
 * Needs Node 22.18+ (runs .ts directly, no build step, no dependencies).
 *
 *   node scripts/new-reveal-deck.ts --path ./talk/deck --title "My Talk"
 *   node scripts/new-reveal-deck.ts --path ./deck --title "Kafka for .NET devs" \
 *     --part intro:Intro --part ingest:Ingest --part stream:Streaming
 *
 * Options
 *   --path <dir>     Where to create the deck. Created if missing. (required)
 *   --title <text>   Deck title: goes into <title> and the title slide.
 *   --part <spec>    Repeatable, in order: 'id:Label' or 'id:Label:#accent:#accent2'.
 *                    `id` must match the data-part attribute on each <section>.
 *   --port <n>       Port `npm start` serves on (default 8081).
 *   --force          Overwrite index.html, css/ and js/ in an existing deck.
 *   --no-install     Copy the files but skip `npm install`.
 */
import { parseArgs } from 'node:util';
import { cpSync, copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const { values: args } = parseArgs({
  options: {
    path: { type: 'string' },
    title: { type: 'string', default: 'My presentation' },
    part: { type: 'string', multiple: true },
    port: { type: 'string', default: '8081' },
    force: { type: 'boolean', default: false },
    'no-install': { type: 'boolean', default: false },
  },
});

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(2);
}
const warn = (msg: string) => console.warn(`warning: ${msg}`);

if (!args.path) fail('--path is required');

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
if (!existsSync(assets)) fail(`cannot find the skill's assets folder at ${assets}`);

// --- default accents --------------------------------------------------------
// Chosen to stay legible on the dark ground at projector gamma, and to read as
// a progression rather than a set. Used as a FOREGROUND colour in the rail and
// the part pill, so very dark values will not work.
const defaultAccents: [string, string][] = [
  ['#8b5cf6', '#22d3ee'], // violet
  ['#22d3ee', '#60a5fa'], // cyan
  ['#fbbf24', '#fb923c'], // amber
  ['#fb7185', '#f472b6'], // rose
  ['#34d399', '#22d3ee'], // emerald
  ['#a78bfa', '#818cf8'], // indigo
];

// four parts by default, matching the four the template's slides use
const partSpecs = args.part?.length
  ? args.part
  : ['intro:Intro', 'one:Part one', 'two:Part two', 'three:Part three'];

const parts = partSpecs.map((spec, i) => {
  const bits = spec.split(':');
  if (bits.length < 2 || !bits[0] || !bits[1]) {
    fail(`part '${spec}' must be 'id:Label' or 'id:Label:#accent:#accent2'`);
  }
  const [fallback, fallback2] = defaultAccents[i % defaultAccents.length];
  return {
    id: bits[0].trim(),
    label: bits[1].trim(),
    accent: bits[2]?.trim() || fallback,
    accent2: bits[3]?.trim() || fallback2,
  };
});

// --- copy -------------------------------------------------------------------
const deck = resolve(args.path);
if (existsSync(join(deck, 'index.html')) && !args.force) {
  fail(`${deck} already contains a deck. Re-run with --force to overwrite index.html, css/ and js/ (node_modules is never touched).`);
}

mkdirSync(deck, { recursive: true });
console.log(`Scaffolding deck in ${deck}`);
for (const item of ['index.html', 'package.json', '.gitignore']) {
  if (existsSync(join(assets, item))) copyFileSync(join(assets, item), join(deck, item));
}
for (const dir of ['css', 'js']) {
  cpSync(join(assets, dir), join(deck, dir), { recursive: true });
}

// --- personalise index.html -------------------------------------------------
// Plain string replacement against the known template markers: less to go
// wrong than regexing HTML, and it warns loudly if a marker moved.
const indexPath = join(deck, 'index.html');
let html = readFileSync(indexPath, 'utf8');

const markers: [string, string][] = [
  ['<title>DECK TITLE — subtitle</title>', `<title>${args.title}</title>`],
  ['<h1>The deck title<br>on two lines</h1>', `<h1>${args.title}</h1>`],
  ['<h2>The deck title</h2>', `<h2>${args.title}</h2>`],
];
for (const [from, to] of markers) {
  if (html.includes(from)) html = html.replace(from, () => to);
  else warn(`template marker not found, left as-is: ${from}`);
}

const partLines = parts.map(
  (p) => `      { id: '${p.id}', label: '${p.label}', accent: '${p.accent}', accent2: '${p.accent2}' }`,
);
const partsBlock = `    window.DECK_PARTS = [\n${partLines.join(',\n')}\n    ];`;
const partsPattern = /    window\.DECK_PARTS = \[[\s\S]*?\r?\n    \];/;
if (partsPattern.test(html)) {
  html = html.replace(partsPattern, () => partsBlock);
} else {
  warn('could not find the window.DECK_PARTS block. Set your parts by hand in index.html.');
}

// --- retarget the template's data-part attributes ---------------------------
// The template's own part ids (intro/one/two/three) would otherwise not match
// the ids supplied here, and every slide would silently fall back to part one.
// Mapped positionally, in the order the ids first appear in the template.
const templateIds = [...new Set([...html.matchAll(/data-part="([^"]+)"/g)].map((m) => m[1]))];
const mapCount = Math.min(templateIds.length, parts.length);
// Two passes via a placeholder: a single pass can collide when a NEW id is
// also an OLD id still waiting to be renamed.
for (let i = 0; i < mapCount; i++) {
  html = html.replaceAll(`data-part="${templateIds[i]}"`, `data-part="@@part${i}@@"`);
}
for (let i = 0; i < mapCount; i++) {
  html = html.replaceAll(`data-part="@@part${i}@@"`, `data-part="${parts[i].id}"`);
}
if (templateIds.length > parts.length) {
  const unmapped = templateIds.slice(parts.length).join(', ');
  warn(`the template has more parts than you supplied. Slides still using data-part=${unmapped} fall back to the first part. Reassign or delete them.`);
}

writeFileSync(indexPath, html, 'utf8');

// --- package.json port ------------------------------------------------------
if (args.port !== '8081') {
  const pkgPath = join(deck, 'package.json');
  writeFileSync(pkgPath, readFileSync(pkgPath, 'utf8').replaceAll('-p 8081', `-p ${args.port}`), 'utf8');
}

// --- install ----------------------------------------------------------------
if (!args['no-install']) {
  console.log('Installing reveal.js + http-server locally...');
  const npm = spawnSync('npm', ['install', '--silent'], {
    cwd: deck,
    stdio: 'inherit',
    shell: process.platform === 'win32', // npm is npm.cmd on Windows
  });
  if (npm.status !== 0) warn(`npm install exited ${npm.status}. Run it by hand in ${deck}`);
}

console.log(`
Done.
  deck      ${deck}
  serve     cd ${deck} && npm start      (http://localhost:${args.port})
  parts     ${parts.map((p) => p.id).join(', ')}

Next: edit index.html. It ships with one of every component and two
working widgets. Delete what you do not need.`);
