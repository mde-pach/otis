import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createTransformersEmbedder } from "../adapters/embedder/transformers-embedder";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import { findDuplicates } from "../core/duplicates";
import { createEmbeddingGrouper } from "../core/embedding-grouper";
import type { GroupDiagnostics } from "../core/ports";
import { importDocument, stats, ungroupedFragments } from "../core/project";
import { cosine, type Vector } from "../core/similarity";
import { emptyProject, type Project } from "../core/types";

const PROJECT_ID = "current";

export type Phase = "idle" | "loading-model" | "embedding" | "grouping" | "ready" | "error";

const store = createIndexedDbStore();

const [phase, setPhase] = createSignal<Phase>("idle");
const [message, setMessage] = createSignal("");
const [device, setDevice] = createSignal<string | null>(null);
const [project, setProject] = createStore<Project>(emptyProject(PROJECT_ID, "Untitled article"));
const [duplicates, setDuplicates] = createSignal<{ a: string; b: string; reason: string }[]>([]);
const [diagnostics, setDiagnostics] = createSignal<GroupDiagnostics | null>(null);

/** Vectors are cached but never reactive — nothing in the UI renders a vector. */
let vectors: Record<string, Vector> = {};

const embedder = createTransformersEmbedder({
	onDevice: (d) => setDevice(d),
	onLoading: (detail) => {
		const d = detail as { status?: string; file?: string; progress?: number };
		if (d?.status === "progress" && typeof d.progress === "number") {
			setMessage(`downloading ${d.file ?? "model"} — ${Math.round(d.progress)}%`);
		}
	},
});

export const state = { phase, message, device, project, duplicates, diagnostics };

export async function init() {
	const saved = await store.load(PROJECT_ID);
	if (saved) {
		setProject(saved);
		vectors = await store.loadVectors(PROJECT_ID);
		recomputeDuplicates();
		setPhase("ready");
	}
}

export function projectStats() {
	return stats(project);
}

export function ungrouped() {
	return ungroupedFragments(project);
}

/**
 * Word overlap, not embeddings, and so it runs the moment text is pasted —
 * before any model has loaded, and whether or not one ever does.
 */
function recomputeDuplicates() {
	const fragments = project.fragments;
	if (fragments.length < 2) return setDuplicates([]);
	const pairs = findDuplicates(fragments.map((f) => f.text));
	setDuplicates(
		pairs.map((p) => ({
			a: (fragments[p.a] as { id: string }).id,
			b: (fragments[p.b] as { id: string }).id,
			reason: p.reason,
		})),
	);
}

export async function importText(text: string) {
	const { project: next } = importDocument(project, text);
	setProject(next);
	recomputeDuplicates();
	await store.save(next);
	await regroup();
}

/** Explicit, because it costs a model run. The counts above it are free and always live. */
export async function regroup() {
	if (project.fragments.length === 0) return;

	try {
		setPhase("loading-model");
		setMessage("preparing the embedder");

		const grouper = createEmbeddingGrouper({
			embedder: {
				id: embedder.id,
				embed: (texts) => {
					setPhase("embedding");
					return embedder.embed(texts, (done, total) => {
						setMessage(`embedding ${done} / ${total} fragments`);
					});
				},
			},
			cut: { kind: "largest-gap" },
			minClusterSize: 2,
			onVectors: (byId) => {
				vectors = { ...vectors, ...byId };
			},
		});

		const proposal = await grouper.propose(project.fragments);
		setPhase("grouping");

		setProject("groups", () =>
			proposal.groups.map((g, i) => ({ ...g, id: `g${String(i + 1).padStart(2, "0")}` })),
		);
		setProject("embedderId", embedder.id);
		setDiagnostics(proposal.diagnostics ?? null);
		setMessage(proposal.rationale);

		recomputeDuplicates();
		// unwrap: a Solid store is a Proxy, and structuredClone refuses one, so
		// IndexedDB silently lost every write until this was here.
		await store.save(unwrap(project));
		await store.saveVectors(PROJECT_ID, vectors);
		setPhase("ready");
	} catch (error) {
		const raw = (error as Error).message;
		const offline = /fetch|network|load model|onnx/i.test(raw);
		setPhase("error");
		setMessage(
			offline
				? `the embedding model could not be downloaded (${raw}). Your fragments are safe and still listed — grouping stays unavailable until the model loads.`
				: raw,
		);
	}
}

/**
 * Everything needed to argue with a grouping, as one JSON blob: the groups, the
 * numbers behind them, and every pairwise similarity. Meant to be pasted
 * somewhere and picked apart, which is the only way to tell a bad threshold
 * from a bad idea.
 */
export function exportDiagnostics(): string {
	const ids = project.fragments.map((f) => f.id).filter((id) => vectors[id]);
	const pairs: [string, string, number][] = [];
	for (let i = 0; i < ids.length; i++) {
		for (let j = i + 1; j < ids.length; j++) {
			const a = vectors[ids[i] as string] as Vector;
			const b = vectors[ids[j] as string] as Vector;
			pairs.push([ids[i] as string, ids[j] as string, Number(cosine(a, b).toFixed(4))]);
		}
	}
	return JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			fragments: project.fragments.map((f) => ({ id: f.id, text: f.text })),
			groups: project.groups.map((g) => ({
				id: g.id,
				label: g.label,
				auto: g.auto,
				fragmentIds: g.fragmentIds,
			})),
			ungroupedFragmentIds: ungroupedFragments(project).map((f) => f.id),
			duplicates: duplicates(),
			diagnostics: diagnostics(),
			rawPairSimilarity: pairs,
		},
		null,
		1,
	);
}

export async function copyDiagnostics(): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(exportDiagnostics());
		return true;
	} catch {
		return false;
	}
}

export async function renameGroup(groupId: string, label: string) {
	setProject("groups", (g) => g.id === groupId, { label, auto: false });
	await store.save(unwrap(project));
}

export async function reset() {
	vectors = {};
	setDuplicates([]);
	setDiagnostics(null);
	const fresh = emptyProject(PROJECT_ID, "Untitled article");
	setProject(fresh);
	await store.save(fresh);
	await store.saveVectors(PROJECT_ID, {});
	setPhase("idle");
	setMessage("");
}

export function fragmentText(id: string): string {
	return project.fragments.find((f) => f.id === id)?.text ?? "";
}
