---
name: interactive-reveal-deck
description: 'Build a presentation as a reveal.js deck with a designed interface and interactive demos the presenter drives on stage. Use when the user asks for a presentation, slide deck or talk, wants live demos in slides, or wants an existing Markdown or reveal-md deck upgraded.'
version: 1.3.0
---

# Interactive reveal.js decks

A deck written directly against reveal.js: a designed interface, plus widgets
the presenter drives with <kbd>B</kbd> (run) and <kbd>R</kbd> (reset). A widget
earns its slide only when pressing B **proves** something a sentence cannot: a
generator emitting output, one approach beating another, a mechanism working.

Paths below are relative to this skill's directory.

## Workflow

1. **Read every source.** Notes, transcripts, the project's own docs, and
   every image (screenshots carry facts the notes skip). Check each claim the
   deck will make against a primary source (a version, a pinned commit, a star
   count) rather than repeating the request's wording. Done when every file
   and image has been opened.
2. **Outline as claim titles.** One line per slide, each title a claim
   ("Tickets are vertical slices", not "Tickets"). Follow the user's table of
   contents and its emphasis: a topic marked for extra attention gets its own
   slide or a widget. Done when every point of the user's request maps to a
   slide.
3. **Pick one running example.** A single concrete scenario (a feature, a bug,
   a customer), introduced on the problem slide and reused in every part, so
   each later slide costs one sentence to explain.
4. **Choose parts and widgets.** Three to five parts. One to three widgets per
   talk, each one **proving** a point; read
   [references/widget-recipes.md](references/widget-recipes.md) before building
   one. When the talk walks through a process, put a `.flowbar` on every slide
   of the walk.
5. **Scaffold and write** (sections below). Every slide carries speaker notes:
   the source, the number behind a claim, and what to tell the room before
   pressing B. Mark anything written for the talk rather than measured or
   captured (a sample conversation, a modelled number) as illustrative, in
   the notes, so the presenter says so on stage before someone asks. A widget
   showing "1,840 ms" reads as a benchmark.
6. **Verify and look** (section below). Done when the layout check exits 0,
   you have opened every screenshot, and you have driven every widget to its
   last step and looked at that state.

## Scaffold

```bash
node scripts/new-reveal-deck.ts --path <deck-dir> --title "My Talk" \
    --part intro:Intro --part build:Build --part ship:Ship
cd <deck-dir> && npm start        # http://localhost:8081
```

Copies `assets/` and installs reveal.js and http-server locally, so the deck
presents with no network. Options are in the script's header. Needs Node
22.18+ (it runs `.ts` directly).

## Slide authoring

Content is plain HTML in `index.html`; the template holds one of every
component and two working widgets. Restyle by editing the tokens at the top of
`css/deck.css`.

- **Every `<section>` gets `data-part` and `data-title`.** `data-part` picks
  the part's accent colour and its place on the chapter rail; `id` must match
  an entry in `window.DECK_PARTS`. `data-title` is what the rail and the
  jump-to-slide palette show.
- **Code goes in `<script type="text/template">`** inside a
  `figure.code-window`. Script text is raw, so generics, JSX and HTML need no
  escaping. `data-lang`: `csharp`, `json` (JSONC), `js`/`ts`, `markdown`,
  `text`; add one in `LANGS` in `js/code.js`. `data-steps="1-3|6-9"` makes
  arrow keys step through highlighted ranges.

  ```html
  <figure class="code-window" data-code data-lang="ts" data-file="cart.ts"
          data-tag="before" data-steps="1-2|4-6">
    <script type="text/template">
  export function total(items: Item[]): number { ... }
    </script>
  </figure>
  ```
- **Optional depth goes in a vertical stack**: a `<section>` wrapping sibling
  sections. The readout shows `↓ more`, so detail you'd show only if asked
  stays reachable and off the main path. The template maps Space, PageDown
  and PageUp (what clickers send) to right and left, so only the down arrow
  enters a stack.

