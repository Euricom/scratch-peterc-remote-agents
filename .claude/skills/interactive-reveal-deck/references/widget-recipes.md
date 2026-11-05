# Widget recipes

Five patterns beyond the `pipeline` and `calc` widgets that ship in
`assets/js/widgets.js`. The CSS for all five is already in
`assets/css/widgets.css`, so each recipe is copy-paste-and-edit: put the JS in
a `js/my-widgets.js` loaded **before** `chrome.js`, and the markup on the
slide.

All five follow [the widget contract](../SKILL.md#widgets):
`{ run, reset }`, <kbd>B</kbd>/<kbd>R</kbd>, reset on slide entry.

Helpers available: `DeckWidgets.helpers.{ nf, $, $$ }` — `nf` is
thousands-separator formatting, `$(root, role)` is
`root.querySelector('[data-role="..."]')`.

---

## 1. `ide` — fake editor with a light-bulb quick fix

**What it's for.** Showing a tool *fixing* something, not describing the fix.
Squiggle under the offending token, click the 💡, pick the action: code
changes, squiggle goes, error list clears, build flips green.

**Why it beats the real IDE on stage.** It reads at the back of the room, it
takes one click instead of a hunt through a menu, it can't be broken by a
stale build or a font size you forgot to raise — and it is the fallback when
the live demo does misbehave. Use it *and* do the real demo; this is the
safety net.

**The one non-obvious bit.** `paint()` re-tokenizes the whole listing on every
state change and re-attaches the bulb, rather than mutating text nodes in
place. Rebuilding is far less fiddly than patching highlighted HTML, and the
listing is ten lines.

The `.row` needs `position: relative` for the absolutely positioned bulb —
that's in `widgets.css`, but if you build your own editor markup, remember it.

### Markup

```html
<section data-part="two" data-title="From error to fix" data-interactive>
  <h2>From error to fix</h2>
  <div class="ide" data-widget="ide">
    <div class="tabs">
      <span class="tab active">Customer.cs</span>
      <span class="tab">Other.cs</span>
      <span class="build" data-role="build">
        <span data-role="build-icon">&#10007;</span>
        <span data-role="build-text">Build failed</span>
      </span>
    </div>
    <div class="editor" data-role="editor"></div>
    <div class="errorlist" data-role="errors"></div>
  </div>
  <div class="toolbar" style="margin-top:20px;margin-bottom:0">
    <span class="label">click the &#128161; in the editor</span>
    <button class="btn" data-role="reset">Reset <span class="kbd">R</span></button>
  </div>
  <aside class="notes">Click the light bulb on line 14. Say the line that
  matters: the fix IS the correct form, so nobody has to guess it.</aside>
</section>
```

### JS

```js
DeckWidgets.register('ide', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const editor = $(el, 'editor');
  const errors = $(el, 'errors');
  const build = $(el, 'build');

  // --- edit these four to retarget the widget -------------------------
  const LANG = 'csharp';
  const BAD = 'Adress', GOOD = 'Address';
  const BAD_LINE = 14;
  const LINES = [
    [6,  'using MyApp.Abstractions;'],
    [7,  ''],
    [8,  'namespace MyApp.Demo;'],
    [9,  ''],
    [10, 'public sealed class Customer : EntityBase'],
    [11, '{'],
    [12, '    public required string Name { get; init; }'],
    [13, ''],
    [14, '    public string Adress { get; init; } = "";'],
    [15, '}']
  ];
  const ERR_BAD = "<b>APP1001</b>&nbsp; Identifier 'Adress' — did you mean 'Address'?";
  const ERR_OK = 'APP1001 fixed by <b>TypoCodeFixProvider</b> — declaration ' +
                 '<em>and</em> every reference renamed';
  const FIXES = ["Rename to 'Address'", 'Fix all in solution'];
  const FIX_HDR = 'APP1001 &nbsp;&middot;&nbsp; MyApp.CodeFixes';
  // --------------------------------------------------------------------

  let fixApplied = false;

  function paint(word) {
    editor.innerHTML = LINES.map(([no, text]) => {
      let src = DeckCode.tokenize(text.replace(BAD, word), LANG);
      if (no === BAD_LINE && !fixApplied) {
        src = src.replace(word, `<span class="squig">${word}</span>`);
      }
      return `<div class="row" data-line="${no}">` +
             `<span class="gut">${no}</span>` +
             `<span class="src">${src || ' '}</span></div>`;
    }).join('');

    if (fixApplied) return;
    const row = editor.querySelector(`.row[data-line="${BAD_LINE}"]`);
    const bulb = document.createElement('span');
    bulb.className = 'bulb';
    bulb.title = 'Show potential fixes';
    bulb.textContent = '\u{1F4A1}';
    row.appendChild(bulb);
    bulb.addEventListener('click', openMenu);
    const squig = row.querySelector('.squig');
    if (squig) squig.addEventListener('click', openMenu);
  }

  const closeMenu = () => {
    const m = editor.querySelector('.fixmenu');
    if (m) m.remove();
  };

  function openMenu(ev) {
    ev.stopPropagation();
    closeMenu();
    const row = editor.querySelector(`.row[data-line="${BAD_LINE}"]`);
    const menu = document.createElement('div');
    menu.className = 'fixmenu';
    menu.innerHTML = `<div class="hdr">${FIX_HDR}</div>` +
      FIXES.map((f) => `<button>\u{1F4A1} ${f}</button>`).join('');
    menu.style.left = '52px';
    menu.style.top = (row.offsetTop + row.offsetHeight + 4) + 'px';
    editor.appendChild(menu);
    menu.querySelectorAll('button').forEach((b) => b.addEventListener('click', applyFix));
  }

  function applyFix(ev) {
    if (ev) ev.stopPropagation();
    closeMenu();
    fixApplied = true;
    paint(GOOD);
    const src = editor.querySelector(`.row[data-line="${BAD_LINE}"] .src`);
    if (src) {                                  // brief green flash on the fixed line
      src.style.transition = 'background .6s ease';
      src.style.background = 'color-mix(in oklab, var(--ok) 22%, transparent)';
      setTimeout(() => { src.style.background = 'transparent'; }, 700);
    }
    errors.classList.add('clean');
    errors.innerHTML = '<span class="sev">✓ 0 errors</span><span>' + ERR_OK + '</span>';
    build.classList.add('green');
    $(build, 'build-icon').innerHTML = '✓';
    $(build, 'build-text').textContent = 'Build succeeded';
  }

  function reset() {
    fixApplied = false;
    closeMenu();
    paint(BAD);
    errors.classList.remove('clean');
    errors.innerHTML = '<span class="sev">✗ error</span><span>' + ERR_BAD + '</span>';
    build.classList.remove('green');
    $(build, 'build-icon').innerHTML = '✗';
    $(build, 'build-text').textContent = 'Build failed';
  }

  editor.addEventListener('click', closeMenu);
  const r = $(section, 'reset');
  if (r) r.addEventListener('click', reset);
  reset();
  // B toggles, so the clicker can show it and put it back
  DeckWidgets.own(section, { run: () => (fixApplied ? reset() : applyFix()), reset });
});
```

---

## 2. `layers` — a token walking down a funnel

**What it's for.** Any "layered defence" or "escalating strictness" argument.
A token walks the layers: the soft ones it slips past, the hard one stops it.
It makes the *shape* of the argument physical — you cannot say "each layer is
stricter" as convincingly as you can show something failing to get through.

**Where the outcome lives.** In the markup, as `data-outcome="pass|warn|block"`
per layer, so the sequence is editable without touching JS. `pass` dims the
layer, `warn` tints it amber, `block` turns it red and stops the token.

**The one non-obvious bit.** Positions come from `offsetTop`, which is 0 while
the slide is `display: none`. That's fine because the framework calls `reset()`
on slide entry, which is when the layout is real. Don't cache positions at
init.

### Markup

```html
<section data-part="two" data-title="From suggestion to guarantee" data-interactive>
  <h2>From suggestion to guarantee</h2>
  <div class="layers" data-widget="layers">
    <div class="layer" data-outcome="pass">
      <span class="num">1</span>
      <span class="what"><code>copilot-instructions.md</code>
        <small>broad context, loaded best-effort</small></span>
      <span class="verdict">slipped through</span>
    </div>
    <div class="layer" data-outcome="warn">
      <span class="num">2</span>
      <span class="what">Analyzer warning<small>visible in the IDE, live</small></span>
      <span class="verdict">warned, ignorable</span>
    </div>
    <div class="layer" data-outcome="block">
      <span class="num">3</span>
      <span class="what"><code>TreatWarningsAsErrors</code> in CI
        <small>the build fails — nothing merges</small></span>
      <span class="verdict">&#10007; BLOCKED</span>
    </div>
  </div>
  <div class="toolbar" style="margin-top:22px;margin-bottom:0">
    <button class="btn primary" data-role="run">&#129302; Send an agent through
      <span class="kbd">B</span></button>
    <button class="btn" data-role="reset">Reset <span class="kbd">R</span></button>
  </div>
  <aside class="notes">Press it and let it play — don't talk over the
  animation. Land the line after it stops.</aside>
</section>
```

### JS

```js
DeckWidgets.register('layers', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const layers = Array.from(el.querySelectorAll('.layer'));
  const STEP = 1000;                 // ms per layer — slow enough to narrate

  const token = document.createElement('div');
  token.className = 'agent-token';
  token.textContent = '\u{1F916}';
  token.style.opacity = '0';
  el.appendChild(token);

  let timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  function reset() {
    clearTimers();
    layers.forEach((l) => l.classList.remove('tested', 'pass', 'warn', 'block', 'active'));
    token.classList.remove('stuck');
    token.style.opacity = '0';
    // offsetTop is only meaningful once the slide is visible — hence reset-on-entry
    token.style.top = (layers[0].offsetTop - 44) + 'px';
  }

  function run() {
    reset();
    token.style.opacity = '1';
    layers.forEach((layer, i) => {
      timers.push(setTimeout(() => {
        layers.forEach((l) => l.classList.remove('active'));
        layer.classList.add('active');
        token.style.top = (layer.offsetTop + layer.offsetHeight / 2 - 17) + 'px';
        timers.push(setTimeout(() => {
          layer.classList.add('tested', layer.dataset.outcome);
          if (layer.dataset.outcome === 'block') {
            layer.classList.remove('active');
            token.classList.add('stuck');
          }
        }, 420));                    // let the token arrive before the verdict
      }, 120 + i * STEP));
    });
  }

  $(section, 'run').addEventListener('click', run);
  $(section, 'reset').addEventListener('click', reset);
  requestAnimationFrame(reset);
  DeckWidgets.own(section, { run, reset });
});
```

---

## 3. `race` — two lanes, live counters, one finishing far sooner

**What it's for.** A cost difference an audience cannot feel from a number in
a table. Two lanes fill at different rates while node / allocation / elapsed
counters run; the fast lane finishes while the slow one is a third of the way
along.

**The honesty rule, restated because this widget invites the mistake.** Live
counters read as a benchmark. `RACE` below is a **model**. Say so in the
speaker notes and say so on stage before anyone asks. The relationship being
real is a defensible claim; the digits being measured is not, unless they are
— in which case say *that*, and where they came from.

**The one non-obvious bit.** The two lanes deliberately have *different real
durations* (`dur`) from their *reported* times (`ms`). Scaling wall-clock to
the real ratio (62 ms vs 1,840 ms) would make the fast lane finish before the
eye caught it. `dur` is stagecraft; `ms` is the claim.

### Markup

```html
<section data-part="three" data-title="One keystroke, whole solution" data-interactive>
  <h2>One keystroke, whole solution</h2>
  <div class="race" data-widget="race">
    <div class="lane slow" data-lane="slow">
      <div class="head">
        <span class="tag">&#10007; SLOW</span>
        <span class="name">ToDisplayString() per node
          <small>no scope gate — visits every project</small></span>
        <span class="done" data-role="done"></span>
      </div>
      <span class="track"><span class="fill" data-role="fill"></span></span>
      <div class="meters">
        <span>nodes visited <b data-role="nodes">0</b></span>
        <span>strings allocated <b class="warnv" data-role="allocs">0</b></span>
        <span>elapsed <b data-role="ms">0 ms</b></span>
      </div>
    </div>
    <div class="lane fast" data-lane="fast">
      <div class="head">
        <span class="tag">&#10003; FAST</span>
        <span class="name">scope gate + symbol compare
          <small>irrelevant projects do zero work</small></span>
        <span class="done" data-role="done"></span>
      </div>
      <span class="track"><span class="fill" data-role="fill"></span></span>
      <div class="meters">
        <span>nodes visited <b data-role="nodes">0</b></span>
        <span>strings allocated <b data-role="allocs">0</b></span>
        <span>elapsed <b data-role="ms">0 ms</b></span>
      </div>
    </div>
  </div>
  <div class="toolbar" style="margin-top:24px;margin-bottom:0">
    <span class="label">40 projects &middot; 12 000 symbols &middot; 1 keystroke</span>
    <button class="btn primary" data-role="run">&#9654; Simulate a keystroke
      <span class="kbd">B</span></button>
    <button class="btn" data-role="reset">Reset <span class="kbd">R</span></button>
  </div>
  <aside class="notes">Illustrative simulation, not a benchmark — say that.
  The shape is what's real.</aside>
</section>
```

`.track` and `.fill` are `<span>`s and **must** stay `display: block`, which
`widgets.css` handles. Without it the bar silently collapses to a 1px line and
looks like a data bug.

### JS

```js
DeckWidgets.register('race', function (el) {
  const { nf, $ } = DeckWidgets.helpers;
  const section = el.closest('section');

  // ms   = the number you claim (put its provenance in the speaker notes)
  // dur  = how long the animation takes on stage. Deliberately NOT to scale:
  //        the real ratio would finish the fast lane before anyone saw it.
  const RACE = {
    slow: { nodes: 12000, allocs: 12000, ms: 1840, dur: 3000 },
    fast: { nodes: 900,   allocs: 0,     ms: 62,   dur: 620 }
  };

  const lanes = {};
  Object.keys(RACE).forEach((k) => {
    lanes[k] = el.querySelector(`.lane[data-lane="${k}"]`);
  });
  let raf = null;

  function paintLane(k, p) {
    const lane = lanes[k], spec = RACE[k];
    $(lane, 'fill').style.width = (p * 100) + '%';
    $(lane, 'nodes').textContent = nf(spec.nodes * p);
    $(lane, 'allocs').textContent = nf(spec.allocs * p);
    $(lane, 'ms').textContent = nf(spec.ms * p) + ' ms';
  }

  function reset() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    Object.keys(RACE).forEach((k) => {
      lanes[k].classList.remove('running', 'finished');
      $(lanes[k], 'done').textContent = '';
      paintLane(k, 0);
    });
  }

  function run() {
    reset();
    Object.keys(RACE).forEach((k) => lanes[k].classList.add('running'));
    const t0 = performance.now();
    (function tick(now) {
      const t = now - t0;
      let allDone = true;
      Object.keys(RACE).forEach((k) => {
        const spec = RACE[k];
        const p = Math.min(1, t / spec.dur);
        paintLane(k, p);
        if (p >= 1) {
          if (!lanes[k].classList.contains('finished')) {
            lanes[k].classList.add('finished');
            lanes[k].classList.remove('running');
            $(lanes[k], 'done').textContent =
              `${nf(spec.ms)} ms · ${nf(spec.allocs)} allocations`;
          }
        } else {
          allDone = false;
        }
      });
      raf = allDone ? null : requestAnimationFrame(tick);
    })(t0);
  }

  $(section, 'run').addEventListener('click', run);
  $(section, 'reset').addEventListener('click', reset);
  reset();
  DeckWidgets.own(section, { run, reset });
});
```

---

## 4. `wire` — a message exchange, one frame per press

**What it's for.** Any request/response conversation you want to walk through
message by message: an HTTP or RPC exchange, an OAuth dance, a webhook
round-trip, a replayed event stream. Showing the actual frames kills the
suspicion that a protocol is magic, and JSON pretty-printed on a projector is
persuasive in a way a box-and-arrow diagram is not.

**Why one press per frame, not one press for the whole trace.** The
interesting thing about a protocol is what each message *carries*, and that
needs a sentence of narration between frames. Every other widget here plays
straight through; this one deliberately does not. Reaching the last frame is a
no-op, so leaning on the clicker cannot run past the slide.

**The one non-obvious bit.** The log is a *fixed height* with `overflow-y:
auto`, and the widget scrolls to the bottom after each frame. That means the
panel cannot grow past the slide frame no matter how many messages you add —
so unlike the other widgets, this one can never become the slide that
overflows. Direction is carried on the frame's left border rather than only in
its header, so a frame scrolled half out of view still reads as request or
response.

**Nothing about your protocol is in the JS.** Frames are
`<script type="text/template">` in document order, with `data-dir`
(`out` = you to them, `in` = them to you), `data-method` and an optional
`data-note`. Reordering the conversation, or swapping in a different protocol
entirely, is a markup edit.

### Markup

```html
<section data-part="build" data-title="On the wire" data-interactive>
  <h2>What's actually on the wire</h2>
  <div class="wire" data-widget="wire" data-stagger="14">
    <div class="wire-log" data-role="log"></div>

    <script type="text/template" data-dir="out" data-method="initialize"
            data-note="handshake">
{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": { "protocolVersion": "2025-06-18" } }
    </script>
    <script type="text/template" data-dir="in" data-method="result"
            data-note="the server says who it is">
{ "jsonrpc": "2.0", "id": 1,
  "result": { "serverInfo": { "name": "weather", "version": "1.0.0" } } }
    </script>
    <script type="text/template" data-dir="out" data-method="tools/call"
            data-note="the model chose this">
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "get_weather", "arguments": { "city": "Ghent" } } }
    </script>
  </div>

  <div class="toolbar" style="margin-top:14px;margin-bottom:0">
    <button class="btn primary" data-role="run">&#9654; Next frame
      <span class="kbd">B</span></button>
    <button class="btn" data-role="reset">Reset <span class="kbd">R</span></button>
    <span class="label">frame <b data-role="frame-count">0/3</b></span>
  </div>

  <aside class="notes">One press per frame, so there is room to talk between
  them. Say what to watch for BEFORE you press.</aside>
</section>
```

Keep each frame to four to nine lines. Elide with `...` rather than pasting a
real capture: nobody reads a 40-line envelope from the back of the room, and
the fields you cut were not the point.

### JS

```js
DeckWidgets.register('wire', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const log = $(el, 'log');
  const counter = $(section, 'frame-count');
  const stagger = Number(el.dataset.stagger || 16);
  // data-labels="agent|you" turns the protocol log into a conversation log
  const [outLabel, inLabel] = (el.dataset.labels || '→ request|← response').split('|');
  const lang = el.dataset.lang || 'json';
  const emptyMsg = el.dataset.empty || 'no traffic yet';

  // read the templates out of the DOM once, so nothing re-parses mid-talk
  const frames = Array.from(el.querySelectorAll('script[type="text/template"]'))
    .map((t) => {
      const f = {
        dir: t.dataset.dir || 'out',
        method: t.dataset.method || '',
        note: t.dataset.note || '',
        body: t.textContent.replace(/^\n+|\s+$/g, '')
      };
      t.remove();
      return f;
    });

  let at = 0;
  let busy = false;

  function reset() {
    busy = false;
    at = 0;
    log.innerHTML = '<div class="empty">' + emptyMsg + '<br>'
      + '<span style="opacity:.7">press &ldquo;Next frame&rdquo;</span></div>';
    if (counter) counter.textContent = '0/' + frames.length;
  }

  function run() {
    if (busy || at >= frames.length) return;     // past the end is a no-op
    busy = true;
    const f = frames[at++];

    const empty = log.querySelector('.empty');
    if (empty) empty.remove();

    const box = document.createElement('div');
    box.className = 'frame ' + f.dir;
    box.innerHTML =
      '<div class="hdr">'
      + '<span class="dir">' + (f.dir === 'out' ? outLabel : inLabel) + '</span>'
      + '<span class="method">' + f.method + '</span>'
      + (f.note ? '<span class="note">' + f.note + '</span>' : '')
      + '</div><div class="codelines"></div>';
    log.appendChild(box);

    if (counter) counter.textContent = at + '/' + frames.length;

    DeckCode.paint(box.querySelector('.codelines'), f.body, lang, { stagger })
      .then(() => { log.scrollTop = log.scrollHeight; busy = false; });
    log.scrollTop = log.scrollHeight;   // and as it types, not only when done
  }

  const runBtn = $(section, 'run');
  if (runBtn) runBtn.addEventListener('click', run);
  const resetBtn = $(section, 'reset');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  reset();
  DeckWidgets.own(section, { run, reset });
});
```

`data-lang` sets the highlighter for the frames (`json` by default; `text` for
a raw HTTP exchange or a chat, `csharp` if you are showing calls rather than
payloads).

**Conversation variant.** The same widget walks any two-party exchange: an
agent interviewing a user, a code review thread, a support chat. Set
`data-labels="agent|you" data-lang="text" data-empty="/grill-me add a pause button"`
and write each turn as a frame. `data-method` becomes the turn's title
("Round 1", "answer by number") and `data-note` the aside. Keep the user turns
to one line: the contrast with the long agent turns is what reads from the
back of the room. If the exchange is written for the talk rather than captured
from a real session, say so in the speaker notes.

---

## 5. `slices` — the same work, cut two ways

**What it's for.** Showing that *how you split work* decides when anything
works: tickets by layer versus vertical slices (tracer bullets), big-bang
versus incremental migration, batch versus streaming. Two lanes hold the same
grid of work (features across, layers down). Each press completes one ticket
in both lanes: a whole **row** on the left, a whole **column** on the right. A
feature is "done" when its column is full, and each lane counts its done
features. After ticket 1 the right lane has a working feature and the left has
none; that gap is the argument.

**Why the grid is generated.** Features and layers are lists in `data-*`
attributes, so retargeting the slide to a different example is a markup edit.
The grid should be square (as many layers as features): the lanes then need
the same number of tickets, and the comparison is fair.

### Markup

```html
<section data-part="build" data-title="Vertical slices" data-interactive>
  <h2>Tickets are vertical slices</h2>
  <div class="slices" data-widget="slices"
       data-features="Pause|Resume date|Packed bag" data-layers="Schema|API|UI">
    <div class="lane h">
      <div class="lane-hd">
        <span class="t">By layer<small>one ticket per layer</small></span>
        <span class="demo">demoable <b data-role="demo">0</b>/3</span>
      </div>
      <div class="grid"></div>
      <div class="verdict" data-role="verdict">&nbsp;</div>
    </div>
    <div class="lane v">
      <div class="lane-hd">
        <span class="t">Tracer bullets<small>one ticket per feature</small></span>
        <span class="demo">demoable <b data-role="demo">0</b>/3</span>
      </div>
      <div class="grid"></div>
      <div class="verdict" data-role="verdict">&nbsp;</div>
    </div>
  </div>
  <div class="toolbar" style="margin-top:16px;margin-bottom:0">
    <button class="btn primary" data-role="run">&#9654; Next ticket <span class="kbd">B</span></button>
    <button class="btn" data-role="reset">Reset <span class="kbd">R</span></button>
    <span class="label">ticket <b data-role="ticket-count">0/3</b></span>
  </div>
</section>
```

### JS

```js
DeckWidgets.register('slices', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const features = (el.dataset.features || 'A|B|C').split('|');
  const layers = (el.dataset.layers || 'DB|API|UI').split('|');
  const counter = $(section, 'ticket-count');
  const total = Math.max(features.length, layers.length);
  const lanes = Array.from(el.querySelectorAll('.lane'));

  lanes.forEach((lane) => {
    let html = '<span></span>';
    features.forEach((f, c) => { html += '<span class="colhd" data-col="' + c + '">' + f + '</span>'; });
    layers.forEach((l, r) => {
      html += '<span class="rowhd">' + l + '</span>';
      features.forEach((f, c) => { html += '<span class="cell" data-r="' + r + '" data-c="' + c + '"></span>'; });
    });
    lane.querySelector('.grid').innerHTML = html;
  });

  let step = 0;
  let busy = false;

  function paint() {
    lanes.forEach((lane) => {
      let n = 0;
      features.forEach((f, c) => {
        const full = Array.from(lane.querySelectorAll('.cell[data-c="' + c + '"]'))
          .every((x) => x.classList.contains('on'));
        lane.querySelector('.colhd[data-col="' + c + '"]').classList.toggle('ok', full);
        if (full) n++;
      });
      $(lane, 'demo').textContent = n;
      const v = $(lane, 'verdict');
      if (step === 0) v.innerHTML = '&nbsp;';
      else if (n === 0) v.innerHTML = 'After ticket ' + step + ': <b>nothing to demo yet</b>';
      else if (lane.classList.contains('h')) v.innerHTML = 'After ticket ' + step + ': <b>everything, but only at the very end</b>';
      else v.innerHTML = 'After ticket ' + step + ': <b>' + n + ' working feature' + (n > 1 ? 's' : '') + '</b>';
    });
    if (counter) counter.textContent = step + '/' + total;
  }

  function reset() {
    busy = false;
    step = 0;
    el.querySelectorAll('.cell').forEach((c) => { c.classList.remove('on'); c.textContent = ''; });
    paint();
  }

  function run() {
    if (busy || step >= total) return;
    busy = true;
    const t = step++;
    lanes.forEach((lane) => {
      // by layer: ticket t is a whole row; vertical slice: a whole column
      const sel = lane.classList.contains('h') ? '.cell[data-r="' + t + '"]' : '.cell[data-c="' + t + '"]';
      lane.querySelectorAll(sel).forEach((c, i) => {
        setTimeout(() => { c.classList.add('on'); c.textContent = 'T' + (t + 1); }, i * 140);
      });
    });
    setTimeout(() => { paint(); busy = false; }, layers.length * 140 + 260);
  }

  const runBtn = $(section, 'run');
  if (runBtn) runBtn.addEventListener('click', run);
  const resetBtn = $(section, 'reset');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  reset();
  DeckWidgets.own(section, { run, reset });
});
```

Tell the room what to watch before the first press: "count the green
headers". The first press makes the point; the last press shows both lanes
finish the same work, which heads off the "but it's the same amount of work"
objection.

---

## Writing a new one

Before building a widget, answer: **what does pressing the button prove that a
sentence could not?** If there isn't an answer, write the sentence.

When there is:

1. Put the *content* in the markup (`data-*`, templates, per-item outcomes) and
   the *behaviour* in the JS. You will re-time and re-word a demo far more
   often than you re-code it, and markup is where a co-presenter can follow.
2. Animate over ~600–3000 ms. Under 400 ms nobody sees it happen; over about
   4 s the room starts talking over it.
3. Reveal generated content **line by line** (`DeckCode.paint(el, src, lang,
   { stagger: 24 })`), not all at once. Staggering reads as work being done and
   gives you something to narrate.
4. Make `reset()` restore the *initial* state, not a blank one. A blank panel
   on re-entry looks broken.
5. Run `scripts/test-deck-layout.ts` afterwards: widget slides are the ones that
   overflow the frame, because a panel grows as you add to it.
