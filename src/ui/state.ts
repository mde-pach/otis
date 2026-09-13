import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createLlmPlanner } from "../adapters/llm/llm-planner";
import { loadKey, loadModel, saveKey, saveModel } from "../adapters/llm/settings";
import { PATTERNS, patternById, patternFor, suggestFor } from "../adapters/patterns";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import {
	build,
	type Doc,
	emptyDoc,
	fits,
	type Reach,
	type Run,
	reviveDoc,
	type Shape,
	segment,
	shapeOf,
	share,
	skeleton,
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
export const view = () => build(doc.notes, doc.plan, doc.reach, doc.shape);
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

/** Your own words, under a run that has been shortened. */
export const sourceOf = (run: Run): string =>
	run.from ? doc.notes.slice(run.from.start, run.from.end) : "";

/** Built from what you pasted, not from a fixed list. */
export const suggestions = () => suggestFor(doc.notes);

/** The plan was made for other text and has been set aside. */
export const dropped_plan = () => Boolean(doc.plan) && !fits(doc.notes, doc.plan);
/** The plan still fits, but the words under it have moved on. */
export const isStale = () => stale(doc.notes, doc.plan);

/**
 * The arrangements on offer, and the one the article is in.
 *
 * Every one of them came back in the same request, so moving between them is
 * free: it is the writer choosing the shape of their piece, not asking again.
 */
export const shapes = (): Shape[] => doc.plan?.shapes ?? [];
export const shape = () => shapeOf(doc.plan, doc.shape);
export const skeletonOf = (one: Shape) => skeleton(doc.notes, one);
export async function setShape(which: number) {
	setDoc({ shape: which, edits: {} });
	await keep();
}

async function keep() {
	setDoc("updatedAt", Date.now());
	await store.save(unwrap(doc));
}

export async function init() {
	// never trusted: it was written by whatever version of this the writer last
	// had open, and a plan it cannot read is not worth their text
	const saved = reviveDoc(ID, await store.load(ID));
	setDoc(saved.notes ? saved : { ...emptyDoc(ID), notes: "", brief: "" });
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
	setDoc({ brief, patternId: patternFor(brief, doc.notes).id });
	await keep();
}

/**
 * The only thing in the app that spends a request, and it only ever happens
 * because the writer pressed it.
 *
 * It comes back with two or three arrangements and applies the first. The
 * others are already paid for: switching between them asks nothing.
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

	const chosen = patternFor(doc.brief, notes);
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
		setDoc({ plan, shape: 0, edits: {} });
		setMessage(plan.shapes[0]?.because ?? "");
		if (doc.reach === 0) setDoc("reach", 2);
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
	setDoc({ plan: null, shape: 0, edits: {}, reach: 0 });
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
