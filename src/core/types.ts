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

export interface Project {
	readonly id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	fragments: Fragment[];
	groups: Group[];
	blocks: Block[];
	skeletonId: string | null;
	/** Embedder identity the vectors were produced with; vectors are invalid across engines. */
	embedderId: string | null;
}

export interface DuplicatePair {
	readonly a: string;
	readonly b: string;
	readonly score: number;
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
		skeletonId: null,
		embedderId: null,
	};
}
