/**
 * The deterministic Grouper: embed, cluster, label.
 *
 * It is deliberately dumb about meaning — it groups by vocabulary, not by
 * argument. When an LlmGrouper eventually lands beside it, both implement the
 * same port and can be compared on the same fragments.
 */

import { agglomerative } from "./cluster";
import { labelClusters } from "./label";
import type { Embedder, Grouper, GroupProposal, Labeler } from "./ports";
import type { Vector } from "./similarity";
import type { Fragment } from "./types";

export interface EmbeddingGrouperOptions {
	embedder: Embedder;
	labeler?: Labeler;
	/** Average-linkage cut. Lower = fewer, broader groups. */
	threshold?: number;
	/** Clusters smaller than this are left ungrouped rather than pretended into a theme. */
	minClusterSize?: number;
	onVectors?: (vectors: Record<string, Vector>) => void;
}

export function createEmbeddingGrouper(options: EmbeddingGrouperOptions): Grouper {
	const { embedder, labeler, threshold = 0.55, minClusterSize = 2, onVectors } = options;

	return {
		id: `embedding-grouper(${embedder.id})`,

		async propose(fragments: Fragment[]): Promise<GroupProposal> {
			if (fragments.length === 0) {
				return { groups: [], ungroupedFragmentIds: [], rationale: "nothing to group" };
			}

			const vectors = await embedder.embed(fragments.map((f) => f.text));
			if (onVectors) {
				const byId: Record<string, Vector> = {};
				fragments.forEach((f, i) => {
					byId[f.id] = vectors[i] as Vector;
				});
				onVectors(byId);
			}

			const { clusters } = agglomerative(vectors, threshold);
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
				rationale: `average-linkage clustering at ${threshold} over ${embedder.id} vectors`,
			};
		},
	};
}
