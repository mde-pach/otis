import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { suggestRewords } from "../adapters/llm/llm-reworder";
import { layOut, pickShape } from "../adapters/llm/llm-structurer";
import { suggestTitles } from "../adapters/llm/llm-titles";
import { loadKey, loadModel, saveKey, saveModel } from "../adapters/llm/settings";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import {
	assignInOrder,
	assignToSlots,
	draftOrder,
	exportMarkdown,
	exportProvenance,
	setTitle,
} from "../core/draft";
import { findDuplicates } from "../core/duplicates";
import { notesText, orphanFragments, syncFragments } from "../core/project";
import { DEFAULT_SKELETON, SKELETONS, skeletonById } from "../core/skeletons";
import { emptyProject, type Project } from "../core/types";

const PROJECT_ID = "current";

export type Phase = "idle" | "working" | "ready" | "error";

const store = createIndexedDbStore();

const [phase, setPhase] = createSignal<Phase>("idle");
const [message, setMessage] = createSignal("");
const [because, setBecause] = createSignal("");
const [project, setProject] = createStore<Project>({
	...emptyProject(PROJECT_ID, "Untitled"),
	skeletonId: DEFAULT_SKELETON,
});
const [apiKey, setApiKeySignal] = createSignal(loadKey());
const [model, setModelSignal] = createSignal(loadModel());

export const state = { phase, message, because, project, apiKey, model };
export const shapes = SKELETONS;
export const keyPresent = () => apiKey().trim().length > 0;
export const sections = () => draftOrder(project);
export const unusedIds = () => new Set(orphanFragments(project).map((f) => f.id));
export const repeats = () => {
	const pairs = findDuplicates(project.fragments.map((f) => f.text));
	const marked = new Map<string, string>();
	for (const p of pairs) {
		const a = project.fragments[p.a];
		const b = project.fragments[p.b];
		if (a && b) marked.set(b.id, `repeats ${a.id.replace("f", "#")}`);
	}
	return marked;
};

async function save() {
	await store.save(unwrap(project));
}

export async function init() {
	const saved = await store.load(PROJECT_ID);
	if (saved) {
		setProject({
			...saved,
			titles: saved.titles ?? {},
			rewords: saved.rewords ?? [],
			rounds: saved.rounds ?? [],
		});
		setPhase("ready");
	}
}

export function notes(): string {
	return notesText(project);
}

/** The notes are the document. Every run reconciles them before anything else. */
export async function setNotes(text: string) {
	setProject(syncFragments(unwrap(project), text));
	await save();
}

export async function chooseShape(id: string) {
	setProject("skeletonId", id);
	await save();
	await organise();
}

/**
 * Text in, text out. With a key the model decides which paragraph plays which
 * role and writes a heading for each section from the writer's own words;
 * without one, the piece keeps the order it was written in.
 */
export async function organise(text?: string) {
	if (text !== undefined) setProject(syncFragments(unwrap(project), text));
	const current = unwrap(project);
	if (current.fragments.length === 0) return;

	try {
		setPhase("working");
		setBecause("");

		if (!keyPresent()) {
			setMessage("kept in the order you wrote it — a key lets it find the shape");
			setProject({ ...assignInOrder({ ...current, skeletonId: "as-written" }), titles: {} });
			setPhase("ready");
			return await save();
		}

		const config = { apiKey: apiKey(), model: model() };
		let shapeId = current.skeletonId ?? DEFAULT_SKELETON;

		if (shapeId === "auto") {
			setMessage("reading your notes for the shape they already have");
			const picked = await pickShape(
				config,
				current.fragments,
				SKELETONS.filter((s) => s.id !== "as-written"),
			);
			shapeId = picked?.shapeId ?? DEFAULT_SKELETON;
			setBecause(picked?.because ?? "");
		}

		const shape = skeletonById(shapeId) ?? skeletonById(DEFAULT_SKELETON);
		if (!shape) return;

		setMessage(`laying your paragraphs into ${shape.name.toLowerCase()}`);
		const layout =
			shape.id === "as-written"
				? {
						slots: [{ slotId: "body", fragmentIds: current.fragments.map((f) => f.id) }],
						leftOut: [],
					}
				: await layOut(config, current.fragments, shape);

		let next = assignToSlots({ ...current, skeletonId: shape.id, titles: {} }, layout.slots);

		if (shape.id !== "as-written") {
			setMessage("writing a heading for each section, from your words");
			const proposals = await suggestTitles(
				config,
				shape.slots.map((slot) => ({
					slotId: slot.id,
					role: slot.role,
					paragraphs: next.blocks.filter((b) => b.slot === slot.id).map((b) => b.text),
				})),
			);
			for (const [slotId, title] of Object.entries(proposals)) {
				next = setTitle(next, slotId, title, "tool");
			}
		}

		setProject(next);
		setMessage(`${next.blocks.length} of ${next.fragments.length} paragraphs used`);
		setPhase("ready");
		await save();
	} catch (error) {
		const raw = (error as Error).message ?? String(error);
		setPhase("error");
		setMessage(
			/fetch|network|401|403/i.test(raw)
				? `could not reach the model (${raw}). Your notes are untouched.`
				: raw,
		);
	}
}

/** Editing anything in the article makes it yours. */
export async function editBlock(blockId: string, text: string) {
	setProject("blocks", (b) => b.id === blockId, "text", text);
	await save();
}

export async function editTitle(slotId: string, text: string) {
	setProject(setTitle(unwrap(project), slotId, text, "yours"));
	await save();
}

export async function reword(blockId: string): Promise<string | null> {
	if (!keyPresent()) return "rewording needs a key";
	const block = project.blocks.find((b) => b.id === blockId);
	if (!block) return null;
	try {
		const [option] = await suggestRewords({ apiKey: apiKey(), model: model() }, block.text);
		return option ?? null;
	} catch (error) {
		return (error as Error).message;
	}
}

export function setApiKey(value: string) {
	saveKey(value.trim());
	setApiKeySignal(value.trim());
}

export function setModel(value: string) {
	saveModel(value.trim());
	setModelSignal(value.trim() || loadModel());
}

export function articleMarkdown(): string {
	return exportMarkdown(unwrap(project));
}

export function provenanceMarkdown(): string {
	return exportProvenance(unwrap(project));
}

export function fragmentText(id: string): string {
	return project.fragments.find((f) => f.id === id)?.text ?? "";
}
