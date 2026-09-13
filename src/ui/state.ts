import { createSignal } from "solid-js";
import { createStore, unwrap } from "solid-js/store";
import { createLlmPlanner } from "../adapters/llm/llm-planner";
import { loadKey, loadModel, saveKey, saveModel } from "../adapters/llm/settings";
import { langOf, PATTERNS, patternById, patternFor, shelf, suggestFor } from "../adapters/patterns";
import { createIndexedDbStore } from "../adapters/store/indexeddb-store";
import {
	build,
	type Doc,
	emptyDoc,
	fits,
	type Pattern,
	type Reach,
	type Run,
	reviveDoc,
	type Shape,
	segment,
	shapeOf,
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
export const view = () =>
	build(doc.notes, doc.plan, {
		reach: doc.reach,
		which: doc.shape,
		pattern: kindOf(shapeOf(doc.plan, doc.shape)),
		lang: langOf(doc.notes),
	});
export const segments = () => segment(doc.notes);
export const runs = () => {
	const built = view().runs;
	return built.map((run) =>
		doc.edits[run.key] ? { ...run, md: doc.edits[run.key] as string } : run,
	);
};
export const dropped = () => view().dropped;
/** Required parts of the chosen kind with none of your text in them. */
export const holes = () => view().gaps;
/** False while the chosen card has not been organised, or organising it failed. */
export const arranged = () => view().arranged;
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

/** The kinds on offer, and the one the article is in. */
export const shapes = (): Shape[] => doc.plan?.shapes ?? [];
export const shape = () => shapeOf(doc.plan, doc.shape);
/** The kind a card is. A card is a pattern; that is the whole of what it shows. */
export const kindOf = (one: Shape | null): Pattern | null =>
	one ? patternById(one.patternId) : null;

/**
 * Choosing a card.
 *
 * Only the card being read has been organised, so choosing another one asks —
 * once. What comes back is kept on the card, and going back to a card that has
 * already been organised costs nothing and asks nothing.
 */
export async function setShape(which: number) {
	if (busy()) return;
	setDoc({ shape: which, edits: {} });
	await keep();
	const chosen = shapeOf(doc.plan, which);
	if (!chosen || chosen.placement) return;
	await organise(which);
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
 * Asking which kinds of piece these notes are.
 *
 * It only ever happens because the writer pressed it. What comes back is three
 * names and a reason each — no order, no text, nothing to apply yet. The card
 * they are left reading is then organised, and the other two only if they are
 * chosen.
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

	try {
		setBusy(true);
		setMessage("");
		const planner = createLlmPlanner({ apiKey: apiKey(), model: model() });
		const picks = await planner.pick({
			notes,
			segments: segment(notes),
			brief: doc.brief,
			shelf: shelf(),
		});
		// edits were filed against the previous plan's runs; they do not survive it
		setDoc({
			plan: {
				basis: notes,
				shapes: picks.map((one) => ({ ...one, placement: null })),
				format: {},
				short: {},
			},
			shape: 0,
			patternId: picks[0]?.patternId ?? doc.patternId,
			edits: {},
		});
		if (doc.reach === 0) setDoc("reach", 3);
		await keep();
	} catch (error) {
		setMessage(trouble(error));
		setBusy(false);
		return;
	}
	setBusy(false);
	// the first card is the one they are reading, so it is the one organised
	await organise(0);
}

/**
 * Sorting your sections into one kind's parts.
 *
 * The model answers which part each section belongs to and nothing else — the
 * order is the pattern's and is computed here, and what it refuses to answer
 * for is checked before any of it is used. If the check fails twice, the
 * article stays in your order and the card says so.
 */
async function organise(which: number) {
	if (busy()) return;
	const chosen = shapeOf(doc.plan, which);
	const kind = kindOf(chosen);
	if (!chosen || !kind || !hasKey()) return;

	try {
		setBusy(true);
		setMessage("");
		const planner = createLlmPlanner({ apiKey: apiKey(), model: model() });
		const placed = await planner.place({
			segments: segment(doc.notes),
			brief: doc.brief,
			pattern: kind,
		});
		setDoc("plan", "shapes", which, "placement", placed.placement);
		setDoc("patternId", kind.id);
		setDoc("plan", "format", (was) => ({ ...was, ...placed.format }));
		setDoc("plan", "short", (was) => ({ ...was, ...placed.short }));
		setMessage(
			placed.violations.length > 0
				? `that answer did not hold up, so this is your own order — ${placed.violations[0]}`
				: (chosen.because ?? ""),
		);
		await keep();
	} catch (error) {
		setMessage(trouble(error));
	} finally {
		setBusy(false);
	}
}

function trouble(error: unknown): string {
	const raw = (error as Error)?.message ?? String(error);
	return /fetch|network|401|403|CORS/i.test(raw)
		? `could not reach the model — your text is untouched (${raw.slice(0, 90)})`
		: raw.slice(0, 140);
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
