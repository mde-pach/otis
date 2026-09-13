# Otis

A tool for turning a pile of notes into an article you would actually publish.

**Text in, text out.** Your notes are one string. The article is one Markdown
string. Provenance is a set of ranges over the two. There are no fragments,
blocks, slots or sections in the model — paste a single line and you get a
single line back, with the parts that moved highlighted inside it.

## The rule

Your text is the source of truth. Otis moves your sentences into an order that
reads, shortens the ones that run long, and — when you let it — writes the parts
your notes never covered. Each of those is a different colour on the page:

| | |
|---|---|
| plain | your words, exactly as you wrote them |
| cyan | your sentence, shortened — no number or claim changed |
| amber | written by Otis; edit it and it becomes yours |
| louder amber | written, and further from what your notes support |
| dimmed, on the left | something you wrote that the article is not using |

Nothing is captioned. Colour is the only thing that says where a word came
from, and no other part of the interface is allowed either hue.

## Reach

One dial, four settings, from the writer's side rather than the model's:

- **as written** — your text, your order. Nothing is touched, and no key is needed.
- **tidy** — shortens sentences that run long. Keeps your order, writes nothing.
- **reorder** — moves things, and drops what does not earn its place.
- **rebuild** — all of the above, and writes what is missing.

The same plan renders four ways. The lower settings do not ask for less; they
refuse to use parts of what came back.

## What the model is asked for

Never an article. It is given the writer's segments, what they said they are
making, and a short reference note, and it answers in **indices**:

```ts
interface Plan {
  at: (number | null)[];                  // where each of your segments goes, or null
  format: Record<number, string>;         // same words, markdown added
  short: Record<number, string>;          // fewer words, same claims
  written: { after: number; md: string; confidence: "high" | "low" }[];
  because: string;
}
```

There is no way to express "put a heading here" or "make a section". The only
text it may contribute arrives in `written`, and that is marked for as long as
it survives.

Nothing it returns is trusted. Every index is resolved against the segments,
duplicates dropped, a `format` entry that changed a word is discarded as a lie,
and a `short` that fails the faithfulness gate never reaches the page.

## The gate

A shortening is checked before anything renders:

- one that keeps almost none of the original's words is a rewrite, not a shortening
- one that introduces a number, unit or identifier the original did not contain
  has invented a fact

A failed shortening is not rendered and then withdrawn. It never exists — the
writer's own sentence stands, and they are not told about a suggestion that was
never safe to make.

**Formatting is not rewriting.** Comparison happens on plain text, so Otis may
bold a figure, make a list or add a heading and the words stay marked as yours.

## Patterns

`patterns/*.md` — a few dozen words each on how a post-mortem, an internal note,
an explanation or an essay tends to move. They are the whole of the context Otis
reads about a kind of writing: versioned with the code, editable, and picked
from the brief by word rather than by a model, so the choice is one you can
check. When one gives bad results you change a file.

## Layout

```
src/
  core/          pure TypeScript — no DOM, no fetch, no storage
    types.ts         Segment, Run, Plan, Reach, Doc
    segments.ts      locating your text without cutting it up (fences stay whole)
    plan.ts          a plan plus a reach becomes runs; the only place an article is made
    markdown.ts      just enough: bold, italic, code, headings, list items
    reword.ts        the faithfulness gate, and what counts as formatting
    diff.ts          word diff, sequence and bag retention
    ports.ts         Planner / DocStore
  adapters/
    llm/             Claude from the browser, and the planner
    patterns/        the bundled reference notes
    store/           IndexedDB
  ui/            Solid: Notes, Threads, Article, Capsule, About
  pages/         Astro shell
patterns/        the reference notes themselves
fixtures/        a fixed pile of notes to run changes against
scripts/         the layout check
```

## Commands

```sh
bun install
bun run dev            # http://localhost:4321/otis/
bun test               # the core, no browser needed
bun run lint           # biome
bun run check:layout   # the panes, in a real browser, at five window sizes
bun run build
```

`check:layout` exists because a pane whose chrome has slid off the bottom looks
fine in a screenshot of the top of the page — which is how a button once shipped
unreachable. It asserts what a screenshot cannot: no pane taller than the
window, overflow scrolling inside the pane, the capsule reachable, every segment
arriving in the article, the notes still one text node, and hovering lighting
exactly one run and one thread. Set `OTIS_CHROMIUM` to skip `playwright install`
if you already have a chromium.

Your key and your notes stay in the browser: the key in `localStorage`, the
document in IndexedDB. Nothing is sent anywhere but the model endpoint you
configured.

Deploys to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).

## Next

- **Confidence from the model rather than a label** — `written` runs carry a
  `confidence` today because the planner is asked for one. Grounding it in
  something measurable would be better.
- **Numbers guard** — every figure in the output checked against the notes, and
  an unmatched one flagged rather than styled.
- **The file as the source of truth** — File System Access API, one `.otis.md`
  per article, IndexedDB demoted to a cache.
