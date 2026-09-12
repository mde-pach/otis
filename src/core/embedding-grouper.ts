/**
 * The deterministic Grouper: embed, centre, cluster, label.
 *
 * It is deliberately dumb about meaning — it groups by vocabulary, not by
 * argument. When an LlmGrouper eventually lands beside it, both implement the
 * same port and can be compared on the same fixture.
 *
 * Two choices are worth knowing about, because both were wrong in the first
 * version and both showed up as "everything landed in one group":
 *
 *   1. Vectors are centred first. Every fragment of one article shares a large
 *      common direction, and that shared component swamps the cosine.
 *   2. The tree is cut at the largest gap in merge scores, not at a fixed
 *      number. Where a pile stops agreeing with itself is a relative question.
 *
 * Raw, uncentred vectors are kept for near-duplicate detection: "0.94 similar"
 * should mean the same thing on every pile, so that one stays absolute.
 */

import { agglomerative, type CutStrategy } from "./cluster";
import { labelClusters } from "./label";
import type { Embedder, Grouper, GroupProposal, Labeler } from "./ports";
import { centerVectors, similarityStats, type Vector } from "./similarity";
import type { Fragment } from "./types";

export interface EmbeddingGrouperOptions {
	embedder: Embedder;
	labeler?: Labeler;
	/** Default: cut where the merge scores drop most. */
	cut?: CutStrategy;
	/** Remove the corpus mean before clustering. Off only for comparison runs. */
	center?: boolean;
	/** Clusters smaller than this are left ungrouped rather than pretended into a theme. */
	minClusterSize?: number;
	onVectors?: (vectors: Record<string, Vector>) => void;
}

export function createEmbeddingGrouper(options: EmbeddingGrouperOptions): Grouper {
	const {
		embedder,
		labeler,
		cut = { kind: "largest-gap" },
		center = true,
		minClusterSize = 2,
		onVectors,
	} = options;

	return {
		id: `embedding-grouper(${embedder.id})`,

		async propose(fragments: Fragment[]): Promise<GroupProposal> {
			if (fragments.length === 0) {
				return { groups: [], ungroupedFragmentIds: [], rationale: "nothing to group" };
			}

			const raw = await embedder.embed(fragments.map((f) => f.text));
			if (onVectors) {
				const byId: Record<string, Vector> = {};
				fragments.forEach((f, i) => {
					byId[f.id] = raw[i] as Vector;
				});
				onVectors(byId);
			}

			const vectors = center ? centerVectors(raw) : raw;
			const rawStats = similarityStats(raw);
			const centredStats = similarityStats(vectors);
			const { clusters, cutScore, reason, merges } = agglomerative(vectors, cut);

			const kept = clusters.filter((c) => c.length >= minClusterSize);
			const dropped = clusters.filter((c) => c.length < minClusterSize).flat();

			const texts = kept.map((c) => c.map((i) => (fragments[i] as Fragment).text));
			const labels = labeler ? await labeler.label(texts) : labelClusters(texts);

			return {
				groups: kept.map((cluster, i) => ({
					label: labels[i] ?? "untitled",
					fragmentIds: cluster.map((idx) => (fragments[idx] as Fragment).id),
					auto: true,
				})),
				ungroupedFragmentIds: dropped.map((idx) => (fragments[idx] as Fragment).id),
				rationale: `${embedder.id} · ${center ? "centred" : "raw"} vectors · ${reason}`,
				diagnostics: {
					embedderId: embedder.id,
					centred: center,
					cutScore,
					rawSimilarity: rawStats,
					clusteringSimilarity: centredStats,
					mergeScores: merges.map((m) => m.score),
					fragmentIds: fragments.map((f) => f.id),
				},
			};
		},
	};
}
