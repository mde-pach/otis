import { describe, expect, test } from "bun:test";
import { agglomerative, buildDendrogram, cutDendrogram } from "../cluster";
import { centerVectors, similarityStats } from "../similarity";

const v = (...xs: number[]) => new Float32Array(xs);

/**
 * Two themes, but every vector also carries a large shared component — the
 * shape real sentence embeddings have when every fragment is about one subject.
 */
const anisotropic = [v(5, 1.0, 0.0), v(5, 0.9, 0.1), v(5, 0.0, 1.0), v(5, 0.1, 0.9)];

describe("buildDendrogram", () => {
	test("always builds the complete tree", () => {
		expect(buildDendrogram(anisotropic)).toHaveLength(anisotropic.length - 1);
	});

	test("merge scores never increase", () => {
		const scores = buildDendrogram(anisotropic).map((m) => m.score);
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i] as number).toBeLessThanOrEqual((scores[i - 1] as number) + 1e-9);
		}
	});

	test("is empty for fewer than two vectors", () => {
		expect(buildDendrogram([])).toEqual([]);
		expect(buildDendrogram([v(1, 0)])).toEqual([]);
	});
});

describe("cutDendrogram", () => {
	const merges = buildDendrogram(anisotropic);

	test("target cuts to exactly that many groups", () => {
		const { clusters } = cutDendrogram(4, merges, { kind: "target", groups: 2 });
		expect(clusters).toHaveLength(2);
	});

	test("largest-gap finds the two themes without being told a number", () => {
		const centred = centerVectors(anisotropic);
		const { clusters } = agglomerative(centred, {
			kind: "largest-gap",
			minGroups: 2,
			maxGroups: 3,
		});
		expect(clusters).toEqual([
			[0, 1],
			[2, 3],
		]);
	});

	test("explains where it cut, in words", () => {
		const { reason, cutScore } = cutDendrogram(4, merges, { kind: "target", groups: 2 });
		expect(reason).toContain("2 groups");
		expect(cutScore).toBeGreaterThan(0);
	});

	test("a threshold nobody reaches leaves every fragment alone", () => {
		const { clusters } = cutDendrogram(4, merges, { kind: "threshold", value: 2 });
		expect(clusters).toEqual([[0], [1], [2], [3]]);
	});
});

describe("centring", () => {
	test("the shared component hides the themes and centring reveals them", () => {
		const rawSpread = similarityStats(anisotropic).spread;
		const centredSpread = similarityStats(centerVectors(anisotropic)).spread;
		expect(rawSpread).toBeLessThan(0.05);
		expect(centredSpread).toBeGreaterThan(rawSpread * 5);
	});

	test("a fixed threshold on raw vectors puts everything in one group", () => {
		const { clusters } = agglomerative(anisotropic, 0.55);
		expect(clusters).toHaveLength(1);
	});

	test("the same threshold on centred vectors separates them", () => {
		const { clusters } = agglomerative(centerVectors(anisotropic), 0.55);
		expect(clusters).toEqual([
			[0, 1],
			[2, 3],
		]);
	});
});
