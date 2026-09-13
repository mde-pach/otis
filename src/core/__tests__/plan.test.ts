import { describe, expect, test } from "bun:test";
import { build, fits, read, settle, share, stale, toMarkdown } from "../plan";
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

describe("a document typed as one line", () => {
	const LINE =
		"The cache was doing exactly what we asked it to do. p99 went from 180ms to 410ms in the week after we shipped it. Nobody experiences the average.";

	const inOrder: Plan = {
		basis: LINE,
		at: [0, 1, 2],
		format: {},
		short: {},
		written: [],
		because: "left it alone",
	};

	test("its sentences are sections the plan can move", () => {
		const { runs } = build(LINE, inOrder, 2);
		expect(runs).toHaveLength(3);
		expect(runs.every((r) => r.kind === "kept")).toBe(true);
	});

	test("the article is those sections, in the plan's order, and nothing else", () => {
		const moved: Plan = { ...inOrder, at: [1, 2, 0] };
		const out = toMarkdown(build(LINE, moved, 2).runs);
		expect(out.startsWith("Nobody experiences the average.")).toBe(true);
		expect(out.split("\n\n")).toHaveLength(3);
	});
});

describe("the proposal, before any of it is true", () => {
	test("it reads as a list of things you can say no to", () => {
		const it = read(NOTES, { ...plan, short: { 0: "The cache did exactly what we asked." } });
		expect(it.moved).toBe(true);
		expect(it.order.map((o) => o.index)).toEqual([1, 2, 0]);
		expect(it.short.map((s) => s.index)).toEqual([0]);
		expect(it.written[0]?.because).toBe("no cost stated");
		expect(it.drop).toHaveLength(0);
	});

	test("a shortening that fails the gate is never offered", () => {
		const liar: Plan = { ...plan, short: { 1: "p99 went from 180ms to 900ms." } };
		expect(read(NOTES, liar).short).toHaveLength(0);
	});

	test("something it wants to leave out is listed as that", () => {
		const it = read(NOTES, { ...plan, at: [0, 1, null] });
		expect(it.drop.map((d) => d.text)).toEqual(["Nobody experiences the average."]);
	});
});

describe("refusing part of a proposal", () => {
	const tighter: Plan = { ...plan, short: { 0: "The cache did exactly what we asked." } };

	test("refusing the order keeps the shortening and the draft", () => {
		const settled = settle(NOTES, tighter, { m: true });
		expect(settled.at).toEqual([0, 1, 2]);
		expect(settled.short[0]).toBeDefined();
		expect(settled.written).toHaveLength(1);
	});

	test("refusing a shortening leaves your sentence standing", () => {
		const settled = settle(NOTES, tighter, { s0: true });
		const { runs } = build(NOTES, settled, 2);
		expect(runs.find((r) => r.fromIndex === 0)?.kind).toBe("kept");
		expect(runs.find((r) => r.fromIndex === 0)?.md).toBe(
			"The cache was doing exactly what we asked it to do.",
		);
	});

	test("refusing a draft means it is never written", () => {
		const settled = settle(NOTES, tighter, { w0: true });
		expect(build(NOTES, settled, 3).runs.some((r) => r.kind === "written")).toBe(false);
	});

	test("refusing a drop puts the section back in the article", () => {
		const cut: Plan = { ...plan, at: [0, 1, null] };
		expect(build(NOTES, cut, 2).dropped).toHaveLength(1);
		const settled = settle(NOTES, cut, { d2: true });
		const { runs, dropped } = build(NOTES, settled, 2);
		expect(dropped).toHaveLength(0);
		expect(runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
	});

	test("refusing everything is your words, in your order — markdown is not a word", () => {
		const settled = settle(NOTES, tighter, { m: true, s0: true, w0: true });
		const { runs } = build(NOTES, settled, 3);
		expect(runs.every((r) => r.kind === "kept")).toBe(true);
		expect(runs.map((r) => r.fromIndex)).toEqual([0, 1, 2]);
		expect(runs[1]?.md).toContain("**p99");
	});
});
