import type { Skeleton } from "./types";

/**
 * Shapes are roles, not headings.
 *
 * A role is stable across articles — every post-mortem has a cause — which is
 * what makes two runs comparable and "why this shape?" answerable. A heading is
 * the opposite: it belongs to one article, and a fixed one ("What was
 * happening") would never survive contact with a real piece. So roles live
 * here, titles are written per article from the writer's own vocabulary, and
 * the tool marks them as its words until the writer touches them.
 *
 * `hint` is written for the model that assigns paragraphs. The writer never
 * reads it.
 */
export const SKELETONS: readonly Skeleton[] = [
	{
		id: "postmortem",
		name: "Post-mortem",
		summary: "something broke, here is what it cost and what changed",
		slots: [
			{ id: "opening", role: "opening", hint: "the line that states the surprise" },
			{ id: "timeline", role: "what happened", hint: "events in order, with times or sequence" },
			{ id: "impact", role: "impact", hint: "what it cost, in measurements" },
			{ id: "cause", role: "cause", hint: "the mechanism, not the culprit" },
			{ id: "fix", role: "remediation", hint: "what was changed, and what the change cost" },
			{ id: "lessons", role: "what generalises", hint: "what the writer would tell themselves" },
		],
	},
	{
		id: "problem-solution",
		name: "Problem, then solution",
		summary: "a thing was wrong, here is the diagnosis and the fix",
		slots: [
			{ id: "hook", role: "hook", hint: "the line that makes someone keep reading" },
			{ id: "symptom", role: "symptom", hint: "what was observed, with numbers" },
			{ id: "diagnosis", role: "diagnosis", hint: "why it happened" },
			{ id: "fix", role: "fix", hint: "what was changed" },
			{ id: "cost", role: "cost", hint: "what the fix made worse" },
			{ id: "close", role: "close", hint: "the closing judgement" },
		],
	},
	{
		id: "explanation",
		name: "Explanation",
		summary: "how a thing works and why it is built that way",
		slots: [
			{ id: "context", role: "context", hint: "why this exists at all" },
			{ id: "mechanism", role: "mechanism", hint: "how it actually works" },
			{ id: "alternatives", role: "alternatives", hint: "what else could have been done" },
			{ id: "consequences", role: "consequences", hint: "what follows from the design" },
		],
	},
	{
		id: "as-written",
		name: "My order, tidied",
		summary: "nothing moves far; repeats and stragglers are marked",
		slots: [{ id: "body", role: "the piece", hint: "everything, in the order it was written" }],
	},
];

export function skeletonById(id: string | null): Skeleton | null {
	return SKELETONS.find((s) => s.id === id) ?? null;
}

export const DEFAULT_SKELETON = "as-written";
