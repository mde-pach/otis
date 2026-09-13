/**
 * Locating the writer's text without cutting it up.
 *
 * A segment is an offset pair, not a copy: the notes stay one string that the
 * editor owns, and everything else points into it.
 *
 * A segment is the smallest thing worth moving, which is a sentence — not a
 * paragraph. A wall of notes typed as one long line is the ordinary case, and
 * if the whole of it were one segment there would be nothing to reorder and
 * nothing to light up. A line that really is one sentence stays one segment,
 * which is the same rule seen from the other end.
 *
 * Each segment remembers the block it came from, so the article can put a
 * paragraph back together rather than handing back one sentence per line.
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

/**
 * Blank lines, as the writer already sees them — except inside a fenced code
 * block, where a blank line is part of the code and splitting there would hand
 * the article half a program.
 */
function blocks(notes: string): Span[] {
	const out: Span[] = [];
	let offset = 0;
	let start = -1;
	let end = -1;
	let fenced = false;

	const flush = () => {
		if (start >= 0) out.push({ start, end });
		start = -1;
	};

	for (const line of notes.split("\n")) {
		const lineStart = offset;
		offset += line.length + 1;

		if (FENCE.test(line)) fenced = !fenced;

		if (!line.trim()) {
			if (!fenced) flush();
			continue;
		}

		if (start < 0) start = lineStart + (line.length - line.trimStart().length);
		end = lineStart + line.trimEnd().length;
	}

	flush();
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

/** The movable pieces of one block. */
function pieces(notes: string, block: Span): Span[] {
	const text = notes.slice(block.start, block.end);
	// a fence is one piece, always: it is a program, not prose
	if (FENCE.test(text)) return [block];

	const out: Span[] = [];
	let offset = 0;

	for (const line of text.split("\n")) {
		const lineStart = offset;
		offset += line.length + 1;
		if (!line.trim()) continue;

		const start = block.start + lineStart + (line.length - line.trimStart().length);
		const end = block.start + lineStart + line.trimEnd().length;
		// a heading, a bullet or a table row is already a unit the writer drew
		if (STRUCTURAL.test(line)) out.push({ start, end });
		else out.push(...sentences(notes, start, end));
	}

	return out;
}

export function segment(notes: string): Segment[] {
	const out: Segment[] = [];

	blocks(notes).forEach((block, index) => {
		for (const piece of pieces(notes, block)) {
			if (piece.end <= piece.start) continue;
			out.push({
				index: out.length,
				block: index,
				text: notes.slice(piece.start, piece.end),
				start: piece.start,
				end: piece.end,
			});
		}
	});

	return out;
}

/** The segment a caret offset falls inside, if any. */
export function segmentAt(segments: Segment[], offset: number): Segment | null {
	return segments.find((s) => offset >= s.start && offset <= s.end) ?? null;
}
