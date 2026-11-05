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
