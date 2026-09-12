/**
 * Headings, written for one article.
 *
 * The roles are fixed; the headings cannot be. "What was happening" is a label
 * from a template and would never survive being read — a heading has to come
 * out of this piece, in this writer's vocabulary. So the model is given the
 * paragraphs that landed in a role and asked for a heading made of their words
 * where possible.
 *
 * Whatever it returns is the tool's words until the writer edits it, and is
 * marked that way everywhere it appears.
 */

import { askJson, type LlmConfig } from "./claude-client";

const SYSTEM = `You write a short heading for one section of a writer's article.

- Use the writer's own words wherever they will serve. Lift a phrase from the section if one fits.
- At most six words. No colons, no "The", no title case, no cleverness.
- Name what this section is about, not what role it plays. Never "Introduction", "Background", "The problem", "What happened" — those are labels from a template, not headings for this piece.
- If the section does not need a heading, return an empty string for it.

Reply with JSON only: {"titles":[{"slotId":"cause","title":"the key expired all at once"}]}`;

export interface TitleRequest {
	slotId: string;
	role: string;
	paragraphs: string[];
}

export async function suggestTitles(
	config: LlmConfig,
	sections: TitleRequest[],
): Promise<Record<string, string>> {
	const filled = sections.filter((s) => s.paragraphs.length > 0);
	if (filled.length === 0) return {};

	const body = filled
		.map(
			(s) =>
				`${s.slotId} (${s.role}):\n${s.paragraphs.map((p) => `- ${p.replace(/\s+/g, " ")}`).join("\n")}`,
		)
		.join("\n\n");

	const raw = await askJson<{ titles: { slotId: string; title: string }[] }>(config, {
		system: SYSTEM,
		user: body,
		maxTokens: 500,
		validate: (value) => {
			const v = value as { titles?: { slotId?: string; title?: string }[] };
			if (!Array.isArray(v?.titles)) throw new Error("expected a titles array");
			return {
				titles: v.titles.map((t) => ({
					slotId: String(t?.slotId ?? ""),
					title: String(t?.title ?? ""),
				})),
			};
		},
	});

	const known = new Set(filled.map((s) => s.slotId));
	const out: Record<string, string> = {};
	for (const { slotId, title } of raw.titles) {
		const clean = title.trim().replace(/^#+\s*/, "");
		if (!known.has(slotId) || !clean) continue;
		if (clean.split(/\s+/).length > 8) continue;
		out[slotId] = clean;
	}
	return out;
}
