import { describe, expect, test } from "bun:test";
import type { Pattern } from "../pattern";
import { build, fits, share, stale, toMarkdown } from "../plan";
import type { Plan } from "../types";

const NOTES = `The cache was doing exactly what we asked it to do.

p99 went from 180ms to 410ms in the week after we shipped it.

Nobody experiences the average.`;

const kind: Pattern = {
	id: "post-mortem",
	group: "reporting",
	does: "what happened, what it cost",
	cues: [],
	signals: [],
	brief: { en: "", fr: "" },
	parts: [
		{ id: "observed", does: "", required: true, many: false, asks: { en: "seen?", fr: "vu ?" } },
		{ id: "cost", does: "", required: true, many: false, asks: { en: "cost?", fr: "coût ?" } },
		{ id: "cause", does: "", required: true, many: true, asks: { en: "why?", fr: "pourquoi ?" } },
	],
};

const plan: Plan = {
	basis: NOTES,
	// the numbers were seen first, the cache is the cause, the average is left out
	shapes: [{ patternId: "post-mortem", because: "an incident with a number", placement: null }],
	format: { 1: "**p99 went from 180ms to 410ms** in the week after we shipped it." },
	short: {},
};

const organised = (placement: (string | null)[]): Plan => ({
	...plan,
	shapes: [{ ...(plan.shapes[0] as (typeof plan.shapes)[0]), placement }],
});

const at = (reach: 0 | 1 | 2 | 3, p: Plan = plan) =>
	build(NOTES, p, { reach, pattern: kind, lang: "en" });

describe("reach", () => {
	test("at zero the article is your text in your order, plan or no plan", () => {
		const { runs, arranged } = at(0, organised(["cause", "observed", null]));
		expect(runs.map((r) => r.kind)).toEqual(["kept", "kept", "kept"]);
		expect(runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
		expect(arranged).toBe(false);
	});

	test("at one the wording may change but the order is still yours", () => {
		const { runs } = at(1, organised(["cause", "observed", null]));
		expect(runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
		expect(runs[1]?.md).toContain("**p99");
	});

	test("at two the order is the pattern's and what it drops is named", () => {
		const { runs, dropped, gaps } = at(2, organised(["cause", "observed", null]));
		expect(runs.map((r) => r.fromIndex)).toEqual([1, 0]);
		expect(dropped.map((s) => s.index)).toEqual([2]);
		// the questions belong to reach three; two is an order, not a demand
		expect(gaps).toEqual([]);
	});

	test("at three the parts nothing was placed in come back as questions", () => {
		const { gaps } = at(3, organised(["cause", "observed", null]));
		expect(gaps).toEqual([{ part: "cost", kind: "missing", asks: "cost?", after: 1 }]);
	});

	test("the question is the file's, in the language asked for", () => {
		const built = build(NOTES, organised(["cause", "observed", null]), {
			reach: 3,
			pattern: kind,
			lang: "fr",
		});
		expect(built.gaps[0]?.asks).toBe("coût ?");
	});
});

describe("what the model cannot do to your article", () => {
	test("a card that has not been organised is your own order, not an empty page", () => {
		const { runs, arranged } = at(3);
		expect(runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
		expect(arranged).toBe(false);
	});

	test("a placement for another kind is ignored rather than half applied", () => {
		const other = { ...kind, id: "essay" };
		const built = build(NOTES, organised(["cause", "observed", null]), {
			reach: 2,
			pattern: other,
		});
		expect(built.runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
		expect(built.arranged).toBe(false);
	});

	test("every word in the article is a word from the notes", () => {
		const { runs } = at(2, organised(["cause", "observed", "cost"]));
		for (const run of runs) {
			const source = NOTES.slice(run.from?.start ?? 0, run.from?.end ?? 0);
			for (const word of run.md.replace(/[*`#]/g, "").split(/\s+/).filter(Boolean)) {
				expect(source).toContain(word);
			}
		}
	});
});

describe("a plan and the text under it", () => {
	test("a plan made for other notes does not apply to these", () => {
		expect(fits(NOTES, plan)).toBe(true);
		expect(fits(`${NOTES}\n\nA fourth section.`, plan)).toBe(false);
	});

	test("the same sections, edited, still fit — but they are stale", () => {
		const edited = NOTES.replace("410ms", "420ms");
		expect(fits(edited, plan)).toBe(true);
		expect(stale(edited, plan)).toBe(true);
		expect(stale(NOTES, plan)).toBe(false);
	});
});

describe("what comes out", () => {
	test("markdown is the runs, blank line between", () => {
		const { runs } = at(2, organised(["cause", "observed", null]));
		expect(toMarkdown(runs).split("\n\n")).toHaveLength(2);
	});

	test("share is counted in words and only ever splits two ways", () => {
		const { runs } = at(1, organised(["cause", "observed", null]));
		const said = share(runs);
		expect(said.yours + said.reworded).toBe(100);
	});
});
