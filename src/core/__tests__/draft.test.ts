import { describe, expect, test } from "bun:test";
import {
	draftOrder,
	editBlock,
	exportMarkdown,
	exportProvenance,
	moveBlock,
	placeFragment,
	removeBlock,
	revertBlock,
	writeInDraft,
} from "../draft";
import { importDocument, orphanFragments } from "../project";
import { deriveState } from "../provenance";
import { emptyProject, type Project } from "../types";

const seed = (): Project => {
	const { project } = importDocument(
		{ ...emptyProject("p", "Why our p99 got worse"), skeletonId: "problem-solution" },
		"The cache was doing what we asked.\n\np99 went from 180ms to 410ms.\n\nThe fix was single-flight.",
	);
	return project;
};

describe("placing fragments", () => {
	test("a placed fragment arrives verbatim", () => {
		const project = placeFragment(seed(), "f01", "hook");
		const block = project.blocks[0];
		const fragment = project.fragments[0];
		expect(block?.text).toBe(fragment?.text as string);
		expect(deriveState(block!, fragment!)).toBe("verbatim");
	});

	test("the same fragment cannot be placed twice", () => {
		const once = placeFragment(seed(), "f01", "hook");
		expect(placeFragment(once, "f01", "symptom").blocks).toHaveLength(1);
	});

	test("placing removes it from the unused list", () => {
		const project = placeFragment(seed(), "f02", "symptom");
		expect(orphanFragments(project).map((f) => f.id)).toEqual(["f01", "f03"]);
	});

	test("removing a block returns the fragment to unused rather than deleting it", () => {
		const placed = placeFragment(seed(), "f02", "symptom");
		const removed = removeBlock(placed, placed.blocks[0]?.id as string);
		expect(removed.fragments).toHaveLength(3);
		expect(orphanFragments(removed).map((f) => f.id)).toContain("f02");
	});
});

describe("writing in the draft", () => {
	test("text typed in the draft becomes a fragment, so nothing is unlabelled", () => {
		const project = writeInDraft(seed(), "close", "What I would tell myself.");
		expect(project.fragments).toHaveLength(4);
		const fragment = project.fragments[3];
		expect(fragment?.origin).toBe("written-in-draft");
		expect(deriveState(project.blocks[0]!, fragment!)).toBe("written-here");
	});

	test("empty text is not captured", () => {
		expect(writeInDraft(seed(), "close", "   ").blocks).toHaveLength(0);
	});
});

describe("editing", () => {
	test("an edit shows as edited and reverting returns it to verbatim", () => {
		const placed = placeFragment(seed(), "f01", "hook");
		const id = placed.blocks[0]?.id as string;
		const edited = editBlock(
			placed,
			id,
			"The cache did exactly what we asked, which was the problem.",
		);
		expect(deriveState(edited.blocks[0]!, edited.fragments[0]!)).toBe("edited");
		const reverted = revertBlock(edited, id);
		expect(deriveState(reverted.blocks[0]!, reverted.fragments[0]!)).toBe("verbatim");
	});
});

describe("ordering and export", () => {
	const built = () => {
		let project = seed();
		project = placeFragment(project, "f01", "hook");
		project = placeFragment(project, "f02", "symptom");
		project = placeFragment(project, "f03", "fix");
		return project;
	};

	test("draft order follows the skeleton's slots", () => {
		const sections = draftOrder(built()).filter((s) => s.blocks.length > 0);
		expect(sections.map((s) => s.slotId)).toEqual(["hook", "symptom", "fix"]);
	});

	test("blocks move within their slot", () => {
		let project = built();
		project = placeFragment(writeInDraft(project, "hook", "A second hook line."), "f01", "hook");
		const hook = project.blocks.filter((b) => b.slot === "hook");
		const moved = moveBlock(project, hook[1]?.id as string, -1);
		const order = moved.blocks
			.filter((b) => b.slot === "hook")
			.sort((a, b) => a.order - b.order)
			.map((b) => b.id);
		expect(order[0]).toBe(hook[1]?.id as string);
	});

	test("markdown contains only the writer's text, in order", () => {
		const md = exportMarkdown(built());
		expect(md).toContain("# Why our p99 got worse");
		expect(md.indexOf("180ms")).toBeGreaterThan(md.indexOf("what we asked"));
		expect(md).not.toContain("hook");
	});

	test("the provenance sidecar accounts for every block", () => {
		const report = exportProvenance(built());
		expect(report).toContain("3 blocks");
		expect(report).toContain("100% of the blocks contain no text a model proposed");
		expect(report.match(/\| b\d+ \|/g)).toHaveLength(3);
	});
});
