import type { Placement } from "./pattern";

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

export type RunKind = "kept" | "reworded";

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
	fromIndex: number;
	/**
	 * The part of the chosen kind this section is serving, once there is one.
	 *
	 * Shown in the gutter rather than in the article. The tool cannot reliably
	 * tell that a part is missing — measured at about three quarters — but it
	 * always knows what is filling it, and a writer who can see their cost
	 * paragraph sitting in the `observed` slot needs no help from a model.
	 */
	part?: string;
}

/**
 * One kind of piece on offer, and the article it would make.
 *
 * A card is a pattern: one kind, one arrangement, one card. The model chose the
 * kind; it did not choose the order, which belongs to the pattern file, and it
 * did not choose the placement's shape, which is checked before it is used.
 */
export interface Shape {
	patternId: string;
	/** one sentence on why this kind, for these notes */
	because: string;
	/**
	 * Where each of the writer's sections goes in it, or null throughout while
	 * this card has not been organised yet. Only the card they are reading is
	 * organised; the other two cost nothing until they are chosen.
	 */
	placement: Placement | null;
}

/**
 * What came back, expressed only over the writer's own segment indices.
 *
 * There is no field here the model can put prose in. What it is missing is not
 * in this object at all — that is computed from the pattern at render time.
 */
export interface Plan {
	/**
	 * The notes this plan was made for. A plan is a map over segment indices, so
	 * applying it to a different document silently drops whatever it has no
	 * entry for — build() checks this rather than trusting the indices.
	 */
	basis: string;
	/** the kinds on offer; the article opens in the first */
	shapes: Shape[];
	/** same words, Markdown added. Formatting is not rewriting. */
	format: Record<number, string>;
	/** fewer words, same claims. Passes the faithfulness gate or it is dropped. */
	short: Record<number, string>;
}

export const REACH = [
	{ id: 0, name: "as written", does: "nothing is touched" },
	{ id: 1, name: "tidy", does: "shortens, keeps your order" },
	{ id: 2, name: "reorder", does: "puts your sections in the shape's order" },
	{ id: 3, name: "and ask", does: "names the parts your notes do not cover" },
] as const;

export type Reach = 0 | 1 | 2 | 3;

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

/**
 * What came out of storage, made safe to render.
 *
 * The stored document is a record of a model that has changed shape more than
 * once, and a document saved by an older version must never be able to take the
 * app down — that costs the writer their text, which is the one thing this tool
 * promises to keep. So a plan from before arrangements existed is carried
 * forward into one, and anything that cannot be read at all is dropped while
 * the notes stay.
 */
function revivePlan(raw: unknown): Plan | null {
	if (!raw || typeof raw !== "object") return null;
	const said = raw as Record<string, unknown>;
	if (typeof said.basis !== "string") return null;

	const offered = Array.isArray(said.shapes) ? said.shapes : [];
	const shapes: Shape[] = offered
		.filter((one): one is Record<string, unknown> => Boolean(one) && typeof one === "object")
		.filter((one) => typeof one.patternId === "string")
		.map((one) => ({
			patternId: one.patternId as string,
			because: typeof one.because === "string" ? one.because : "",
			// a placement it cannot read is a placement it does not have, and an
			// un-organised card is a state the app already knows how to be in
			placement: Array.isArray(one.placement)
				? (one.placement as unknown[]).map((id) => (typeof id === "string" ? id : null))
				: null,
		}));

	// a plan from before a pattern was a list of parts. Its positions mean
	// nothing here, and inventing a reading of them would put the writer's
	// sections in an order nobody chose — so the notes stay and the plan goes.
	if (shapes.length === 0) return null;

	const map = (value: unknown): Record<number, string> =>
		value && typeof value === "object" ? (value as Record<number, string>) : {};

	return { basis: said.basis, shapes, format: map(said.format), short: map(said.short) };
}

export function reviveDoc(id: string, saved: unknown): Doc {
	const base = emptyDoc(id);
	if (!saved || typeof saved !== "object") return base;
	const said = saved as Record<string, unknown>;
	const reach = [0, 1, 2, 3].includes(said.reach as number) ? (said.reach as Reach) : 0;

	return {
		...base,
		notes: typeof said.notes === "string" ? said.notes : "",
		brief: typeof said.brief === "string" ? said.brief : "",
		reach,
		patternId: typeof said.patternId === "string" ? said.patternId : base.patternId,
		plan: revivePlan(said.plan),
		shape: Number.isInteger(said.shape) ? Math.max(0, said.shape as number) : 0,
		edits:
			said.edits && typeof said.edits === "object" ? (said.edits as Record<string, string>) : {},
		updatedAt: typeof said.updatedAt === "number" ? said.updatedAt : Date.now(),
	};
}
