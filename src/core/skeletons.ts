import type { Skeleton } from "./types";

/** The writer picks one. The tool only ever audits the choice. */
export const SKELETONS: readonly Skeleton[] = [
	{
		id: "problem-solution",
		name: "Problem → Solution",
		slots: [
			{ id: "hook", name: "Hook", hint: "the line that makes someone keep reading" },
			{ id: "symptom", name: "Symptom", hint: "what was observed, with numbers" },
			{ id: "diagnosis", name: "Diagnosis", hint: "why it happened" },
			{ id: "fix", name: "Fix", hint: "what you changed" },
			{ id: "cost", name: "Cost / caveat", hint: "what the fix made worse" },
			{ id: "close", name: "Close", hint: "what you'd tell your past self" },
		],
	},
	{
		id: "scqa",
		name: "SCQA",
		slots: [
			{ id: "situation", name: "Situation", hint: "the world as the reader knows it" },
			{ id: "complication", name: "Complication", hint: "what broke that assumption" },
			{ id: "question", name: "Question", hint: "the question the complication raises" },
			{ id: "answer", name: "Answer", hint: "your answer, stated first" },
		],
	},
	{
		id: "diataxis-explanation",
		name: "Diátaxis · explanation",
		slots: [
			{ id: "context", name: "Context", hint: "why this exists at all" },
			{ id: "mechanism", name: "Mechanism", hint: "how it actually works" },
			{ id: "alternatives", name: "Alternatives", hint: "what else could have been done" },
			{ id: "consequences", name: "Consequences", hint: "what follows from the design" },
		],
	},
	{
		id: "postmortem",
		name: "Post-mortem",
		slots: [
			{ id: "timeline", name: "Timeline", hint: "what happened, in order" },
			{ id: "impact", name: "Impact", hint: "who felt it and how much" },
			{ id: "cause", name: "Cause", hint: "the mechanism, not the culprit" },
			{ id: "remediation", name: "Remediation", hint: "what changed afterwards" },
			{ id: "lessons", name: "Lessons", hint: "what generalises" },
		],
	},
];

export function skeletonById(id: string | null): Skeleton | null {
	return SKELETONS.find((s) => s.id === id) ?? null;
}
