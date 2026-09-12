/**
 * Agglomerative clustering with average linkage.
 *
 * Chosen over anything cleverer because it is inspectable: every merge happened
 * at a similarity the writer can be shown, and re-running it on the same input
 * gives the same answer. Ties break on index order, so results never wobble.
 *
 * The tree is always built to completion and the cut is a separate decision.
 * An absolute threshold is a bad default on real notes — every fragment of one
 * article is about the same subject, so the similarities bunch together and the
 * same number that yields one blob on one pile yields thirty singletons on the
 * next. Cutting at the largest gap in the merge scores asks the relative
 * question instead: where does this pile stop agreeing with itself?
 */

import { similarityMatrix, type Vector } from "./similarity";

export interface Merge {
	a: number[];
	b: number[];
	score: number;
}

export type CutStrategy =
	| { kind: "threshold"; value: number }
	| { kind: "target"; groups: number }
	| { kind: "largest-gap"; minGroups?: number; maxGroups?: number };

export interface ClusterResult {
	/** Indices into the input array, each cluster sorted ascending. */
	clusters: number[][];
	/** Every merge, highest similarity first. The whole tree, not just the kept part. */
	merges: Merge[];
	/** The similarity the tree was cut at. */
	cutScore: number;
	/** Plain words for why the cut landed there, shown to the writer. */
	reason: string;
}

/** Builds the complete tree: n − 1 merges, ending in a single cluster. */
export function buildDendrogram(vectors: Vector[]): Merge[] {
	const n = vectors.length;
	if (n < 2) return [];

	const sim = similarityMatrix(vectors);
	let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
	const merges: Merge[] = [];

	const linkage = (a: number[], b: number[]): number => {
		let total = 0;
		for (const i of a) for (const j of b) total += (sim[i] as number[])[j] as number;
		return total / (a.length * b.length);
	};

	while (clusters.length > 1) {
		let best = Number.NEGATIVE_INFINITY;
		let bi = -1;
		let bj = -1;
		for (let i = 0; i < clusters.length; i++) {
			for (let j = i + 1; j < clusters.length; j++) {
				const score = linkage(clusters[i] as number[], clusters[j] as number[]);
				if (score > best) {
					best = score;
					bi = i;
					bj = j;
				}
			}
		}
		const a = clusters[bi] as number[];
		const b = clusters[bj] as number[];
		merges.push({ a: [...a], b: [...b], score: best });
		const merged = [...a, ...b].sort((x, y) => x - y);
		clusters = clusters.filter((_, idx) => idx !== bi && idx !== bj);
		clusters.push(merged);
	}

	return merges;
}

function replay(n: number, merges: Merge[], keep: number): number[][] {
	const parent = Array.from({ length: n }, (_, i) => i);
	const find = (x: number): number => {
		let root = x;
		while ((parent[root] as number) !== root) root = parent[root] as number;
		return root;
	};
	for (let i = 0; i < keep; i++) {
		const merge = merges[i] as Merge;
		const a = find(merge.a[0] as number);
		const b = find(merge.b[0] as number);
		if (a !== b) parent[b] = a;
	}
	const byRoot = new Map<number, number[]>();
	for (let i = 0; i < n; i++) {
		const root = find(i);
		const list = byRoot.get(root);
		if (list) list.push(i);
		else byRoot.set(root, [i]);
	}
	return [...byRoot.values()]
		.map((c) => c.sort((x, y) => x - y))
		.sort((a, b) => (a[0] as number) - (b[0] as number));
}

export function cutDendrogram(n: number, merges: Merge[], strategy: CutStrategy): ClusterResult {
	if (n === 0) return { clusters: [], merges, cutScore: 0, reason: "nothing to cluster" };
	if (n === 1) return { clusters: [[0]], merges, cutScore: 1, reason: "a single fragment" };

	if (strategy.kind === "threshold") {
		const keep = merges.filter((m) => m.score >= strategy.value).length;
		return {
			clusters: replay(n, merges, keep),
			merges,
			cutScore: strategy.value,
			reason: `merges at or above ${strategy.value.toFixed(2)} average linkage`,
		};
	}

	if (strategy.kind === "target") {
		const keep = Math.max(0, Math.min(merges.length, n - strategy.groups));
		const cutScore = keep > 0 ? (merges[keep - 1] as Merge).score : 1;
		return {
			clusters: replay(n, merges, keep),
			merges,
			cutScore,
			reason: `cut to ${strategy.groups} groups, which landed at ${cutScore.toFixed(2)}`,
		};
	}

	// largest-gap: the biggest drop in merge score inside the allowed range.
	const minGroups = strategy.minGroups ?? 3;
	const maxGroups = strategy.maxGroups ?? Math.max(minGroups, Math.round(Math.sqrt(n) * 1.6));
	const lo = Math.max(0, n - maxGroups);
	const hi = Math.min(merges.length, n - minGroups);

	let bestGap = Number.NEGATIVE_INFINITY;
	let keep = Math.min(merges.length, Math.max(0, n - Math.min(maxGroups, Math.max(minGroups, 5))));
	for (let i = lo; i < hi; i++) {
		const gap = (merges[i] as Merge).score - (merges[i + 1] as Merge).score;
		if (gap > bestGap) {
			bestGap = gap;
			keep = i + 1;
		}
	}
	const cutScore = keep > 0 ? (merges[keep - 1] as Merge).score : 1;
	return {
		clusters: replay(n, merges, keep),
		merges,
		cutScore,
		reason:
			bestGap > Number.NEGATIVE_INFINITY
				? `cut where the merge scores drop most (${cutScore.toFixed(2)}, a gap of ${bestGap.toFixed(3)})`
				: `cut at ${cutScore.toFixed(2)}`,
	};
}

/** Build and cut in one call. A bare number keeps the old threshold behaviour. */
export function agglomerative(vectors: Vector[], strategy: CutStrategy | number): ClusterResult {
	const merges = buildDendrogram(vectors);
	const cut: CutStrategy =
		typeof strategy === "number" ? { kind: "threshold", value: strategy } : strategy;
	return cutDendrogram(vectors.length, merges, cut);
}

/** Pairs above a threshold, strongest first. A measurement, not an opinion. */
export function nearDuplicates(
	vectors: Vector[],
	threshold = 0.9,
): { a: number; b: number; score: number }[] {
	const sim = similarityMatrix(vectors);
	const pairs: { a: number; b: number; score: number }[] = [];
	for (let i = 0; i < vectors.length; i++) {
		for (let j = i + 1; j < vectors.length; j++) {
			const score = (sim[i] as number[])[j] as number;
			if (score >= threshold) pairs.push({ a: i, b: j, score });
		}
	}
	return pairs.sort((x, y) => y.score - x.score);
}
