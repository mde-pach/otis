import type { Pattern } from "../src/core/pattern";

/**
 * A post-mortem is read by someone who was not there and will not ask a
 * follow-up question. Omitting the cost is what turns one into an engineering
 * anecdote, so cost is required here rather than encouraged.
 */
export const postMortem: Pattern = {
	id: "post-mortem",
	group: "reporting",
	does: "what happened, what it cost, and what would catch it sooner",
	cues: ["post-mortem", "postmortem", "incident", "outage", "went wrong", "retro"],
	signals: [
		"incident",
		"outage",
		"p99",
		"p50",
		"latency",
		"rollback",
		"downtime",
		"postmortem",
		"panne",
		"coupure",
		"correctif",
	],
	brief: {
		en: "A post-mortem on % for people who were not there. Lead with the cost.",
		fr: "Un post-mortem sur % pour des gens qui n'étaient pas là. Commencer par le coût.",
	},
	parts: [
		{
			id: "observed",
			does: "what was seen, and when — the first symptom, with its time",
			required: true,
			many: false,
			wants: "specifics",
			asks: {
				en: "what was seen first, and at what time?",
				fr: "qu'est-ce qu'on a vu en premier, et à quelle heure ?",
			},
			thin: {
				en: "when did it start, and what did the numbers actually do?",
				fr: "ça a commencé quand, et les chiffres ont fait quoi au juste ?",
			},
		},
		{
			id: "cost",
			does: "what it cost the people on the other end",
			required: true,
			many: false,
			wants: "specifics",
			asks: {
				en: "what did it cost the people on the other end?",
				fr: "qu'est-ce que ça a coûté aux gens en face ?",
			},
			thin: {
				en: "how many, for how long? a cost without a figure reads as an anecdote",
				fr: "combien, et pendant combien de temps ? un coût sans chiffre passe pour une anecdote",
			},
		},
		{
			id: "cause",
			does: "what actually happened, under the symptom",
			required: true,
			many: true,
			asks: { en: "what actually happened?", fr: "qu'est-ce qui s'est vraiment passé ?" },
		},
		{
			id: "hidden",
			does: "why it was not caught earlier",
			required: true,
			many: false,
			asks: {
				en: "why did nobody see it sooner?",
				fr: "pourquoi personne ne l'a vu plus tôt ?",
			},
		},
		{
			id: "fix",
			does: "what changed, and whether it is live",
			required: true,
			many: true,
			asks: {
				en: "what changed, and is it live?",
				fr: "qu'est-ce qui a changé, et est-ce en prod ?",
			},
		},
		{
			id: "detection",
			does: "what would catch the same thing sooner next time",
			required: true,
			many: false,
			asks: {
				en: "what would catch it sooner next time?",
				fr: "qu'est-ce qui le verrait plus tôt la prochaine fois ?",
			},
		},
	],
};
