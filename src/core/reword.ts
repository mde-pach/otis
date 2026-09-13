/**
 * The gate every shortening has to pass.
 *
 * The one hard promise is that the tool never adds a claim. It is enforced
 * here, deterministically, before anything reaches the page:
 *
 *   - a shortening that keeps almost none of the original's words is a rewrite
 *   - one that introduces a number, unit or identifier the original did not
 *     contain has invented a fact
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

export function checkFaithfulness(original: string, proposed: string, minRetention = 0.25): Check {
	const before = plain(original);
	const after = plain(proposed);
	const retention = wordRetention(before, after);

	const known = facts(before);
	const addedFacts = [...facts(after)].filter((f) => !known.has(f));

	if (addedFacts.length > 0) {
		return {
			retention,
			addedFacts,
			passed: false,
			reason: `it introduces ${addedFacts.join(", ")}, which your sentence does not say`,
		};
	}
	if (retention < minRetention) {
		return {
			retention,
			addedFacts,
			passed: false,
			reason: `it keeps only ${Math.round(retention * 100)}% of your words, which is rewriting rather than shortening`,
		};
	}
	if (after === before) {
		return { retention, addedFacts, passed: false, reason: "it is the sentence you already wrote" };
	}
	return {
		retention,
		addedFacts,
		passed: true,
		reason: `keeps ${Math.round(retention * 100)}% of your words and adds no facts`,
	};
}

/**
 * Saying again what the writer already said.
 *
 * The prompt forbids putting their words in `written`, and a model will do it
 * anyway — it paraphrases a section it likes and the piece then makes the same
 * point twice, once in the writer's voice and once in the tool's. So the words
 * are counted. Accents are folded and short words dropped, because agreement on
 * "les" is not evidence of anything; agreement on "investissements" is.
 */
function content(text: string): string[] {
	return plain(text)
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter((word) => word.length > 3);
}

export function restates(text: string, notes: string, limit = 0.7): boolean {
	const words = content(text);
	// too short to tell a restatement from a heading that happens to share a noun
	if (words.length < 5) return false;
	const known = new Set(content(notes));
	const seen = words.filter((word) => known.has(word)).length;
	return seen / words.length >= limit;
}
