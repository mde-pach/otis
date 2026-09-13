import type { Pattern } from "../src/core/pattern";

/**
 * An essay is held together by an argument, not by a subject: the reader should
 * be able to say what you are claiming after the first few lines, and should be
 * given a reason to doubt it before the end.
 */
export const essay: Pattern = {
	id: "essay",
	group: "arguing",
	does: "works one claim from doubt to conviction",
	cues: ["essay", "argue", "argument", "opinion", "essai", "tribune"],
	signals: [
		"i think",
		"the mistake",
		"we cannot",
		"should",
		"responsibility",
		"rule",
		"erreur",
		"on ne peut pas",
		"responsabilité",
		"règle",
		"il faut",
		"critères",
	],
	brief: {
		en: "An essay arguing % — the claim early, and a reason to doubt it before the end.",
		fr: "Un essai qui défend % — la thèse tôt, et une raison d'en douter avant la fin.",
	},
	parts: [
		{
			id: "ground",
			does: "the case or situation the claim comes out of, before any claim is made",
			required: true,
			many: false,
			asks: {
				en: "what is the situation anyone would agree on?",
				fr: "quelle est la situation sur laquelle tout le monde serait d'accord ?",
			},
		},
		{
			id: "claim",
			does: "the one sentence the piece exists to defend",
			required: true,
			many: false,
			asks: { en: "what do you actually assert?", fr: "qu'est-ce que tu affirmes, au juste ?" },
		},
		{
			id: "reason",
			does: "a case, an argument or an example that carries the claim",
			required: true,
			many: true,
			asks: { en: "why should that be believed?", fr: "pourquoi devrait-on le croire ?" },
		},
		{
			id: "doubt",
			does: "the strongest case against the claim, put in its own words",
			required: true,
			many: false,
			asks: {
				en: "what would someone who disagrees say?",
				fr: "qu'est-ce que dirait quelqu'un qui n'est pas d'accord ?",
			},
		},
		{
			id: "answer",
			does: "why the objection does not undo the claim",
			required: true,
			many: false,
			asks: {
				en: "why does that not undo your claim?",
				fr: "pourquoi est-ce que ça ne défait pas ta thèse ?",
			},
		},
		{
			id: "condition",
			does: "what would have to hold for the claim to be true",
			required: false,
			many: true,
			asks: {
				en: "under what conditions does this hold?",
				fr: "à quelles conditions est-ce que ça tient ?",
			},
		},
	],
};
