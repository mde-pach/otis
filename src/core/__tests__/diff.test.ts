import { describe, expect, test } from "bun:test";
import { diffWords, retentionRatio } from "../diff";

describe("diffWords", () => {
	test("identical text is all kept", () => {
		expect(diffWords("a b c", "a b c").every((o) => o.type === "keep")).toBe(true);
	});

	test("marks an insertion", () => {
		const ops = diffWords("the cache", "the warm cache");
		expect(ops.some((o) => o.type === "ins" && o.text.includes("warm"))).toBe(true);
	});

	test("marks a deletion", () => {
		const ops = diffWords("the warm cache", "the cache");
		expect(ops.some((o) => o.type === "del" && o.text.includes("warm"))).toBe(true);
	});

	test("reconstructs both sides", () => {
		const before = "every request had two ways to be slow";
		const after = "every request had two failure modes";
		const ops = diffWords(before, after);
		const left = ops
			.filter((o) => o.type !== "ins")
			.map((o) => o.text)
			.join("");
		const right = ops
			.filter((o) => o.type !== "del")
			.map((o) => o.text)
			.join("");
		expect(left).toBe(before);
		expect(right).toBe(after);
	});
});

describe("retentionRatio", () => {
	test("unchanged text retains everything", () => {
		expect(retentionRatio("a b c", "a b c")).toBe(1);
	});

	test("a rewrite that keeps nothing retains nothing", () => {
		expect(retentionRatio("alpha beta", "gamma delta")).toBe(0);
	});

	test("a partial rewrite lands in between", () => {
		const r = retentionRatio("the cache was cold", "the cache went cold");
		expect(r).toBeGreaterThan(0.5);
		expect(r).toBeLessThan(1);
	});
});
