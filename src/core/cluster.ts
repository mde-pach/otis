/**
 * Agglomerative clustering with average linkage.
 *
 * Chosen over anything cleverer because it is inspectable: every merge happened
 * at a similarity the writer can be shown, and re-running it on the same input
 * gives the same answer. Ties break on index order, so results never wobble.
 */

import { similarityMatrix, type Vector } from "./similarity";

export interface ClusterResult {
	/** Indices into the input array, each cluster sorted ascending. */
	clusters: number[][];
	/** Merge log: which clusters joined, and at what average-linkage similarity. */
	merges: { a: number[]; b: number[]; score: number }[];
}

export function agglomerative(vectors: Vector[], threshold: number): ClusterResult {
	const n = vectors.length;
	if (n === 0) return { clusters: [], merges: [] };
	if (n === 1) return { clusters: [[0]], merges: [] };

	const sim = similarityMatrix(vectors);
	let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);
	const merges: ClusterResult["merges"] = [];

	const linkage = (a: number[], b: number[]): number => {
		let total = 0;
		for (const i of a) for (const j of b) total += (sim[i] as number[])[j] as number;
		return total / (a.length * b.length);
	};

	while (clusters.length > 1) {
		let best = -Infinity;
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
		if (best < threshold || bi < 0) break;

		const a = clusters[bi] as number[];
		const b = clusters[bj] as number[];
		merges.push({ a: [...a], b: [...b], score: best });
		const merged = [...a, ...b].sort((x, y) => x - y);
		clusters = clusters.filter((_, idx) => idx !== bi && idx !== bj);
		clusters.push(merged);
	}

	clusters.sort((a, b) => (a[0] as number) - (b[0] as number));
	return { clusters, merges };
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
