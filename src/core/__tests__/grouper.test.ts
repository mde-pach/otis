import { describe, expect, test } from "bun:test";
import { createEmbeddingGrouper } from "../embedding-grouper";
import type { Embedder } from "../ports";
import type { Fragment } from "../types";

/** A fake embedder: two poles, so clustering behaviour is assertable. */
const fakeEmbedder: Embedder = {
	id: "fake",
	async embed(texts) {
		return texts.map((t) =>
			t.includes("cache")
				? new Float32Array([1, 0.05])
				: t.includes("team")
					? new Float32Array([0.05, 1])
					: new Float32Array([0.7, 0.7]),
		);
	},
};

const frag = (id: string, text: string): Fragment => ({
	id,
	text,
	origin: "imported",
	createdAt: 0,
});

describe("createEmbeddingGrouper", () => {
	const fragments = [
		frag("f01", "the cache was cold"),
		frag("f02", "the cache stampeded"),
		frag("f03", "the team shipped it on a Friday"),
		frag("f04", "the team argued about the TTL"),
	];

	test("proposes groups along the poles", async () => {
		const grouper = createEmbeddingGrouper({ embedder: fakeEmbedder, threshold: 0.9 });
		const proposal = await grouper.propose(fragments);
		expect(proposal.groups).toHaveLength(2);
		const sets = proposal.groups.map((g) => g.fragmentIds.sort().join(","));
		expect(sets.sort()).toEqual(["f01,f02", "f03,f04"]);
	});

	test("marks proposals as auto and labels them from their own words", async () => {
		const grouper = createEmbeddingGrouper({ embedder: fakeEmbedder, threshold: 0.9 });
		const { groups } = await grouper.propose(fragments);
		expect(groups.every((g) => g.auto)).toBe(true);
		expect(groups.some((g) => g.label.includes("cache"))).toBe(true);
	});

	test("leaves undersized clusters ungrouped instead of inventing a theme", async () => {
		const grouper = createEmbeddingGrouper({
			embedder: fakeEmbedder,
			threshold: 0.9,
			minClusterSize: 3,
		});
		const proposal = await grouper.propose(fragments);
		expect(proposal.groups).toHaveLength(0);
		expect(proposal.ungroupedFragmentIds.sort()).toEqual(["f01", "f02", "f03", "f04"]);
	});

	test("states how the proposal was produced", async () => {
		const grouper = createEmbeddingGrouper({ embedder: fakeEmbedder, threshold: 0.6 });
		const { rationale } = await grouper.propose(fragments);
		expect(rationale).toContain("fake");
	});

	test("handles an empty pile", async () => {
		const grouper = createEmbeddingGrouper({ embedder: fakeEmbedder });
		expect((await grouper.propose([])).groups).toEqual([]);
	});
});
