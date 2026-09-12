/**
 * The whole domain, in one file.
 *
 * Two objects matter and they are not the same thing:
 *   Fragment — frozen. A record of a thought, exactly as it was written.
 *   Block    — living. That thought fitted to a position in the article.
 *
 * A Block points at a Fragment and never reassigns it. Provenance is derived
 * from comparing the two, never stored by hand — see provenance.ts.
 */

export type FragmentOrigin = "imported" | "written-in-draft";

export interface Fragment {
	readonly id: string;
	readonly text: string;
	readonly origin: FragmentOrigin;
	readonly createdAt: number;
}

/** A group of fragments. `auto` flips to false the moment the writer touches it. */
export interface Group {
	readonly id: string;
	label: string;
	fragmentIds: string[];
	auto: boolean;
}

export interface Block {
	readonly id: string;
	/** The anchor. Never reassigned. */
	readonly fragmentId: string;
	text: string;
	slot: string | null;
	/** Position within its slot. */
	order: number;
	/**
	 * Set when a tool-proposed reword was accepted, to the exact accepted text.
	 * If the writer then edits the block, text diverges and the state falls back
	 * to "edited" on its own.
	 */
	acceptedRewordText?: string;
}

export type BlockState = "verbatim" | "edited" | "reword-accepted" | "written-here";

export interface Skeleton {
	readonly id: string;
	readonly name: string;
	readonly slots: readonly { id: string; name: string; hint: string }[];
}

/** A proposed rewording. It is not in the draft and never will be unless accepted. */
export interface Reword {
	readonly id: string;
	readonly blockId: string;
	/** The block's text at the moment the suggestion was made. */
	readonly original: string;
	readonly proposed: string;
	readonly createdAt: number;
	status: "pending" | "accepted" | "rejected";
	/** Why it is safe to show, in numbers. */
	readonly check: FaithfulnessCheck;
}

export interface FaithfulnessCheck {
	/** Share of the original's words kept. */
	retention: number;
	/** Numbers, units and code identifiers present in the reword but not the original. */
	addedFacts: string[];
	passed: boolean;
	reason: string;
}

export type ReviewItemKind =
	| "orphan"
	| "empty-slot"
	| "duplicate"
	| "ungrouped"
	| "missing-evidence"
	| "missing-step"
	| "unsupported-claim"
	| "digression";

export interface ReviewItem {
	readonly id: string;
	readonly kind: ReviewItemKind;
	/** What the writer is being asked. Never a sentence to paste into the draft. */
	readonly question: string;
	readonly blockId?: string;
	readonly fragmentIds?: string[];
	readonly slotId?: string;
	/** "measured" items come from arithmetic; "judged" ones came from a model. */
	readonly source: "measured" | "judged";
	status: "open" | "resolved" | "waived";
	note?: string;
}

/** Frozen once created. Progress is only legible if the list stops moving. */
export interface ReviewRound {
	readonly id: string;
	readonly index: number;
	readonly createdAt: number;
	readonly items: ReviewItem[];
	/** How the round was produced, shown verbatim. */
	readonly rationale: string;
}

export interface Project {
	readonly id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	fragments: Fragment[];
	groups: Group[];
	blocks: Block[];
	rewords: Reword[];
	rounds: ReviewRound[];
	skeletonId: string | null;
	/** Embedder identity the vectors were produced with; vectors are invalid across engines. */
	embedderId: string | null;
}

export interface ProjectStats {
	fragments: number;
	grouped: number;
	placed: number;
	unused: number;
}

export function emptyProject(id: string, title: string, now = Date.now()): Project {
	return {
		id,
		title,
		createdAt: now,
		updatedAt: now,
		fragments: [],
		groups: [],
		blocks: [],
		rewords: [],
		rounds: [],
		skeletonId: null,
		embedderId: null,
	};
}
