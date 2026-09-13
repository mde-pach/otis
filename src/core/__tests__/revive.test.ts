import { describe, expect, test } from "bun:test";
import { build, shapeOf } from "../plan";
import { reviveDoc } from "../types";

const NOTES = "First one.\n\nSecond one.\n\nThird one.";

describe("a document saved by an older version", () => {
	/** what the store held when an arrangement was a list of positions */
	const positions = {
		id: "current",
		notes: NOTES,
		brief: "an essay",
		reach: 2,
		patternId: "essay",
		plan: {
			basis: NOTES,
			shapes: [{ name: "the claim first", at: [1, 0, 2], because: "led with it" }],
			format: {},
			short: {},
			written: [{ after: 1, md: "a gap", confidence: "low", because: "missing" }],
		},
		edits: {},
		updatedAt: 1,
	};

	test("its plan is dropped rather than reinterpreted into an order nobody chose", () => {
		const doc = reviveDoc("current", positions);
		expect(doc.plan).toBeNull();
	});

	test("but the writer's text survives, which is the only thing that matters", () => {
		const doc = reviveDoc("current", positions);
		expect(doc.notes).toBe(NOTES);
		expect(doc.brief).toBe("an essay");
	});

	test("and what renders is their own order, not an empty page", () => {
		const doc = reviveDoc("current", positions);
		const built = build(doc.notes, doc.plan, { reach: doc.reach, which: doc.shape });
		expect(built.runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
	});
});

describe("a document saved by this version", () => {
	const current = {
		id: "current",
		notes: NOTES,
		brief: "",
		reach: 2,
		patternId: "essay",
		plan: {
			basis: NOTES,
			shapes: [
				{ patternId: "essay", because: "it argues", placement: ["claim", "reason", null] },
				{ patternId: "internal-note", because: "it is short", placement: null },
			],
			format: {},
			short: {},
		},
		shape: 1,
		edits: {},
		updatedAt: 1,
	};

	test("placements come back as they went in", () => {
		const doc = reviveDoc("current", current);
		expect(doc.plan?.shapes[0]?.placement).toEqual(["claim", "reason", null]);
	});

	test("a card that was never organised stays un-organised", () => {
		const doc = reviveDoc("current", current);
		expect(doc.plan?.shapes[1]?.placement).toBeNull();
		expect(shapeOf(doc.plan, doc.shape)?.patternId).toBe("internal-note");
	});

	test("a placement full of things that are not part ids is read as left out", () => {
		const doc = reviveDoc("current", {
			...current,
			plan: {
				...current.plan,
				shapes: [{ patternId: "essay", because: "", placement: [3, {}, "claim"] }],
			},
		});
		expect(doc.plan?.shapes[0]?.placement).toEqual([null, null, "claim"]);
	});
});

describe("junk in the store", () => {
	test("nothing at all is an empty document, not a crash", () => {
		expect(reviveDoc("current", null).notes).toBe("");
	});

	test("a plan with no shapes is no plan", () => {
		expect(
			reviveDoc("current", { notes: NOTES, plan: { basis: NOTES, shapes: [] } }).plan,
		).toBeNull();
	});

	test("a reach nobody recognises falls back to leaving the text alone", () => {
		expect(reviveDoc("current", { notes: NOTES, reach: 9 }).reach).toBe(0);
	});
});
