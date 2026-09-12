# Run 1 — `cache-p99.notes.md`

Run against the deployed build on 12 Sept 2026. MiniLM-L6-v2, centred vectors,
tree cut at the largest gap in merge scores. 30 fragments in, 5 groups out.

## What came back

| Group | Label the tool chose | Fragments |
|---|---|---|
| 1 | cache · origin · load | f01 f02 f06 f10 f14 f17 f22 f24 f26 f29 |
| 2 | average · percent · nobody | f03 f04 f12 f13 f16 f20 f28 f30 |
| 3 | fine · cpu · dashboard | f05 f07 |
| 4 | request · every · hangs | f08 f11 f18 f21 f25 f27 |
| 5 | stampede · thing · add | f09 f15 f19 f23 |

Group 3 pairs "Redis was healthy, every dashboard green" with the code block.
Group 5 pairs the stampede line with the tonal outlier, the closing line and a
note about old incident reports. These are not themes; they are word bins.

## Probes

| # | Pair | Wanted | Cosine | Landed | Verdict |
|---|---|---|---|---|---|
| V1 | f08 ~ f09 — the same event, once mechanically, once by its names | together | **0.019** | apart | vocabulary |
| V2 | f10 ~ f11 — "single-flight" and "request coalescing" | together | 0.309 | apart | vocabulary |
| V3 | f02 ~ f29 — two p99 numbers, symptom vs outcome | apart | **0.686** | together | vocabulary |
| V4 | f01 ~ f22 — hook vs definition, both full of "cache" | apart | 0.443 | together | vocabulary |
| V5 | f17 ~ f27 — origin load and connection setup, one causal chain | together | 0.386 | apart | vocabulary |
| D1 | f03 ~ f30 — one contains the other | flagged | 0.643 | not flagged | miss |
| D2 | f03 ~ f04 — same claim, fully reworded | flagged | 0.509 | not flagged | miss |
| D3 | f02 ~ f18 — two different facts | not flagged | 0.336 | not flagged | pass |
| O2 | f15 — tonal outlier | ungrouped | — | grouped | miss |

**Five out of five on the vocabulary/argument axis, all in the same direction.**
The grouper matches words. It was designed to, and now that is measured rather
than assumed.

## The number that settles it

The most similar pair in the entire pile is **f01 ~ f14 at 0.728** — "the cache
was doing exactly what we asked it to do" and "I still think adding the cache
was the right call". Not duplicates, not even the same section.

The genuine duplicate, f03 ~ f30, scores **0.643**.

An unrelated pair outranks a pair where one fragment literally contains the
other. No threshold fixes a ranking that is wrong — which is why duplicate
detection moved to word overlap, where f03 ⊂ f30 is containment 1.00 and f01 ~
f14 is nothing at all.

## What was wrong in my diagnosis

I predicted the problem was anisotropy — all fragments sharing one dominant
direction, bunching the similarities into a narrow band. Centring was the fix
for that.

Measured: raw spread 0.185, centred spread 0.169, raw median 0.180. The
similarities were never bunched, and centring made no difference worth having.
The tree gets cut at 0.01 because there is no structure in it to find, not
because the cut is in the wrong place.

Centring stays — it is free and harmless — but it did not earn its comment, and
the comment has been corrected.

## What changes

1. **Duplicate detection is lexical now.** Containment and trigram overlap, with
   a sentence of reasoning attached to every pair. It needs no model, so it runs
   the moment text is pasted. D1 now passes; D3 still passes.
2. **D2 is conceded.** The same claim written twice in different words cannot be
   caught by word overlap, and the embeddings rank it below noise. It belongs to
   the Judge.
3. **Grouping needs the LLM.** This is the empirical answer to the question the
   fixture was built to ask. The `Grouper` port exists for exactly this, and an
   `LlmGrouper` is now the next thing worth building, not a later maybe.
4. **The embedding grouper is not deleted.** It stays as the no-key fallback and
   as the control to measure the LLM against. Same fixture, same probes.

## Fixed in passing

Nothing persisted: a Solid store is a Proxy and structuredClone refuses one, so
every IndexedDB write threw. Found by running the fixture against the deployed
page, not by reading the code.
