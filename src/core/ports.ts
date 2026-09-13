/**
 * The two things that are not pure.
 *
 * Everything above these is arithmetic over the writer's own text and runs with
 * no key, no network and no storage. The planner is split in two on purpose:
 * choosing a kind of piece and placing sections into its parts are different
 * questions, each with its own check, and neither of them is "write an
 * article".
 */

import type { Pattern, Placement } from "./pattern";
import type { Doc, Segment } from "./types";

/** One kind the model thinks these notes are, and why. */
export interface Pick {
	patternId: string;
	because: string;
}

export interface PickRequest {
	notes: string;
	segments: Segment[];
	/** what the writer said they are making, in their own words */
	brief: string;
	/** one line per kind on the shelf: the whole of what the picker is told */
	shelf: string;
}

export interface PlaceRequest {
	segments: Segment[];
	brief: string;
	/** the kind being organised into; only its parts are sent */
	pattern: Pattern;
}

/**
 * The answer to the one closed question the model is asked, plus wording it
 * offered for sections it did not move. Every field is checked by the caller.
 */
export interface Placed {
	placement: Placement;
	/** same words, Markdown added */
	format: Record<number, string>;
	/** fewer words, same claims */
	short: Record<number, string>;
	/** what the check said about the answer, after the re-ask */
	violations: string[];
}

export interface Planner {
	pick(request: PickRequest): Promise<Pick[]>;
	place(request: PlaceRequest): Promise<Placed>;
}

export interface DocStore {
	load(id: string): Promise<Doc | null>;
	save(doc: Doc): Promise<void>;
}
