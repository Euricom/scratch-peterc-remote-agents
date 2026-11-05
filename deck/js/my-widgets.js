/* Deck-specific widgets. Loaded after widgets.js, before chrome.js. */

/* survive: one network event per press. Each row carries its outcomes in
   data-out="ok|bad|lost" (one per event, in column order); each event column
   is judged from a fresh, healthy session. */
DeckWidgets.register('survive', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const heads = Array.from(el.querySelectorAll('.hd[data-event]'));
  const rows = Array.from(el.querySelectorAll('.who[data-out]'));
  const verdict = $(section, 'verdict');
  const counter = $(section, 'event-count');
  const LABEL = { ok: '✓ agent alive', bad: '✗ agent killed', lost: '⚠ alive, unreachable' };
  const VERDICTS = (el.dataset.verdicts || '').split('|');
  const STAGGER = 260;

  // build the empty cells once, right after each row label
  const cells = rows.map((row) => {
    const outs = row.dataset.out.split('|');
    let anchor = row;
    return outs.map((out) => {
      const c = document.createElement('div');
      c.className = 'cell';
      c.dataset.out = out;
      anchor.after(c);
      anchor = c;
      return c;
    });
  });

  let at = 0;
  let busy = false;
  let timers = [];

  function reset() {
    timers.forEach(clearTimeout);
    timers = [];
    busy = false;
    at = 0;
    heads.forEach((h) => h.classList.remove('on'));
    cells.flat().forEach((c) => { c.className = 'cell'; c.textContent = '·'; });
    if (verdict) verdict.innerHTML = '&nbsp;';
    if (counter) counter.textContent = '0/' + heads.length;
  }

  function run() {
    if (busy || at >= heads.length) return;   // past the last event is a no-op
    busy = true;
    const col = at++;
    heads.forEach((h, i) => h.classList.toggle('on', i === col));
    if (verdict) verdict.innerHTML = '&nbsp;';
    if (counter) counter.textContent = at + '/' + heads.length;
    cells.forEach((row, r) => {
      timers.push(setTimeout(() => {
        const c = row[col];
        c.className = 'cell pop ' + c.dataset.out;
        c.textContent = LABEL[c.dataset.out];
        timers.push(setTimeout(() => c.classList.remove('pop'), 300));
      }, 150 + r * STAGGER));
    });
    timers.push(setTimeout(() => {
      if (verdict && VERDICTS[col]) verdict.innerHTML = VERDICTS[col];
      busy = false;
    }, 150 + rows.length * STAGGER + 200));
  }

  const runBtn = $(section, 'run');
  if (runBtn) runBtn.addEventListener('click', run);
  const resetBtn = $(section, 'reset');
  if (resetBtn) resetBtn.addEventListener('click', reset);

  reset();
  DeckWidgets.own(section, { run, reset });
});

