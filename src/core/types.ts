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
 * One arrangement of the writer's sections: a whole article, in an order.
 *
 * A run comes back with several of these rather than one, because "which shape
 * should this take" is the writer's question and a model guessing at it once is
 * worse than offering the two or three it can actually make. They cost one
 * request between them, and switching costs nothing.
 */
export interface Shape {
	/** three or four words for what this arrangement is */
	name: string;
	/** where each segment goes in it, or null for left out */
	at: (number | null)[];
	/** one sentence, plain words, on why this order */
	because: string;
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
	/** the arrangements on offer; the first is the one the article opens in */
	shapes: Shape[];
	/** same words, Markdown added. Formatting is not rewriting. */
	format: Record<number, string>;
	/** fewer words, same claims. Passes the faithfulness gate or it is dropped. */
	short: Record<number, string>;
	/** the model's own text, anchored after one of your segments */
	written: Written[];
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

export interface Doc {
	id: string;
	notes: string;
	brief: string;
	reach: Reach;
	patternId: string;
	plan: Plan | null;
	/** which of the plan's arrangements the article is in */
	shape: number;
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
		shape: 0,
		edits: {},
		updatedAt: Date.now(),
	};
}
