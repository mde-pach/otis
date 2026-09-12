import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createTransformersEmbedder } from "../adapters/embedder/transformers-embedder";
import { createLlmGrouper } from "../adapters/llm/llm-grouper";
import { reviewDraft } from "../adapters/llm/llm-judge";
import { suggestRewords } from "../adapters/llm/llm-reworder";
import { hasKey, loadKey, loadModel, saveKey, saveModel } from "../adapters/llm/settings";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import * as draft from "../core/draft";
import { findDuplicates } from "../core/duplicates";
import { createEmbeddingGrouper } from "../core/embedding-grouper";
import type { GroupDiagnostics } from "../core/ports";
import { importDocument, orphanFragments, stats, ungroupedFragments } from "../core/project";
import * as review from "../core/review";
import * as reword from "../core/reword";
import type { Vector } from "../core/similarity";
import { emptyProject, type Project } from "../core/types";

const PROJECT_ID = "current";

export type Surface = "pile" | "plan" | "draft" | "review";
export type Phase =
	| "idle"
	| "loading-model"
	| "embedding"
	| "grouping"
	| "reviewing"
	| "ready"
	| "error";

const store = createIndexedDbStore();

const [phase, setPhase] = createSignal<Phase>("idle");
const [message, setMessage] = createSignal("");
const [device, setDevice] = createSignal<string | null>(null);
const [surface, setSurface] = createSignal<Surface>("pile");
const [project, setProject] = createStore<Project>(emptyProject(PROJECT_ID, "Untitled article"));
const [duplicates, setDuplicates] = createSignal<{ a: string; b: string; reason: string }[]>([]);
const [diagnostics, setDiagnostics] = createSignal<GroupDiagnostics | null>(null);
const [apiKey, setApiKeySignal] = createSignal(loadKey());
const [model, setModelSignal] = createSignal(loadModel());

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

export const state = {
	phase,
	message,
	device,
	surface,
	project,
	duplicates,
	diagnostics,
	apiKey,
	model,
};

export { setSurface };

/** One place where the store is written and the project is persisted. */
async function commit(next: Project) {
	setProject(next);
	recomputeDuplicates();
	// unwrap: a Solid store is a Proxy and structuredClone refuses one.
	await store.save(unwrap(project));
}

export async function init() {
	const saved = await store.load(PROJECT_ID);
	if (saved) {
		// projects saved before rounds existed are still loadable
		setProject({ ...saved, rewords: saved.rewords ?? [], rounds: saved.rounds ?? [] });
		vectors = await store.loadVectors(PROJECT_ID);
		recomputeDuplicates();
		setPhase("ready");
	}
}

export const projectStats = () => stats(project);
export const ungrouped = () => ungroupedFragments(project);
export const unplaced = () => orphanFragments(project);
export const draftSections = () => draft.draftOrder(project);
export const pendingFor = (blockId: string) => reword.pendingRewords(project, blockId);
export const currentRound = () => review.latestRound(project);
export const openCount = () => review.openItems(project).length;
export const finishable = () => review.isFinishable(project);
export const keyPresent = () => apiKey().trim().length > 0;

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

// ---------------------------------------------------------------- settings

export function setApiKey(value: string) {
	saveKey(value.trim());
	setApiKeySignal(value.trim());
}

export function setModel(value: string) {
	saveModel(value.trim());
	setModelSignal(value.trim() || loadModel());
}

// ------------------------------------------------------------------- pile

export async function importText(text: string) {
	const { project: next } = importDocument(project, text);
	await commit(next);
	await regroup();
}

/**
 * The LLM groups when a key is present, because the fixture showed embeddings
 * grouping by vocabulary. Without a key the deterministic grouper still runs —
 * worse, but honest about being worse, and free.
 */
export async function regroup() {
	if (project.fragments.length === 0) return;

	try {
		const useLlm = hasKey();
		setPhase(useLlm ? "grouping" : "loading-model");
		setMessage(useLlm ? "asking the model to group by argument" : "preparing the embedder");

		const grouper = useLlm
			? createLlmGrouper({ apiKey: apiKey(), model: model() })
			: createEmbeddingGrouper({
					embedder: {
						id: embedder.id,
						embed: (texts) => {
							setPhase("embedding");
							return embedder.embed(texts, (done, total) =>
								setMessage(`embedding ${done} / ${total} fragments`),
							);
						},
					},
					cut: { kind: "largest-gap" },
					minClusterSize: 2,
					onVectors: (byId) => {
						vectors = { ...vectors, ...byId };
					},
				});

		const proposal = await grouper.propose(unwrap(project).fragments);
		setPhase("grouping");

		const next: Project = {
			...unwrap(project),
			groups: proposal.groups.map((g, i) => ({ ...g, id: `g${String(i + 1).padStart(2, "0")}` })),
			embedderId: useLlm ? null : embedder.id,
		};
		setDiagnostics(proposal.diagnostics ?? null);
		setMessage(proposal.rationale);
		await commit(next);
		if (!useLlm) await store.saveVectors(PROJECT_ID, vectors);
		setPhase("ready");
	} catch (error) {
		fail(error);
	}
}

export async function renameGroup(groupId: string, label: string) {
	setProject("groups", (g) => g.id === groupId, { label, auto: false });
	await store.save(unwrap(project));
}

// ------------------------------------------------------------------- plan