/* hub diagrams: one arrow from each client box to the tailnet label. Drawn
   from offset geometry (unscaled slide px), redrawn on every slide change
   because offsets are 0 while a slide is hidden. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let fans = 0;
  function offsetIn(el, root) {
    let x = 0, y = 0;
    for (let n = el; n && n !== root; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
    return { x, y };
  }
  function draw(hub) {
    const label = hub.querySelector('.wall');
    const clients = Array.from(hub.querySelectorAll('.clients .end'));
    if (!label || !hub.offsetWidth) return;
    let svg = hub.querySelector('svg.fan');
    if (!svg) {
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'fan');
      svg.dataset.marker = 'fan-arrow-' + (++fans);   // one marker per hub, so each can have its own colour
      svg.innerHTML = '<defs><marker id="' + svg.dataset.marker + '" viewBox="0 0 10 10" refX="9" refY="5" ' +
        'markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>';
      hub.appendChild(svg);
    }
    svg.setAttribute('width', hub.offsetWidth);
    svg.setAttribute('height', hub.offsetHeight);
    svg.querySelectorAll('path.link').forEach((p) => p.remove());
    const l = offsetIn(label, hub);
    // label is centred with translate(-50%,-50%), so correct for its own size
    // the cloud outline sits inside its box, so stop the arrows at the drawn edge
    const lx = l.x - label.offsetWidth / 2 + (label.classList.contains('cloud') ? 14 : -2);
    const ly = l.y - label.offsetHeight / 2 + label.offsetHeight / 2;
    clients.forEach((c, i) => {
      const o = offsetIn(c, hub);
      const sx = o.x + c.offsetWidth, sy = o.y + c.offsetHeight / 2;
      const ty = ly + (i - (clients.length - 1) / 2) * 8;   // fan into the label
      const mx = sx + (lx - sx) * 0.5;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('class', 'link');
      p.setAttribute('d', `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${lx},${ty}`);
      p.setAttribute('marker-end', `url(#${svg.dataset.marker})`);
      svg.appendChild(p);
    });
  }
  const drawAll = () => document.querySelectorAll('.reach.hub').forEach(draw);
  window.addEventListener('load', () => {
    if (window.Reveal) {
      Reveal.on('ready', drawAll);
      Reveal.on('slidechanged', drawAll);
      Reveal.on('resize', drawAll);
    }
    setTimeout(drawAll, 300);
  });
})();

/* flagBuilder: toggles for claude remote-control flags; shows the command and
   N sessions in one folder vs N worktrees. B = next preset, R = default. */
DeckWidgets.register('flagBuilder', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const segs = {};
  el.querySelectorAll('.seg[data-key]').forEach((s) => { segs[s.dataset.key] = s; });
  const cmd = $(section, 'cmd'), diagram = $(section, 'diagram'), note = $(section, 'note');
  const DEFAULT = { spawn: 'same-dir', cap: '32', perm: 'default' };
  const PRESETS = [
    DEFAULT,
    { spawn: 'worktree', cap: '8', perm: 'acceptEdits' },
    { spawn: 'session', cap: '32', perm: 'acceptEdits' }
  ];
  const MAX_DRAWN = 8;
  let state = { ...DEFAULT };
  let preset = 0;

  function render() {
    Object.entries(segs).forEach(([k, s]) => {
      s.querySelectorAll('button').forEach((b) => {
        b.setAttribute('aria-selected', String(b.dataset.v === state[k]));
        if (k === 'cap') b.disabled = state.spawn === 'session';
      });
    });
    const parts = ['claude remote-control --name "api"'];
    if (state.spawn !== 'same-dir') parts.push('--spawn ' + state.spawn);
    if (state.spawn !== 'session' && state.cap !== '32') parts.push('--capacity ' + state.cap);
    if (state.perm !== 'default') parts.push('--permission-mode ' + state.perm);
    cmd.innerHTML = '<span class="p">$</span> ' +
      parts.map((f) => '<span style="white-space:nowrap">' + f + '</span>').join(' ');

    const n = state.spawn === 'session' ? 1 : Number(state.cap);
    const drawn = Math.min(n, MAX_DRAWN);
    const more = n > drawn ? '<span class="more">+' + (n - drawn) + '</span>' : '';
    const dot = (i) => '<span class="dot" style="animation-delay:' + (i * 40) + 'ms"></span>';
    if (state.spawn === 'worktree') {
      let h = '';
      for (let i = 0; i < drawn; i++) h += '<div class="folder">wt-' + (i + 1) + '<div class="dots">' + dot(i) + '</div></div>';
      diagram.innerHTML = h + more;
    } else {
      let d = '';
      for (let i = 0; i < drawn; i++) d += dot(i);
      diagram.innerHTML = '<div class="folder shared">~/api<div class="dots">' + d + more + '</div></div>';
    }
    const NOTES = {
      'same-dir': '<b>' + n + ' sessions, one folder</b>: they can edit the same files.',
      worktree: '<b>' + n + ' worktrees</b>: one per session, no edit conflicts.',
      session: '<b>Exactly one session</b>, reachable from your phone.'
    };
    note.innerHTML = NOTES[state.spawn] + (state.perm === 'acceptEdits' ? ' Fewer approvals land on your phone.' : '');
  }

  Object.entries(segs).forEach(([k, s]) => {
    s.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      state[k] = b.dataset.v;
      render();
    });
  });

  function run() {
    preset = (preset + 1) % PRESETS.length;
    state = { ...PRESETS[preset] };
    render();
  }
  function reset() { preset = 0; state = { ...DEFAULT }; render(); }

  const runBtn = $(section, 'run');
  if (runBtn) runBtn.addEventListener('click', run);
  const resetBtn = $(section, 'reset');
  if (resetBtn) resetBtn.addEventListener('click', reset);
  reset();
  DeckWidgets.own(section, { run, reset });
});

