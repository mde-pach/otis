import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createLlmPlanner } from "../adapters/llm/llm-planner";
import { loadKey, loadModel, saveKey, saveModel } from "../adapters/llm/settings";
import { PATTERNS, patternById, patternFor } from "../adapters/patterns";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import {
	build,
	type Doc,
	emptyDoc,
	fits,
	type Reach,
	segment,
	share,
	stale,
	toMarkdown,
} from "../core";

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
		doc.edits[run.key] ? { ...run, md: doc.edits[run.key] as string } : run,
	);
};
export const dropped = () => view().dropped;
export const shares = () => share(runs());
export const markdown = () => toMarkdown(runs());
export const pattern = () => patternById(doc.patternId);

/** The plan was made for other text and has been set aside. */
export const dropped_plan = () => Boolean(doc.plan) && !fits(doc.notes, doc.plan);
/** The plan still fits, but the words under it have moved on. */
export const isStale = () => stale(doc.notes, doc.plan);

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
export async function editRun(key: string, md: string) {
	setDoc("edits", key, md);
	await keep();
}

/** Free: the dial filters the plan already in hand, it does not ask for another. */
export async function setReach(reach: Reach) {
	setDoc("reach", reach);
	await keep();
}

/** Also free. Nothing reaches the model until the writer asks for it. */
export async function setBrief(brief: string) {
	setDoc({ brief, patternId: patternFor(brief).id });
	await keep();
}

/**
 * The only thing in the app that spends a request, and it only ever happens
 * because the writer pressed it. One plan comes back whole; the dial reads it
 * four ways afterwards without asking again.
 */
export async function run() {
	if (busy()) return;
	const notes = doc.notes;
	if (!notes.trim()) {
		setMessage("nothing to work from yet");
		return;
	}
	if (!hasKey()) {
		setMessage("add a key first — until then this is your text, in your order");
		return;
	}

	const chosen = patternFor(doc.brief);
	setDoc("patternId", chosen.id);

	try {
		setBusy(true);
		setMessage("");
		const planner = createLlmPlanner({ apiKey: apiKey(), model: model() });
		const plan = await planner.plan({
			notes,
			segments: segment(notes),
			brief: doc.brief,
			pattern: chosen.text,
		});
		// edits were filed against the previous plan's runs; they do not survive it
		setDoc({ plan, edits: {} });
		setMessage(plan.because);
		if (doc.reach === 0) setDoc("reach", 2);
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

/** Starting over is the writer's, not something that happens to them. */
export async function clearPlan() {
	setDoc({ plan: null, edits: {}, reach: 0 });
	setMessage("");
	await keep();
}

export function setApiKey(value: string) {
	saveKey(value.trim());
	setKeySignal(value.trim());
}

export function setModel(value: string) {
	saveModel(value.trim());
	setModelSignal(value.trim() || loadModel());
}
