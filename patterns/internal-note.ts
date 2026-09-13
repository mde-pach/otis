import type { Pattern } from "../src/core/pattern";

/**
 * An internal note is read for status before it is read for reasoning. The
 * audience already has the context, so background is dead weight and there is
 * no slot for it.
 */
export const internalNote: Pattern = {
	id: "internal-note",
	group: "working",
	does: "what changed, and what to do about it now",
	cues: ["note", "my team", "internal", "status", "update", "standup"],
	signals: ["shipped", "we decided", "next week", "the team", "todo", "équipe", "livré", "décidé"],
	brief: {
		en: "A short note to my own team about %. What changed, and what to do now.",
		fr: "Une note courte à mon équipe sur %. Ce qui change, et quoi faire maintenant.",
	},
	parts: [
		{
			id: "change",
			does: "what changed, said in one go",
			required: true,
			many: false,
			asks: { en: "what changed?", fr: "qu'est-ce qui a changé ?" },
		},
		{
			id: "state",
			does: "whether it is live, and since when",
			required: true,
			many: false,
			wants: "specifics",
			asks: { en: "is it live, and since when?", fr: "est-ce en prod, et depuis quand ?" },
			thin: {
				en: 'since when, exactly? "soon" is not a date anyone can plan around',
				fr: "depuis quand, exactement ? « prochainement » n'est pas une date",
			},
		},
		{
			id: "action",
			does: "what someone should do differently now",
			required: true,
			many: true,
			asks: {
				en: "what should someone do differently now?",
				fr: "qu'est-ce qu'on doit faire différemment maintenant ?",
			},
		},
		{
			id: "why",
			does: "the one piece of reasoning the decision would be argued with without",
			required: false,
			many: false,
			asks: {
				en: "would anyone argue with this? say why once",
				fr: "est-ce que quelqu'un va discuter ? dis pourquoi, une fois",
			},
		},
	],
};
