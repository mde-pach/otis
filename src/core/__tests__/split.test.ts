import { describe, expect, test } from "bun:test";
import { splitDocument, splitSentences } from "../split";

describe("splitDocument", () => {
	test("splits on blank lines and trims", () => {
		expect(splitDocument("one\n\ntwo\n\n\n  three  ")).toEqual(["one", "two", "three"]);
	});

	test("keeps a fenced code block whole, blank lines included", () => {
		const doc = "before\n\n```ts\nconst a = 1;\n\nconst b = 2;\n```\n\nafter";
		expect(splitDocument(doc)).toEqual([
			"before",
			"```ts\nconst a = 1;\n\nconst b = 2;\n```",
			"after",
		]);
	});

	test("a heading is its own fragment", () => {
		expect(splitDocument("## Why it broke\nbecause of the cache")).toEqual([
			"## Why it broke",
			"because of the cache",
		]);
	});

	test("keeps consecutive lines of one paragraph together", () => {
		expect(splitDocument("a line\nanother line")).toEqual(["a line\nanother line"]);
	});

	test("empty input yields nothing", () => {
		expect(splitDocument("\n\n  \n")).toEqual([]);
	});
});

describe("splitSentences", () => {
	test("splits a paragraph into sentences", () => {
		expect(splitSentences("The cache was fine. The stampede was not.")).toEqual([
			"The cache was fine.",
			"The stampede was not.",
		]);
	});
});
