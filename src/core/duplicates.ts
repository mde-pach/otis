/**
 * Near-duplicate detection, lexically.
 *
 * This used to be a cosine threshold on embeddings, and the fixture showed why
 * that cannot work. Measured on 30 real fragments with MiniLM-L6:
 *
 *   f03 "Nobody experiences the average."
 *   f30 "Nobody experiences the average. They experience the worst request…"   0.643
 *
 *   f01 "The cache was doing exactly what we asked it to do…"
 *   f14 "I still think adding the cache was the right call…"                   0.728
 *
 * The genuine duplicate scores *lower* than an unrelated pair. No threshold can
 * separate them, because the ranking itself is wrong. Word overlap gets the
 * first pair exactly right and the second exactly wrong-way-round, is free, and
 * can be shown to the writer as a reason rather than a number they must trust.
 *
 * What this deliberately does not catch: the same claim written twice in
 * completely different words. That needs a model that understands the claim,
 * and it belongs to the Judge, not here.
 */

export type DuplicateKind = "contains" | "near";

export interface DuplicatePair {
	a: number;
	b: number;
	kind: DuplicateKind;
	/** Share of the shorter fragment's words that appear in the longer one. */
	containment: number;
	/** Word-trigram Jaccard: catches reordering that containment misses. */
	jaccard: number;
	/** One sentence the writer can check for themselves. */
	reason: string;
}

function normalise(text: string): string[] {
	return text
		.replace(/```[\s\S]*?```/g, " ")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, " ")
		.split(/\s+/)
		.filter(Boolean);
}

function trigrams(words: string[]): Set<string> {
	const out = new Set<string>();
	for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
	if (words.length > 0 && words.length < 3) out.add(words.join(" "));
	return out;
}

function intersectionSize<T>(a: Set<T>, b: Set<T>): number {
	let n = 0;
	for (const x of a) if (b.has(x)) n++;
	return n;
}

export interface DuplicateOptions {
	/** Containment at or above this is "one fragment swallowed the other". */
	containment?: number;
	/** Trigram overlap at or above this is "the same sentence, lightly edited". */
	jaccard?: number;
	/** Fragments shorter than this are ignored: three words match by accident. */
	minWords?: number;
}

export function findDuplicates(texts: string[], options: DuplicateOptions = {}): DuplicatePair[] {
	const { containment: containmentCut = 0.85, jaccard: jaccardCut = 0.4, minWords = 4 } = options;

	const words = texts.map(normalise);
	const sets = words.map((w) => new Set(w));
	const grams = words.map(trigrams);
	const pairs: DuplicatePair[] = [];

	for (let i = 0; i < texts.length; i++) {
		for (let j = i + 1; j < texts.length; j++) {
			const wi = words[i] as string[];
			const wj = words[j] as string[];
			if (wi.length < minWords || wj.length < minWords) continue;

			const si = sets[i] as Set<string>;
			const sj = sets[j] as Set<string>;
			const shared = intersectionSize(si, sj);
			const containment = shared / Math.min(si.size, sj.size);

			const gi = grams[i] as Set<string>;
			const gj = grams[j] as Set<string>;
			const union = gi.size + gj.size - intersectionSize(gi, gj);
			const jaccard = union === 0 ? 0 : intersectionSize(gi, gj) / union;

			if (containment >= containmentCut) {
				const shorter = si.size <= sj.size ? i : j;
				const longer = shorter === i ? j : i;
				pairs.push({
					a: i,
					b: j,
					kind: "contains",
					containment,
					jaccard,
					reason: `every word of #${shorter + 1} appears in #${longer + 1}`,
				});
			} else if (jaccard >= jaccardCut) {
				pairs.push({
					a: i,
					b: j,
					kind: "near",
					containment,
					jaccard,
					reason: `${Math.round(jaccard * 100)}% of their three-word phrases are identical`,
				});
			}
		}
	}

	return pairs.sort(
		(x, y) => Math.max(y.containment, y.jaccard) - Math.max(x.containment, x.jaccard),
	);
}
