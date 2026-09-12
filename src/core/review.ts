/**
 * Review rounds.
 *
 * A round is frozen when it is created. If the list silently recomputed while
 * the writer worked, there would be no way to tell progress from the model
 * changing its mind — so closing a round and running another is the only way
 * the list changes.
 *
 * Two sources, kept visibly apart: "measured" items are arithmetic over the
 * writer's own material and cost nothing; "judged" items came from a model and
 * only appear because the writer asked.
 */

import { findDuplicates } from "./duplicates";
import { orphanFragments, ungroupedFragments } from "./project";
import { skeletonById } from "./skeletons";
import type { Project, ReviewItem, ReviewRound } from "./types";

export interface JudgedItem {
	kind: "missing-evidence" | "missing-step" | "unsupported-claim" | "digression";
	question: string;
	blockId?: string;
	fragmentIds?: string[];
}

/** Everything that can be known without a model. */
export function measuredItems(project: Project): Omit<ReviewItem, "id" | "status">[] {
	const items: Omit<ReviewItem, "id" | "status">[] = [];

	const skeleton = skeletonById(project.skeletonId);
	if (skeleton) {
		for (const slot of skeleton.slots) {
			if (!project.blocks.some((b) => b.slot === slot.id)) {
				items.push({
					kind: "empty-slot",
					question: `"${slot.name}" is empty — ${slot.hint}. What goes there, or should the skeleton change?`,
					slotId: slot.id,
					source: "measured",
				});
			}
		}
	}

	const orphans = orphanFragments(project).filter((f) => f.origin === "imported");
	if (orphans.length > 0) {
		items.push({
			kind: "orphan",
			question: `${orphans.length} fragments you wrote are not in the draft. Which of them does the article still need?`,
			fragmentIds: orphans.map((f) => f.id),
			source: "measured",
		});
	}

	const duplicates = findDuplicates(project.fragments.map((f) => f.text));
	for (const pair of duplicates) {
		const a = project.fragments[pair.a];
		const b = project.fragments[pair.b];
		if (!a || !b) continue;
		items.push({
			kind: "duplicate",
			question: `${a.id} and ${b.id} say the same thing — ${pair.reason}. Merge them, or make them different?`,
			fragmentIds: [a.id, b.id],
			source: "measured",
		});
	}

	const ungrouped = ungroupedFragments(project);
	if (ungrouped.length > 2) {
		items.push({
			kind: "ungrouped",
			question: `${ungrouped.length} fragments belong to no group. Is there a theme here you have not named?`,
			fragmentIds: ungrouped.map((f) => f.id),
			source: "measured",
		});
	}

	return items;
}

export function nextRoundIndex(project: Project): number {
	return project.rounds.length + 1;
}

/** Creates a frozen round. Judged items are validated by the caller before this. */
export function startRound(
	project: Project,
	judged: JudgedItem[] = [],
	rationale = "measured items only",
	now = Date.now(),
): Project {
	const index = nextRoundIndex(project);
	const measured = measuredItems(project);

	const items: ReviewItem[] = [
		...measured.map((item, i) => ({ ...item, id: `r${index}-m${i + 1}`, status: "open" as const })),
		...judged.map((item, i) => ({
			...item,
			id: `r${index}-j${i + 1}`,
			source: "judged" as const,
			status: "open" as const,
		})),
	];

	const round: ReviewRound = {
		id: `round-${index}`,
		index,
		createdAt: now,
		items,
		rationale,
	};
	return { ...project, rounds: [...project.rounds, round], updatedAt: now };
}

export function latestRound(project: Project): ReviewRound | null {
	return project.rounds[project.rounds.length - 1] ?? null;
}

function updateItem(
	project: Project,
	itemId: string,
	change: (item: ReviewItem) => ReviewItem,
): Project {
	return {
		...project,
		rounds: project.rounds.map((round) => ({
			...round,
			items: round.items.map((item) => (item.id === itemId ? change(item) : item)),
		})),
		updatedAt: Date.now(),
	};
}

export function resolveItem(project: Project, itemId: string): Project {
	return updateItem(project, itemId, (item) => ({ ...item, status: "resolved" }));
}

/** Waiving needs a reason, because "I decided this does not apply" is an answer. */
export function waiveItem(project: Project, itemId: string, note: string): Project {
	return updateItem(project, itemId, (item) => ({ ...item, status: "waived", note }));
}

export function reopenItem(project: Project, itemId: string): Project {
	return updateItem(project, itemId, (item) => ({ ...item, status: "open", note: undefined }));
}

export function openItems(project: Project): ReviewItem[] {
	const round = latestRound(project);
	return round ? round.items.filter((i) => i.status === "open") : [];
}

/**
 * Not "the article is good" — only that nothing is still waiting for an answer,
 * which is the question the writer actually cannot hold in their head.
 */
export function isFinishable(project: Project): boolean {
	return project.blocks.length > 0 && project.rounds.length > 0 && openItems(project).length === 0;
}
