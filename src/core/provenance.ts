/**
 * Provenance is derived, never stored.
 *
 * If the text still equals its fragment it is verbatim, whatever happened in
 * between — an edit that is undone leaves no residue, which is the honest answer.
 */

import type { Block, BlockState, Fragment } from "./types";

export function deriveState(block: Block, fragment: Fragment): BlockState {
	if (block.text === fragment.text) {
		return fragment.origin === "written-in-draft" ? "written-here" : "verbatim";
	}
	if (block.acceptedRewordText !== undefined && block.text === block.acceptedRewordText) {
		return "reword-accepted";
	}
	return "edited";
}

export interface ProvenanceSummary {
	blocks: number;
	verbatim: number;
	edited: number;
	rewordAccepted: number;
	writtenHere: number;
	/** Share of blocks whose words are the writer's, untouched by any model. */
	untouchedByModel: number;
}

export function summarise(blocks: Block[], fragments: Map<string, Fragment>): ProvenanceSummary {
	const counts = { verbatim: 0, edited: 0, rewordAccepted: 0, writtenHere: 0 };
	for (const block of blocks) {
		const fragment = fragments.get(block.fragmentId);
		if (!fragment) continue;
		const state = deriveState(block, fragment);
		if (state === "verbatim") counts.verbatim++;
		else if (state === "edited") counts.edited++;
		else if (state === "reword-accepted") counts.rewordAccepted++;
		else counts.writtenHere++;
	}
	const total = blocks.length || 1;
	return {
		blocks: blocks.length,
		...counts,
		untouchedByModel: (counts.verbatim + counts.edited + counts.writtenHere) / total,
	};
}
