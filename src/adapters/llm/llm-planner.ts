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
import { checkFaithfulness, formattingOnly } from "../../core/reword";
import type { Confidence, Plan, Segment } from "../../core/types";
import { askJson, type LlmConfig } from "./claude-client";

const SYSTEM = `You arrange a writer's own sentences into an article. You are not writing their article.

You are given their text as numbered segments, what they said they are making, and a short reference note about that kind of writing.

Return, as JSON:
- "at": one entry per segment, in order — the position it should take in the article, or null to leave it out. Positions are integers you choose; only their order matters.
- "format": {segmentIndex: markdown} for segments that would read better with formatting. THE WORDS MUST BE IDENTICAL. You may add **bold**, *italic*, \`code\`, a list marker or a heading marker. Changing, adding or removing a single word here is a mistake.
- "short": {segmentIndex: text} for segments that run long. Fewer words, same claims. Every number, unit, name and identifier must survive exactly. If you cannot shorten one without losing something, leave it out of this object.
- "written": the parts the piece needs that the notes do not contain. Each is {"after": segmentIndex, "md": "...", "confidence": "high" | "low", "because": "..."}. Use "low" when you inferred beyond what the notes support. "because" says, to the writer, what was missing.
- "because": one sentence, plain words, on what you did and why.

Rules you must not break:
- Never put the writer's words in "written" and never put your words in "format" or "short".
- Do not impose sections. A heading is only ever a "written" run, and only when the piece genuinely needs one — most do not.
- Leaving the order alone is a legitimate plan. So is writing nothing.

Reply with JSON only.`;

function clean(value: unknown, segments: Segment[], basis: string): Plan {
	const raw = (value ?? {}) as Partial<Plan>;
	const size = segments.length;

	const at: (number | null)[] = Array.from({ length: size }, () => null);
	const taken = new Set<number>();
	const given = Array.isArray(raw.at) ? raw.at : [];
	given.slice(0, size).forEach((position, index) => {
		const n = Number(position);
		if (!Number.isFinite(n) || taken.has(n)) return;
		taken.add(n);
		at[index] = n;
	});
	// a plan that placed nothing is not a plan; fall back to the writer's order
	const placedAny = at.some((position) => position !== null);
	if (!placedAny) {
		for (let i = 0; i < size; i++) at[i] = i;
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
		.filter((item) => item.md.length > 0 && segments[item.after] !== undefined);

	return { basis, at, format, short, written, because: String(raw.because ?? "").trim() };
}

export function createLlmPlanner(config: LlmConfig): Planner {
	return {
		async plan(request: PlanRequest): Promise<Plan> {
			const { segments, brief, pattern, notes } = request;
			if (segments.length === 0) {
				return { basis: notes, at: [], format: {}, short: {}, written: [], because: "" };
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
