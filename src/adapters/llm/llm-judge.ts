/**
 * The judgments: gaps, missing steps, unsupported claims, digressions.
 *
 * Three gates stand between the model and the writer:
 *   1. the shape must parse
 *   2. every block and fragment id must resolve against the project
 *   3. the text must be a question — anything that reads as a sentence to paste
 *      into the draft is dropped, because that is the one thing this tool does
 *      not do
 */

import type { JudgedItem } from "../../core/review";
import type { Block, Fragment } from "../../core/types";
import { askJson, type LlmConfig } from "./claude-client";

const SYSTEM = `You are a developmental editor reading a draft the writer assembled from their own notes.

You never write prose for the writer. You only ask questions. Every item you return must:
- end in a question mark
- be one sentence, under 30 words
- point at a specific block by id
- never contain a sentence the writer could paste into the draft, and never suggest wording

Look for exactly these:
- missing-evidence: a claim that needs a number, an example or a source that is not in the draft
- missing-step: a jump in the reasoning where a step is implied but never stated
- unsupported-claim: an assertion the draft never comes back to
- digression: a block that is interesting but does not serve the article's argument

If an unused fragment would answer a gap, name it in candidateFragmentIds. Do not invent ids.
Return at most six items, the ones that would most change the piece. Fewer is better than padded.

Reply with JSON only:
{"items":[{"kind":"missing-evidence","blockId":"b03","question":"...?","candidateFragmentIds":["f34"]}]}`;

interface RawItems {
	items: {
		kind: string;
		blockId?: string;
		question?: string;
		candidateFragmentIds?: string[];
	}[];
}

const KINDS = new Set(["missing-evidence", "missing-step", "unsupported-claim", "digression"]);

function validate(value: unknown): RawItems {
	const v = value as Partial<RawItems>;
	if (!Array.isArray(v?.items)) throw new Error("expected an items array");
	return { items: v.items as RawItems["items"] };
}

export interface JudgeInput {
	blocks: Block[];
	unused: Fragment[];
	title: string;
}

export async function reviewDraft(config: LlmConfig, input: JudgeInput): Promise<JudgedItem[]> {
	if (input.blocks.length === 0) return [];

	const knownBlocks = new Set(input.blocks.map((b) => b.id));
	const knownFragments = new Set(input.unused.map((f) => f.id));

	const draft = input.blocks.map((b) => `${b.id}: ${b.text.replace(/\s+/g, " ")}`).join("\n");
	const unused = input.unused.length
		? input.unused.map((f) => `${f.id}: ${f.text.replace(/\s+/g, " ")}`).join("\n")
		: "(none)";

	const raw = await askJson<RawItems>(config, {
		system: SYSTEM,
		user: `Article: ${input.title}\n\nDraft, in order:\n${draft}\n\nFragments the writer wrote but has not used:\n${unused}`,
		maxTokens: 1500,
		validate,
	});

	return raw.items
		.map((item) => ({
			kind: String(item.kind) as JudgedItem["kind"],
			blockId: item.blockId ? String(item.blockId) : undefined,
			question: String(item.question ?? "").trim(),
			fragmentIds: (item.candidateFragmentIds ?? [])
				.map(String)
				.filter((id) => knownFragments.has(id)),
		}))
		.filter((item) => KINDS.has(item.kind))
		.filter((item) => item.blockId === undefined || knownBlocks.has(item.blockId))
		.filter((item) => item.question.endsWith("?") && item.question.split(/\s+/).length <= 30)
		.slice(0, 6);
}
