# Otis

A tool for turning a pile of notes into an article you would actually publish.

**Text in, text out.** Your notes are one string. The article is one Markdown
string. Provenance is a set of ranges over the two. There are no fragments,
blocks or slots in the model — paste a single line and you get a single line
back, with the parts that moved highlighted inside it.

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

Your text is the source of truth. Otis puts your sections in the order a kind of
piece puts them, shortens the ones that run long by deleting words, and tells
you which parts of that kind your notes do not cover. **It does not write those
parts.** It asks you about them, in the gutter, and the question comes out of a
file you can open and edit.

| | |
|---|---|
| plain | your words, exactly as you wrote them |
| cyan | your sentence, shortened — every word still one of yours |
| amber, in the gutter | a part of this kind of piece nothing was placed in |
| cyan, in the gutter | a part something *was* placed in that does not do its job |
| dimmed, on the left | something you wrote that the article is not using |

Nothing is captioned, and nothing is ever written into the article to explain
the article.

## A pattern is data the program runs

A pattern used to be a note handed to the model with the request to respect it.
That is not a rule — it is a rule whose target is also its enforcer, and it
holds right up until the run where it does not, with nothing in the system able
to tell the difference.

So a `Pattern` is a list of parts, and the program does the work:

```ts
interface Part {
  id: string;
  does: string;              // one line, and all the model is ever told about it
  required: boolean;
  many: boolean;             // whether several of your sections may sit here
  asks: { en: string; fr: string };   // printed when the slot comes up empty
  wants?: "specifics";       // declared on a part that owes a checkable figure
  thin?: { en: string; fr: string };  // printed when it is filled but delivers nothing
}
```

`asks` and `thin` are **never sent to the model**. They are strings the program
prints, so a gap is a question out of a file rather than a sentence generated
about your document.

## What the model is asked for

Two questions, and neither is "write" or "arrange".

**pick** — which kinds of piece could these notes become. It sees one line per
kind on the shelf and answers with ids and a sentence each.

**place** — for one kind, which part each of your sections belongs to. A closed
question with a vocabulary the size of the pattern file:

```ts
{ "at": { "0": "observed", "1": "cost", "2": "cause", "3": null } }
```

Then code takes over, and this is the whole of the argument:

| | |
|---|---|
| `check()` | judges the answer: every section answered once, every value a known part, no single-slot part holding two. One re-ask naming the violations, then your own order. |
| `arrange()` | computes the order from the pattern's part order, and inside a part from yours. The model has no field in which to express a sequence, so the same placement is the same article by construction. |
| `gaps()` | counts required parts with nothing in them, and — for parts that declare `wants` — parts filled by a section carrying no figure. Prints the file's own string. |

There is no field in the reply that the model's own prose could arrive in.

## The card

A card is a pattern: one kind, one arrangement, one card. What it shows comes out
of the pattern file and nowhere else — the name, what that kind of piece does,
and its parts in the order it puts them, dashed where optional. **It reads the
same on every document**, because you are choosing a shape rather than looking at
a small copy of the result. The one line about your notes is why that kind was
picked. Choosing another card organises it, once, and keeps what comes back.

## The spine, and the questions

Down the gutter runs the spine: the part each of your sections is serving,
marked where that part begins. It is there because of a measurement — the tool
is right about three quarters of the time when it says a part is *missing*,
because a neighbouring section slides into the hole, but it is never wrong about
what is *filling* one. So it shows you that, and you catch a cost paragraph
standing in for the opening yourself.

Hover a shortened section and the word diff opens on that section's own thread,
between the two texts. It belongs to neither: `check:layout` asserts nothing of
the kind is ever inside `.md`. The gutter is hidden below 880px.

`copy markdown` in the article's header puts `toMarkdown()` on the clipboard.

## Nothing runs on its own

Typing, moving the dial and rewriting the brief are all free. Only **run** spends
a request.

A plan is stamped with the notes it was made for. Applied to a different document
it would be a map with no entry for most of what you just pasted, so `build` sets
it aside entirely rather than silently dropping what it cannot place. Edit a word
and the plan still fits but is marked behind: the button reads *run again*.

What comes out of storage is revived rather than trusted. A plan from before a
pattern was a list of parts is dropped rather than reinterpreted into an order
nobody chose — the notes stay, because losing the writer's text is the one thing
this cannot do.

## Reach

- **as written** — your text, your order. Nothing is touched, and no key is needed.
- **tidy** — shortens sentences that run long. Keeps your order.
- **reorder** — puts your sections in the order this kind of piece puts them.
- **and ask** — and names the parts your notes do not cover. It never fills one.

