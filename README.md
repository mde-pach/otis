# Otis

A tool for turning a pile of notes into a technical article.

**The rule the whole thing is built around: the tool never writes your prose.**
It reorders, marks, measures and asks. Every sentence in the article traces back
to a paragraph you wrote, and the only words the tool contributes are the
headings — which are marked as its own, and which you can rewrite or delete.

## What it looks like

Three panes and a hover.

**Notes**, on the left, is one editable document. It is the source of truth: you
type, paste, and edit there, and nothing is filed away into cards. Paragraphs the
article left out are dimmed and tagged `not used`; a paragraph that repeats
another is tagged with the one it repeats.

**Article**, on the right, is the same text, reordered into a shape, as flowing
prose. Your words carry no mark, because they are the norm. Only what changed is
marked: altered words inside a rephrasing, and any heading the tool wrote.
Hovering a paragraph shows the word-level diff against what you actually wrote —
struck for dropped, boxed for added — and lights the source paragraph on the
left. Everything in the pane is editable, and editing makes it yours.

**Shape**, the thin panel, is the only settings there are: which structure to use
(or `Let it decide`), where the words come from as three percentages, and the
model key.

## Why it is shaped like this

Two objects, doing different jobs:

| | Fragment | Block |
|---|---|---|
| lifetime | frozen, append-only | living, the draft |
| what it is | a paragraph as you wrote it | that paragraph fitted to a position |
| edits | never | freely |

Provenance only works if the thing you point back at cannot move, so fragments
never change. A block's state (`verbatim`, `edited`, `reword-accepted`,
`written-here`) is *derived* by comparing it to its fragment — never stored, so
an edit that gets undone leaves no residue.

Editing the notes reconciles rather than reimports: an unchanged paragraph keeps
its id, an edited one becomes a new fragment, and a deleted one the draft is
still using is kept so no block dangles.

The second line, which decides when the tool is allowed to speak:

- **Facts about your material** — counts, repeats, paragraphs left out — are
  measurements. They appear unasked and cost nothing.
- **Judgments about your writing** — which paragraph plays which role, what a
  section should be called, a rewording — are opinions. They need your key.

That is also the deterministic/probabilistic line. Without a key the tool still
runs: the article keeps the order you wrote in, and every mark on the left still
works.

## Shapes are roles, headings are per article

A shape is a list of *roles* with hints addressed to the model — `hook`,
`what happened`, `cause`, `what changed` — never headings. Two post-mortems have
the same roles; they almost never have the same headings. So the heading for each
section is written for this article, out of the words in that section, and marked
as the tool's until you touch it. "Introduction", "Background", "The problem" are
rejected by construction: they are labels from a template, not headings for this
piece.

## The gate

Any rewording is checked before it is ever shown:

- a reword that keeps almost none of the original's words is a rewrite, not a
  reword, and is dropped;
- a reword that introduces a number, a unit or a code identifier the original did
  not contain has invented a fact, and is dropped.

A failed suggestion is not rendered and then rejected. It never exists.

## Engines

Nothing is hard-wired to a model. The ports in `src/core/ports.ts` carry
everything impure — `Embedder`, `Grouper`, `Labeler`, `ProjectStore`, `Judge` —
so any of them can be swapped without touching the rules above.

Duplicate detection is lexical (containment plus trigram overlap) rather than
embedding-based, and reports a checkable reason. The fixture in `fixtures/` is
why: on 30 real paragraphs the embedding grouper scored two descriptions of the
same event at 0.019 and merged a symptom with its own fix at 0.686. Same port,
so swapping cost nothing above it. The measured numbers are in the comment at
the top of `src/core/duplicates.ts`.

Everything the model returns is checked before you see it. Ids are resolved: a
layout naming a paragraph that does not exist, or claiming one twice, loses that
id, and every paragraph the model never mentioned is reported as left out rather
than quietly dropped.

## Layout

```
src/
  core/          pure TypeScript — no DOM, no fetch, no storage. All the rules live here.
    types.ts         Fragment, Block, Skeleton, Project
    split.ts         document → fragments (code fences stay whole)
    project.ts       import, reconciliation, selectors, orphans
    draft.ts         slots, titles, ordering, markdown export
    diff.ts          word-level diff + retention
    duplicates.ts    lexical near-duplicate pairs, with a reason
    provenance.ts    derived block state
    reword.ts        the faithfulness gate
    review.ts        frozen review rounds
    skeletons.ts     the shapes, as roles and hints
    ports.ts         Embedder / Grouper / Labeler / ProjectStore / Judge
  adapters/      everything impure, each behind a port
    embedder/        transformers.js in a worker
    llm/             Claude client, structurer, titles, grouper, judge, reworder, key storage
    store/           IndexedDB
  ui/            Solid island: Notes, Article, Shape, Peek
  pages/         Astro shell
fixtures/        a fixed pile of notes to run changes against
```

## Commands

```sh
bun install
bun run dev       # http://localhost:4321/otis/
bun test          # core domain, no browser needed
bun run lint      # biome
bun run format    # biome, writing fixes
bun run build
```

Your key and your notes stay in the browser: the key in `localStorage`, the
project in IndexedDB. Nothing is sent anywhere but the model endpoint you
configured.

Deploys to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).
Enable Pages → Source → GitHub Actions once, in the repo settings.

## Next

- **Rewording in the pane** — the gate and the diff exist; the gesture that asks
  for one does not.
- **Review rounds on screen** — `src/core/review.ts` freezes rounds of measured
  and judged items; nothing surfaces them yet.
- **File as source of truth** — File System Access API, one `.otis.json` per
  article, IndexedDB demoted to a cache.
