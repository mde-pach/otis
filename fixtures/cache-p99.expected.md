# Control sheet — `cache-p99.notes.md`

30 fragments, `f01`–`f30`, numbered in document order (f07 is the code fence).
Paste the notes file unchanged so the numbering below always refers to the same text.

This is not a test the tool passes or fails as a whole. It is a set of probes,
each one designed so that a *vocabulary* grouper and an *argument* grouper give
different answers. That is the open question: does cosine similarity over
embeddings group by what the fragments are about, or merely by the words they
happen to share?

## What we expect a good grouping to look like

| Group | Fragments | What holds them together |
|---|---|---|
| Symptom / evidence | f02, f05, f17, f18, f24 | what was observed, and the measurements |
| Mechanism | f06, f08, f09, f25, f27 | why a cache made things slower |
| Fix | f07, f10, f11, f20, f21, f29 | single-flight, jitter, and what they cost |
| Process / TTL | f12, f13, f23, f28 | decisions made badly, not code |
| Framing / aphorism | f01, f03, f04, f14, f16, f19, f22, f26, f30 | the lines that carry the argument |
| Probably ungrouped | f15 | tonal outlier, belongs nowhere |

Five or six groups, not nine, and not two.

## Probes

Each probe is a prediction that separates the two hypotheses. Record what actually happened.

| # | Probe | Vocabulary grouper says | Argument grouper says | Result |
|---|---|---|---|---|
| **V1** | f08 and f09 — the same phenomenon, described once mechanically and once by its names | apart (no shared words) | together | |
| **V2** | f10 and f11 — "single-flight" and "request coalescing" are the same fix | apart | together | |
| **V3** | f02 and f29 — both are p99 numbers, but one is the symptom and one is the result | together | apart | |
| **V4** | f01 and f22 — both are dense with "cache", but one is a hook and one is a definition | together | apart | |
| **V5** | f17 and f27 — origin load and connection setup, the same causal chain in different vocabulary | apart | together | |
| **D1** | f03 and f30 — near-identical claim, one extended | flagged ≥ 0.90 | flagged | |
| **D2** | f03 and f04 — same claim, fully reworded | probably 0.80–0.88, below the threshold | flagged | |
| **D3** | f02 and f18 — both are numbers from the same incident but different facts | must **not** be flagged as duplicates | must not | |
| **O1** | f28 — the superlinear-rollout insight, the one worth keeping | — | should still be unused when you think you are finished | |
| **O2** | f15 — the tonal outlier | forced into a group | left ungrouped | |

**V1, V2 and V5 are the ones that matter.** If they come out "apart", the
deterministic grouper is doing vocabulary matching and an LLM grouper is
justified sooner than planned. If they come out "together", embeddings are
carrying more meaning than expected and the LLM can wait.

**V3 and V4 are the reverse test.** An LLM grouper that gets V1/V2/V5 right but
also merges V3/V4 has not understood the argument either — it has just found a
bigger vocabulary.

## Threshold calibration

The grouper runs at 0.55 average linkage and flags duplicates at 0.90. Record
where these actually land, because the right values are an empirical question:

- Similarity of f03 ↔ f30: ______   (expect high)
- Similarity of f03 ↔ f04: ______   (expect borderline — this pair sets the duplicate threshold)
- Similarity of f02 ↔ f18: ______   (expect middling; if it is above 0.90 the threshold is too low)
- Number of groups produced: ______ (expect 5–6; more than 8 means the threshold is too high)
- Fragments left ungrouped: ______  (expect 1–4)

## What this fixture cannot tell us yet

The Review surface does not exist, so the judgments have no implementation to
test. Recorded here so the expectations are fixed before anything is built:

- **f14 and f15 contradict each other in tone** — one owns the decision, one
  disowns it. A review round should ask which one is the piece's actual stance.
- **f02 claims the p99 doubled; f29 claims it recovered.** Both are evidence,
  and a draft that uses one without the other is incomplete.
- **f12 is a digression** — the TTL meeting anecdote is good writing and not
  load-bearing. The right suggestion is "footnote or aside", never "delete".
- **f23 is a different article.** A review round should notice it does not serve
  this piece's argument.
- **A "cost / caveat" slot has exactly one candidate: f21.** If the draft omits
  it, the slot audit should say so.
