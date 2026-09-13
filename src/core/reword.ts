/**
 * The gate every shortening has to pass.
 *
 * The one hard promise is that the tool never adds a claim. It is enforced
 * here, deterministically, before anything reaches the page:
 *
 *   - a shortening may only use words the sentence already contains. "Fewer
 *     words, same claims" is taken literally: it is a selection of your words,
 *     so a clause that reads well and was never yours cannot survive it
 *   - one that introduces a number, unit or identifier the original did not
 *     contain has invented a fact
 *   - one that keeps almost none of the original's words is a rewrite
 *
 * A failed shortening is not rendered and then withdrawn. It never exists: the
 * planner drops it and the writer's own sentence stands.
 */

import { wordRetention } from "./diff";

/** Numbers, measurements, versions and code-ish identifiers: things that can be wrong. */
const FACT =
	/\b\d+(?:[.,]\d+)?\s*(?:%|ms|s|m|h|kb|mb|gb|tb|k|x)?(?![a-z])|\b[a-z_$][\w$]*\(\)|\b[A-Z][A-Za-z0-9]*_[A-Z0-9_]+\b/g;

function facts(text: string): Set<string> {
	return new Set((text.match(FACT) ?? []).map((f) => f.replace(/\s+/g, "").toLowerCase()));
}

export interface Check {
	retention: number;
	addedFacts: string[];
	/** words in the shortening that the writer's sentence does not contain */
	addedWords: string[];
	passed: boolean;
	reason: string;
}

/** Markdown is formatting, not words: it is stripped before anything is compared. */
export function plain(md: string): string {
	return md
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/^#{1,6}\s+/gm, "")
		.replace(/^[-*]\s+/gm, "")
		.replace(/\*\*([^*]+)\*\*/g, "$1")
		.replace(/\*([^*]+)\*/g, "$1")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.trim();
}

/** True when the only difference is Markdown. Those runs stay marked as yours. */
export function formattingOnly(original: string, proposed: string): boolean {
	return plain(original).replace(/\s+/g, " ") === plain(proposed).replace(/\s+/g, " ");
}

/** The words of a sentence, counted, so a shortening cannot quietly add one. */
function bag(text: string): Map<string, number> {
	const counted = new Map<string, number>();
	for (const word of words(text)) counted.set(word, (counted.get(word) ?? 0) + 1);
	return counted;
}

function words(text: string): string[] {
	return text
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter(Boolean);
}

export function checkFaithfulness(original: string, proposed: string, minRetention = 0.25): Check {
	const before = plain(original);
	const after = plain(proposed);
	const retention = wordRetention(before, after);

	const known = facts(before);
	const addedFacts = [...facts(after)].filter((f) => !known.has(f));

	// every word of a shortening has to be a word of the sentence it shortens
	const available = bag(before);
	const addedWords: string[] = [];
	for (const word of words(after)) {
		const left = available.get(word) ?? 0;
		if (left > 0) available.set(word, left - 1);
		else addedWords.push(word);
	}

	if (addedFacts.length > 0) {
		return {
			retention,
			addedFacts,
			addedWords,
			passed: false,
			reason: `it introduces ${addedFacts.join(", ")}, which your sentence does not say`,
		};
	}
	if (addedWords.length > 0) {
		return {
			retention,
			addedFacts,
			addedWords,
			passed: false,
			reason: `it puts words in your mouth — ${[...new Set(addedWords)].slice(0, 4).join(", ")}`,
		};
	}
	if (retention < minRetention) {
		return {
			retention,
			addedFacts,
			addedWords,
			passed: false,
			reason: `it keeps only ${Math.round(retention * 100)}% of your words, which is rewriting rather than shortening`,
		};
	}
	if (after === before) {
		return {
			retention,
			addedFacts,
			addedWords,
			passed: false,
			reason: "it is the sentence you already wrote",
		};
	}
	return {
		retention,
		addedFacts,
		addedWords,
		passed: true,
		reason: `keeps ${Math.round(retention * 100)}% of your words and adds none of its own`,
	};
}
