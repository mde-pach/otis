import { describe, expect, test } from "bun:test";
import { importDocument, orphanFragments, stats, ungroupedFragments } from "../project";
import { emptyProject } from "../types";

const doc = `The cache was doing exactly what we asked it to do.

p99 went from 180ms to 410ms in the week after rollout.

400 concurrent misses on the same key. Stampede.`;

describe("importDocument", () => {
	test("appends fragments with sequential ids", () => {
		const { project, added } = importDocument(emptyProject("p1", "test"), doc);
		expect(added).toHaveLength(3);
		expect(project.fragments.map((f) => f.id)).toEqual(["f01", "f02", "f03"]);
	});

	test("importing twice appends rather than replaces", () => {
		const first = importDocument(emptyProject("p1", "test"), doc).project;
		const second = importDocument(first, "one more thought").project;
		expect(second.fragments).toHaveLength(4);
		expect(second.fragments[3]?.id).toBe("f04");
	});

	test("fragments carry their origin", () => {
		const { added } = importDocument(emptyProject("p1", "t"), "typed here", "written-in-draft");
		expect(added[0]?.origin).toBe("written-in-draft");
	});
});

describe("selectors", () => {
	test("everything unplaced is an orphan", () => {
		const { project } = importDocument(emptyProject("p1", "t"), doc);
		expect(orphanFragments(project)).toHaveLength(3);
		expect(stats(project)).toEqual({ fragments: 3, grouped: 0, placed: 0, unused: 3 });
	});

	test("placing a fragment removes it from the orphan list", () => {
		const { project } = importDocument(emptyProject("p1", "t"), doc);
		const placed = {
			...project,
			blocks: [{ id: "b1", fragmentId: "f01", text: "x", slot: null, order: 0 }],
		};
		expect(orphanFragments(placed).map((f) => f.id)).toEqual(["f02", "f03"]);
		expect(stats(placed).placed).toBe(1);
	});

	test("grouping tracks separately from placing", () => {
		const { project } = importDocument(emptyProject("p1", "t"), doc);
		const grouped = {
			...project,
			groups: [{ id: "g1", label: "what broke", fragmentIds: ["f01", "f02"], auto: true }],
		};
		expect(stats(grouped).grouped).toBe(2);
		expect(ungroupedFragments(grouped).map((f) => f.id)).toEqual(["f03"]);
	});
});
