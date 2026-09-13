/**
 * The reference notes, bundled.
 *
 * These are the whole of the context Otis reads about a kind of writing: a few
 * dozen words each, versioned with the code, editable by the writer. When one
 * gives bad results you change a file rather than guess at a hidden prompt.
 */

import essay from "../../../patterns/essay.md?raw";
import howItWorks from "../../../patterns/how-it-works.md?raw";
import internalNote from "../../../patterns/internal-note.md?raw";
import postMortem from "../../../patterns/post-mortem.md?raw";

export interface Pattern {
	id: string;
	name: string;
	file: string;
	text: string;
	/** words that suggest this note, when the writer has not said which */
	cues: string[];
}

export const PATTERNS: Pattern[] = [
	{
		id: "post-mortem",
		name: "post-mortem",
		file: "patterns/post-mortem.md",
		text: postMortem,
		cues: ["post-mortem", "postmortem", "incident", "outage", "went wrong", "retro"],
	},
	{
		id: "internal-note",
		name: "internal note",
		file: "patterns/internal-note.md",
		text: internalNote,
		cues: ["note", "my team", "internal", "status", "update", "standup"],
	},
	{
		id: "how-it-works",
		name: "explanation",
		file: "patterns/how-it-works.md",
		text: howItWorks,
		cues: ["how it works", "explain", "tutorial", "guide", "walkthrough", "deep dive"],
	},
	{
		id: "essay",
		name: "essay",
		file: "patterns/essay.md",
		text: essay,
		cues: [],
	},
];

export function patternById(id: string): Pattern {
	return PATTERNS.find((p) => p.id === id) ?? (PATTERNS.at(-1) as Pattern);
}

/**
 * Picked from the brief by word, not by a model: it is a lookup the writer can
 * check, and they can override it.
 */
export function patternFor(brief: string): Pattern {
	const said = brief.toLowerCase();
	for (const pattern of PATTERNS) {
		if (pattern.cues.some((cue) => said.includes(cue))) return pattern;
	}
	return PATTERNS.at(-1) as Pattern;
}
