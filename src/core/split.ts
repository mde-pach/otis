/**
 * Splitting a document into fragments. No model involved — this is string work.
 *
 * Two rules that matter for technical writing:
 *   - a fenced code block is one fragment, never split on its inner blank lines
 *   - a heading is its own fragment, because it is a structural claim
 */

const FENCE = /^\s*(```|~~~)/;

export function splitDocument(text: string): string[] {
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	const out: string[] = [];
	let buf: string[] = [];
	let fence: string | null = null;

	const flush = () => {
		const joined = buf.join("\n").trim();
		if (joined.length > 0) out.push(joined);
		buf = [];
	};

	for (const line of lines) {
		const fenceMatch = line.match(FENCE);

		if (fence) {
			buf.push(line);
			if (fenceMatch && line.trim().startsWith(fence)) {
				fence = null;
				flush();
			}
			continue;
		}

		if (fenceMatch?.[1]) {
			flush();
			fence = fenceMatch[1];
			buf.push(line);
			continue;
		}

		if (line.trim() === "") {
			flush();
			continue;
		}

		if (/^\s*#{1,6}\s+/.test(line)) {
			flush();
			buf.push(line);
			flush();
			continue;
		}

		buf.push(line);
	}
	flush();

	return out;
}

/** Sentence segmentation, for splitting a fragment the writer wants broken up. */
export function splitSentences(text: string, locale = "en"): string[] {
	if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
		const seg = new Intl.Segmenter(locale, { granularity: "sentence" });
		return [...seg.segment(text)].map((s) => s.segment.trim()).filter((s) => s.length > 0);
	}
	return text
		.split(/(?<=[.!?])\s+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}
