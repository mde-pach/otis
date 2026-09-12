/**
 * Cluster labels without a model: the terms that distinguish this cluster from
 * the others (class-based TF-IDF). Swap for an LLM labeler behind the Labeler
 * port when you want prettier names — the pipeline does not care.
 */

const STOPWORDS = new Set(
	`a an the and or but if then than that this these those it its is are was were be been being
	of in on at to for from with without into over under about as by we i you they he she our your
	their not no so such can could will would should may might must do does did done have has had
	what which who whom when where why how all any both each few more most other some only own same
	too very just also because while during after before again further once here there both`
		.split(/\s+/)
		.filter(Boolean),
);

function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/[^\p{L}\p{N}\s-]/gu, " ")
		.split(/\s+/)
		.filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/**
 * @param clusters texts grouped per cluster
 * @returns one label per cluster, in the same order
 */
export function labelClusters(clusters: string[][], termsPerLabel = 3): string[] {
	const tfs = clusters.map((texts) => {
		const tf = new Map<string, number>();
		for (const t of texts) for (const tok of tokenize(t)) tf.set(tok, (tf.get(tok) ?? 0) + 1);
		return tf;
	});

	const df = new Map<string, number>();
	for (const tf of tfs) for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);

	const total = clusters.length || 1;
	return tfs.map((tf) => {
		const scored = [...tf.entries()]
			.map(([term, count]) => ({
				term,
				score: count * Math.log(1 + total / (df.get(term) ?? 1)),
			}))
			.sort((a, b) => b.score - a.score || a.term.localeCompare(b.term));
		const picked = scored.slice(0, termsPerLabel).map((s) => s.term);
		return picked.length > 0 ? picked.join(" · ") : "untitled";
	});
}