export async function chooseSkeleton(skeletonId: string) {
	await commit({ ...unwrap(project), skeletonId: skeletonId || null });
}

export async function place(fragmentId: string, slotId: string) {
	await commit(draft.placeFragment(unwrap(project), fragmentId, slotId));
}

// ------------------------------------------------------------------ draft

export async function writeInDraft(slotId: string, text: string) {
	await commit(draft.writeInDraft(unwrap(project), slotId, text));
}

export async function editBlock(blockId: string, text: string) {
	await commit(draft.editBlock(unwrap(project), blockId, text));
}

export async function revertBlock(blockId: string) {
	await commit(draft.revertBlock(unwrap(project), blockId));
}

export async function removeBlock(blockId: string) {
	await commit(draft.removeBlock(unwrap(project), blockId));
}

export async function moveBlock(blockId: string, direction: -1 | 1) {
	await commit(draft.moveBlock(unwrap(project), blockId, direction));
}

export async function moveToSlot(blockId: string, slotId: string) {
	await commit(draft.moveBlockToSlot(unwrap(project), blockId, slotId));
}

/**
 * Suggestions that fail the faithfulness gate are never shown as suggestions —
 * the writer is told one was discarded and why, which is a different thing.
 */
export async function askReword(blockId: string) {
	if (!keyPresent()) return setMessage("rewording needs an API key — add one in settings");
	const block = project.blocks.find((b) => b.id === blockId);
	if (!block) return;

	try {
		setPhase("reviewing");
		setMessage("asking for a rephrasing of your sentence");
		const options = await suggestRewords({ apiKey: apiKey(), model: model() }, block.text);

		let next = unwrap(project);
		const refused: string[] = [];
		for (const option of options) {
			const result = reword.proposeReword(next, blockId, option);
			next = result.project;
			if (result.rejected) refused.push(result.rejected.reason);
		}
		await commit(next);
		setPhase("ready");
		setMessage(
			refused.length > 0
				? `${options.length - refused.length} suggestion(s) kept; ${refused.length} discarded: ${refused[0]}`
				: `${options.length} suggestions, none of them in your draft until you say so`,
		);
	} catch (error) {
		fail(error);
	}
}

export async function acceptReword(rewordId: string) {
	await commit(reword.acceptReword(unwrap(project), rewordId));
}

export async function rejectReword(rewordId: string) {
	await commit(reword.rejectReword(unwrap(project), rewordId));
}

// ----------------------------------------------------------------- review

/** Measured items always. Judged items only with a key, and only when asked. */
export async function runReview() {
	try {
		setPhase("reviewing");
		const current = unwrap(project);
		let judged: review.JudgedItem[] = [];
		let rationale = "measured items only — no key, so no judgments";

		if (keyPresent() && current.blocks.length > 0) {
			setMessage("reading the draft for gaps");
			judged = await reviewDraft(
				{ apiKey: apiKey(), model: model() },
				{
					blocks: current.blocks,
					unused: orphanFragments(current),
					title: current.title,
				},
			);
			rationale = `measured items · ${model()} found ${judged.length} question(s)`;
		}

		await commit(review.startRound(current, judged, rationale));
		setMessage(rationale);
		setPhase("ready");
	} catch (error) {
		fail(error);
	}
}

export async function resolveItem(itemId: string) {
	await commit(review.resolveItem(unwrap(project), itemId));
}

export async function waiveItem(itemId: string, note: string) {
	await commit(review.waiveItem(unwrap(project), itemId, note || "no reason given"));
}

export async function reopenItem(itemId: string) {
	await commit(review.reopenItem(unwrap(project), itemId));
}

// ----------------------------------------------------------------- export

function download(filename: string, content: string) {
	const blob = new Blob([content], { type: "text/markdown" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.click();
	URL.revokeObjectURL(url);
}

export function exportArticle() {
	download(`${slug(project.title)}.md`, draft.exportMarkdown(unwrap(project)));
}

export function exportProvenance() {
	download(`${slug(project.title)}.provenance.md`, draft.exportProvenance(unwrap(project)));
}

function slug(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "") || "article"
	);
}

/** The whole run as one blob, for picking a bad grouping apart offline. */
export function exportDiagnostics(): string {
	return JSON.stringify(
		{
			generatedAt: new Date().toISOString(),
			project: unwrap(project),
			duplicates: duplicates(),
			diagnostics: diagnostics(),
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

export async function setTitle(title: string) {
	await commit({ ...unwrap(project), title: title.trim() || "Untitled article" });
}

// ------------------------------------------------------------------ misc

function fail(error: unknown) {
	const raw = (error as Error).message ?? String(error);
	const offline = /fetch|network|load model|onnx/i.test(raw);
	setPhase("error");
	setMessage(
		offline
			? `could not reach the model (${raw}). Everything you wrote is safe — only the step that needed a model stopped.`
			: raw,
	);
}

export async function reset() {
	vectors = {};
	setDuplicates([]);
	setDiagnostics(null);
	const fresh = emptyProject(PROJECT_ID, "Untitled article");
	setProject(fresh);
	await store.save(fresh);
	await store.saveVectors(PROJECT_ID, {});
	setSurface("pile");
	setPhase("idle");
	setMessage("");
}

export function fragmentText(id: string): string {
	return project.fragments.find((f) => f.id === id)?.text ?? "";
}
