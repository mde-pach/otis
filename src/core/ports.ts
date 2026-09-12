/**
 * Ports. Everything impure enters through one of these, and the core depends on
 * the interface only.
 *
 * The Grouper port is the one that matters most right now: today it is backed by
 * embeddings + clustering, tomorrow it can be backed by an LLM reading the
 * fragments, and nothing above it changes. Same for Labeler.
 */

import type { SimilarityStats, Vector } from "./similarity";
import type { Fragment, Group, Project } from "./types";

export interface Embedder {
	/** Stable identity, e.g. "minilm-l6-v2@webgpu". Vectors are not comparable across ids. */
	readonly id: string;
	embed(texts: string[], onProgress?: (done: number, total: number) => void): Promise<Vector[]>;
}

export interface GroupProposal {
	groups: Omit<Group, "id">[];
	/** Fragments the grouper deliberately left out. Noise is a signal, not a failure. */
	ungroupedFragmentIds: string[];
	/** How this proposal was produced, shown to the writer verbatim. */
	rationale: string;
	/** Everything needed to argue with the result rather than just accept it. */
	diagnostics?: GroupDiagnostics;
}

export interface GroupDiagnostics {
	embedderId: string;
	centred: boolean;
	cutScore: number;
	/** Similarities as the embedder produced them — the duplicate threshold lives here. */
	rawSimilarity: SimilarityStats;
	/** Similarities the clustering actually saw. A narrow spread explains a bad grouping. */
	clusteringSimilarity: SimilarityStats;
	/** Every merge score, highest first. The shape of the tree. */
	mergeScores: number[];
	fragmentIds: string[];
}

export interface Grouper {
	readonly id: string;
	propose(fragments: Fragment[]): Promise<GroupProposal>;
}

export interface Labeler {
	readonly id: string;
	label(clusters: string[][]): Promise<string[]>;
}

export interface ProjectStore {
	list(): Promise<{ id: string; title: string; updatedAt: number }[]>;
	load(id: string): Promise<Project | null>;
	save(project: Project): Promise<void>;
	remove(id: string): Promise<void>;
	saveVectors(projectId: string, vectors: Record<string, Vector>): Promise<void>;
	loadVectors(projectId: string): Promise<Record<string, Vector>>;
}

/**
 * Judgments about the writing — gaps, claim/evidence, mode confusion, rewords.
 * Not implemented yet: these are the calls that need a frontier model and a key,
 * and they only ever run when the writer asks for a review round.
 */
export interface Judge {
	readonly id: string;
	reviewGaps(input: {
		blocks: { id: string; text: string }[];
		unusedFragmentIds: string[];
	}): Promise<
		{
			kind: "missing-evidence" | "missing-step" | "unsupported-claim";
			blockId: string;
			question: string;
			candidateFragmentIds: string[];
		}[]
	>;
}
