import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createLlmPlanner } from "../adapters/llm/llm-planner";
import { loadKey, loadModel, saveKey, saveModel } from "../adapters/llm/settings";
import { PATTERNS, patternById, patternFor } from "../adapters/patterns";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import { build, type Doc, emptyDoc, type Reach, segment, share, toMarkdown } from "../core";

const ID = "current";
const store = createIndexedDbStore();

const [doc, setDoc] = createStore<Doc>(emptyDoc(ID));
const [busy, setBusy] = createSignal(false);
const [message, setMessage] = createSignal("");
const [apiKey, setKeySignal] = createSignal(loadKey());
const [model, setModelSignal] = createSignal(loadModel());

export const state = { doc, busy, message, apiKey, model };
export const patterns = PATTERNS;
export const hasKey = () => apiKey().trim().length > 0;

/** Everything the panes draw comes from here, and it is pure. */
export const view = () => build(doc.notes, doc.plan, doc.reach);
export const segments = () => segment(doc.notes);
export const runs = () => {
	const built = view().runs;
	return built.map((run) =>
		doc.edits[run.id] ? { ...run, md: doc.edits[run.id] as string } : run,
	);
};
export const dropped = () => view().dropped;
export const shares = () => share(runs());
export const markdown = () => toMarkdown(runs());
export const pattern = () => patternById(doc.patternId);

async function keep() {
	setDoc("updatedAt", Date.now());
	await store.save(unwrap(doc));
}

export async function init() {
	const saved = await store.load(ID);
	if (saved?.notes) setDoc({ ...saved, edits: saved.edits ?? {} });
	else setDoc({ ...emptyDoc(ID), notes: "", brief: "" });
}

export async function setNotes(notes: string) {
	setDoc("notes", notes);
	await keep();
}

/** Editing a run detaches it: your words now, wherever they came from. */
export async function editRun(id: number, md: string) {
	setDoc("edits", id, md);
	await keep();
}

export async function setReach(reach: Reach) {
	setDoc({ reach, edits: {} });
	await keep();
	if (reach > 0 && !doc.plan) await replan(doc.brief);
}

export async function setBrief(brief: string) {
	setDoc("brief", brief);
	await replan(brief);
}

/**
 * One request, one plan. Without a key the article is the writer's own text in
 * their own order, which is a true answer rather than an error state.
 */
export async function replan(brief: string) {
	const text = doc.notes.trim();
	if (!text) return;

	const chosen = patternFor(brief);
	setDoc("patternId", chosen.id);

	if (!hasKey()) {
		setDoc({ plan: null, edits: {} });
		setMessage("no key yet — this is your text, in your order");
		await keep();
		return;
	}
	if (doc.reach === 0) {
		await keep();
		return;
	}

	try {
		setBusy(true);
		setMessage("");
		const planner = createLlmPlanner({ apiKey: apiKey(), model: model() });
		const plan = await planner.plan({
			segments: segment(doc.notes),
			brief,
			pattern: chosen.text,
			reach: doc.reach,
		});
		setDoc({ plan, edits: {} });
		setMessage(plan.because);
		await keep();
	} catch (error) {
		const raw = (error as Error).message ?? String(error);
		setMessage(
			/fetch|network|401|403|CORS/i.test(raw)
				? `could not reach the model — your text is untouched (${raw.slice(0, 90)})`
				: raw.slice(0, 140),
		);
	} finally {
		setBusy(false);
	}
}

export function setApiKey(value: string) {
	saveKey(value.trim());
	setKeySignal(value.trim());
}

export function setModel(value: string) {
	saveModel(value.trim());
	setModelSignal(value.trim() || loadModel());
}
