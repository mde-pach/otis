# Otis

A tool for turning a pile of notes into a technical article.

**The rule the whole thing is built around: the assistant never writes your prose.**
It groups, measures, labels, diffs and asks questions. Every word that ends up in
the article traces back to a fragment you wrote, and the tool's contribution is
metadata — marks, counts, questions — never text.

Status: **walking skeleton.** The Pile surface works end to end; Plan, Draft and
Review are designed but not built.

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

- **Facts about your material** — counts, similarity scores, orphans, empty
  slots — are measurements. They can appear unasked.
- **Judgments about your writing** — gaps, claim/evidence, mode confusion,
  rewording — are opinions. They wait for you to ask for a review round.

That is also the deterministic/probabilistic line. Everything on the first side
is arithmetic and ships without a model at all.

## Engines

Nothing is hard-wired to a model. The ports in `src/core/ports.ts` carry
everything impure:

- `Embedder` — today transformers.js in a worker (WebGPU, wasm fallback).
- `Grouper` — today embeddings + agglomerative clustering. An `LlmGrouper`
  implementing the same interface can replace it without touching anything above.
- `Labeler` — today class-based TF-IDF over each cluster's own words.
- `Judge` — declared, not implemented. This is the one that needs a frontier
  model and your API key, and it only runs during a review round.

Deterministic first, on purpose: "these two fragments are 0.94 similar" is a
number you can check, and re-running produces the same answer. If the clustering
turns out to group by vocabulary where it should group by argument, the port is
already there to swap it.

## Layout

```
src/
  core/          pure TypeScript — no DOM, no fetch, no storage. All the rules live here.
    types.ts         Fragment, Block, Group, Project
    split.ts         document → fragments (code fences stay whole)
    similarity.ts    cosine, normalisation, pairwise matrix
    cluster.ts       agglomerative clustering + near-duplicate pairs
    label.ts         c-TF-IDF cluster labels
    diff.ts          word-level diff + retention ratio
    provenance.ts    derived block state
    project.ts       import, selectors, counts, orphans
    skeletons.ts     the article structures you can pick from
    ports.ts         Embedder / Grouper / Labeler / ProjectStore / Judge
  adapters/      everything impure, each behind a port
  ui/            Solid island: state + surfaces
  pages/         Astro shell
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
Enable Pages → Source → GitHub Actions once, in the repository settings.

## Next

- **Plan** — pick a skeleton, drag groups into slots, flag the empty ones.
- **Draft** — promote fragments into blocks, render provenance marks, keep a
  rail of unused fragments visible.
- **Review** — frozen rounds of items you resolve or waive; publish when the
  queue is empty.
- **File as the source of truth** — File System Access API, one `.otis.json` per
  article, with IndexedDB demoted to a cache.
