import { describe, expect, test } from "bun:test";
import { build, fits, share, stale, toMarkdown } from "../plan";
import type { Plan } from "../types";

const NOTES = `The cache was doing exactly what we asked it to do.

p99 went from 180ms to 410ms in the week after we shipped it.

Nobody experiences the average.`;

const plan: Plan = {
	basis: NOTES,
	at: [2, 0, 1],
	format: { 1: "**p99 went from 180ms to 410ms** in the week after we shipped it." },
	short: {},
	written: [
		{
			after: 1,
			md: "It cost users half a second twice a day.",
			confidence: "low",
			because: "no cost stated",
		},
	],
	because: "led with the numbers",
};

describe("reach", () => {
	test("at zero the article is your text in your order, plan or no plan", () => {
		const { runs, dropped } = build(NOTES, plan, 0);
		expect(runs.map((r) => r.kind)).toEqual(["kept", "kept", "kept"]);
		expect(runs[0]?.md).toBe("The cache was doing exactly what we asked it to do.");
		expect(dropped).toHaveLength(0);
	});

	test("at one it keeps your order and writes nothing", () => {
		const { runs } = build(NOTES, plan, 1);
		expect(runs).toHaveLength(3);
		expect(runs.some((r) => r.kind === "written")).toBe(false);
		expect(runs[0]?.fromIndex).toBe(0);
	});

	test("at two it reorders but still writes nothing", () => {
		const { runs } = build(NOTES, plan, 2);
		expect(runs.map((r) => r.fromIndex)).toEqual([1, 2, 0]);
		expect(runs.some((r) => r.kind === "written")).toBe(false);
	});

	test("at three what it wrote lands after the segment it was anchored to", () => {
		const { runs } = build(NOTES, plan, 3);
		expect(runs.map((r) => r.kind)).toEqual(["kept", "written", "kept", "kept"]);
		expect(runs[1]?.from).toBeUndefined();
		expect(runs[1]?.confidence).toBe("low");
	});
});

describe("what counts as a change", () => {
	test("markdown added to your sentence leaves it yours", () => {
		const { runs } = build(NOTES, plan, 2);
		const formatted = runs.find((r) => r.fromIndex === 1);
		expect(formatted?.kind).toBe("kept");
		expect(formatted?.md).toContain("**");
	});

	test("a shortening that invents a number never reaches the article", () => {
		const liar: Plan = {
			...plan,
			short: { 1: "p99 went from 180ms to 900ms after we shipped it." },
		};
		const { runs } = build(NOTES, liar, 2);
		expect(runs.find((r) => r.fromIndex === 1)?.md).not.toContain("900ms");
		expect(runs.find((r) => r.fromIndex === 1)?.kind).toBe("kept");
	});

	test("an honest shortening is marked as reworded", () => {
		const tighter: Plan = { ...plan, short: { 0: "The cache did exactly what we asked." } };
		const { runs } = build(NOTES, tighter, 2);
		expect(runs.find((r) => r.fromIndex === 0)?.kind).toBe("reworded");
	});
});

describe("dropping", () => {
	test("a segment with no position is reported, not deleted", () => {
		const { runs, dropped } = build(NOTES, { ...plan, at: [0, 1, null] }, 2);
		expect(runs).toHaveLength(2);
		expect(dropped).toHaveLength(1);
		expect(dropped[0]?.text).toBe("Nobody experiences the average.");
	});
});

describe("share", () => {
	test("what the tool wrote is counted apart from your words", () => {
		const { runs } = build(NOTES, plan, 3);
		const split = share(runs);
		expect(split.written).toBeGreaterThan(0);
		expect(split.yours).toBeGreaterThan(split.written);
		expect(split.yours + split.reworded + split.written).toBeGreaterThan(98);
	});
});

describe("a plan belongs to the text it was made for", () => {
	const OTHER = `Redis was healthy the entire time.

When the key expired, every in-flight request missed at once.

A miss under load costs more than no cache at all.

The fix was single-flight.`;

	test("applied to a different document it is set aside, not partly applied", () => {
		const { runs, dropped } = build(OTHER, plan, 3);
		expect(fits(OTHER, plan)).toBe(false);
		// every segment arrives, and none of them vanish into "not used"
		expect(runs).toHaveLength(4);
		expect(dropped).toHaveLength(0);
		expect(runs.every((r) => r.kind === "kept")).toBe(true);
	});

	test("the article is then your text in your order, not a reordering of someone else's", () => {
		const { runs } = build(OTHER, plan, 3);
		expect(runs[0]?.md).toBe("Redis was healthy the entire time.");
		expect(runs.at(-1)?.md).toBe("The fix was single-flight.");
	});

	test("editing a word keeps the plan but marks it behind", () => {
		const edited = NOTES.replace("exactly", "precisely");
		expect(fits(edited, plan)).toBe(true);
		expect(stale(edited, plan)).toBe(true);
		expect(stale(NOTES, plan)).toBe(false);
	});
});

describe("run keys", () => {
	test("a run keeps its key across reach settings, so an edit survives the dial", () => {
		const two = build(NOTES, plan, 2).runs.find((r) => r.fromIndex === 0);
		const three = build(NOTES, plan, 3).runs.find((r) => r.fromIndex === 0);
		expect(two?.key).toBe("s0");
		expect(three?.key).toBe(two?.key);
		expect(two?.id).not.toBe(three?.id);
	});

	test("what the tool wrote is keyed by its position in the plan, not in the article", () => {
		const written = build(NOTES, plan, 3).runs.filter((r) => r.kind === "written");
		expect(written.map((r) => r.key)).toEqual(["w0"]);
	});
});

describe("toMarkdown", () => {
	test("the article is text you can paste anywhere", () => {
		const out = toMarkdown(build(NOTES, plan, 2).runs);
		expect(out.split("\n\n")).toHaveLength(3);
		expect(out).toContain("**p99");
	});
});
