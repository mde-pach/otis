import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { createTransformersEmbedder } from "../adapters/embedder/transformers-embedder";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import { nearDuplicates } from "../core/cluster";
import { createEmbeddingGrouper } from "../core/embedding-grouper";
import { importDocument, stats, ungroupedFragments } from "../core/project";
import type { Vector } from "../core/similarity";
import { emptyProject, type Project } from "../core/types";

const PROJECT_ID = "current";

export type Phase = "idle" | "loading-model" | "embedding" | "grouping" | "ready" | "error";

const store = createIndexedDbStore();

const [phase, setPhase] = createSignal<Phase>("idle");
const [message, setMessage] = createSignal("");
const [device, setDevice] = createSignal<string | null>(null);
const [project, setProject] = createStore<Project>(emptyProject(PROJECT_ID, "Untitled article"));
const [duplicates, setDuplicates] = createSignal<{ a: string; b: string; score: number }[]>([]);

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

export const state = { phase, message, device, project, duplicates };

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

function recomputeDuplicates() {
	const ids = project.fragments.map((f) => f.id).filter((id) => vectors[id]);
	if (ids.length < 2) return setDuplicates([]);
	const pairs = nearDuplicates(
		ids.map((id) => vectors[id] as Vector),
		0.9,
	);
	setDuplicates(
		pairs.map((p) => ({ a: ids[p.a] as string, b: ids[p.b] as string, score: p.score })),
	);
}

export async function importText(text: string) {
	const { project: next } = importDocument(project, text);
	setProject(next);
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
			threshold: 0.55,
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
		setMessage(proposal.rationale);

		recomputeDuplicates();
		await store.save(project);
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

export async function renameGroup(groupId: string, label: string) {
	setProject("groups", (g) => g.id === groupId, { label, auto: false });
	await store.save(project);
}

export async function reset() {
	vectors = {};
	setDuplicates([]);
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
