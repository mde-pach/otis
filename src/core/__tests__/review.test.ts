import { describe, expect, test } from "bun:test";
import { placeFragment } from "../draft";
import { importDocument } from "../project";
import {
	isFinishable,
	latestRound,
	measuredItems,
	openItems,
	reopenItem,
	resolveItem,
	startRound,
	waiveItem,
} from "../review";
import { emptyProject, type Project } from "../types";

const notes = `The cache was doing what we asked.

p99 went from 180ms to 410ms.

Nobody experiences the average.

Nobody experiences the average. They experience the worst request they made today.`;

const seed = (): Project => {
	const { project } = importDocument(
		{ ...emptyProject("p", "t"), skeletonId: "problem-solution" },
		notes,
	);
	return project;
};

describe("measuredItems", () => {
	test("names every empty slot in the chosen skeleton", () => {
		const items = measuredItems(seed()).filter((i) => i.kind === "empty-slot");
		expect(items).toHaveLength(6);
		expect(items[0]?.question).toContain("Hook");
	});

	test("reports fragments written and never placed", () => {
		const item = measuredItems(seed()).find((i) => i.kind === "orphan");
		expect(item?.fragmentIds).toHaveLength(4);
	});

	test("carries the duplicate pair through as a question", () => {
		const item = measuredItems(seed()).find((i) => i.kind === "duplicate");
		expect(item?.fragmentIds).toEqual(["f03", "f04"]);
		expect(item?.question).toContain("every word");
	});

	test("every measured item is marked as measured", () => {
		expect(measuredItems(seed()).every((i) => i.source === "measured")).toBe(true);
	});
});

describe("rounds", () => {
	test("a round freezes its items", () => {
		const project = startRound(seed());
		const before = latestRound(project)?.items.length;
		const placed = placeFragment(project, "f01", "hook");
		expect(latestRound(placed)?.items.length).toBe(before as number);
	});

	test("judged items are kept separate from measured ones", () => {
		const project = startRound(
			seed(),
			[{ kind: "missing-evidence", question: "Where is the number?", blockId: "b01" }],
			"claude · 1 gap",
		);
		const items = latestRound(project)?.items ?? [];
		expect(items.filter((i) => i.source === "judged")).toHaveLength(1);
		expect(latestRound(project)?.rationale).toContain("claude");
	});

	test("resolving and waiving both close an item, and waiving keeps the reason", () => {
		let project = startRound(seed());
		const [first, second] = openItems(project);
		project = resolveItem(project, first?.id as string);
		project = waiveItem(project, second?.id as string, "different article");
		const items = latestRound(project)?.items ?? [];
		expect(items.find((i) => i.id === first?.id)?.status).toBe("resolved");
		expect(items.find((i) => i.id === second?.id)?.note).toBe("different article");
	});

	test("an item can be reopened", () => {
		let project = startRound(seed());
		const id = openItems(project)[0]?.id as string;
		project = reopenItem(resolveItem(project, id), id);
		expect(openItems(project).some((i) => i.id === id)).toBe(true);
	});

	test("a second round starts from the current state", () => {
		const project = startRound(startRound(seed()));
		expect(project.rounds).toHaveLength(2);
		expect(latestRound(project)?.index).toBe(2);
	});
});

describe("isFinishable", () => {
	test("not finishable while anything is open", () => {
		expect(isFinishable(startRound(placeFragment(seed(), "f01", "hook")))).toBe(false);
	});

	test("finishable once every item is answered", () => {
		let project = startRound(placeFragment(seed(), "f01", "hook"));
		for (const item of openItems(project)) project = waiveItem(project, item.id, "on purpose");
		expect(isFinishable(project)).toBe(true);
	});

	test("an empty draft is never finishable", () => {
		let project = startRound(seed());
		for (const item of openItems(project)) project = waiveItem(project, item.id, "x");
		expect(isFinishable(project)).toBe(false);
	});
});
