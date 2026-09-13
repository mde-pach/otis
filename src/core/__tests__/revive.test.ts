import { describe, expect, test } from "bun:test";
import { build, shapeOf } from "../plan";
import { reviveDoc } from "../types";

const NOTES = "First one.\n\nSecond one.\n\nThird one.";

describe("a document saved by an older version", () => {
	/** what the store held before a run came back with more than one arrangement */
	const before = {
		id: "current",
		notes: NOTES,
		brief: "an essay",
		reach: 2,
		patternId: "essay",
		plan: {
			basis: NOTES,
			at: [1, 0, 2],
			format: {},
			short: {},
			written: [],
			because: "led with it",
		},
		review: null,
		edits: {},
		updatedAt: 1,
	};

	test("its plan is carried forward into an arrangement rather than crashing", () => {
		const doc = reviveDoc("current", before);
		expect(doc.plan?.shapes).toHaveLength(1);
		expect(doc.plan?.shapes[0]?.at).toEqual([1, 0, 2]);
		expect(doc.shape).toBe(0);
	});

	test("and the article it made still renders", () => {
		const doc = reviveDoc("current", before);
		expect(build(doc.notes, doc.plan, doc.reach, doc.shape).runs.map((r) => r.fromIndex)).toEqual([
			1, 0, 2,
		]);
	});

	test("the field that no longer exists is simply not there", () => {
		expect("review" in reviveDoc("current", before)).toBe(false);
	});
});

describe("a document that cannot be read", () => {
	const kept = (plan: unknown) => reviveDoc("current", { notes: NOTES, plan });

	test("keeps the writer's text and drops only the plan", () => {
		for (const plan of [undefined, null, 42, "a plan", {}, { basis: 1 }, { basis: NOTES }]) {
			const doc = kept(plan);
			expect(doc.notes).toBe(NOTES);
			expect(doc.plan).toBeNull();
		}
	});

	test("nothing stored at all is an empty document, not an exception", () => {
		expect(reviveDoc("current", null).notes).toBe("");
		expect(reviveDoc("current", "rubbish").plan).toBeNull();
	});

	test("a reach that is not a reach falls back to your text untouched", () => {
		expect(reviveDoc("current", { notes: NOTES, reach: 9 }).reach).toBe(0);
	});
});

describe("asking a plan for an arrangement it has not got", () => {
	test("is nothing, never a crash", () => {
		expect(shapeOf(null, 0)).toBeNull();
		expect(shapeOf({ shapes: [] } as never, 0)).toBeNull();
		expect(shapeOf({} as never, 0)).toBeNull();
	});
});
