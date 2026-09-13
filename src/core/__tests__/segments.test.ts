import { describe, expect, test } from "bun:test";
import { segment, segmentAt } from "../segments";

describe("a wall of text is the ordinary case", () => {
	const line =
		"The cache was doing exactly what we asked it to do. p99 went from 180ms to 410ms in the week after we shipped it. Nobody experiences the average.";

	test("one long line is not one segment", () => {
		const out = segment(line);
		expect(out).toHaveLength(3);
		expect(out[0]?.text).toBe("The cache was doing exactly what we asked it to do.");
		expect(out[2]?.text).toBe("Nobody experiences the average.");
	});

	test("they all came from the same paragraph, and say so", () => {
		expect(segment(line).map((s) => s.block)).toEqual([0, 0, 0]);
	});

	test("offsets still point back into the original string, never a copy", () => {
		for (const s of segment(line)) expect(line.slice(s.start, s.end)).toBe(s.text);
	});

	test("a document that really is one sentence stays one segment", () => {
		const notes = "One line, and that is the whole document.";
		const out = segment(notes);
		expect(out).toHaveLength(1);
		expect(out[0]?.text).toBe(notes);
		expect(out[0]?.end).toBe(notes.length);
	});

	test("a line the writer never punctuated is left alone", () => {
		expect(segment("cache ttl 60s and nobody wrote it down")).toHaveLength(1);
	});
});

describe("what is not the end of a sentence", () => {
	const stays = (notes: string) => expect(segment(notes)).toHaveLength(1);

	test("a decimal", () => stays("p99 sat at 410.5ms for four days."));
	test("a version", () => stays("We were on redis 7.2.4 the whole time."));
	test("a method call", () => stays("It calls redis.get(key) and gives up."));
	test("code spans", () => stays("The call is `await redis.get(key)` and nothing else."));
	test("an abbreviation", () => stays("Cheap reads, e.g. the ones already warm, were fine."));
	test("an initial", () => stays("J. Smith shipped it on a Friday."));

	test("an ellipsis ends one sentence, not three", () => {
		const out = segment("We thought it was Redis... It was not.");
		expect(out).toHaveLength(2);
		expect(out[0]?.text).toBe("We thought it was Redis...");
		expect(out[1]?.text).toBe("It was not.");
	});
});

describe("lines the writer already made units of", () => {
	test("bullets are separate even with no blank line between them", () => {
		const out = segment("- ttl was 60s\n- redis was healthy\n- p99 went to 410ms");
		expect(out).toHaveLength(3);
		expect(out[1]?.text).toBe("- redis was healthy");
	});

	test("a bullet is not cut up by its own full stops", () => {
		expect(segment("- ttl was 60s. Nobody wrote it down.")).toHaveLength(1);
	});

	test("a heading stands alone", () => {
		const out = segment("## What happened\nThe cache expired. Everything missed at once.");
		expect(out.map((s) => s.text)).toEqual([
			"## What happened",
			"The cache expired.",
			"Everything missed at once.",
		]);
	});
});

describe("blocks", () => {
	test("blank lines still separate paragraphs", () => {
		const notes = "first thing\n\nsecond thing";
		expect(segment(notes).map((s) => s.block)).toEqual([0, 1]);
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

	test("a caret offset resolves to the piece it sits in", () => {
		const notes = "First one. Second one.";
		const all = segment(notes);
		expect(segmentAt(all, 2)?.text).toBe("First one.");
		expect(segmentAt(all, 14)?.text).toBe("Second one.");
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

	test("a fence is one piece, blank lines and full stops and all", () => {
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

describe("units are not abbreviations", () => {
	test("a stop after a unit ends the sentence", () => {
		const out = segment("p50 barely moved, 42ms to 39ms. Nobody experiences the average.");
		expect(out).toHaveLength(2);
		expect(out[1]?.text).toBe("Nobody experiences the average.");
	});

	test("the same letters capitalised are a person", () => {
		expect(segment("Ms. Patel found it on the fourth day.")).toHaveLength(1);
	});

	test("seconds and minutes are units too", () => {
		expect(segment("It held for 90 sec. Then it fell over.")).toHaveLength(2);
	});
});
