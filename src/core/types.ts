/**
 * Text in, text out.
 *
 * There are no fragments, blocks, slots or paragraphs here. Your notes are one
 * string; the article is one Markdown string; provenance is a set of ranges
 * over the two. A one-line note stays one run, and a heading in the output is
 * a run of text like any other — it carries no special status.
 */

/**
 * One section of the writer's notes, located by offset. Never a copy.
 *
 * A section is whatever they separated: a block between blank lines, a bullet,
 * a heading, a fenced block — or, in a document typed as one line, a sentence.
 * Nothing above this knows about paragraphs; layout is Markdown, in the text.
 */
export interface Segment {
	index: number;
	text: string;
	start: number;
	end: number;
}

export type RunKind = "kept" | "reworded" | "written";

/** Confidence is only meaningful for written runs: how far it reached. */
export type Confidence = "high" | "low";

/** A stretch of the article, and where it came from. */
export interface Run {
	id: number;
	/**
	 * Stable across reach settings and re-renders, unlike `id`, which is just a
	 * position. An edit is filed under this so it survives moving the dial.
	 */
	key: string;
	kind: RunKind;
	md: string;
	/** absent exactly when nothing of the writer's sits under this run */
	from?: { start: number; end: number };
	/** the segment it came from, so both panes can name the same thing */
	fromIndex?: number;
	confidence?: Confidence;
}

/**
 * What the model proposes, expressed only over the writer's own segment
 * indices. It cannot express "put a heading here" or "make a section": the only
 * text it may contribute arrives in `written`, and that is marked.
 */
export interface Plan {
	/**
	 * The notes this plan was made for. A plan is a map over segment indices, so
	 * applying it to a different document silently drops whatever it has no
	 * entry for — build() checks this rather than trusting the indices.
	 */
	basis: string;
	/** where each segment goes in the article, or null for left out */
	at: (number | null)[];
	/** same words, Markdown added. Formatting is not rewriting. */
	format: Record<number, string>;
	/** fewer words, same claims. Passes the faithfulness gate or it is dropped. */
	short: Record<number, string>;
	/** the model's own text, anchored after one of your segments */
	written: Written[];
	/** one sentence, in plain words, on what it did */
	because: string;
}

export const REACH = [
	{ id: 0, name: "as written", does: "nothing is touched" },
	{ id: 1, name: "tidy", does: "shortens, keeps your order" },
	{ id: 2, name: "reorder", does: "moves and drops, writes nothing" },
	{ id: 3, name: "rebuild", does: "and writes what is missing" },
] as const;

export type Reach = 0 | 1 | 2 | 3;

/** A gap the notes do not cover, drafted into place and always marked. */
export interface Written {
	after: number;
	md: string;
	confidence: Confidence;
	/** what was missing, said to the writer */
	because: string;
}

/**
 * What the writer has turned down in a proposal, before any of it is applied.
 * Keyed the way the review lists them: `m` for the order, `s<index>` for a
 * shortening, `d<index>` for a section it wants to leave out, `w<n>` for
 * something it wants to write.
 */
export type Refused = Record<string, true>;

export interface Doc {
	id: string;
	notes: string;
	brief: string;
	reach: Reach;
	patternId: string;
	plan: Plan | null;
	/**
	 * A proposal that has not been applied. Nothing in it touches the article
	 * until the writer says so — this is the step where they have their word.
	 */
	review: Plan | null;
	/** runs the writer has rewritten by hand, keyed by the stable run key */
	edits: Record<string, string>;
	updatedAt: number;
}

export function emptyDoc(id: string): Doc {
	return {
		id,
		notes: "",
		brief: "",
		reach: 0,
		patternId: "essay",
		plan: null,
		review: null,
		edits: {},
		updatedAt: Date.now(),
	};
}
