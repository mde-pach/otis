/**
 * Asking the model the two questions it is allowed to be asked.
 *
 * Neither of them is "write an article", and neither is "arrange this". The
 * first is which kinds of piece these notes are; the second, for one kind, is
 * which part each of the writer's sections belongs to. The second answer has a
 * vocabulary the size of the pattern file, so it can be checked by a program
 * rather than trusted — which is the only reason a model is near this text.
 *
 * The order is never asked for. It is the pattern's, and it is computed.
 */

import { check, type Pattern, type Placement, read, say } from "../../core/pattern";
import type { Pick, PickRequest, Placed, PlaceRequest, Planner } from "../../core/ports";
import { checkFaithfulness, formattingOnly } from "../../core/reword";
import type { Segment } from "../../core/types";
import { askJson, askOnce, type LlmConfig } from "./claude-client";

const PICK = `You are given a writer's notes and a shelf of kinds of piece. Say which three kinds these notes could become.

Return JSON: {"picks": [{"kind": "<id from the shelf>", "because": "<one sentence>"}, ...]}

Three picks, best first. "kind" must be an id from the shelf, exactly as written. "because" says, to the writer, what in their notes makes this kind fit — one sentence, in the language their notes are written in, naming something that is actually in them.

Do not offer a kind the notes cannot support just to reach three. Two is a fine answer. One is a fine answer.

Reply with JSON only.`;

const PLACE = `You sort a writer's own sections into the parts of one kind of piece. You are not writing, reordering or summarising anything.

You are given their sections, numbered, and the parts of one kind of piece. For every section, say which part it belongs to, or null if the piece is better without it.

Return JSON:
- "at": {"<section number>": "<part id>" or null} — one entry for every section you were given, no exceptions.
- "format": {"<section number>": "<markdown>"} for sections that would read better with formatting. THE WORDS MUST BE IDENTICAL. You may add **bold**, *italic*, \`code\`, a list marker or a heading marker. Changing, adding or removing a single word here is a mistake.
- "short": {"<section number>": "<text>"} for sections that run long. You may only DELETE words: every word in your answer must already be in that section, and every number, unit, name and identifier that survives must be exact. Do not rephrase, do not join two ideas with a word of your own. If a section cannot be shortened by deleting alone, leave it out.

Rules:
- A part id must come from the list you were given. Do not invent one.
- Parts marked "one" hold at most one section. Parts marked "many" hold as many as belong there.
- A part with nothing to put in it stays empty. Do not stretch a section to cover it, and do not write anything to fill it.
- Never put your own words in "format" or "short".

Reply with JSON only.`;

function listing(segments: Segment[]): string {
	return segments.map((s) => `${s.index}: ${s.text.replace(/\s+/g, " ")}`).join("\n");
}

function parts(pattern: Pattern): string {
	return pattern.parts
		.map((part) => `${part.id} (${part.many ? "many" : "one"}): ${part.does}`)
		.join("\n");
}

interface Wording {
	format: Record<number, string>;
	short: Record<number, string>;
}

/** Wording, each field gated by the check that belongs to it. */
function wording(raw: unknown, segments: Segment[]): Wording {
	const said = (raw ?? {}) as { format?: unknown; short?: unknown };
	const format: Record<number, string> = {};
	for (const [key, md] of Object.entries((said.format ?? {}) as Record<string, unknown>)) {
		const index = Number(key);
		const source = segments[index];
		if (!source || typeof md !== "string") continue;
		// silently discard anything that changed a word while claiming to format
		if (formattingOnly(source.text, md)) format[index] = md;
	}
	const short: Record<number, string> = {};
	for (const [key, text] of Object.entries((said.short ?? {}) as Record<string, unknown>)) {
		const index = Number(key);
		const source = segments[index];
		if (!source || typeof text !== "string") continue;
		if (checkFaithfulness(source.text, text).passed) short[index] = text;
	}
	return { format, short };
}

export function createLlmPlanner(config: LlmConfig): Planner {
	return {
		async pick(request: PickRequest): Promise<Pick[]> {
			const { segments, brief, shelf, notes } = request;
			if (segments.length === 0) return [];

			return askJson<Pick[]>(config, {
				system: PICK,
				user: `The shelf:\n${shelf}\n\nWhat they said they are making:\n${brief || "(they have not said)"}\n\nTheir notes:\n${notes.slice(0, 12000)}`,
				maxTokens: 700,
				validate: (value) => {
					const said = (value ?? {}) as { picks?: unknown };
					const offered = Array.isArray(said.picks) ? said.picks : [];
					const seen = new Set<string>();
					const picks: Pick[] = [];
					for (const one of offered) {
						const patternId = String((one as { kind?: unknown })?.kind ?? "").trim();
						// a kind that is not on the shelf is not a kind
						if (!patternId || seen.has(patternId) || !shelf.includes(`${patternId}:`)) continue;
						seen.add(patternId);
						picks.push({
							patternId,
							because: String((one as { because?: unknown })?.because ?? "").trim(),
						});
					}
					if (picks.length === 0) throw new Error("no kind from the shelf came back");
					return picks.slice(0, 3);
				},
			});
		},

		async place(request: PlaceRequest): Promise<Placed> {
			const { segments, brief, pattern } = request;
			const count = segments.length;
			const empty: Placement = Array.from({ length: count }, () => null);
			if (count === 0) return { placement: empty, format: {}, short: {}, violations: [] };

			const user = `The kind: ${pattern.id} — ${pattern.does}\n\nIts parts, in order:\n${parts(pattern)}\n\nWhat they said they are making:\n${brief || "(they have not said)"}\n\nTheir sections:\n${listing(segments)}`;

			let answer = (await askOnce(config, { system: PLACE, user })) as { at?: unknown };
			let violations = check(answer?.at, pattern, count);

			// one re-ask, with the violations named. A model that cannot answer the
			// shape twice will not on the third try, and their own order is a
			// legitimate article — so the fallback is not a failure state.
			if (violations.length > 0) {
				const retried = (await askOnce(config, {
					system: PLACE,
					user: `${user}\n\nYour previous answer could not be used:\n${violations.map(say).join("\n")}\nAnswer again, for every section.`,
				})) as { at?: unknown };
				const left = check(retried?.at, pattern, count);
				if (left.length === 0) {
					answer = retried;
					violations = [];
				}
			}

			const placement = violations.length === 0 ? read(answer?.at, pattern, count) : empty;
			return { placement, ...wording(answer, segments), violations: violations.map(say) };
		},
	};
}
