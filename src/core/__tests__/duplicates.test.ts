import { describe, expect, test } from "bun:test";
import { findDuplicates } from "../duplicates";

/** Real fragments from the cache-p99 fixture, with their real relationships. */
const f03 = "Nobody experiences the average.";
const f30 = "Nobody experiences the average. They experience the worst request they made today.";
const f04 = "We optimised for the average and forgot that nobody actually lives there.";
const f02 = "p99 went from 180ms to 410ms in the week after we shipped the read-through cache.";
const f18 =
	"Four hundred concurrent requests for the same key, every thirty seconds, like clockwork.";
const f01 = "The cache was doing exactly what we asked it to do, which was the problem.";
const f14 = "I still think adding the cache was the right call. The rollout was not.";

describe("findDuplicates", () => {
	test("catches one fragment swallowing another — the pair embeddings ranked below noise", () => {
		const pairs = findDuplicates([f03, f30]);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]?.kind).toBe("contains");
		expect(pairs[0]?.containment).toBe(1);
	});

	test("explains itself in words the writer can check", () => {
		const [pair] = findDuplicates([f03, f30]);
		expect(pair?.reason).toContain("#1");
		expect(pair?.reason).toContain("#2");
	});

	test("does not flag two different facts from the same incident", () => {
		expect(findDuplicates([f02, f18])).toEqual([]);
	});

	test("does not flag fragments that merely share a subject", () => {
		expect(findDuplicates([f01, f14])).toEqual([]);
	});

	test("leaves a fully reworded claim alone — that one needs a model, not word overlap", () => {
		expect(findDuplicates([f03, f04])).toEqual([]);
	});

	test("catches a lightly edited sentence through trigram overlap", () => {
		const a = "A miss under load costs more than having no cache at all.";
		const b = "A miss under load costs more than having no cache, at all, really.";
		const pairs = findDuplicates([a, b]);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]?.jaccard).toBeGreaterThan(0.4);
	});

	test("ignores fragments too short to match meaningfully", () => {
		expect(findDuplicates(["one two", "one two"])).toEqual([]);
	});

	test("strongest pair comes first", () => {
		const pairs = findDuplicates([f02, f03, f30, f18]);
		expect(pairs[0]?.kind).toBe("contains");
	});
});