/* rcClose: one event per press. Closing the client leaves the session working;
   closing the host pauses or stops it. The bar is the work in progress. */
DeckWidgets.register('rcClose', function (el) {
  const { $ } = DeckWidgets.helpers;
  const section = el.closest('section');
  const client = $(section, 'client'), host = $(section, 'host');
  const clientSt = $(section, 'client-st'), hostSt = $(section, 'host-st');
  const session = $(section, 'session'), sessSt = $(section, 'sess-st'), bar = $(section, 'bar');
  const link = el.querySelector('.link');
  const verdict = $(section, 'verdict'), count = $(section, 'count');
  const STEPS = [
    { client: false, host: 'working', verdict: '<b>Client closed.</b> The session keeps running on the host. Push still reaches you.' },
    { client: true, host: 'working', verdict: '<b>App reopened.</b> Same conversation, progress synced.' },
    { client: true, host: 'paused', verdict: '<b>Laptop lid closed.</b> The host sleeps: offline, work paused. Reconnects on wake.' },
    { client: true, host: 'stopped', verdict: '<b>claude quit on the host.</b> The session stops. Bring it back with <code>claude --continue</code>.' }
  ];
  const HOST = { working: ['working', '✅ working'], paused: ['asleep', '⏸ paused'], stopped: ['claude stopped', '❌ stopped'] };
  let at = 0, progress = 0, hostState = 'working', tick = null;

  function apply(s) {
    client.classList.toggle('off', !s.client);
    clientSt.textContent = s.client ? 'connected' : 'closed';
    hostState = s.host;
    host.classList.toggle('off', s.host !== 'working');
    hostSt.textContent = HOST[s.host][0];
    sessSt.textContent = HOST[s.host][1];
    session.className = 'session ' + s.host;
    link.classList.toggle('cut-l', !s.client);
    link.classList.toggle('cut-r', s.host !== 'working');
  }
  function loop() {
    if (hostState === 'working') {
      progress = progress >= 100 ? 8 : progress + 0.25;
      bar.style.width = progress + '%';
    }
  }
  function reset() {
    at = 0; progress = 8; bar.style.width = '8%';
    apply({ client: true, host: 'working' });
    verdict.innerHTML = '&nbsp;';
    count.textContent = '0/' + STEPS.length;
    if (!tick) tick = setInterval(loop, 40);
  }
  let busy = false;
  function run() {
    if (busy || at >= STEPS.length) return;   // absorb a clicker double-tap
    busy = true; setTimeout(() => { busy = false; }, 400);
    const s = STEPS[at++];
    apply(s);
    verdict.innerHTML = s.verdict;
    count.textContent = at + '/' + STEPS.length;
  }
  const runBtn = $(section, 'run');
  if (runBtn) runBtn.addEventListener('click', run);
  const resetBtn = $(section, 'reset');
  if (resetBtn) resetBtn.addEventListener('click', reset);
  reset();
  DeckWidgets.own(section, { run, reset });
});