The same plan renders four ways. The lower settings do not ask for less; they
refuse to use parts of what came back.

## The gate

A shortening may **only delete**. Every word in it has to be a word your sentence
already contains, so a clause that reads well and was never yours cannot survive,
and neither can a number or unit your notes do not have.

That rule exists because the evaluation found the old one leaking: a gate that
only checked for invented *facts* let `"If you enqueue jobs, drop the priority
argument."` become `"If you enqueue jobs, drop the and it cost us the quarter"`.

**Formatting is not rewriting.** Comparison happens on plain text, so Otis may
bold a figure, make a list or add a heading and the words stay marked as yours.

## The evaluation

```sh
bun run evaluate                              # offline, free, no network
ANTHROPIC_API_KEY=… bun run evaluate --live   # about a hundred requests
```

`fixtures/labelled/` is fifteen documents written for this: twelve complete ones
across four kinds in two languages, three that sit between kinds, every section
labelled with the part it belongs to. Forty-two sections also carry a `thin`
twin — the same section, in the same part, saying nothing. Sixteen of the twins
are *longer* than the real version, so "it is short" cannot win for free.

Offline it measures that the same answer is the same article, that nothing the
model adds reaches the article, that a malformed answer is caught, and what the
hollow-section check catches and costs. Live it measures pick precision,
placement agreement against the labels, whether a complete document is left
alone, and gap recall.

Floors are set below measured values so they catch a regression rather than a
bad day, and the misses are printed rather than summarised. A `candidate
detectors` table records the bake-off that chose the hollow check, so the choice
stays checkable.

## Patterns

`patterns/*.ts` — four kinds of piece as typed data, versioned with the code and
editable. When one gives bad results you change a list of parts rather than
guess at a prompt.

## Layout

```
src/
  core/          pure TypeScript — no DOM, no fetch, no storage
    pattern.ts       Part, Pattern, Placement, check, arrange, gaps
    types.ts         Segment, Run, Shape, Plan, Reach, Doc, reviveDoc
    segments.ts      your own sections, located without cutting the text up
    plan.ts          a plan, a reach and a pattern become runs; the only place an article is made
    markdown.ts      just enough: bold, italic, code, headings, list items
    reword.ts        the faithfulness gate, and what counts as formatting
    diff.ts          word diff, sequence and bag retention
    ports.ts         Planner (pick / place) and DocStore
  adapters/
    llm/             Claude from the browser, and the two questions
    patterns/        the shelf
    store/           IndexedDB
  ui/            Solid: Notes, Threads, Article, Shapes, Capsule, About
  pages/         Astro shell
patterns/        the kinds of piece themselves
fixtures/        a pile of notes to run changes against, and the labelled corpus
scripts/         the layout check and the evaluation
```

## Commands

```sh
bun install
bun run dev            # http://localhost:4321/otis/
bun test               # the core, no browser needed
bun run lint           # biome
bun run check:layout   # the panes, in a real browser, at five window sizes
bun run evaluate       # the offline measures
bun run build
```

`check:layout` exists because a pane whose chrome has slid off the bottom looks
fine in a screenshot of the top of the page — which is how a button once shipped
unreachable. It asserts what a screenshot cannot: no pane taller than the
window, overflow scrolling inside the pane, the capsule reachable, a pasted
document keeping every line break, every section arriving in the article, the
notes still one text node, hovering lighting exactly one run and one thread, the
cards describing their kind and saying nothing about your document, the spine
naming the parts, and a missing part and a hollow one told apart — without the
strip pushing a pane off the window. Set `OTIS_CHROMIUM` to skip
`playwright install` if you already have a chromium.

Your key and your notes stay in the browser: the key in `localStorage`, the
document in IndexedDB. Nothing is sent anywhere but the model endpoint you
configured.

Deploys to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).
Nothing runs on a pull request, so a branch is only as verified as whoever ran
the commands on it.

## Next

- **The rest of the shelf.** Four kinds is thin, and it is the likeliest reason
  the picker returns two cards rather than three: it is told to give three and
  told not to pad, and with four kinds the second instruction wins.
- **`wants` beyond four parts.** Thirty of the forty-two hollow twins sit in
  parts that declare nothing and are not looked at.
- **Numbers guard** — every figure in the output checked against the notes, and
  an unmatched one flagged rather than styled.
- **The file as the source of truth** — File System Access API, one `.otis.md`
  per article, IndexedDB demoted to a cache.
