# Otis

A tool for turning a pile of notes into an article you would actually publish.

**Text in, text out.** Your notes are one string. The article is one Markdown
string. Provenance is a set of ranges over the two. There are no fragments,
blocks, slots or sections in the model — paste a single line and you get a
single line back, with the parts that moved highlighted inside it.

**The unit is a section of your own document.** Whatever you separated: a block
between blank lines, a bullet, a heading, a fenced block. One section in, one
section out — there is no paragraph model underneath and nothing is grouped back
together afterwards, because layout is Markdown, in the text. A document typed
as a single line has nothing separated in it, so its sentences are its sections
instead; the splitter never cuts inside a decimal, a version, a method call, a
code span or an abbreviation.

**Your notes are read as text, not as `textContent`.** A browser answers Enter
and a paste by building `<div>`s, and `textContent` reads those back with every
line break gone. So line breaks go in as characters, whatever the browser builds
anyway is read properly and flattened back with the caret where it was, and
`check:layout` pastes for real rather than assigning `textContent`.

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

## Shapes

A run comes back with **two or three arrangements**, not one, and applies the
first. "Which shape should this take" is the writer's question, and a model
guessing at it once is worse than offering the ones it can actually make. They
all arrived in the same request, so the strip above the article moves between
them for nothing.

Each is laid out by `skeleton()`: what it leads with, why it is in that order,
and the piece it would make — every section by its opening words, carrying the
place it holds in the notes so a move is visible as well as readable, and the
ones it would leave out named rather than silently missing. A picture of an
order was tried and thrown out: the length of a section is not something anyone
is choosing between. Nothing asks you to approve a reword or a move — the run
applies, and the dial and the strip are how you read it afterwards.

## What it did, in the gutter

Hover a shortened section and the word diff opens on that section's own thread,
between the two texts. It belongs to neither: `check:layout` asserts nothing of
the kind is ever inside `.md`, and nothing is ever written into the notes. The
gutter is hidden below 880px, and the card goes with it.

`copy markdown` in the article's header puts `toMarkdown()` on the clipboard.

The brief suggestions are built from what you pasted: the kind is scored against
the notes themselves, the subject is your own first line, and the sentence is in
the language you wrote in. A fixed list once offered a post-mortem to an essay
about responsibility, which is worse than offering nothing.

## Nothing runs on its own

Typing, moving the dial and rewriting the brief are all free. Only **run**
spends a request, and one request answers all four reach settings — the dial is
a render-time filter over the plan already in hand, so reading your text four
ways costs one call.

A plan is stamped with the notes it was made for. Applied to a different
document it would be a map with no entry for most of what you just pasted, so
`build` sets it aside entirely and shows your text in your order rather than
silently dropping the parts it cannot place. Edit a word and the plan still
fits but is marked behind: the button reads *run again*.

What comes out of storage is revived rather than trusted — it was written by
whatever version the writer last had open. A plan from before arrangements
existed is carried forward into one; anything unreadable is dropped and the
notes stay, because losing the writer's text is the one thing this cannot do.

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
interface Shape {
  name: string;                           // three or four words for the arrangement
  at: (number | null)[];                  // where each of your segments goes in it, or null
  because: string;
}

interface Plan {
  basis: string;                          // the notes it was made for
  shapes: Shape[];                        // the arrangements on offer
  format: Record<number, string>;         // same words, markdown added
  short: Record<number, string>;          // fewer words, same claims
  written: { after: number; md: string; confidence: "high" | "low" }[];
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

Anything written into a gap is checked too. A model asked for what is missing
will happily paraphrase a section it liked, and the piece then makes the same
point twice — once in your voice and once in its own. So the content words are
counted, accents folded and short words dropped: a draft that mostly repeats
something already in the notes is a restatement, not a gap, and never appears.

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
    types.ts         Segment, Run, Shape, Plan, Reach, Doc, and reviveDoc
    segments.ts      your own sections, located without cutting the text up
    plan.ts          a plan, a reach and a shape become runs; the only place an article is made
    markdown.ts      just enough: bold, italic, code, headings, list items
    reword.ts        the faithfulness gate, and what counts as formatting
    diff.ts          word diff, sequence and bag retention
    ports.ts         Planner / DocStore
  adapters/
    llm/             Claude from the browser, and the planner
    patterns/        the bundled reference notes
    store/           IndexedDB
  ui/            Solid: Notes, Threads, Article, Shapes, Capsule, About
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
window, overflow scrolling inside the pane, the capsule reachable, a pasted
document keeping every line break, every section arriving in the article, the
notes still one text node, hovering lighting exactly one run and one thread, and
— with arrangements on offer — every one of them saying what it is, why, and the
piece it would make, without the strip pushing a pane off the window. Set
`OTIS_CHROMIUM` to skip `playwright install` if you already have a chromium.

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
