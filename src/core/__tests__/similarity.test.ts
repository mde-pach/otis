import { describe, expect, test } from "bun:test";
import { agglomerative, nearDuplicates } from "../cluster";
import { cosine, l2normalize } from "../similarity";

const v = (...xs: number[]) => new Float32Array(xs);

describe("cosine", () => {
	test("identical vectors are 1", () => {
		expect(cosine(v(1, 2, 3), v(1, 2, 3))).toBeCloseTo(1, 6);
	});

	test("orthogonal vectors are 0", () => {
		expect(cosine(v(1, 0), v(0, 1))).toBeCloseTo(0, 6);
	});

	test("scale invariant", () => {
		expect(cosine(v(1, 1), v(5, 5))).toBeCloseTo(1, 6);
	});

	test("zero vector yields 0 rather than NaN", () => {
		expect(cosine(v(0, 0), v(1, 1))).toBe(0);
	});

	test("length mismatch throws", () => {
		expect(() => cosine(v(1, 2), v(1, 2, 3))).toThrow();
	});
});

describe("l2normalize", () => {
	test("produces a unit vector", () => {
		const n = l2normalize(v(3, 4));
		expect(Math.hypot(n[0] as number, n[1] as number)).toBeCloseTo(1, 6);
	});
});

describe("agglomerative", () => {
	test("separates two obvious poles", () => {
		const vectors = [v(1, 0), v(0.98, 0.02), v(0, 1), v(0.02, 0.98)];
		const { clusters } = agglomerative(vectors, 0.8);
		expect(clusters).toEqual([
			[0, 1],
			[2, 3],
		]);
	});

	test("a high threshold leaves everything apart", () => {
		const { clusters } = agglomerative([v(1, 0), v(0, 1)], 0.99);
		expect(clusters).toEqual([[0], [1]]);
	});

	test("is deterministic across runs", () => {
		const vectors = [v(1, 0.1), v(0.9, 0.2), v(0.1, 1), v(0.2, 0.9), v(0.5, 0.5)];
		const a = agglomerative(vectors, 0.7).clusters;
		const b = agglomerative(vectors, 0.7).clusters;
		expect(a).toEqual(b);
	});

	test("records why each merge happened", () => {
		const { merges } = agglomerative([v(1, 0), v(0.99, 0.01)], 0.5);
		expect(merges).toHaveLength(1);
		expect(merges[0]?.score).toBeGreaterThan(0.9);
	});

	test("handles empty and single input", () => {
		expect(agglomerative([], 0.5).clusters).toEqual([]);
		expect(agglomerative([v(1, 1)], 0.5).clusters).toEqual([[0]]);
	});
});

describe("nearDuplicates", () => {
	test("finds the pair and sorts by score", () => {
		const pairs = nearDuplicates([v(1, 0), v(0, 1), v(0.999, 0.001)], 0.9);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]).toMatchObject({ a: 0, b: 2 });
	});
});