Components:

| Component | For |
|---|---|
| `ul.rows`, `ol.rows` | Bullets, four to five rows at most |
| `.card` / `.card.good` / `.card.bad` in `.grid-2` / `.grid-3` | Parallel points, before/after, do/don't |
| `blockquote.pull` (`.pull.hero` for the big one) | The line to remember |
| `table.matrix` with `td.win` / `td.lose` | Comparisons |
| `.terminal` | Commands. It is `white-space: pre`: start the content on the tag's own line and close the tag on the last line. |
| `img.shot` | Screenshots and diagrams |
| `.flowbar` | "You are here" in a process: `<div class="flowbar" data-steps="plan\|build\|review" data-at="build">` |
| `.chain > .node` | The whole process on one slide (`.cmd`, `.what`, `.out`, `.who`), `style="--n:4"` for the column count |
| `.label-sm`, `.chips` | A small caption above a block; a wrapping row of terms |
| `.links > a.card` | The closing slide's links, with `.url` lines |
| `section.part-divider`, `section.title-slide` | Part openers, title and closing slides |

Steps that appear together share a `data-fragment-index`. Once one fragment
on a slide has an index, give every fragment on that slide one: reveal shows
all indexed fragments before any unindexed one, so the stage order silently
differs from the source order.

Keep inline `<code>` in cards to short names: a long token such as
`plugin@marketplace` wraps mid-word. Put long commands in a `.terminal`.

## Widgets

Built in (`js/widgets.js`):

- **`pipeline`**: input in, generated output out line by line. Variant buttons
  change the input and rebuild; the second build is the argument.
- **`calc`**: one slider, several derived numbers. Expressions live in the
  markup (`data-calc="n * 48"`, `data-bar="42 + n"`), evaluated against `n`.

The recipes file holds five more with full code (fake IDE quick fix, a token
walking down defence layers, a two-lane race, a message exchange or
conversation one frame per press, the same work cut by layer versus vertical
slices). Their CSS already ships in `css/widgets.css`.

Every widget keeps this contract:

- **<kbd>B</kbd> runs, <kbd>R</kbd> resets**, so the presenter drives it from a
  clicker.
- **Entering the slide calls `reset()`**, so a second pass through the deck
  behaves like the first.
- **`run()` is idempotent**: a `busy` flag absorbs a clicker double-tap.
- Register it in `js/my-widgets.js`, loaded before `chrome.js`:

```js
DeckWidgets.register('myThing', function (el) {
  const section = el.closest('section');
  function run()   { /* ... */ }
  function reset() { /* ... */ }
  reset();
  DeckWidgets.own(section, { run, reset });
});
```

Before changing `deck.css`, `chrome.js`, `code.js` or the `Reveal.initialize`
call, or writing CSS for a new widget, read
[references/framework-gotchas.md](references/framework-gotchas.md).

## Verify and look

```bash
node scripts/test-deck-layout.ts --path <deck-dir> --shots <shots-dir>
```

Walks every slide in a real browser with all fragments shown. Exits 1 on a
slide taller than the 740px frame, content past the right edge, a block that
scrolls sideways, or a JS error. Needs `agent-browser`
(`npm i -g agent-browser`). Fix overflow by trimming content or moving it to a
vertical stack; code stays at or above `.32em` to read from the back row.

`--shots` saves one 1600x925 screenshot per slide. Open each one: collapsed
whitespace, a tiny image, a card that reads as a wall of text pass every
check. Screenshots catch widgets in their reset state, so also drive each
widget to its last step and look. Reach a fragment slide going forwards:
backward navigation shows all fragments by design.

## PDF handout

`http://localhost:8081/index.html?print-pdf`, then print to PDF, one page per
slide. Widgets export in their reset state, so a static slide near each
widget should carry the same point; it doubles as the fallback when a live
demo misbehaves.
