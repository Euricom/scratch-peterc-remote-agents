#!/usr/bin/env node
/**
 * Check every slide of an interactive reveal.js deck for content overflow and
 * JavaScript errors.
 *
 * Drives a real browser through all slides, vertical sub-slides included, with
 * every fragment revealed, and reports:
 *   - slides whose content is taller than the configured slide height
 *   - slides with content running past the right edge, or a block (a terminal,
 *     a code window) that only fits by scrolling sideways
 *   - slides that mix fragments with and without data-fragment-index: reveal
 *     shows every indexed fragment before any unindexed one, so the build
 *     order on stage silently differs from the order in the source
 *   - any JavaScript error raised while walking the deck
 *
 * With --shots it also saves one screenshot per slide, fragments shown, so the
 * deck can be LOOKED at. Collapsed whitespace, a clipped image or a widget that
 * renders empty are not errors either, and only a look catches them.
 *
 * Overflow is the failure this exists for: nothing errors, the content just
 * runs off the bottom of the projector, and you find out on stage. Widget
 * slides are the usual offenders because a panel grows as you add to it.
 *
 * Serves the deck itself unless --url is given, and stops the server after.
 * Needs Node 22.18+ and agent-browser (npm i -g agent-browser && agent-browser install).
 *
 *   node scripts/test-deck-layout.ts --path ./talk/deck
 *   node scripts/test-deck-layout.ts --url http://localhost:8081/index.html
 *
 * Options
 *   --path <dir>       Deck folder. Served on --port and stopped after.
 *   --url <url>        Test an already-running deck instead.
 *   --port <n>         Port to serve on (default 8099).
 *   --keep-browser     Leave the browser open at the last slide.
 *   --shots <dir>      Save a screenshot of every slide (all fragments shown)
 *                      as <dir>/NN-title.png at 1600x925.
 *
 * Exit codes: 0 all good, 1 overflow or JS errors, 2 could not run.
 */
import { parseArgs } from 'node:util';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';

const { values: args } = parseArgs({
  options: {
    path: { type: 'string' },
    url: { type: 'string' },
    port: { type: 'string', default: '8099' },
    'keep-browser': { type: 'boolean', default: false },
    shots: { type: 'string' },
  },
});

const isWin = process.platform === 'win32';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const c = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const red = c(31), yellow = c(33), green = c(32), cyan = c(36), dim = c(90);

let server: ChildProcess | undefined;
let opener: ChildProcess | undefined;

function cleanup() {
  for (const p of [opener, server]) {
    if (p && p.exitCode === null) p.kill();
  }
}

function fail(msg: string): never {
  console.error(red(`error: ${msg}`));
  cleanup();
  process.exit(2);
}

/** Run agent-browser synchronously; the script goes in over stdin, so no shell quoting. */
function ab(cmdArgs: string[], input?: string): string {
  const r = spawnSync('agent-browser', cmdArgs, {
    input,
    encoding: 'utf8',
    shell: isWin, // the npm shim is agent-browser.cmd on Windows
    timeout: 120_000,
  });
  return (r.stdout ?? '').trim();
}
const lastLine = (s: string) => s.split(/\r?\n/).filter(Boolean).at(-1) ?? '';

// `agent-browser open` can hang indefinitely on a cold Chrome start, long after
// the page is loaded and answering evals. So fire it off detached and confirm
// readiness by polling the page itself rather than waiting on it.
function openDetached(url: string): ChildProcess {
  const p = spawn('agent-browser', ['open', url], { stdio: 'ignore', shell: isWin });
  p.on('error', () => {});
  return p;
}

