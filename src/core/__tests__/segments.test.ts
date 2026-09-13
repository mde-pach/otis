import { describe, expect, test } from "bun:test";
import { segment, segmentAt } from "../segments";

describe("segment", () => {
	test("a single line stays a single segment", () => {
		const notes = "One line, and that is the whole document.";
		const out = segment(notes);
		expect(out).toHaveLength(1);
		expect(out[0]?.text).toBe(notes);
		expect(out[0]?.start).toBe(0);
		expect(out[0]?.end).toBe(notes.length);
	});

	test("offsets point back into the original string, never a copy", () => {
		const notes = "first\n\nsecond\n\nthird";
		for (const s of segment(notes)) {
			expect(notes.slice(s.start, s.end)).toBe(s.text);
		}
	});

	test("blank lines are the only boundary", () => {
		const notes = "a line\nand its continuation\n\nsomething else";
		const out = segment(notes);
		expect(out).toHaveLength(2);
		expect(out[0]?.text).toBe("a line\nand its continuation");
	});

	test("trailing and leading whitespace is outside the range", () => {
		const notes = "   padded   \n\n  another  ";
		const out = segment(notes);
		expect(out[0]?.text).toBe("padded");
		expect(notes.slice(out[0]?.start, out[0]?.end)).toBe("padded");
	});

	test("empty notes produce nothing", () => {
		expect(segment("")).toHaveLength(0);
		expect(segment("\n\n  \n\n")).toHaveLength(0);
	});

	test("a caret offset resolves to the segment it sits in", () => {
		const notes = "first\n\nsecond";
		const all = segment(notes);
		expect(segmentAt(all, 2)?.text).toBe("first");
		expect(segmentAt(all, 9)?.text).toBe("second");
		expect(segmentAt(all, 6)).toBeNull();
	});
});

describe("code", () => {
	const fenced = [
		"Here is what we shipped first.",
		"",
		"```ts",
		"const cached = await redis.get(key);",
		"",
		"const fresh = await db.query(HOT_QUERY);",
		"```",
		"",
		"And that was the mistake.",
	].join("\n");

	test("a blank line inside a fence does not split the block", () => {
		const out = segment(fenced);
		expect(out).toHaveLength(3);
		expect(out[1]?.text.startsWith("```ts")).toBe(true);
		expect(out[1]?.text.endsWith("```")).toBe(true);
		expect(out[1]?.text).toContain("HOT_QUERY");
	});

	test("the fence still points back into the original string", () => {
		const block = segment(fenced)[1] as { text: string; start: number; end: number };
		expect(fenced.slice(block.start, block.end)).toBe(block.text);
	});

	test("an unclosed fence runs to the end rather than swallowing nothing", () => {
		const out = segment("intro\n\n```ts\nconst a = 1;\n\nconst b = 2;");
		expect(out).toHaveLength(2);
		expect(out[1]?.text).toContain("const b = 2;");
	});
});
