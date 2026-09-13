/**
 * Locating the writer's text without cutting it up.
 *
 * A segment is an offset pair, not a copy: the notes stay one string that the
 * editor owns, and everything else points into it.
 *
 * A segment is a section of the writer's own document — a thing they separated
 * from its neighbours. There is no paragraph model here and nothing is grouped
 * back together afterwards: a section goes in and a section comes out, and how
 * it is laid out is Markdown, decided in the text itself.
 *
 * The boundary is whichever one the document actually has. A document with
 * blank lines is cut at the blank lines. One typed as several lines is cut at
 * the lines. One typed as a single line is cut at its sentences, because
 * otherwise there would be one section and nothing to move.
 */

import type { Segment } from "./types";

const FENCE = /^\s*```/;

/** a line the writer has already marked as a thing of its own */
const STRUCTURAL = /^\s*(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\|)/;

/**
 * A capital in front is what tells `Ms. Patel` from `39ms. Nobody`, and this is
 * a tool for technical notes: milliseconds turn up far more often than
 * honorifics, so these only count capitalised.
 */
const TITLES = new Set([
	"Mr",
	"Mrs",
	"Ms",
	"Dr",
	"Prof",
	"St",
	"Jr",
	"Sr",
	"Fig",
	"No",
	"Inc",
	"Ltd",
	"Co",
	"Vol",
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Sept",
	"Oct",
	"Nov",
	"Dec",
]);

/** never a unit, whatever case it is written in */
const SHORTHAND = new Set(["etc", "eg", "ie", "cf", "al", "vs", "approx", "pp", "ca", "resp"]);

interface Span {
	start: number;
	end: number;
}

interface Row extends Span {
	text: string;
	fence: boolean;
}

/** The whitespace the writer cannot see is not part of what they wrote. */
function tighten(notes: string, span: Span): Span {
	let { start, end } = span;
	while (start < end && /\s/.test(notes[start] as string)) start++;
	while (end > start && /\s/.test(notes[end - 1] as string)) end--;
	return { start, end };
}

/**
 * Every line, with fenced runs already folded into one. A blank line inside a
 * fence is part of the code, and splitting there would hand the article half a
 * program.
 */
function rows(notes: string): Row[] {
	const out: Row[] = [];
	let offset = 0;
	let open: Row | null = null;

	for (const line of notes.split("\n")) {
		const start = offset;
		const end = start + line.length;
		offset += line.length + 1;

		if (FENCE.test(line)) {
			if (open) {
				open.end = end;
				open.text = notes.slice(open.start, end);
				open = null;
			} else {
				open = { start, end, text: line, fence: true };
				out.push(open);
			}
			continue;
		}
		if (open) {
			open.end = end;
			open.text = notes.slice(open.start, end);
			continue;
		}
		out.push({ start, end, text: line, fence: false });
	}

	return out;
}

/** A stop that is part of a word — an initial, or an abbreviation — is not a stop. */
function ends(notes: string, from: number, dot: number): boolean {
	let at = dot;
	while (at > from && /[A-Za-z]/.test(notes[at - 1] as string)) at--;
	const word = notes.slice(at, dot);
	if (word.length === 1) return false;
	if (TITLES.has(word)) return false;
	return !SHORTHAND.has(word.toLowerCase());
}

/**
 * Sentences inside one line. Deliberately shy: a full stop only ends a sentence
 * when whitespace follows it, so `180.5ms`, `1.2.3` and `redis.get(key)` stay
 * whole — and never after an initial or an abbreviation, which is what saves
 * `e.g.` and `J. Smith`. What follows may well be lower case: notes open
 * sentences with `p99` and `redis` all the time.
 */
function sentences(notes: string, start: number, end: number): Span[] {
	const out: Span[] = [];
	let from = start;
	let code = false;

	for (let i = start; i < end; i++) {
		const ch = notes[i] as string;
		if (ch === "`") {
			code = !code;
			continue;
		}
		// inside a code span, and behind a stop already taken, nothing counts
		if (code || i < from || (ch !== "." && ch !== "!" && ch !== "?")) continue;

		// an ellipsis, and whatever was closed on the way out
		let stop = i + 1;
		while (stop < end && /[.!?)\]"'”’»]/.test(notes[stop] as string)) stop++;
		if (stop >= end || !/\s/.test(notes[stop] as string)) continue;

		let next = stop;
		while (next < end && /\s/.test(notes[next] as string)) next++;
		if (next >= end) break;
		// notes open sentences with p99 and redis, so a small letter proves
		// nothing; only punctuation that can only be a continuation does
		if (/[,;:)\]}]/.test(notes[next] as string)) continue;
		if (ch === "." && !ends(notes, from, i)) continue;

		out.push({ start: from, end: stop });
		from = next;
	}

	if (from < end) out.push({ start: from, end });
	return out;
}

/**
 * One run of lines with no blank line in it. A bullet list is not one section —
 * the writer drew those boundaries — but a wrapped run of prose is.
 */
function sections(notes: string, group: Row[]): Span[] {
	if (group.some((row) => STRUCTURAL.test(row.text))) {
		return group.map((row) => tighten(notes, row));
	}
	const first = group[0] as Row;
	const last = group.at(-1) as Row;
	return [tighten(notes, { start: first.start, end: last.end })];
}

/** Cut at the strongest boundary the document actually has. */
function cut(notes: string): Span[] {
	const all = rows(notes);
	const spaced = all.some((row) => !row.fence && !row.text.trim());

	if (spaced) {
		const out: Span[] = [];
		let group: Row[] = [];
		const flush = () => {
			if (group.length) out.push(...sections(notes, group));
			group = [];
		};
		for (const row of all) {
			if (row.fence) {
				flush();
				out.push(tighten(notes, row));
			} else if (!row.text.trim()) {
				flush();
			} else {
				group.push(row);
			}
		}
		flush();
		return out;
	}

	const body = all.filter((row) => row.fence || row.text.trim());
	if (body.length > 1) return body.map((row) => tighten(notes, row));

	const only = body[0];
	if (!only) return [];
	const span = tighten(notes, only);
	// one line, and nothing else to cut at: its sentences are its sections
	return only.fence ? [span] : sentences(notes, span.start, span.end);
}

export function segment(notes: string): Segment[] {
	return cut(notes)
		.filter((span) => span.end > span.start)
		.map((span, index) => ({
			index,
			text: notes.slice(span.start, span.end),
			start: span.start,
			end: span.end,
		}));
}

/** The segment a caret offset falls inside, if any. */
export function segmentAt(segments: Segment[], offset: number): Segment | null {
	return segments.find((s) => offset >= s.start && offset <= s.end) ?? null;
}
