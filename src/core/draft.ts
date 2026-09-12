/**
 * The draft: blocks in slots, and what comes out at the end.
 *
 * Every operation here is a pure function from Project to Project. Nothing is
 * ever deleted — removing a block returns its fragment to the unused pile,
 * which is a state, not a bin.
 */

import { fragmentsById } from "./project";
import { deriveState, summarise } from "./provenance";
import { skeletonById } from "./skeletons";
import type { Block, Fragment, Project } from "./types";

function nextBlockId(project: Project): string {
	let max = 0;
	for (const b of project.blocks) {
		const n = Number.parseInt(b.id.replace(/\D/g, ""), 10);
		if (Number.isFinite(n) && n > max) max = n;
	}
	return `b${String(max + 1).padStart(2, "0")}`;
}

function nextFragmentId(project: Project): string {
	let max = 0;
	for (const f of project.fragments) {
		const n = Number.parseInt(f.id.replace(/\D/g, ""), 10);
		if (Number.isFinite(n) && n > max) max = n;
	}
	return `f${String(max + 1).padStart(2, "0")}`;
}

function nextOrder(project: Project, slot: string | null): number {
	const inSlot = project.blocks.filter((b) => b.slot === slot);
	return inSlot.length === 0 ? 0 : Math.max(...inSlot.map((b) => b.order)) + 1;
}

/** Put an existing fragment into the draft, verbatim. The only way text enters. */
export function placeFragment(project: Project, fragmentId: string, slot: string): Project {
	const fragment = project.fragments.find((f) => f.id === fragmentId);
	if (!fragment) return project;
	if (project.blocks.some((b) => b.fragmentId === fragmentId)) return project;

	const block: Block = {
		id: nextBlockId(project),
		fragmentId,
		text: fragment.text,
		slot,
		order: nextOrder(project, slot),
	};
	return { ...project, blocks: [...project.blocks, block], updatedAt: Date.now() };
}

/**
 * Text typed straight into the draft is captured as a fragment too, so that no
 * sentence in the article is without an origin.
 */
export function writeInDraft(
	project: Project,
	slot: string,
	text: string,
	now = Date.now(),
): Project {
	const trimmed = text.trim();
	if (trimmed.length === 0) return project;

	const fragment: Fragment = {
		id: nextFragmentId(project),
		text: trimmed,
		origin: "written-in-draft",
		createdAt: now,
	};
	const withFragment = { ...project, fragments: [...project.fragments, fragment] };
	const block: Block = {
		id: nextBlockId(withFragment),
		fragmentId: fragment.id,
		text: trimmed,
		slot,
		order: nextOrder(withFragment, slot),
	};
	return { ...withFragment, blocks: [...withFragment.blocks, block], updatedAt: now };
}

export function editBlock(project: Project, blockId: string, text: string): Project {
	return {
		...project,
		blocks: project.blocks.map((b) => (b.id === blockId ? { ...b, text } : b)),
		updatedAt: Date.now(),
	};
}

/** Back to verbatim. Always available, because an edit is never irreversible. */
export function revertBlock(project: Project, blockId: string): Project {
	const fragments = fragmentsById(project);
	return {
		...project,
		blocks: project.blocks.map((b) => {
			if (b.id !== blockId) return b;
			const fragment = fragments.get(b.fragmentId);
			if (!fragment) return b;
			const { acceptedRewordText, ...rest } = b;
			return { ...rest, text: fragment.text };
		}),
		updatedAt: Date.now(),
	};
}

/** Removes the block. The fragment goes back to being unused, not deleted. */
export function removeBlock(project: Project, blockId: string): Project {
	return {
		...project,
		blocks: project.blocks.filter((b) => b.id !== blockId),
		rewords: project.rewords.filter((r) => r.blockId !== blockId || r.status !== "pending"),
		updatedAt: Date.now(),
	};
}

export function moveBlock(project: Project, blockId: string, direction: -1 | 1): Project {
	const block = project.blocks.find((b) => b.id === blockId);
	if (!block) return project;
	const siblings = project.blocks
		.filter((b) => b.slot === block.slot)
		.sort((a, b) => a.order - b.order);
	const index = siblings.findIndex((b) => b.id === blockId);
	const target = siblings[index + direction];
	if (!target) return project;

	return {
		...project,
		blocks: project.blocks.map((b) => {
			if (b.id === block.id) return { ...b, order: target.order };
			if (b.id === target.id) return { ...b, order: block.order };
			return b;
		}),
		updatedAt: Date.now(),
	};
}

export function moveBlockToSlot(project: Project, blockId: string, slot: string): Project {
	return {
		...project,
		blocks: project.blocks.map((b) =>
			b.id === blockId ? { ...b, slot, order: nextOrder(project, slot) } : b,
		),
		updatedAt: Date.now(),
	};
}

/** Blocks in reading order: slot order from the skeleton, then order within a slot. */
export function draftOrder(
	project: Project,
): { slotId: string; slotName: string; blocks: Block[] }[] {
	const skeleton = skeletonById(project.skeletonId);
	const slots = skeleton ? skeleton.slots : [{ id: "body", name: "Body", hint: "" }];
	return slots.map((slot) => ({
		slotId: slot.id,
		slotName: slot.name,
		blocks: project.blocks.filter((b) => b.slot === slot.id).sort((a, b) => a.order - b.order),
	}));
}

export function blocksInSlot(project: Project, slotId: string): Block[] {
	return project.blocks.filter((b) => b.slot === slotId).sort((a, b) => a.order - b.order);
}

export interface ExportOptions {
	/** Slot names as headings. Off by default: a skeleton is scaffolding, not structure. */
	slotHeadings?: boolean;
}

export function exportMarkdown(project: Project, options: ExportOptions = {}): string {
	const parts: string[] = [`# ${project.title}`];
	for (const section of draftOrder(project)) {
		if (section.blocks.length === 0) continue;
		if (options.slotHeadings) parts.push(`## ${section.slotName}`);
		for (const block of section.blocks) parts.push(block.text);
	}
	return `${parts.join("\n\n")}\n`;
}

/**
 * The sidecar: who wrote what, per block and in total. Published beside the
 * article so the claim "these are my words" is checkable rather than asserted.
 */
export function exportProvenance(project: Project): string {
	const fragments = fragmentsById(project);
	const summary = summarise(project.blocks, fragments);
	const lines = [
		`# Provenance — ${project.title}`,
		"",
		`${summary.blocks} blocks · ${summary.verbatim} verbatim · ${summary.edited} edited by the writer · ${summary.rewordAccepted} reworded and accepted · ${summary.writtenHere} written in the draft`,
		"",
		`${Math.round(summary.untouchedByModel * 100)}% of the blocks contain no text a model proposed.`,
		"",
		"| block | fragment | state | text |",
		"|---|---|---|---|",
	];
	for (const section of draftOrder(project)) {
		for (const block of section.blocks) {
			const fragment = fragments.get(block.fragmentId);
			const state = fragment ? deriveState(block, fragment) : "unknown";
			const text = block.text.replace(/\s+/g, " ").slice(0, 80);
			lines.push(`| ${block.id} | ${block.fragmentId} | ${state} | ${text} |`);
		}
	}
	return `${lines.join("\n")}\n`;
}
