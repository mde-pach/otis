import { describe, expect, test } from "bun:test";
import { checkFaithfulness, formattingOnly, plain } from "../reword";

const ORIGINAL =
	"p99 went from 180ms to 410ms in the week after we shipped the read-through cache.";

describe("the gate", () => {
	test("a shortening that keeps your words and adds no facts passes", () => {
		const check = checkFaithfulness(
			ORIGINAL,
			"p99 went 180ms to 410ms the week we shipped the read-through cache.",
		);
		expect(check.passed).toBe(true);
		expect(check.addedFacts).toHaveLength(0);
	});

	test("an invented measurement is caught, with the unit intact", () => {
		const check = checkFaithfulness(
			ORIGINAL,
			"p99 went from 180ms to 900ms in the week after we shipped it.",
		);
		expect(check.passed).toBe(false);
		expect(check.addedFacts).toContain("900ms");
		expect(check.reason).toContain("900ms");
	});

	test("an invented percentage is caught", () => {
		const check = checkFaithfulness(
			"Latency roughly doubled after the rollout.",
			"Latency rose 128% after the rollout.",
		);
		expect(check.passed).toBe(false);
		expect(check.addedFacts).toContain("128%");
	});

	test("a rewrite that keeps almost nothing is not a shortening", () => {
		const check = checkFaithfulness(ORIGINAL, "Things got slower.");
		expect(check.passed).toBe(false);
		expect(check.reason).toContain("rewriting");
	});

	test("a faithful reordering is not punished for moving words", () => {
		const check = checkFaithfulness(
			ORIGINAL,
			"In the week after we shipped the read-through cache, p99 went from 180ms to 410ms.",
		);
		expect(check.retention).toBeGreaterThan(0.9);
	});

	test("returning the sentence unchanged is not a shortening", () => {
		expect(checkFaithfulness(ORIGINAL, ORIGINAL).passed).toBe(false);
	});
});

describe("formatting is not rewriting", () => {
	test("markdown around the same words reads as formatting", () => {
		expect(
			formattingOnly(
				ORIGINAL,
				`**p99 went from 180ms to 410ms** in the week after we shipped the read-through cache.`,
			),
		).toBe(true);
	});

	test("a heading marker is formatting too", () => {
		expect(formattingOnly("Where it went wrong", "## Where it went wrong")).toBe(true);
	});

	test("one changed word is not formatting", () => {
		expect(
			formattingOnly(
				ORIGINAL,
				`**p99 rose from 180ms to 410ms** in the week after we shipped the read-through cache.`,
			),
		).toBe(false);
	});

	test("the gate compares plain text, so formatting alone never trips it", () => {
		const check = checkFaithfulness(ORIGINAL, `**${ORIGINAL}**`);
		expect(check.addedFacts).toHaveLength(0);
	});

	test("plain strips the marks and leaves the words", () => {
		expect(plain("## A `heading` with **bold**")).toBe("A heading with bold");
	});
});
