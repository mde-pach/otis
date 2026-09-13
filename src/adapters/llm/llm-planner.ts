/**
 * Asking for a plan.
 *
 * The model is never asked for an article. It is asked where the writer's own
 * segments should go, which run long, and what the piece is missing — and it
 * answers in indices. The only text it may return is in `written`, which the
 * writer sees in a different colour for as long as it survives.
 *
 * Nothing it returns is trusted. Every index is resolved against the segments,
 * duplicates are dropped, shortenings that fail the faithfulness gate are
 * discarded here rather than rendered and withdrawn.
 */

import type { Planner, PlanRequest } from "../../core/ports";
import { checkFaithfulness, formattingOnly, restates } from "../../core/reword";
import type { Confidence, Plan, Segment, Shape } from "../../core/types";
import { askJson, type LlmConfig } from "./claude-client";

const SYSTEM = `You arrange a writer's own sentences into an article. You are not writing their article.

You are given their text as numbered segments, what they said they are making, and a short reference note about that kind of writing.

A segment is one section of their document, exactly as they separated it. Each one is laid out on its own in the article, so ordering them is the whole of the structure. There is no paragraph to think about.

Return, as JSON:
- "shapes": two or three ARRANGEMENTS of their sections, each a genuinely different article. Each is {"name": "...", "at": [...], "because": "..."}. "name" is three or four words for what that arrangement is, in the language of the notes — say what it leads with, not what kind of document it is. "at" has one entry per segment, in order: the position it takes in that arrangement, or null to leave it out; positions are integers you choose and only their order matters. "because" is one sentence on why that order.
  The FIRST shape is the one you would publish. The others must differ in what they lead with or what they leave out — three names for the same order is not an answer. If the notes only support one order, return one shape and say so in its "because".
- "format": {segmentIndex: markdown} for segments that would read better with formatting. THE WORDS MUST BE IDENTICAL. You may add **bold**, *italic*, \`code\`, a list marker or a heading marker. Changing, adding or removing a single word here is a mistake.
- "short": {segmentIndex: text} for segments that run long. Fewer words, same claims. Every number, unit, name and identifier must survive exactly. If you cannot shorten one without losing something, leave it out of this object.
- "written": the parts the piece needs that the notes do not contain. Each is {"after": segmentIndex, "md": "...", "confidence": "high" | "low", "because": "..."}. Use "low" when you inferred beyond what the notes support. "because" says, to the writer, what was missing.
  This is for what is MISSING. If a segment already makes the point, do not write it again in your own words — that makes the piece say the same thing twice. A summary, a recap, a restatement or a tidier version of something already in the notes is not a gap; a transition, a definition, a consequence, a counter-argument or a conclusion the notes never reach may be.

Rules you must not break:
- Never put the writer's words in "written" and never put your words in "format" or "short".
- Do not impose sections. A heading is only ever a "written" run, and only when the piece genuinely needs one — most do not.
- Leaving the order alone is a legitimate plan. So is writing nothing.
- Write in the language the notes are written in.

Reply with JSON only.`;

/** One arrangement, resolved against the real segments and never trusted. */
function order(raw: unknown, size: number, fallback: string): Shape {
	const entry = (raw ?? {}) as Partial<Shape>;
	const at: (number | null)[] = Array.from({ length: size }, () => null);
	const taken = new Set<number>();
	const given = Array.isArray(entry.at) ? entry.at : [];
	given.slice(0, size).forEach((position, index) => {
		const n = Number(position);
		if (!Number.isFinite(n) || taken.has(n)) return;
		taken.add(n);
		at[index] = n;
	});
	// an arrangement that placed nothing is not one; fall back to their order
	if (!at.some((position) => position !== null)) {
		for (let i = 0; i < size; i++) at[i] = i;
	}
	return {
		name: String(entry.name ?? "").trim() || fallback,
		at,
		because: String(entry.because ?? "").trim(),
	};
}

function clean(value: unknown, segments: Segment[], basis: string): Plan {
	const raw = (value ?? {}) as Partial<Plan>;
	const size = segments.length;

	const offered = Array.isArray(raw.shapes) ? raw.shapes.slice(0, 4) : [];
	const shapes: Shape[] = offered.map((one, n) => order(one, size, `arrangement ${n + 1}`));
	// nothing usable came back: their own order is a legitimate article
	if (shapes.length === 0) {
		shapes.push({
			name: "as you wrote it",
			at: Array.from({ length: size }, (_, i) => i),
			because: "nothing came back to arrange, so this is your order",
		});
	}

	const format: Record<number, string> = {};
	for (const [key, md] of Object.entries(raw.format ?? {})) {
		const index = Number(key);
		const source = segments[index];
		if (!source || typeof md !== "string") continue;
		// silently discard anything that changed a word while claiming to format
		if (formattingOnly(source.text, md)) format[index] = md;
	}

	const short: Record<number, string> = {};
	for (const [key, text] of Object.entries(raw.short ?? {})) {
		const index = Number(key);
		const source = segments[index];
		if (!source || typeof text !== "string") continue;
		if (checkFaithfulness(source.text, text).passed) short[index] = text;
	}

	const written = (Array.isArray(raw.written) ? raw.written : [])
		.map((item) => {
			const after = Number((item as { after?: unknown })?.after);
			const md = String((item as { md?: unknown })?.md ?? "").trim();
			const confidence: Confidence =
				(item as { confidence?: unknown })?.confidence === "low" ? "low" : "high";
			const because = String((item as { because?: unknown })?.because ?? "").trim();
			return { after, md, confidence, because };
		})
		// a paraphrase of the writer's own section is not a gap, whatever it claims
		.filter(
			(item) =>
				item.md.length > 0 && segments[item.after] !== undefined && !restates(item.md, basis),
		);

	return { basis, shapes, format, short, written };
}

export function createLlmPlanner(config: LlmConfig): Planner {
	return {
		async plan(request: PlanRequest): Promise<Plan> {
			const { segments, brief, pattern, notes } = request;
			if (segments.length === 0) {
				return { basis: notes, shapes: [], format: {}, short: {}, written: [] };
			}

			const listing = segments.map((s) => `${s.index}: ${s.text.replace(/\s+/g, " ")}`).join("\n");

			// Always the whole plan, whatever the dial says. The writer's reach
			// filters it at render time, so moving the dial costs nothing and they
			// can see all four readings of one request.
			return askJson<Plan>(config, {
				system: SYSTEM,
				user: `What they are making:\n${brief || "(they have not said — keep close to what they wrote)"}\n\nReference note for this kind of writing:\n${pattern}\n\nTheir segments:\n${listing}`,
				maxTokens: 3000,
				validate: (value) => clean(value, segments, notes),
			});
		},
	};
}
