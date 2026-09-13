import type { Pattern } from "../src/core/pattern";

/**
 * An explanation is judged by whether the reader can predict behaviour
 * afterwards, not by how much ground it covers. One mechanism at a time, and a
 * worked example in place of a definition.
 */
export const howItWorks: Pattern = {
	id: "how-it-works",
	group: "explaining",
	does: "one mechanism at a time, until the reader can predict it",
	cues: ["how it works", "explain", "tutorial", "guide", "walkthrough", "deep dive"],
	signals: [
		"works",
		"mechanism",
		"because",
		"means that",
		"in other words",
		"for example",
		"fonctionne",
		"mécanisme",
		"c'est-à-dire",
		"par exemple",
		"autrement dit",
	],
	brief: {
		en: "An explanation of % for someone who has never touched it. One mechanism at a time.",
		fr: "Une explication de % pour quelqu'un qui n'y a jamais touché. Un mécanisme à la fois.",
	},
	parts: [
		{
			id: "belief",
			does: "what the reader already thinks, and the point where that belief breaks",
			required: true,
			many: false,
			asks: {
				en: "what does your reader believe now, and where does it break?",
				fr: "qu'est-ce que ton lecteur croit déjà, et où est-ce que ça casse ?",
			},
		},
		{
			id: "mechanism",
			does: "one moving part of the thing, explained on its own",
			required: true,
			many: true,
			asks: {
				en: "which part actually does the work?",
				fr: "quelle pièce fait vraiment le travail ?",
			},
		},
		{
			id: "example",
			does: "a case where the mechanism visibly matters",
			required: true,
			many: true,
			wants: "specifics",
			asks: {
				en: "show one case where it visibly matters",
				fr: "montre un cas où ça se voit vraiment",
			},
			thin: {
				en: "which case, with what numbers? an example nobody can picture is a claim",
				fr: "quel cas, avec quels chiffres ? un exemple qu'on ne peut pas voir est une affirmation",
			},
		},
		{
			id: "limit",
			does: "where the explanation stops being true",
			required: true,
			many: false,
			asks: {
				en: "where does this stop being true?",
				fr: "où est-ce que ça cesse d'être vrai ?",
			},
		},
		{
			id: "consequence",
			does: "what the reader can now predict that they could not before",
			required: false,
			many: true,
			asks: {
				en: "what can they predict now that they could not before?",
				fr: "qu'est-ce qu'ils peuvent prévoir maintenant qu'ils ne pouvaient pas avant ?",
			},
		},
	],
};
