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
import { segment } from "../../core/segments";

export interface Pattern {
	id: string;
	name: string;
	file: string;
	text: string;
	/** words that suggest this note when the writer says what they are making */
	cues: string[];
	/** words that suggest it from the notes themselves, before they have said */
	signals: string[];
	/** a brief in their words, not ours — `%` is where the subject goes */
	brief: { en: string; fr: string };
}

export const PATTERNS: Pattern[] = [
	{
		id: "post-mortem",
		name: "post-mortem",
		file: "patterns/post-mortem.md",
		text: postMortem,
		cues: ["post-mortem", "postmortem", "incident", "outage", "went wrong", "retro"],
		signals: [
			"incident",
			"outage",
			"p99",
			"p50",
			"latency",
			"rollback",
			"downtime",
			"postmortem",
			"panne",
			"incident",
			"coupure",
			"correctif",
		],
		brief: {
			en: "A post-mortem on % for people who were not there. Lead with the cost.",
			fr: "Un post-mortem sur % pour des gens qui n'étaient pas là. Commencer par le coût.",
		},
	},
	{
		id: "internal-note",
		name: "internal note",
		file: "patterns/internal-note.md",
		text: internalNote,
		cues: ["note", "my team", "internal", "status", "update", "standup"],
		signals: [
			"shipped",
			"we decided",
			"next week",
			"the team",
			"todo",
			"équipe",
			"livré",
			"décidé",
		],
		brief: {
			en: "A short note to my own team about %. What changed, and what to do now.",
			fr: "Une note courte à mon équipe sur %. Ce qui change, et quoi faire maintenant.",
		},
	},
	{
		id: "how-it-works",
		name: "explanation",
		file: "patterns/how-it-works.md",
		text: howItWorks,
		cues: ["how it works", "explain", "tutorial", "guide", "walkthrough", "deep dive"],
		signals: [
			"works",
			"mechanism",
			"because",
			"means that",
			"in other words",
			"for example",
			"fonctionne",
			"mécanisme",
			"c'est-à-dire",
			"par exemple",
			"autrement dit",
		],
		brief: {
			en: "An explanation of % for someone who has never touched it. One mechanism at a time.",
			fr: "Une explication de % pour quelqu'un qui n'y a jamais touché. Un mécanisme à la fois.",
		},
	},
	{
		id: "essay",
		name: "essay",
		file: "patterns/essay.md",
		text: essay,
		cues: ["essay", "argue", "argument", "opinion", "essai", "tribune"],
		signals: [
			"i think",
			"the mistake",
			"we cannot",
			"should",
			"responsibility",
			"rule",
			"erreur",
			"on ne peut pas",
			"responsabilité",
			"règle",
			"il faut",
			"critères",
		],
		brief: {
			en: "An essay arguing % — the claim early, and a reason to doubt it before the end.",
			fr: "Un essai qui défend % — la thèse tôt, et une raison d'en douter avant la fin.",
		},
	},
];

export function patternById(id: string): Pattern {
	return PATTERNS.find((p) => p.id === id) ?? (PATTERNS.at(-1) as Pattern);
}

function score(text: string, words: string[]): number {
	const said = text.toLowerCase();
	return words.filter((word) => said.includes(word)).length;
}

/**
 * Picked by word, not by a model: it is a lookup the writer can check, and they
 * can override it by saying something else. What they said wins; when they have
 * not said anything, the notes are asked instead.
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

/** French or not. Enough to keep a suggestion in the writer's own language. */
function french(notes: string): boolean {
	const said = notes.toLowerCase();
	const marks = ["é", "è", "ê", "à", "ç", "ù", "œ"].filter((mark) => said.includes(mark)).length;
	const words = score(said, [" les ", " des ", " une ", " que ", " pour ", " est ", " sont "]);
	return marks > 0 && words >= 2;
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
	const lang = french(notes) ? "fr" : "en";
	return ranked(notes)
		.slice(0, 3)
		.map((pattern) => pattern.brief[lang].replace("%", subject));
}
