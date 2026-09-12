# Otis

A tool for turning a pile of notes into a technical article.

**The rule the whole thing is built around: the assistant never writes your prose.**
It groups, measures, labels, diffs and asks questions. Every word that ends up in
the article traces back to a fragment you wrote, and the tool's contribution is
metadata — marks, counts, questions — never text.

Status: **all four surfaces work end to end.** Paste a document, group it, pick a
skeleton, place fragments into slots, edit or reword them, run review rounds,
export the article and its provenance sidecar.

## Why it is shaped like this

Two objects, doing different jobs:

| | Fragment | Block |
|---|---|---|
| lifetime | frozen, append-only | living, the draft |
| what it is | a thought as it was written | that thought fitted to a position |
| edits | never | freely |

Provenance only works if the thing you point back at cannot move, so fragments
never change. A block's state (`verbatim`, `edited`, `reword-accepted`,
`written-here`) is *derived* by comparing it to its fragment — never stored by
hand, so an edit that gets undone leaves no residue.

The second line, which decides when the tool is allowed to speak:

- **Facts about your material** — counts, repeated wording, orphans, empty
  slots — are measurements. They appear unasked and need no model at all.
- **Judgments about your writing** — gaps, missing steps, unsupported claims,
  rewording — are opinions. They wait for you to ask for a review round, and
  they need a key.

## The four surfaces

- **Pile** — every fragment, grouped, with the repeated pairs called out.
- **Plan** — a skeleton you choose, its slots, and what is still unplaced. An
  empty slot is a visible hole; the tool audits and never fills.
- **Draft** — blocks in slot order, each showing where it came from and what
  state it is in. Rewordings sit beside your sentence until you accept one.
- **Review** — frozen rounds of items you resolve or waive with a reason. The
  article is finishable when nothing is left open.

## What the model may and may not do

Everything the model returns is checked before you see it:

- **Ids are resolved.** A grouping that names a fragment that does not exist, or
  claims one twice, loses that id. A review item pointing at a missing block is
  dropped.
- **Items must be questions.** Anything from the judge that is not a question is
  discarded, because a sentence you could paste into the draft is the one thing
  this tool must never hand you.
- **Rewordings pass a gate first.** A suggestion that introduces a number, a unit
  or a code identifier your sentence does not contain — or that keeps too few of
  your words to be a rewording — never becomes a suggestion at all. You are told
  it was discarded, and why.

## Engines

Nothing is hard-wired to a model. The ports in `src/core/ports.ts` carry
everything impure:

- `Grouper` — the LLM grouper when a key is set, the embedding grouper when not.
  The fixture is why: on 30 real fragments the embedding grouper scored two
  descriptions of the same event at 0.019 and merged a symptom with its own fix
  at 0.686. Same port, so swapping cost nothing above it.
- `Embedder` — transformers.js in a worker (WebGPU, wasm fallback).
- `Labeler` — class-based TF-IDF over each cluster's own words.
- `ProjectStore` — IndexedDB.

## Layout

```
src/
  core/          pure TypeScript — no DOM, no fetch, no storage. All the rules live here.
    types.ts         Fragment, Block, Group, Reword, ReviewRound, Project
    split.ts         document → fragments (code fences stay whole)
    similarity.ts    cosine, centring, pairwise matrix, distribution
    cluster.ts       dendrogram + cut strategies
    duplicates.ts    containment and trigram overlap, with a stated reason
    label.ts         c-TF-IDF cluster labels
    diff.ts          word diff, sequence and bag retention
    provenance.ts    derived block state
    draft.ts         placing, editing, ordering, markdown and provenance export
    reword.ts        the faithfulness gate
    review.ts        measured items and frozen rounds
    skeletons.ts     the article structures you can pick from
    ports.ts         Embedder / Grouper / Labeler / ProjectStore / Judge
  adapters/      everything impure, each behind a port
    embedder/        transformers.js in a worker
    llm/             Claude client, grouper, judge, reworder, key storage
    store/           IndexedDB
  ui/            Solid island: state + the four surfaces
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

First run: `bun install` writes `bun.lock` — commit it, then switch the workflow
step to `bun install --frozen-lockfile`.

Deploys to GitHub Pages on push to `main` (`.github/workflows/deploy.yml`).

## Next

- **The file as the source of truth** — File System Access API, one `.otis.json`
  per article, with IndexedDB demoted to a cache.
- **More than one article** at a time.
- **Keyboard paths** for placing, accepting and resolving.
