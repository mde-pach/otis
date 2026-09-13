import { describe, expect, test } from "bun:test";
import { blockOf, escapeHtml, inline, stripMarker } from "../markdown";

describe("blocks", () => {
	test("a run knows what kind of block it is", () => {
		expect(blockOf("## Where it went wrong")).toBe("h2");
		expect(blockOf("### smaller")).toBe("h3");
		expect(blockOf("- an item")).toBe("li");
		expect(blockOf("```ts\ncode\n```")).toBe("code");
		expect(blockOf("ordinary prose")).toBe("p");
	});

	test("the marker is removed for rendering but not from the source", () => {
		expect(stripMarker("## Where it went wrong")).toBe("Where it went wrong");
		expect(stripMarker("- an item")).toBe("an item");
	});
});

describe("inline", () => {
	test("bold, italic and code render", () => {
		expect(inline("**p99** and *p50* and `redis.get()`")).toBe(
			"<strong>p99</strong> and <em>p50</em> and <code>redis.get()</code>",
		);
	});

	test("nothing authored can inject markup", () => {
		expect(escapeHtml('<img src=x onerror="alert(1)">')).not.toContain("<img");
		expect(inline("<script>alert(1)</script>")).not.toContain("<script>");
	});

	test("a link keeps its text and carries noopener", () => {
		expect(inline("[the fix](https://example.com)")).toBe(
			'<a href="https://example.com" rel="noopener">the fix</a>',
		);
	});
});
