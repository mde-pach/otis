/**
 * Turning a plan into the article.
 *
 * The plan only ever names the writer's own segment indices, so this function
 * is the single place where an article comes into being — and it can only
 * produce text that either came from the notes or is explicitly marked as the
 * tool's. There is no path here that quietly writes.
 */

import { blockOf } from "./markdown";
import { checkFaithfulness, formattingOnly } from "./reword";
import { segment } from "./segments";
import type { Plan, Reach, Run, Segment } from "./types";

export interface Built {
	runs: Run[];
	/** segments the article is not using, at reach 2 and above */
	dropped: Segment[];
}

/**
 * A plan made for other text is not a plan for this one. Indices are all it
 * has, so applied to a different document it would quietly drop every segment
 * it has no entry for — which reads as the tool ignoring what you just pasted.
 */
export function fits(notes: string, plan: Plan | null): boolean {
	return Boolean(plan) && segment((plan as Plan).basis).length === segment(notes).length;
}

/** The plan still fits, but the words under it have moved on. */
export function stale(notes: string, plan: Plan | null): boolean {
	return Boolean(plan) && (plan as Plan).basis !== notes;
}

/**
 * Reach is the writer's, not the model's: the same plan renders four ways, and
 * the lower settings simply refuse to use parts of it.
 */
export function build(notes: string, plan: Plan | null, reach: Reach): Built {
	const segments = segment(notes);
	if (!plan || reach === 0 || !fits(notes, plan)) {
		return {
			runs: segments.map((s, id) => ({
				id,
				key: `s${s.index}`,
				kind: "kept" as const,
				md: s.text,
				from: { start: s.start, end: s.end },
				fromIndex: s.index,
				block: s.block,
			})),
			dropped: [],
		};
	}

	const shape = (s: Segment): { md: string; kind: Run["kind"] } => {
		const formatted = plan.format[s.index];
		const shortened = plan.short[s.index];
		// a shortening that fails the gate never reaches the page; yours stands
		if (shortened && checkFaithfulness(s.text, shortened).passed) {
			return { md: shortened, kind: "reworded" };
		}
		// formatting is not rewriting, so these stay marked as the writer's own
		if (formatted && formattingOnly(s.text, formatted)) return { md: formatted, kind: "kept" };
		return { md: s.text, kind: "kept" };
	};

	if (reach === 1) {
		return {
			runs: segments.map((s, id) => ({
				id,
				key: `s${s.index}`,
				...shape(s),
				from: { start: s.start, end: s.end },
				fromIndex: s.index,
				block: s.block,
			})),
			dropped: [],
		};
	}

	const placed: { at: number; segment: Segment }[] = [];
	const dropped: Segment[] = [];
	for (const s of segments) {
		const at = plan.at[s.index];
		if (at === null || at === undefined) dropped.push(s);
		else placed.push({ at, segment: s });
	}
	placed.sort((a, b) => a.at - b.at);

	const runs: Run[] = placed.map(({ segment: s }) => ({
		id: 0,
		key: `s${s.index}`,
		...shape(s),
		from: { start: s.start, end: s.end },
		fromIndex: s.index,
		block: s.block,
	}));

	if (reach === 3) {
		// anchored to a segment so an insertion survives the writer editing around it
		[...plan.written].reverse().forEach((written, back) => {
			const anchor = placed.findIndex((p) => p.segment.index === written.after);
			const where = anchor < 0 ? runs.length : anchor + 1;
			runs.splice(where, 0, {
				id: 0,
				key: `w${plan.written.length - 1 - back}`,
				kind: "written",
				md: written.md,
				confidence: written.confidence,
			});
		});
	}

	return { runs: runs.map((run, id) => ({ ...run, id })), dropped };
}

/**
 * Putting the paragraph back.
 *
 * Segments are sentences, so laying every run out on its own line would turn a
 * paragraph the writer wrote into a column of one-liners. Runs that came from
 * the same paragraph and are still next to each other are still that paragraph.
 * The moment the plan moves one away from its neighbours, it stands alone —
 * which is exactly the change the writer wants to be able to see.
 *
 * Only prose joins: a heading, a bullet and a fenced block are their own thing,
 * and so is anything the tool wrote.
 */
export function paragraphs(runs: Run[]): Run[][] {
	const out: Run[][] = [];
	for (const run of runs) {
		const last = out.at(-1);
		const head = last?.[0];
		const together =
			last !== undefined &&
			head !== undefined &&
			run.block !== undefined &&
			head.block === run.block &&
			blockOf(head.md) === "p" &&
			blockOf(run.md) === "p";
		if (together && last) last.push(run);
		else out.push([run]);
	}
	return out;
}

/** The article, as the writer would paste it anywhere else. */
export function toMarkdown(runs: Run[]): string {
	return paragraphs(runs)
		.map((group) => group.map((r) => r.md).join(" "))
		.join("\n\n");
}

export interface Share {
	yours: number;
	reworded: number;
	written: number;
}

/** Counted in words, because a run is not a unit anyone experiences. */
export function share(runs: Run[]): Share {
	const count = { yours: 0, reworded: 0, written: 0 };
	for (const run of runs) {
		const words = run.md
			.replace(/[*`#\-[\]()]/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean).length;
		if (run.kind === "written") count.written += words;
		else if (run.kind === "reworded") count.reworded += words;
		else count.yours += words;
	}
	const total = count.yours + count.reworded + count.written || 1;
	return {
		yours: Math.round((count.yours / total) * 100),
		reworded: Math.round((count.reworded / total) * 100),
		written: Math.round((count.written / total) * 100),
	};
}
