import { describe, expect, test } from "bun:test";
import { segment, segmentAt } from "../segments";

describe("the writer's own boundaries", () => {
	const notes = `Responsabilité et LLM

Une des erreurs classiques est la responsabilité qu'on lui confère. On lui demande de respecter des règles. Il est aussi celui qui les applique.

Pour qu'une règle tienne il faut:

* indépendance
* automatisme ou contrôle
* obligatoire`;

	test("blank lines are the boundary when the document has them", () => {
		const out = segment(notes);
		expect(out[0]?.text).toBe("Responsabilité et LLM");
		expect(out[1]?.text.startsWith("Une des erreurs")).toBe(true);
		expect(out[1]?.text.endsWith("les applique.")).toBe(true);
	});

	test("a section that runs to three sentences is still one section", () => {
		expect(segment(notes).filter((s) => s.text.includes("erreurs"))).toHaveLength(1);
	});

	test("bullets are their own sections even with no blank line between them", () => {
		const bullets = segment(notes).filter((s) => s.text.startsWith("*"));
		expect(bullets.map((s) => s.text)).toEqual([
			"* indépendance",
			"* automatisme ou contrôle",
			"* obligatoire",
		]);
	});

	test("every section points back into the original string, never a copy", () => {
		for (const s of segment(notes)) expect(notes.slice(s.start, s.end)).toBe(s.text);
	});
});

describe("a document with no blank line", () => {
	test("its lines are its sections", () => {
		const out = segment("cache ttl 60s\nredis healthy the whole time\np99 410ms");
		expect(out.map((s) => s.text)).toEqual([
			"cache ttl 60s",
			"redis healthy the whole time",
			"p99 410ms",
		]);
	});
});

describe("a document typed as one line", () => {
	const line =
		"The cache was doing exactly what we asked it to do. p99 went from 180ms to 410ms in the week after we shipped it. Nobody experiences the average.";

	test("its sentences are its sections, because nothing else is", () => {
		const out = segment(line);
		expect(out).toHaveLength(3);
		expect(out[0]?.text).toBe("The cache was doing exactly what we asked it to do.");
		expect(out[2]?.text).toBe("Nobody experiences the average.");
	});

	test("one that really is one sentence stays one section", () => {
		const notes = "One line, and that is the whole document.";
		expect(segment(notes)).toHaveLength(1);
		expect(segment(notes)[0]?.text).toBe(notes);
	});

	test("one the writer never punctuated is left alone", () => {
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
	test("a unit is not an abbreviation", () => {
		const out = segment("p50 moved 42ms to 39ms. Nobody experiences the average.");
		expect(out).toHaveLength(2);
	});
	test("the same letters capitalised are a person", () => {
		stays("Ms. Patel found it on the fourth day.");
	});

	test("an ellipsis ends one sentence, not three", () => {
		const out = segment("We thought it was Redis... It was not.");
		expect(out.map((s) => s.text)).toEqual(["We thought it was Redis...", "It was not."]);
	});
});

describe("housekeeping", () => {
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

	test("a caret offset resolves to the section it sits in", () => {
		const notes = "First one.\n\nSecond one.";
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

	test("a fence is one section, blank lines and full stops and all", () => {
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
