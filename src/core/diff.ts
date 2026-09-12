/** Word-level diff. Drives the provenance state and the cheap faithfulness signal. */

export type DiffOp = { type: "keep" | "del" | "ins"; text: string };

function words(text: string): string[] {
	return text.split(/(\s+)/).filter((w) => w.length > 0);
}

export function diffWords(before: string, after: string): DiffOp[] {
	const a = words(before);
	const b = words(after);
	const n = a.length;
	const m = b.length;

	// LCS table. Fragments are short; the quadratic table is not a problem.
	const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			(lcs[i] as number[])[j] =
				a[i] === b[j]
					? ((lcs[i + 1] as number[])[j + 1] as number) + 1
					: Math.max((lcs[i + 1] as number[])[j] as number, (lcs[i] as number[])[j + 1] as number);
		}
	}

	const ops: DiffOp[] = [];
	let i = 0;
	let j = 0;
	const push = (type: DiffOp["type"], text: string) => {
		const last = ops[ops.length - 1];
		if (last && last.type === type) last.text += text;
		else ops.push({ type, text });
	};
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			push("keep", a[i] as string);
			i++;
			j++;
		} else if (((lcs[i + 1] as number[])[j] as number) >= ((lcs[i] as number[])[j + 1] as number)) {
			push("del", a[i] as string);
			i++;
		} else {
			push("ins", b[j] as string);
			j++;
		}
	}
	while (i < n) push("del", a[i++] as string);
	while (j < m) push("ins", b[j++] as string);
	return ops;
}

/**
 * Share of the original's words kept. A first-pass faithfulness signal: a reword
 * that keeps almost nothing is not a reword.
 */
export function retentionRatio(before: string, after: string): number {
	const ops = diffWords(before, after);
	const kept = ops
		.filter((o) => o.type === "keep")
		.reduce((acc, o) => acc + o.text.trim().split(/\s+/).filter(Boolean).length, 0);
	const originalLength = before.trim().split(/\s+/).filter(Boolean).length;
	return originalLength === 0 ? 1 : kept / originalLength;
}

/**
 * Share of the original's words that survive anywhere in the rewrite, order
 * ignored.
 *
 * `retentionRatio` above walks the sequence, so it scores a faithful
 * reordering at zero — "p99 went from 180ms to 410ms in the week after
 * rollout" rearranged to lead with the week keeps every word and shares almost
 * no subsequence. For judging whether a reword kept the writer's words, the bag
 * is the honest measure; the sequence version is for rendering a diff.
 */
export function wordRetention(before: string, after: string): number {
	const bag = (text: string) =>
		text
			.toLowerCase()
			.replace(/[^\p{L}\p{N}\s]/gu, " ")
			.split(/\s+/)
			.filter(Boolean);

	const original = bag(before);
	if (original.length === 0) return 1;

	const remaining = new Map<string, number>();
	for (const word of bag(after)) remaining.set(word, (remaining.get(word) ?? 0) + 1);

	let kept = 0;
	for (const word of original) {
		const left = remaining.get(word) ?? 0;
		if (left > 0) {
			kept++;
			remaining.set(word, left - 1);
		}
	}
	return kept / original.length;
}
