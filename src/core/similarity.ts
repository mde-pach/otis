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
