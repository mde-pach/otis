import { describe, expect, test } from "bun:test";
import { arrange, check, gaps, type Pattern, read, say } from "../pattern";

const kind: Pattern = {
	id: "essay",
	group: "arguing",
	does: "works one claim from doubt to conviction",
	cues: [],
	signals: [],
	brief: { en: "", fr: "" },
	parts: [
		{
			id: "ground",
			does: "",
			required: true,
			many: false,
			asks: { en: "what is the situation?", fr: "quelle situation ?" },
		},
		{
			id: "claim",
			does: "",
			required: true,
			many: false,
			asks: { en: "what do you claim?", fr: "qu'affirmes-tu ?" },
		},
		{
			id: "reason",
			does: "",
			required: true,
			many: true,
			asks: { en: "why believe it?", fr: "pourquoi le croire ?" },
		},
		{
			id: "doubt",
			does: "",
			required: true,
			many: false,
			asks: { en: "what would an opponent say?", fr: "que dirait un opposant ?" },
		},
		{
			id: "aside",
			does: "",
			required: false,
			many: false,
			asks: { en: "nothing required", fr: "rien d'obligatoire" },
		},
	],
};

describe("check", () => {
	test("a well formed answer has nothing wrong with it", () => {
		const said = { 0: "ground", 1: "claim", 2: "reason", 3: null };
		expect(check(said, kind, 4)).toEqual([]);
	});

	test("a section the model did not answer for is a violation, not a silent drop", () => {
		const said = { 0: "ground", 2: "reason" };
		expect(check(said, kind, 3)).toEqual([{ kind: "missing", index: 1 }]);
	});

	test("a part that is not in the file cannot be invented", () => {
		const said = { 0: "prologue" };
		expect(check(said, kind, 1)).toEqual([{ kind: "unknown", index: 0, said: "prologue" }]);
	});

	test("a single part cannot swallow two of the writer's sections", () => {
		const said = { 0: "claim", 1: "claim" };
		expect(check(said, kind, 2)).toEqual([{ kind: "crowded", part: "claim", indices: [0, 1] }]);
	});

	test("a repeatable part can hold as many as it likes", () => {
		expect(check({ 0: "reason", 1: "reason", 2: "reason" }, kind, 3)).toEqual([]);
	});

	test("null is an answer: left out on purpose", () => {
		expect(check({ 0: "claim", 1: null }, kind, 2)).toEqual([]);
	});

	test("violations say what went wrong in words the model can act on", () => {
		expect(say({ kind: "missing", index: 4 })).toContain("4");
		expect(say({ kind: "unknown", index: 1, said: "x" })).toContain("not a part");
		expect(say({ kind: "crowded", part: "claim", indices: [0, 1] })).toContain("one section");
	});
});

describe("arrange", () => {
	test("the order is the pattern's, not the answer's", () => {
		// the model answered in the writer's order; the claim still comes second
		const placement = read({ 0: "reason", 1: "claim", 2: "ground" }, kind, 3);
		expect(arrange(placement, kind).order).toEqual([2, 1, 0]);
	});

	test("inside one part, the writer's own order survives", () => {
		const placement = read({ 0: "reason", 1: "reason", 2: "claim" }, kind, 3);
		expect(arrange(placement, kind).order).toEqual([2, 0, 1]);
	});

	test("the same placement is the same article, every time", () => {
		const placement = read({ 0: "reason", 1: "ground", 2: "doubt", 3: "claim" }, kind, 4);
		const once = arrange(placement, kind).order;
		for (let i = 0; i < 20; i++) expect(arrange(placement, kind).order).toEqual(once);
	});

	test("what it leaves out is named, not missing", () => {
		const placement = read({ 0: "claim", 1: null, 2: "reason" }, kind, 3);
		expect(arrange(placement, kind)).toEqual({ order: [0, 2], out: [1] });
	});

	test("an unknown part is read as left out rather than guessed at", () => {
		expect(read({ 0: "epilogue" }, kind, 1)).toEqual([null]);
	});
});

describe("gaps", () => {
	test("a required part with nothing in it is a gap, with the file's own question", () => {
		const placement = read({ 0: "ground", 1: "claim", 2: "reason" }, kind, 3);
		expect(gaps(placement, kind, "fr")).toEqual([
			{ part: "doubt", kind: "missing", asks: "que dirait un opposant ?", after: 2 },
		]);
	});

	test("an optional part left empty is not a gap", () => {
		const placement = read({ 0: "ground", 1: "claim", 2: "reason", 3: "doubt" }, kind, 4);
		expect(gaps(placement, kind)).toEqual([]);
	});

	test("a gap before anything has nothing to sit after", () => {
		const placement = read({ 0: "claim", 1: "reason", 2: "doubt" }, kind, 3);
		expect(gaps(placement, kind, "fr")[0]).toEqual({
			part: "ground",
			kind: "missing",
			asks: "quelle situation ?",
			after: null,
		});
	});

	test("the question comes back in the language the writer is working in", () => {
		const placement = read({ 0: "ground", 1: "claim", 2: "reason" }, kind, 3);
		expect(gaps(placement, kind, "en")[0]?.asks).toBe("what would an opponent say?");
	});

	test("an empty document is all of the required parts and none of the optional", () => {
		expect(gaps([], kind).map((gap) => gap.part)).toEqual(["ground", "claim", "reason", "doubt"]);
	});
});

describe("a part that is filled but says nothing", () => {
	const owing: Pattern = {
		...kind,
		parts: [
			{
				id: "cost",
				does: "",
				required: true,
				many: false,
				wants: "specifics",
				asks: { en: "what did it cost?", fr: "combien ?" },
				thin: { en: "how much, in numbers?", fr: "combien, en chiffres ?" },
			},
			{ id: "cause", does: "", required: true, many: true, asks: { en: "why?", fr: "pourquoi ?" } },
		],
	};

	const texts = ["Roughly 9,000 requests a day took over a second.", "The TTL was too short."];
	const hollow = ["A number of users were affected and some complained.", "The TTL was too short."];

	test("a part carrying a figure is not a gap", () => {
		expect(gaps(["cost", "cause"], owing, "en", texts)).toEqual([]);
	});

	test("the same part carrying nothing is asked a different question", () => {
		expect(gaps(["cost", "cause"], owing, "en", hollow)).toEqual([
			{ part: "cost", kind: "thin", asks: "how much, in numbers?", after: 0 },
		]);
	});

	test("and it is a different kind of gap from a part nobody filled", () => {
		const [said] = gaps([null, "cause"], owing, "en", hollow);
		expect(said?.kind).toBe("missing");
		expect(said?.asks).toBe("what did it cost?");
	});

	test("a part that does not declare wants is never checked for it", () => {
		expect(gaps(["cost", "cause"], owing, "en", ["9 requests", "vague"])).toEqual([]);
	});

	test("without the writer's text there is nothing to check, and it stays quiet", () => {
		expect(gaps(["cost", "cause"], owing, "en")).toEqual([]);
	});
});
