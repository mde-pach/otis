/** Vector maths. Deterministic: the same pair always yields the same number. */

export type Vector = Float32Array;

export function l2normalize(v: Vector): Vector {
	let sum = 0;
	for (let i = 0; i < v.length; i++) sum += (v[i] as number) ** 2;
	const norm = Math.sqrt(sum);
	if (norm === 0) return v;
	const out = new Float32Array(v.length);
	for (let i = 0; i < v.length; i++) out[i] = (v[i] as number) / norm;
	return out;
}

/** Cosine similarity. Assumes nothing about normalisation. */
export function cosine(a: Vector, b: Vector): number {
	if (a.length !== b.length) throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		const x = a[i] as number;
		const y = b[i] as number;
		dot += x * y;
		na += x * x;
		nb += y * y;
	}
	if (na === 0 || nb === 0) return 0;
	return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Subtract the mean vector, then renormalise.
 *
 * Sentence embeddings of texts from one domain share a large common direction —
 * every fragment of one article is "about caching", and that shared component
 * dominates the cosine. Raw similarities then bunch into a narrow band near the
 * top, where no fixed threshold can separate them: everything looks related to
 * everything, because on this corpus everything *is*.
 *
 * Centring removes what the fragments have in common and leaves what
 * distinguishes them, which is the thing being clustered.
 */
export function centerVectors(vectors: Vector[]): Vector[] {
	if (vectors.length === 0) return [];
	const dim = (vectors[0] as Vector).length;
	const mean = new Float32Array(dim);
	for (const v of vectors) {
		for (let i = 0; i < dim; i++) mean[i] = (mean[i] as number) + (v[i] as number);
	}
	for (let i = 0; i < dim; i++) mean[i] = (mean[i] as number) / vectors.length;

	return vectors.map((v) => {
		const out = new Float32Array(dim);
		for (let i = 0; i < dim; i++) out[i] = (v[i] as number) - (mean[i] as number);
		return l2normalize(out);
	});
}

/** Full pairwise similarity matrix. n is in the hundreds, so O(n²) is free. */
export function similarityMatrix(vectors: Vector[]): number[][] {
	const n = vectors.length;
	const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
	for (let i = 0; i < n; i++) {
		for (let j = i + 1; j < n; j++) {
			const s = cosine(vectors[i] as Vector, vectors[j] as Vector);
			(m[i] as number[])[j] = s;
			(m[j] as number[])[i] = s;
		}
	}
	return m;
}

export interface SimilarityStats {
	pairs: number;
	min: number;
	p25: number;
	median: number;
	p75: number;
	max: number;
	mean: number;
	/** p75 − p25. A narrow spread means no fixed threshold will separate anything. */
	spread: number;
}

/** What the numbers actually look like. Shown to the writer, not hidden in a log. */
export function similarityStats(vectors: Vector[]): SimilarityStats {
	const values: number[] = [];
	for (let i = 0; i < vectors.length; i++) {
		for (let j = i + 1; j < vectors.length; j++) {
			values.push(cosine(vectors[i] as Vector, vectors[j] as Vector));
		}
	}
	if (values.length === 0) {
		return { pairs: 0, min: 0, p25: 0, median: 0, p75: 0, max: 0, mean: 0, spread: 0 };
	}
	values.sort((a, b) => a - b);
	const at = (q: number) =>
		values[Math.min(values.length - 1, Math.floor(q * values.length))] as number;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const p25 = at(0.25);
	const p75 = at(0.75);
	return {
		pairs: values.length,
		min: values[0] as number,
		p25,
		median: at(0.5),
		p75,
		max: values[values.length - 1] as number,
		mean,
		spread: p75 - p25,
	};
}
