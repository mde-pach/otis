/**
 * Turning a plan into the article.
 *
 * This is the single place an article comes into being, and there is no path
 * through it that writes. The model's answer reaches here as a placement — one
 * part id per section of the writer's own document — and the order comes from
 * the pattern file, not from the answer. Anything the placement does not cover
 * is left out and named; anything the pattern requires and the placement does
 * not fill is a question, computed here and printed from the file.
 */

import { arrange, type Gap, gaps, type Lang, type Pattern } from "./pattern";
import { checkFaithfulness, formattingOnly } from "./reword";
import { segment } from "./segments";
import type { Plan, Reach, Run, Segment, Shape } from "./types";

export interface Built {
	runs: Run[];
	/** sections the article is not using, at reach 2 and above */
	dropped: Segment[];
	/** required parts of the shape with none of the writer's text in them */
	gaps: Gap[];
	/** false when the article is in the writer's order rather than the shape's */
	arranged: boolean;
}

export interface BuildOptions {
	reach: Reach;
	/** which card the article is in */
	which?: number;
	/** the kind that card is; without it there is no order to put anything in */
	pattern?: Pattern | null;
	/** the language the questions come back in */
	lang?: Lang;
}

/**
 * A plan made for other text is not a plan for this one. Indices are all it
 * has, so applied to a different document it would quietly drop every section
 * it has no entry for — which reads as the tool ignoring what you just pasted.
 */
export function fits(notes: string, plan: Plan | null): boolean {
	return Boolean(plan) && segment((plan as Plan).basis).length === segment(notes).length;
}

/** The plan still fits, but the words under it have moved on. */
export function stale(notes: string, plan: Plan | null): boolean {
	return Boolean(plan) && (plan as Plan).basis !== notes;
}

/** The card the article is in, or nothing if the plan has none. */
export function shapeOf(plan: Plan | null, which: number): Shape | null {
	const shapes = plan?.shapes;
	if (!Array.isArray(shapes) || shapes.length === 0) return null;
	return shapes[Math.min(Math.max(which, 0), shapes.length - 1)] ?? null;
}

/**
 * Reach is the writer's, not the model's: the same plan renders four ways, and
 * the lower settings simply refuse to use parts of it.
 */
export function build(notes: string, plan: Plan | null, options: BuildOptions): Built {
	const { reach, which = 0, pattern = null, lang = "en" } = options;
	const segments = segment(notes);
	const chosen = shapeOf(plan, which);

	const render = (s: Segment): { md: string; kind: Run["kind"] } => {
		const formatted = plan?.format[s.index];
		const shortened = plan?.short[s.index];
		// a shortening that fails the gate never reaches the page; yours stands
		if (shortened && checkFaithfulness(s.text, shortened).passed) {
			return { md: shortened, kind: "reworded" };
		}
		// formatting is not rewriting, so these stay marked as the writer's own
		if (formatted && formattingOnly(s.text, formatted)) return { md: formatted, kind: "kept" };
		return { md: s.text, kind: "kept" };
	};

	const run = (s: Segment, id: number, touched: boolean): Run => ({
		id,
		key: `s${s.index}`,
		...(touched ? render(s) : { md: s.text, kind: "kept" as const }),
		from: { start: s.start, end: s.end },
		fromIndex: s.index,
	});

	const asWritten = (touched: boolean): Built => ({
		runs: segments.map((s, id) => run(s, id, touched)),
		dropped: [],
		gaps: [],
		arranged: false,
	});

	if (!plan || !chosen || reach === 0 || !fits(notes, plan)) return asWritten(false);
	if (reach === 1) return asWritten(true);

	// the card has been chosen but not organised yet, or organising it failed:
	// their own order is a legitimate article and is what they get meanwhile
	const placement = chosen.placement;
	if (!placement || !pattern || pattern.id !== chosen.patternId) return asWritten(true);

	const { order, out } = arrange(placement, pattern);
	const byIndex = new Map(segments.map((s) => [s.index, s]));

	return {
		runs: order
			.map((index) => byIndex.get(index))
			.filter((s): s is Segment => Boolean(s))
			.map((s, id) => ({ ...run(s, id, true), part: placement[s.index] ?? undefined })),
		dropped: out.map((index) => byIndex.get(index)).filter((s): s is Segment => Boolean(s)),
		gaps:
			reach === 3
				? gaps(
						placement,
						pattern,
						lang,
						segments.map((s) => s.text),
					)
				: [],
		arranged: true,
	};
}

/** The article, as the writer would paste it anywhere else. */
export function toMarkdown(runs: Run[]): string {
	return runs.map((r) => r.md).join("\n\n");
}

export interface Share {
	yours: number;
	reworded: number;
}

/** Counted in words, because a run is not a unit anyone experiences. */
export function share(runs: Run[]): Share {
	const count = { yours: 0, reworded: 0 };
	for (const run of runs) {
		const words = run.md
			.replace(/[*`#\-[\]()]/g, " ")
			.trim()
			.split(/\s+/)
			.filter(Boolean).length;
		if (run.kind === "reworded") count.reworded += words;
		else count.yours += words;
	}
	const total = count.yours + count.reworded || 1;
	return {
		yours: Math.round((count.yours / total) * 100),
		reworded: Math.round((count.reworded / total) * 100),
	};
}
