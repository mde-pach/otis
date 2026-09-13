/**
 * The shelf.
 *
 * A kind of piece is a typed file the writer can open, disagree with and edit —
 * not a prompt hidden somewhere in the request. Nothing here is sent to the
 * model whole: the picker sees one line per kind, the placer sees one line per
 * part, and the questions in `asks` are never sent at all.
 */

import { essay } from "../../../patterns/essay";
import { howItWorks } from "../../../patterns/how-it-works";
import { internalNote } from "../../../patterns/internal-note";
import { postMortem } from "../../../patterns/post-mortem";
import type { Lang, Pattern } from "../../core/pattern";
import { segment } from "../../core/segments";

export type { Pattern } from "../../core/pattern";

export const PATTERNS: Pattern[] = [postMortem, internalNote, howItWorks, essay];

export function patternById(id: string): Pattern {
	return PATTERNS.find((p) => p.id === id) ?? (PATTERNS.at(-1) as Pattern);
}

function score(text: string, words: string[]): number {
	const said = text.toLowerCase();
	return words.filter((word) => said.includes(word)).length;
}

/**
 * Picked by word, not by a model: a lookup the writer can check, and override
 * by saying something else. It is what the strip falls back to when there is no
 * key, so the app is usable without one.
 */
export function patternFor(brief: string, notes = ""): Pattern {
	const said = brief.toLowerCase();
	for (const pattern of PATTERNS) {
		if (pattern.cues.some((cue) => said.includes(cue))) return pattern;
	}
	return ranked(notes)[0] ?? (PATTERNS.at(-1) as Pattern);
}

/** The kinds this document looks most like, best first. */
export function ranked(notes: string): Pattern[] {
	if (!notes.trim()) return PATTERNS;
	return [...PATTERNS]
		.map((pattern) => ({ pattern, hits: score(notes, pattern.signals) }))
		.sort((a, b) => b.hits - a.hits)
		.map((entry) => entry.pattern);
}

/**
 * French or not. Enough to keep what the writer reads — a suggested brief, the
 * question under an empty part — in the language they are working in.
 */
export function langOf(notes: string): Lang {
	const said = notes.toLowerCase();
	const marks = ["é", "è", "ê", "à", "ç", "ù", "œ"].filter((mark) => said.includes(mark)).length;
	const words = score(said, [" les ", " des ", " une ", " que ", " pour ", " est ", " sont "]);
	return marks > 0 && words >= 2 ? "fr" : "en";
}

/**
 * What this document seems to be about, in the writer's own words. The first
 * line if they gave it a title, otherwise the opening of the first section —
 * never anything invented.
 */
export function subjectOf(notes: string): string {
	const first = segment(notes)[0];
	if (!first) return "";
	const line = first.text.replace(/^[#*\-+>\s]+/, "").split("\n")[0] ?? "";
	const words = line.split(/\s+/).filter(Boolean);
	if (words.length <= 9) return line.replace(/[.:;,]$/, "");
	return `${words.slice(0, 8).join(" ")}…`;
}

/**
 * Three briefs to start from, built from what was actually pasted rather than
 * from a fixed list — a fixed list offered a post-mortem to an essay about
 * responsibility, which is worse than offering nothing.
 */
export function suggestFor(notes: string): string[] {
	if (!notes.trim()) return [];
	const subject = subjectOf(notes);
	if (!subject) return [];
	const lang = langOf(notes);
	return ranked(notes)
		.slice(0, 3)
		.map((pattern) => pattern.brief[lang].replace("%", subject));
}

/** What the picker is shown: one line per kind, and nothing else. */
export function shelf(): string {
	return PATTERNS.map((p) => `${p.id}: ${p.does}`).join("\n");
}
