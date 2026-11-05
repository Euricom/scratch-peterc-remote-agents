# Framework gotchas

Read before changing `deck.css`, `chrome.js`, `code.js`, the `Reveal.initialize`
call, or writing CSS for a new widget. Each of these cost real time once.

**reveal.css contains almost no typography.** A *theme* file is what binds the
`--r-*` variables to selectors. A theme that only *defines* the variables
resolves every `font-family` to Times New Roman, silently, while the custom
properties inspect as correct. `deck.css` has a **theme application layer**
section for exactly this. Keep it, and port it into any theme you start from
scratch.

**`<span>` with a `height` collapses.** Progress bars and meters written as
`<span class="track"><span class="fill">` render as a 1px line until both get
`display: block`. The bar looks *absent*, not broken, so it reads as a data
bug rather than a CSS one.

**Absolutely positioned children need an explicit `left`.** Without one they
sit at their static position, which inside a container with `padding-left` is
*after* the padding, on top of the content you were avoiding.

**Width plus padding needs `box-sizing: border-box`.** Without it, an element
with `width: 100%` pokes past the right edge by its padding.

**`margin: 0.07` in `Reveal.initialize`.** The chapter rail lives outside the
slide, in the letterbox. At reveal's default margin there is no letterbox at
16:9 and the rail sits on the leftmost content.

**Release reveal's own keys before binding them.**
`keyboard: { 66: null, 67: null, 68: null, 82: null, 191: null }` frees
<kbd>B</kbd> <kbd>C</kbd> <kbd>D</kbd> <kbd>R</kbd> <kbd>/</kbd>. Reveal binds
<kbd>B</kbd> to pause: a black screen mid-demo, a confusing failure to debug
live.

**`?print-pdf` runs on screen, not in print media.** Hide custom chrome under
`html.print-pdf` as well as `@media print`, or the rail and the context pill
land in the handout.

**Tokenize the whole block, then split lines.** A block comment is one token
spanning newlines. Splitting first breaks it; splitting after needs the
span-rebalancing that `splitTokenizedLines()` in `code.js` does.
