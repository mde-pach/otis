/**
 * A kind of piece, as data the program runs.
 *
 * A pattern used to be a note handed to the model with the request to respect
 * it. That is not a rule — it is a rule whose target is also its enforcer, and
 * it holds right up until the run where it does not, with nothing in the system
 * able to tell the difference.
 *
 * So the pattern is a list of parts, and the program does the work: it asks the
 * model one closed question (which part does this section belong to), validates
 * the answer the way it would validate a form, puts the sections in the
 * pattern's order itself, and computes what is missing. The model never orders
 * anything and never says what is missing.
 */

/** Anything the writer reads has to be in the language they are writing in. */
export interface Said {
	en: string;
	fr: string;
}

export type Lang = keyof Said;

/** One slot of a kind of piece. */
export interface Part {
	id: string;
	/** one line, and the only thing about this part the model is ever told */
	does: string;
	/** a piece of this kind is not finished without it */
	required: boolean;
	/** whether several of the writer's sections may sit here */
	many: boolean;
	/**
	 * What the writer is asked when the slot comes up empty, in their language.
	 *
	 * Never sent to the model. It is printed, verbatim, by the program — so a
	 * gap is a question out of a file the writer can open and edit, not a
	 * sentence generated about their document.
	 */
	asks: Said;
	/**
	 * Declare this on a part that owes the reader something checkable.
	 *
	 * An impact in a post-mortem owes a figure; a reason in an essay owes
	 * nothing of the kind, and demanding one would be worse than saying
	 * nothing. So it is declared per part, by hand, and only where a program
	 * can actually tell the difference. `bun run evaluate` scores what this
	 * catches and what it costs; adding a part here without running it is
	 * guessing.
	 */
	wants?: "specifics";
	/** what the writer is asked when the slot is filled but delivers nothing */
	thin?: Said;
}

export interface Pattern {
	id: string;
	group: string;
	/** one line for the card: what this kind of piece does */
	does: string;
	/** words that suggest this kind when the writer says what they are making */
	cues: string[];
	/** words that suggest it from the notes themselves, before they have said */
	signals: string[];
	/** a brief in their words, not ours — `%` is where the subject goes */
	brief: Said;
	parts: Part[];
}

/** Where each of the writer's sections goes: a part id, or null for left out. */
export type Placement = (string | null)[];

export type Violation =
	| { kind: "missing"; index: number }
	| { kind: "unknown"; index: number; said: string }
	| { kind: "crowded"; part: string; indices: number[] };

/** What a violation reads like when it goes back to the model. */
export function say(violation: Violation): string {
	if (violation.kind === "missing") return `segment ${violation.index} was not answered`;
	if (violation.kind === "unknown") {
		return `segment ${violation.index} was given "${violation.said}", which is not a part`;
	}
	return `part "${violation.part}" takes one section but was given ${violation.indices.join(", ")}`;
}

function answer(raw: unknown, index: number): unknown {
	if (!raw || typeof raw !== "object") return undefined;
	const said = raw as Record<string, unknown>;
	return Array.isArray(raw) ? said[index] : (said[String(index)] ?? said[index]);
}

/**
 * The model's answer, judged. Not by another model — by this function.
 *
 * Independence is the whole point: the thing that checks the arrangement is not
 * the thing that produced it, so there is no path where the answer is taken on
 * trust. Anything this returns non-empty is re-asked once and then abandoned in
 * favour of the writer's own order.
 */
export function check(raw: unknown, pattern: Pattern, count: number): Violation[] {
	const known = new Map(pattern.parts.map((part) => [part.id, part]));
	const violations: Violation[] = [];
	const held = new Map<string, number[]>();

	for (let index = 0; index < count; index++) {
		const said = answer(raw, index);
		if (said === null) continue;
		if (said === undefined || said === "") {
			violations.push({ kind: "missing", index });
			continue;
		}
		const id = String(said);
		if (!known.has(id)) {
			violations.push({ kind: "unknown", index, said: id });
			continue;
		}
		held.set(id, [...(held.get(id) ?? []), index]);
	}

	for (const [id, indices] of held) {
		const part = known.get(id) as Part;
		if (!part.many && indices.length > 1) violations.push({ kind: "crowded", part: id, indices });
	}

	return violations;
}

/** A judged answer, converted. Unreadable entries are left out, never guessed. */
export function read(raw: unknown, pattern: Pattern, count: number): Placement {
	const known = new Set(pattern.parts.map((part) => part.id));
	return Array.from({ length: count }, (_, index) => {
		const said = answer(raw, index);
		if (said === null || said === undefined) return null;
		const id = String(said);
		return known.has(id) ? id : null;
	});
}

export interface Arrangement {
	/** the writer's section indices, in the order the pattern puts them */
	order: number[];
	/** the ones this placement leaves out, in the writer's own order */
	out: number[];
}

/**
 * The order, computed here and nowhere else.
 *
 * The model said what goes where; it did not say in what order, and it cannot.
 * The order is the pattern's part order, and inside a part the writer's own —
 * so the same placement is the same article, every time, by construction rather
 * than by asking nicely.
 */
export function arrange(placement: Placement, pattern: Pattern): Arrangement {
	const order: number[] = [];
	for (const part of pattern.parts) {
		placement.forEach((id, index) => {
			if (id === part.id) order.push(index);
		});
	}
	const out = placement.map((_, index) => index).filter((index) => !order.includes(index));
	return { order, out };
}

/** A part of this kind of piece that the writer has not actually covered. */
export interface Gap {
	part: string;
	/**
	 * `missing` — nothing of theirs is in this part at all.
	 * `thin` — something is, and it does not deliver what the part is for.
	 */
	kind: "missing" | "thin";
	/** the file's own words, printed as they are written */
	asks: string;
	/**
	 * Where to show the question: the last section placed before the hole, or
	 * the hollow section itself. Null when nothing precedes it.
	 */
	after: number | null;
}

/**
 * The one code-side test for whether a section delivers anything.
 *
 * Deliberately crude, and chosen by measurement rather than by taste: the
 * candidates it beat are in `bun run evaluate`, scored against the corpus, so
 * replacing it means beating it there rather than arguing about it. It is only
 * ever consulted for parts that declare `wants`, and it only ever produces a
 * question — never a rejection, and never a word in the article.
 */
const SPECIFIC = /\d/;

/**
 * What the piece does not cover, counted rather than noticed.
 *
 * No judgement is involved and no request is spent: a required part holding
 * none of the writer's sections is a gap, on every build, and what the writer
 * reads is the question their pattern file already carried.
 */
export function gaps(
	placement: Placement,
	pattern: Pattern,
	lang: Lang = "en",
	/** the writer's sections, by index, when the hollow check should run */
	texts: string[] = [],
): Gap[] {
	const found: Gap[] = [];
	let last: number | null = null;

	for (const part of pattern.parts) {
		const here = placement.reduce<number[]>((all, id, index) => {
			if (id === part.id) all.push(index);
			return all;
		}, []);

		if (here.length === 0) {
			if (part.required) {
				found.push({ part: part.id, kind: "missing", asks: part.asks[lang], after: last });
			}
			continue;
		}

		last = here[here.length - 1] as number;

		// filled, but by something that does not do the part's job
		if (part.wants === "specifics" && part.thin && texts.length > 0) {
			const said = here.map((index) => texts[index] ?? "");
			if (said.length > 0 && !said.some((text) => SPECIFIC.test(text))) {
				found.push({ part: part.id, kind: "thin", asks: part.thin[lang], after: last });
			}
		}
	}

	return found;
}
