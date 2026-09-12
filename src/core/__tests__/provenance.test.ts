import { describe, expect, test } from "bun:test";
import { deriveState, summarise } from "../provenance";
import type { Block, Fragment } from "../types";

const fragment = (over: Partial<Fragment> = {}): Fragment => ({
	id: "f01",
	text: "The cache was doing exactly what we asked it to do.",
	origin: "imported",
	createdAt: 0,
	...over,
});

const block = (over: Partial<Block> = {}): Block => ({
	id: "b01",
	fragmentId: "f01",
	text: fragment().text,
	slot: null,
	order: 0,
	...over,
});

describe("deriveState", () => {
	test("untouched text is verbatim", () => {
		expect(deriveState(block(), fragment())).toBe("verbatim");
	});

	test("text typed in the draft is written-here", () => {
		const f = fragment({ origin: "written-in-draft" });
		expect(deriveState(block({ text: f.text }), f)).toBe("written-here");
	});

	test("an accepted reword is reword-accepted", () => {
		const b = block({ text: "A reworded line.", acceptedRewordText: "A reworded line." });
		expect(deriveState(b, fragment())).toBe("reword-accepted");
	});

	test("editing after accepting a reword falls back to edited", () => {
		const b = block({
			text: "A reworded line, then mine.",
			acceptedRewordText: "A reworded line.",
		});
		expect(deriveState(b, fragment())).toBe("edited");
	});

	test("an undone edit leaves no residue", () => {
		const b = block({ text: "changed", acceptedRewordText: "something else" });
		expect(deriveState(b, fragment())).toBe("edited");
		expect(deriveState({ ...b, text: fragment().text }, fragment())).toBe("verbatim");
	});
});

describe("summarise", () => {
	test("counts states and the share untouched by any model", () => {
		const f1 = fragment({ id: "f01", text: "one" });
		const f2 = fragment({ id: "f02", text: "two" });
		const fragments = new Map([
			[f1.id, f1],
			[f2.id, f2],
		]);
		const blocks: Block[] = [
			block({ id: "b1", fragmentId: "f01", text: "one" }),
			block({
				id: "b2",
				fragmentId: "f02",
				text: "two, reworded",
				acceptedRewordText: "two, reworded",
			}),
		];
		const s = summarise(blocks, fragments);
		expect(s).toMatchObject({ blocks: 2, verbatim: 1, rewordAccepted: 1 });
		expect(s.untouchedByModel).toBe(0.5);
	});
});
