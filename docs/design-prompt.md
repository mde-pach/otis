# Base prompt for a design session

*Paste this as the opening message of a fresh Claude design session.*

---

I need the interface designed for a tool called **Otis**. It is a personal tool —
one user, me. There is nothing to sell, no landing page, no onboarding flow, no
pricing, no marketing copy, no brand story. Do not produce any of those, and do
not write in a product-launch register. Everything you design is a working
surface that one writer uses alone, repeatedly, for weeks at a time.

## What the tool does

I write technical articles. My process starts as a text file of disconnected
notes — half-thoughts, sentences that belong together but I don't know how yet,
a number I looked up, a code snippet. Between that file and a published article
there is currently a month of rearranging.

Otis takes that text file and helps me find the article inside it. **It never
writes prose.** It groups my fragments, measures them, labels them, asks
questions about them, and shows me what is missing. Every word in the finished
article is mine.

## The objects

- **Fragment** — one piece of my writing, split from the pasted document at
  blank lines. Frozen: it is never edited, never deleted, never reordered. Each
  has a short id (`#12`).
- **Group** — fragments the tool thinks belong together. A proposal until I
  rename or edit it, at which point it is mine and the tool stops touching it.
- **Skeleton** — an article structure I choose (problem→solution, SCQA,
  post-mortem…), made of named **slots**.
- **Block** — a fragment placed in the draft. It points back at its fragment
  forever, and carries a state: *verbatim*, *edited by me*, *reworded by the
  tool and accepted by me*, or *typed straight into the draft*.
- **Review round** — a dated, frozen list of questions about the draft that I
  resolve or waive one at a time.

## The four surfaces to design

1. **Pile** — every fragment, grouped. Ambient facts: how many fragments, how
   many unused, which pairs repeat each other's words.
2. **Plan** — the skeleton's slots, with groups dragged into them. Empty slots
   are visible holes. The tool audits; it never fills.
3. **Draft** — the article. Every sentence carries its provenance state, and the
   original is one interaction away. Unused fragments stay visible.
4. **Review** — the open-items queue. The article is finishable when it is empty.

## Non-negotiable rules the design must express

- **Nothing the tool produces may look like my writing.** My prose is set in a
  reading serif; everything the tool says — labels, counts, questions, flags —
  is in mono or the UI sans. If it is in the reading face, I wrote it.
- **Facts and judgments are separated.** Counts, repeated wording, orphans and
  empty slots are measurements and may appear unasked. Gaps, missing steps and
  rewordings are opinions and appear only when I ask for a review.
- **A suggestion is never applied silently.** A reword sits beside the original
  until I accept it, and can always be reverted.
- **Nothing I wrote can disappear.** "Unused" is a visible state, not a deletion.

## How it should feel

- **The fewest interactions possible.** Paste a document and the fragments,
  groups and facts should already be there — no wizard, no "next" button, no
  configuration before first use. Count the clicks in every flow you design and
  tell me the number.
- **Minimal, not bloated.** No sidebars full of icons, no settings panels, no
  modals, no toolbars of things I use twice a year. If a control is used rarely,
  it does not get permanent space on screen. Prefer direct manipulation
  (dragging a fragment) over menus about fragments.
- **Keyboard first.** Every frequent action has a key. Moving a fragment between
  groups, accepting a reword, resolving a review item, jumping to a fragment's
  origin — none of those should require aiming at a small target.
- **Quiet.** No badges, toasts, celebration states, progress gamification, or
  colour used for decoration. Colour carries meaning only: provenance state,
  something missing, something the tool is unsure about.
- **Honest about work in progress.** Model loading, embedding, and failures are
  states to design, not afterthoughts. A failure says what still works.

## What to produce

Screens for all four surfaces, at desktop width and again at ~400px, plus these
states: an empty Pile before anything is pasted; the Pile mid-embedding; a Pile
where the grouping is obviously wrong and I want to overrule it; a Draft with
all four provenance states visible at once; a Review round with two open items
and four resolved.

For each screen, tell me the interaction cost of its main job in clicks and
keystrokes, and name anything you removed to keep it uncluttered.

Both light and dark. Real content only — use the caching post-mortem fragments I
will paste, never lorem ipsum or invented sample text.
