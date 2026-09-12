/**
 * Rewording one sentence the writer already wrote.
 *
 * The model is told to keep the writer's words; the gate in core/reword.ts then
 * checks that it did, and a suggestion that adds a number or rewrites wholesale
 * is discarded before the writer ever sees it. The prompt asks nicely; the gate
 * is what makes the promise true.
 */

import { askJson, type LlmConfig } from "./claude-client";

const SYSTEM = `You rephrase a single sentence a writer wrote, and nothing else.

- Keep their words wherever possible; change order and connective tissue, not substance.
- Never add a fact, a number, an example or an opinion that is not already in the sentence.
- Never make it longer than it was by more than a few words.
- Keep their voice: if they write plainly, stay plain. No flourish, no marketing tone.
- Offer two options that differ from each other, not two versions of the same move.

Reply with JSON only: {"options":["...","..."]}`;

interface RawOptions {
	options: string[];
}

function validate(value: unknown): RawOptions {
	const v = value as Partial<RawOptions>;
	if (!Array.isArray(v?.options)) throw new Error("expected an options array");
	return {
		options: v.options
			.map(String)
			.filter((s) => s.trim().length > 0)
			.slice(0, 3),
	};
}

export async function suggestRewords(
	config: LlmConfig,
	sentence: string,
	context?: string,
): Promise<string[]> {
	const { options } = await askJson<RawOptions>(config, {
		system: SYSTEM,
		user: context
			? `Sentence to rephrase:\n${sentence}\n\nIt sits in this section of the article, for context only — do not rephrase the context:\n${context}`
			: `Sentence to rephrase:\n${sentence}`,
		maxTokens: 500,
		validate,
	});
	return options;
}