async function main() {
  if (spawnSync('agent-browser', ['--version'], { shell: isWin }).status !== 0) {
    fail('agent-browser is not on PATH. Install it with:  npm i -g agent-browser && agent-browser install');
  }
  if (!args.path === !args.url) fail('pass exactly one of --path or --url');

  let url = args.url ?? '';

  if (args.path) {
    const deck = resolve(args.path);
    if (!existsSync(join(deck, 'index.html'))) fail(`no index.html in ${deck}`);
    if (!existsSync(join(deck, 'node_modules/reveal.js'))) {
      fail(`reveal.js is not installed in ${deck}. Run npm install there first.`);
    }

    url = `http://127.0.0.1:${args.port}/index.html`;
    console.log(dim(`Serving ${deck} on port ${args.port}...`));

    // Run the locally installed http-server through node directly: no npx
    // shim, so it behaves the same on every platform.
    const bin = join(deck, 'node_modules/http-server/bin/http-server');
    if (!existsSync(bin)) fail(`http-server is not installed in ${deck}. Run npm install in the deck folder.`);
    server = spawn(process.execPath, [bin, '.', '-p', args.port!, '-c-1', '--silent'], {
      cwd: deck,
      stdio: 'ignore',
    });

    let up = false;
    for (let i = 0; i < 25 && !up; i++) {
      await sleep(400);
      try {
        up = (await fetch(url, { signal: AbortSignal.timeout(2000) })).ok;
      } catch {}
    }
    if (!up) fail(`server did not come up on ${url}`);
  }

  console.log(cyan(`Walking every slide at ${url}`));
  opener = openDetached(url);

  // A cold Chrome start can eat the whole budget before the navigation lands,
  // leaving a live browser sitting on about:blank. So poll for the DECK, and if
  // the browser is answering but is on the wrong page, ask again: a second
  // `open` against a warm browser returns immediately.
  const probe = "typeof Reveal !== 'undefined' && Reveal.isReady() && !!document.querySelector('#rail .chap')";
  let ready = false;
  for (let i = 1; i <= 120 && !ready; i++) { // x 750ms = 90s
    await sleep(750);
    ready = /true/.test(lastLine(ab(['eval', '--stdin'], probe)));
    if (!ready && i % 12 === 0) {
      const here = lastLine(ab(['get', 'url']));
      if (here && !here.includes(url)) {
        console.log(dim(`  browser is up but on ${here}, re-issuing the open`));
        if (opener.exitCode === null) opener.kill();
        opener = openDetached(url);
      }
    }
  }
  if (opener.exitCode === null) opener.kill();
  if (!ready) fail(`the deck did not become ready at ${url} within 90s. Open it in a browser and check the console.`);

  // Walks the deck, revealing all fragments, and measures the innermost
  // .present section. For a vertical stack the wrapper is .present too, and its
  // scrollHeight is the sum of its children, which reads as a false positive if
  // you take the first match.
  const walk = `
(async () => {
  const errors = [];
  window.addEventListener('error', e => errors.push(String(e.message)));
  const H = Reveal.getConfig().height;
  const index = [], overflow = [], wide = [], mixed = [];

  // Fragment order has to be checked in the SOURCE: at runtime reveal writes
  // data-fragment-index onto every fragment, which hides the mix.
  const src = new DOMParser().parseFromString(await (await fetch(location.href)).text(), 'text/html');
  const leaves = [...src.querySelectorAll('.reveal .slides section')].filter(x => !x.querySelector('section'));
  for (const sec of leaves) {
    const fr = [...sec.querySelectorAll('.fragment')];
    const steps = sec.querySelectorAll('[data-steps]').length;   // code.js adds unindexed fragments
    const withIdx = fr.filter(f => f.hasAttribute('data-fragment-index')).length;
    if (withIdx && (withIdx < fr.length || steps)) {
      mixed.push(sec.dataset.title || (sec.querySelector('h1,h2')?.textContent ?? '?').trim());
    }
  }
  document.querySelectorAll('.reveal .slides > section').forEach((sec, h) => {
    const kids = sec.querySelectorAll(':scope > section');
    if (kids.length) kids.forEach((k, v) => index.push([h, v]));
    else index.push([h, 0]);
  });
  for (const [h, v] of index) {
    Reveal.slide(h, v);
    await new Promise(r => setTimeout(r, 110));
    while (Reveal.availableFragments().next) Reveal.nextFragment();
    await new Promise(r => setTimeout(r, 60));
    const all = document.querySelectorAll('section.present');
    const s = all[all.length - 1];
    if (s.scrollHeight > H + 4) {
      overflow.push({
        slide: (h + 1) + (v ? '.' + (v + 1) : ''),
        title: s.dataset.title || ('slide ' + (h + 1)),
        height: s.scrollHeight,
        frame: H
      });
    }
    // Horizontal problems. Rects are in screen pixels, so divide by the scale.
    // Elements inside a scroll container are judged by that container instead.
    const scale = Reveal.getScale() || 1;
    const right = s.getBoundingClientRect().right;
    let past = 0, scrolls = [];
    for (const el of s.querySelectorAll('*')) {
      if (el.closest('aside.notes')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      let clipped = false;
      for (let a = el.parentElement; a && a !== s; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== 'visible') { clipped = true; break; }
      }
      if (clipped) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.right > right + 2) past = Math.max(past, (r.right - right) / scale);
      if ((cs.overflowX === 'auto' || cs.overflowX === 'scroll') && el.scrollWidth > el.clientWidth + 2) {
        scrolls.push((el.className || el.tagName).toString().split(' ')[0]);
      }
    }
    if (past || scrolls.length) {
      wide.push({
        slide: (h + 1) + (v ? '.' + (v + 1) : ''),
        title: s.dataset.title || ('slide ' + (h + 1)),
        past: Math.round(past),
        scrolls: [...new Set(scrolls)]
      });
    }
  }
  return JSON.stringify({ total: index.length, frame: H, overflow, wide, mixed, errors, index });
})()`;

  const raw = lastLine(ab(['eval', '--stdin'], walk));

  type Result = {
    total: number;
    frame: number;
    overflow: { slide: string; title: string; height: number; frame: number }[];
    wide: { slide: string; title: string; past: number; scrolls: string[] }[];
    mixed: string[];
    errors: string[];
    index: [number, number][];
  };
  let result: Result;
  try {
    // eval returns the JSON string, itself JSON-quoted
    const once = JSON.parse(raw);
    result = typeof once === 'string' ? JSON.parse(once) : once;
  } catch {
    fail(`could not parse the browser's answer: ${raw.slice(0, 200)}`);
  }

  if (args.shots) {
    const dir = resolve(args.shots);
    mkdirSync(dir, { recursive: true });
    ab(['set', 'viewport', '1600', '925']);
    await sleep(500);
    for (const [i, [h, v]] of result.index.entries()) {
      const title = lastLine(ab(['eval', '--stdin'],
        `Reveal.slide(${h}, ${v}); while (Reveal.availableFragments().next) Reveal.nextFragment();
         (document.querySelectorAll('section.present')[document.querySelectorAll('section.present').length - 1].dataset.title || '')`));
      await sleep(900); // let transitions and staggered fragments settle
      const slug = title.replace(/^"|"$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
      ab(['screenshot', join(dir, `${String(i + 1).padStart(2, '0')}-${slug || 'slide'}.png`)]);
    }
    console.log(dim(`Saved ${result.index.length} screenshots to ${dir}. Look at every one of them.`));
  }
  if (!args['keep-browser']) ab(['close']);

  console.log(dim(`\nSlides walked: ${result.total}   frame height: ${result.frame}px`));

  if (result.errors.length) {
    console.log(red(`\nJavaScript errors (${result.errors.length}):`));
    for (const e of result.errors) console.log(red(`  ${e}`));
  }

  if (result.overflow.length) {
    console.log(yellow(`\nSlides taller than the frame (${result.overflow.length}):`));
    for (const o of result.overflow) {
      console.log(yellow(`  ${o.slide.padEnd(6)} ${o.title.padEnd(44)} ${o.height}px  (+${o.height - o.frame}px)`));
    }
    console.log(dim('\nFix by trimming content, not by shrinking the frame: cut lines from the'));
    console.log(dim('snippet, shorten the pull quote, or move detail to a vertical sub-slide.'));
  }

  if (result.wide.length) {
    console.log(yellow(`\nSlides too wide (${result.wide.length}):`));
    for (const w of result.wide) {
      const why = [w.past ? `content runs ${w.past}px past the right edge` : '',
        w.scrolls.length ? `scrolls sideways: ${w.scrolls.join(', ')}` : ''].filter(Boolean).join('; ');
      console.log(yellow(`  ${w.slide.padEnd(6)} ${w.title.padEnd(44)} ${why}`));
    }
    console.log(dim('\nUsual causes: width:100% plus padding without box-sizing, a long unbreakable'));
    console.log(dim('inline <code>, or a terminal line that is too long. Shorten the line.'));
  }

  if (result.mixed.length) {
    console.log(yellow(`\nSlides mixing indexed and unindexed fragments (${result.mixed.length}):`));
    for (const t of result.mixed) console.log(yellow(`  ${t}`));
    console.log(dim('\nReveal shows every fragment with data-fragment-index before any without one.'));
    console.log(dim('Give every fragment on the slide an explicit index, in the order it should appear.'));
  }

  const failed = result.errors.length > 0 || result.overflow.length > 0 || result.wide.length > 0
    || result.mixed.length > 0;
  if (!failed) console.log(green('\nAll slides fit the frame, no JavaScript errors.'));
  cleanup();
  process.exit(failed ? 1 : 0);
}

process.on('SIGINT', () => { cleanup(); process.exit(130); });
main().catch((e) => fail(String(e?.stack ?? e)));
