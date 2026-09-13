/**
 * Locating the writer's text without cutting it up.
 *
 * A segment is an offset pair, not a copy: the notes stay one string that the
 * editor owns, and everything else points into it. This is what lets a single
 * line of input stay a single line while still being highlightable inside.
 */

import type { Segment } from "./types";

const FENCE = /^\s*```/;

/**
 * Blank lines are the only boundary the writer already sees — except inside a
 * fenced code block, where a blank line is part of the code and splitting there
 * would hand the article half a program.
 */
export function segment(notes: string): Segment[] {
	const out: Segment[] = [];
	let offset = 0;
	let start = -1;
	let end = -1;
	let fenced = false;

	const flush = () => {
		if (start < 0) return;
		out.push({ index: out.length, text: notes.slice(start, end), start, end });
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

/** The segment a caret offset falls inside, if any. */
export function segmentAt(segments: Segment[], offset: number): Segment | null {
	return segments.find((s) => offset >= s.start && offset <= s.end) ?? null;
}
