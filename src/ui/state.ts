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
	type Refused,
	type Run,
	read,
	segment,
	settle,
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
/** what the writer has turned down in the proposal they are looking at */
const [refused, setRefused] = createSignal<Refused>({});

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

/** Your own words, under a run that has been shortened. */
export const sourceOf = (run: Run): string =>
	run.from ? doc.notes.slice(run.from.start, run.from.end) : "";

/** Built from what you pasted, not from a fixed list. */
export const suggestions = () => suggestFor(doc.notes);

/** The plan was made for other text and has been set aside. */
export const dropped_plan = () => Boolean(doc.plan) && !fits(doc.notes, doc.plan);
/** The plan still fits, but the words under it have moved on. */
export const isStale = () => stale(doc.notes, doc.plan);

/** A proposal waiting on the writer. Nothing in it is true yet. */
export const proposal = () => (doc.review ? read(doc.notes, doc.review) : null);
export const refusals = refused;
export const isRefused = (key: string) => refused()[key] === true;
export function refuse(key: string, no: boolean) {
	const next = { ...refused() };
	if (no) next[key] = true;
	else delete next[key];
	setRefused(next);
}

async function keep() {
	setDoc("updatedAt", Date.now());
	await store.save(unwrap(doc));
}

export async function init() {
	const saved = await store.load(ID);
	if (saved?.notes) setDoc({ ...saved, edits: saved.edits ?? {}, review: saved.review ?? null });
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
	setDoc({ brief, patternId: patternFor(brief, doc.notes).id });
	await keep();
}

/**
 * The only thing in the app that spends a request, and it only ever happens
 * because the writer pressed it.
 *
 * What comes back is a proposal, not an article. It is put in front of them
 * with what it wants to move, shorten, leave out and write, and none of it is
 * true until they say so.
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
		const review = await planner.plan({
			notes,
			segments: segment(notes),
			brief: doc.brief,
			pattern: chosen.text,
		});
		setRefused({});
		setDoc("review", review);
		setMessage("");
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

/** Yes, to what is left of it. */
export async function apply() {
	const review = doc.review;
	if (!review) return;
	const plan = settle(doc.notes, review, refused());
	// edits were filed against the previous plan's runs; they do not survive it
	setDoc({ plan, review: null, edits: {} });
	setMessage(review.because);
	if (doc.reach === 0) setDoc("reach", 2);
	setRefused({});
	await keep();
}

/** No, to all of it. Your text is untouched and nothing was spent twice. */
export async function discard() {
	setDoc("review", null);
	setRefused({});
	await keep();
}

/** Starting over is the writer's, not something that happens to them. */
export async function clearPlan() {
	setDoc({ plan: null, review: null, edits: {}, reach: 0 });
	setMessage("");
	setRefused({});
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
