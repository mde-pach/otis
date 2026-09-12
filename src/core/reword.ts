/**
 * Rewording, and the gate every reword has to pass.
 *
 * The product's one hard promise is that the tool never adds a claim. That is
 * enforced here, deterministically, before a suggestion is ever shown:
 *
 *   - a reword that keeps almost none of the original's words is not a reword
 *   - a reword that introduces a number, a unit or a code identifier the
 *     original did not contain has invented a fact
 *
 * A failed suggestion is not rendered and then rejected. It never exists.
 */

import { wordRetention } from "./diff";
import type { FaithfulnessCheck, Project, Reword } from "./types";

/** Numbers, measurements, versions, and code-ish identifiers: things that can be wrong. */
const FACT =
	/\b\d+(?:[.,]\d+)?\s*(?:%|ms|s|m|h|kb|mb|gb|tb|k|x)?(?![a-z])|\b[a-z_$][\w$]*\(\)|\b[A-Z][A-Za-z0-9]*_[A-Z0-9_]+\b/g;

function facts(text: string): Set<string> {
	return new Set((text.match(FACT) ?? []).map((f) => f.replace(/\s+/g, "").toLowerCase()));
}

export interface RewordGateOptions {
	/** Below this share of retained words, it is a rewrite rather than a reword. */
	minRetention?: number;
}

export function checkFaithfulness(
	original: string,
	proposed: string,
	options: RewordGateOptions = {},
): FaithfulnessCheck {
	const { minRetention = 0.25 } = options;
	const retention = wordRetention(original, proposed);

	const before = facts(original);
	const addedFacts = [...facts(proposed)].filter((f) => !before.has(f));

	if (addedFacts.length > 0) {
		return {
			retention,
			addedFacts,
			passed: false,
			reason: `it introduces ${addedFacts.join(", ")}, which your sentence does not say`,
		};
	}
	if (retention < minRetention) {
		return {
			retention,
			addedFacts,
			passed: false,
			reason: `it keeps only ${Math.round(retention * 100)}% of your words, which is rewriting rather than rewording`,
		};
	}
	if (proposed.trim() === original.trim()) {
		return { retention, addedFacts, passed: false, reason: "it is the sentence you already wrote" };
	}
	return {
		retention,
		addedFacts,
		passed: true,
		reason: `keeps ${Math.round(retention * 100)}% of your words and adds no facts`,
	};
}

function nextRewordId(project: Project): string {
	let max = 0;
	for (const r of project.rewords) {
		const n = Number.parseInt(r.id.replace(/\D/g, ""), 10);
		if (Number.isFinite(n) && n > max) max = n;
	}
	return `r${String(max + 1).padStart(2, "0")}`;
}

/** Returns the project unchanged when the suggestion fails the gate. */
export function proposeReword(
	project: Project,
	blockId: string,
	proposed: string,
	now = Date.now(),
): { project: Project; rejected?: FaithfulnessCheck } {
	const block = project.blocks.find((b) => b.id === blockId);
	if (!block) return { project };

	const check = checkFaithfulness(block.text, proposed);
	if (!check.passed) return { project, rejected: check };

	const reword: Reword = {
		id: nextRewordId(project),
		blockId,
		original: block.text,
		proposed,
		createdAt: now,
		status: "pending",
		check,
	};
	return {
		project: { ...project, rewords: [...project.rewords, reword], updatedAt: now },
	};
}

export function acceptReword(project: Project, rewordId: string): Project {
	const reword = project.rewords.find((r) => r.id === rewordId);
	if (!reword || reword.status !== "pending") return project;
	return {
		...project,
		blocks: project.blocks.map((b) =>
			b.id === reword.blockId
				? { ...b, text: reword.proposed, acceptedRewordText: reword.proposed }
				: b,
		),
		rewords: project.rewords.map((r) => (r.id === rewordId ? { ...r, status: "accepted" } : r)),
		updatedAt: Date.now(),
	};
}

export function rejectReword(project: Project, rewordId: string): Project {
	return {
		...project,
		rewords: project.rewords.map((r) => (r.id === rewordId ? { ...r, status: "rejected" } : r)),
		updatedAt: Date.now(),
	};
}

export function pendingRewords(project: Project, blockId?: string): Reword[] {
	return project.rewords.filter(
		(r) => r.status === "pending" && (blockId === undefined || r.blockId === blockId),
	);
}
