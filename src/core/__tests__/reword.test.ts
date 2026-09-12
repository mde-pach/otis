import { describe, expect, test } from "bun:test";
import { placeFragment } from "../draft";
import { importDocument } from "../project";
import { deriveState } from "../provenance";
import {
	acceptReword,
	checkFaithfulness,
	pendingRewords,
	proposeReword,
	rejectReword,
} from "../reword";
import { emptyProject } from "../types";

const seed = () => {
	const { project } = importDocument(
		emptyProject("p", "t"),
		"p99 went from 180ms to 410ms in the week after rollout.",
	);
	return placeFragment(project, "f01", "symptom");
};

describe("checkFaithfulness", () => {
	test("passes a genuine reword", () => {
		const check = checkFaithfulness(
			"p99 went from 180ms to 410ms in the week after rollout.",
			"In the week after rollout, p99 went from 180ms to 410ms.",
		);
		expect(check.passed).toBe(true);
	});

	test("blocks a reword that invents a number", () => {
		const check = checkFaithfulness(
			"p99 went from 180ms to 410ms in the week after rollout.",
			"p99 went from 180ms to 410ms in the week after rollout, a 128% regression.",
		);
		expect(check.passed).toBe(false);
		expect(check.addedFacts).toContain("128%");
	});

	test("blocks a rewrite dressed as a reword", () => {
		const check = checkFaithfulness(
			"p99 went from 180ms to 410ms in the week after rollout.",
			"Latency regressed sharply once the change shipped everywhere.",
		);
		expect(check.passed).toBe(false);
		expect(check.reason).toContain("rewriting");
	});

	test("blocks a no-op", () => {
		const text = "p99 went from 180ms to 410ms in the week after rollout.";
		expect(checkFaithfulness(text, text).passed).toBe(false);
	});
});

describe("proposeReword", () => {
	test("a failing suggestion never becomes a pending reword", () => {
		const { project, rejected } = proposeReword(
			seed(),
			"b01",
			"p99 doubled, costing us 12 customers.",
		);
		expect(rejected?.passed).toBe(false);
		expect(project.rewords).toHaveLength(0);
	});

	test("a passing suggestion waits, and does not touch the draft", () => {
		const { project } = proposeReword(
			seed(),
			"b01",
			"In the week after rollout, p99 went from 180ms to 410ms.",
		);
		expect(pendingRewords(project)).toHaveLength(1);
		expect(project.blocks[0]?.text).toBe(seed().blocks[0]?.text as string);
	});

	test("accepting applies it and marks the block", () => {
		const { project } = proposeReword(
			seed(),
			"b01",
			"In the week after rollout, p99 went from 180ms to 410ms.",
		);
		const accepted = acceptReword(project, "r01");
		expect(accepted.blocks[0]?.text).toContain("In the week after rollout");
		expect(deriveState(accepted.blocks[0]!, accepted.fragments[0]!)).toBe("reword-accepted");
	});

	test("rejecting leaves the draft untouched", () => {
		const { project } = proposeReword(
			seed(),
			"b01",
			"In the week after rollout, p99 went from 180ms to 410ms.",
		);
		const rejected = rejectReword(project, "r01");
		expect(rejected.blocks[0]?.text).toBe(seed().blocks[0]?.text as string);
		expect(pendingRewords(rejected)).toHaveLength(0);
	});
});
