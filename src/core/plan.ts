/**
 * Turning a plan into the article.
 *
 * The plan only ever names the writer's own segment indices, so this function
 * is the single place where an article comes into being — and it can only
 * produce text that either came from the notes or is explicitly marked as the
 * tool's. There is no path here that quietly writes.
 */

import { checkFaithfulness, formattingOnly, plain } from "./reword";
import { segment } from "./segments";
import type { Plan, Reach, Run, Segment, Shape } from "./types";

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

/** The arrangement the article is in, or nothing if the plan has none. */
export function shapeOf(plan: Plan | null, which: number): Shape | null {
	if (!plan || plan.shapes.length === 0) return null;
	return plan.shapes[Math.min(Math.max(which, 0), plan.shapes.length - 1)] ?? null;
}

/**
 * Reach is the writer's, not the model's: the same plan renders four ways, and
 * the lower settings simply refuse to use parts of it. `which` is the
 * arrangement, and it is theirs too — one request answers for all of them.
 */
export function build(notes: string, plan: Plan | null, reach: Reach, which = 0): Built {
	const segments = segment(notes);
	const chosen = shapeOf(plan, which);
	if (!plan || !chosen || reach === 0 || !fits(notes, plan)) {
		return {
			runs: segments.map((s, id) => ({
				id,
				key: `s${s.index}`,
				kind: "kept" as const,
				md: s.text,
				from: { start: s.start, end: s.end },
				fromIndex: s.index,
			})),
			dropped: [],
		};
	}

	const render = (s: Segment): { md: string; kind: Run["kind"] } => {
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
				...render(s),
				from: { start: s.start, end: s.end },
				fromIndex: s.index,
			})),
			dropped: [],
		};
	}

	const placed: { at: number; segment: Segment }[] = [];
	const dropped: Segment[] = [];
	for (const s of segments) {
		const at = chosen.at[s.index];
		if (at === null || at === undefined) dropped.push(s);
		else placed.push({ at, segment: s });
	}
	placed.sort((a, b) => a.at - b.at);

	const runs: Run[] = placed.map(({ segment: s }) => ({
		id: 0,
		key: `s${s.index}`,
		...render(s),
		from: { start: s.start, end: s.end },
		fromIndex: s.index,
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

/** The article, as the writer would paste it anywhere else. */
export function toMarkdown(runs: Run[]): string {
	return runs.map((r) => r.md).join("\n\n");
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

/**
 * An arrangement at a glance: the opening of each section, in the order it puts
 * them. The writer's own words, so choosing a shape means reading their text
 * rather than a label for it.
 */
export function outline(notes: string, shape: Shape, words = 5): string[] {
	const segments = segment(notes);
	return segments
		.map((s) => ({ s, at: shape.at[s.index] }))
		.filter((p) => p.at !== null && p.at !== undefined)
		.sort((a, b) => (a.at as number) - (b.at as number))
		.map(({ s }) => {
			const said = plain(s.text).replace(/\s+/g, " ").split(" ").filter(Boolean);
			return said.length > words ? `${said.slice(0, words).join(" ")}…` : said.join(" ");
		});
}

/**
 * The same arrangement as a picture: one bar per section, in the order it puts
 * them, as wide as that section is long.
 *
 * A section keeps its width wherever it lands, so reading two of these side by
 * side is seeing what moved rather than being told. Widths are relative to the
 * longest section, 0 to 1.
 */
export function bars(notes: string, shape: Shape): number[] {
	const segments = segment(notes);
	const longest = Math.max(1, ...segments.map((s) => s.text.length));
	return segments
		.map((s) => ({ s, at: shape.at[s.index] }))
		.filter((p) => p.at !== null && p.at !== undefined)
		.sort((a, b) => (a.at as number) - (b.at as number))
		.map(({ s }) => Math.max(0.12, s.text.length / longest));
}
