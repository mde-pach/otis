/**
 * Measuring the thing rather than arguing for it.
 *
 * Offline measures cost nothing and need no network — they are free because the
 * mechanism made the outcome a function of its inputs. Live measures need a key
 * and spend about a hundred requests.
 *
 *   bun run evaluate
 *   ANTHROPIC_API_KEY=… bun run evaluate --live
 *
 * The corpus is fifteen documents written for this, in fixtures/labelled. Each
 * labelled section carries the part it belongs to, and most carry a `thin`
 * variant: the same section, in the same part, saying nothing — "users were
 * affected" where the real one says "22,000 sessions failed". That variant is
 * what the hollow-section measures are for.
 */

import { readdirSync, readFileSync } from "node:fs";
import { createLlmPlanner } from "../src/adapters/llm/llm-planner";
import { PATTERNS, patternById, shelf } from "../src/adapters/patterns";
import type { Planner } from "../src/core";
import { build, check, gaps, type Placement, read, segment } from "../src/core";

interface Section {
	part?: string;
	text: string;
	/** the same section, in the same part, delivering nothing */
	thin?: string;
}

interface Doc {
	id: string;
	/** the one kind it is; absent when the document sits between kinds */
	kind?: string;
	/** the kinds that would all be defensible, for a document that is between */
	accepts?: string[];
	lang: "en" | "fr";
	note: string;
	sections: Section[];
}

const here = new URL("../fixtures/labelled/", import.meta.url);
const ALL: Doc[] = readdirSync(here)
	.filter((name) => name.endsWith(".json"))
	.map((name) => JSON.parse(readFileSync(new URL(name, here), "utf8")) as Doc);

const LABELLED = ALL.filter((d): d is Doc & { kind: string } => typeof d.kind === "string");
const BETWEEN = ALL.filter((d) => Array.isArray(d.accepts));

const textOf = (s: Section, thin: boolean) => (thin && s.thin ? s.thin : s.text);
const notesOf = (d: Doc, thin = false) => d.sections.map((s) => textOf(s, thin)).join("\n\n");
const goldOf = (d: Doc): Placement => d.sections.map((s) => s.part ?? null);

let failed = 0;
function report(name: string, score: number, floor: number, detail = "") {
	const ok = score >= floor;
	if (!ok) failed++;
	console.log(
		`${ok ? "  ok  " : "  FAIL"} ${name.padEnd(52)} ${(score * 100).toFixed(1).padStart(5)}%  (floor ${(floor * 100).toFixed(0)}%)${detail}`,
	);
}
function note(name: string, said: string) {
	console.log(`  ·     ${name.padEnd(52)} ${said}`);
}

function planFor(d: Doc, placement: Placement, thin = false) {
	return {
		basis: notesOf(d, thin),
		shapes: [{ patternId: d.kind ?? "essay", because: "", placement }],
		format: {},
		short: {},
	};
}

/* ════════════════════════════════════════════════════════════════ offline */

/** The order is a function of the placement and the file, and of nothing else. */
function stability(): void {
	let same = 0;
	let total = 0;
	for (const d of LABELLED) {
		const pattern = patternById(d.kind);
		const gold = goldOf(d);
		const want = build(notesOf(d), planFor(d, gold), { reach: 2, pattern }).runs.map(
			(r) => r.fromIndex,
		);
		const asObject = Object.fromEntries(gold.map((part, i) => [i, part]));
		const shuffled = Object.fromEntries(
			[...gold.entries()].sort(() => Math.random() - 0.5).map(([i, part]) => [i, part]),
		);
		const forms: unknown[] = [gold, asObject, shuffled];
		for (let round = 0; round < 30; round++) {
			const placement = read(forms[round % forms.length], pattern, gold.length);
			const got = build(notesOf(d), planFor(d, placement), { reach: 2, pattern }).runs.map(
				(r) => r.fromIndex,
			);
			total++;
			if (JSON.stringify(got) === JSON.stringify(want)) same++;
		}
	}
	report("the same answer is the same article", same / total, 1, `  ${total} rounds`);
}

const POISON = "and it cost us the quarter";

/** Nothing reaches the article that is not the writer's. */
function intrusion(): void {
	let clean = 0;
	let total = 0;
	let kept = 0;
	let offered = 0;

	for (const d of LABELLED) {
		const notes = notesOf(d);
		const segments = segment(notes);
		const format: Record<number, string> = {};
		const short: Record<number, string> = {};
		segments.forEach((s, i) => {
			if (i % 3 === 0) format[i] = `**${s.text}**`;
			if (i % 3 === 1) format[i] = `${s.text} ${POISON}`;
			if (i % 3 === 2) short[i] = `${s.text.split(" ").slice(0, 6).join(" ")} ${POISON}`;
		});
		for (const pattern of PATTERNS) {
			for (let round = 0; round < 60; round++) {
				const placement: Placement = Array.from({ length: segments.length }, () => {
					const part = pattern.parts[Math.floor(Math.random() * (pattern.parts.length + 1))];
					return part ? part.id : null;
				});
				const plan = {
					basis: notes,
					shapes: [{ patternId: pattern.id, because: "", placement }],
					format,
					short,
				};
				const built = build(notes, plan, { reach: 3, pattern, lang: d.lang });
				total++;
				offered += built.runs.length;
				kept += built.runs.filter((r) => r.kind === "kept").length;
				if (!built.runs.some((r) => r.md.includes(POISON))) clean++;
			}
		}
	}
	report("nothing the model added reaches the article", clean / total, 1, `  ${total} articles`);
	report("and honest formatting still survives the gate", kept / offered, 0.6);
}

/** The validator is the independence claim, so it is measured too. */
function validator(): void {
	const junk: unknown[] = [
		{ 0: "nonsense" },
		{ 0: 42 },
		{},
		[null, "made-up"],
		{ 0: "claim", 1: "claim" },
		"not an object",
		null,
	];
	let caught = 0;
	let sound = 0;
	for (const pattern of PATTERNS) {
		const ids = new Set(pattern.parts.map((p) => p.id));
		for (const bad of junk) {
			if (check(bad, pattern, 3).length > 0) caught++;
			if (read(bad, pattern, 3).every((id) => id === null || ids.has(id))) sound++;
		}
	}
	const total = PATTERNS.length * junk.length;
	report("a malformed answer is caught", caught / total, 1, `  ${total} cases`);
	report("and nothing that gets through invents a part", sound / total, 1);
}

/* ──────────────────────────────────────────────── the hollow section */

interface Pair {
	doc: Doc;
	part: string;
	full: string;
	thin: string;
}

const PAIRS: Pair[] = LABELLED.flatMap((doc) =>
	doc.sections
		.filter((s) => s.thin && s.part)
		.map((s) => ({ doc, part: s.part as string, full: s.text, thin: s.thin as string })),
);

/**
 * What happens when a required part is filled by a section that says nothing.
 *
 * Until the four `wants: "specifics"` declarations existed this was zero of
 * forty-two, and the number was here so the blindness could not be mistaken for
 * a handled case. It is still zero for every part that does not declare — a
 * reason in an essay owes no figure and is never asked for one — so the measure
 * is split: caught where a part declares, and openly blind everywhere else.
 */
function hollow(): void {
	const declared = PAIRS.filter((p) => {
		const part = patternById(p.doc.kind as string).parts.find((x) => x.id === p.part);
		return part?.wants === "specifics";
	});

	let caught = 0;
	const alarms: string[] = [];

	for (const d of LABELLED) {
		const pattern = patternById(d.kind);
		const gold = goldOf(d);
		const texts = d.sections.map((x) => x.text);
		const thinTexts = d.sections.map((x) => x.thin ?? x.text);

		// the real document: any "thin" question here is an alarm on writing the
		// corpus calls complete
		for (const g of gaps(gold, pattern, d.lang, texts).filter((x) => x.kind === "thin")) {
			alarms.push(`${d.id} · ${g.part}`);
		}
		// the gutted one: every declared part whose sections went hollow should ask
		const said = new Set(
			gaps(gold, pattern, d.lang, thinTexts)
				.filter((g) => g.kind === "thin")
				.map((g) => g.part),
		);
		caught += declared.filter((p) => p.doc.id === d.id && said.has(p.part)).length;
	}

	report(
		"a hollow section is noticed, where the part declares it owes one",
		caught / declared.length,
		1,
		`  ${declared.length} pairs`,
	);
	// An alarm here is the check disagreeing with a label, and the disagreement is
	// worth reading before it is worth fixing: a section the corpus calls complete
	// may still owe a figure. Whichever way it is settled, settle it by changing
	// the check or the label on its merits — editing the fixture until the number
	// goes green is how a measure stops meaning anything. Each one is printed.
	report(
		"and writing the corpus calls complete is left alone",
		1 - alarms.length / LABELLED.length,
		0.9,
		`  ${alarms.length} in ${LABELLED.length} documents`,
	);
	for (const one of alarms) note("asked anyway", one);
	note(
		"still blind",
		`${PAIRS.length - declared.length} of ${PAIRS.length} hollow sections sit in parts that declare nothing, and are not looked at`,
	);
}

/* ──────────────────────────────────────────── candidate detectors */

const HEDGE =
	/\b(some|a few|a couple|several|various|certain|things?|issues?|problems?|stuff|closely|properly|soon|shortly|a while|a bit|somehow|generally|often|usually|etc|quelques?|certains?|des choses|un peu|prochainement|bientôt|souvent|globalement|plus ou moins|etc)\b/i;
const DIGIT = /\d/;
const SPECIFIC =
	/\b\d+(?:[.,]\d+)?\s*(?:%|ms|s|h|kb|mb|gb|k)?\b|\b[a-z_]+\.[a-z_]+\b|\b[a-z]+_[a-z]+\b|\b[A-Z]{2,}\b|\b[a-z]+[A-Z][a-zA-Z]*\b|\/[a-z]+/;

interface Detector {
	id: string;
	says: string;
	/** true when the detector thinks this section delivers nothing */
	hollow: (text: string) => boolean;
}

/**
 * Which parts would be entitled to demand something specific, declared by hand.
 *
 * The first version of this measure derived the set by testing whether the real
 * section happened to contain a number — which is the detector's own rule, so
 * it scored itself against its own definition and got a perfect zero. Declaring
 * the set by judgement, before looking, is the only honest way to ask the
 * question. A reason in an essay owes no number; an impact in a post-mortem
 * does.
 */
const WANTS_SPECIFICS = new Set([
	"post-mortem/observed",
	"post-mortem/cost",
	"internal-note/state",
	"how-it-works/example",
]);

const DETECTORS: Detector[] = [
	{ id: "short", says: "under 110 characters", hollow: (t) => t.length < 110 },
	{ id: "shorter", says: "under 150 characters", hollow: (t) => t.length < 150 },
	{ id: "no-digit", says: "contains no digit", hollow: (t) => !DIGIT.test(t) },
	{ id: "no-specific", says: "no number, identifier or path", hollow: (t) => !SPECIFIC.test(t) },
	{ id: "hedged", says: "hedge word and no digit", hollow: (t) => HEDGE.test(t) && !DIGIT.test(t) },
	{
		id: "hedged-or-vague",
		says: "hedge word, or nothing specific at all",
		hollow: (t) => HEDGE.test(t) || !SPECIFIC.test(t),
	},
	{
		id: "vague-and-short",
		says: "nothing specific and under 150 characters",
		hollow: (t) => !SPECIFIC.test(t) && t.length < 150,
	},
];

/**
 * The bake-off that chose the check, kept so the choice stays checkable.
 *
 * The question was whether a code-side test could tell a hollow section from a
 * real one at all, and whether anything beat the dumb baseline of "it is
 * short". `no-digit` won on the declared parts and is what `gaps()` now uses;
 * the rest are here so a future change has something to beat.
 */
function detectors(): void {
	console.log("\n  candidate detectors");
	console.log(
		`        ${" ".repeat(18)}${"— all parts —".padStart(23)}${"— declared parts only —".padStart(23)}`,
	);
	console.log(
		`        ${"detector".padEnd(18)}${"catches".padStart(9)}${"false alarms".padStart(14)}` +
			`${"catches".padStart(10)}${"false alarms".padStart(13)}   what it looks for`,
	);

	const wanting = PAIRS.filter((p) => WANTS_SPECIFICS.has(`${p.doc.kind}/${p.part}`));

	const score = (set: Pair[], d: Detector) => ({
		caught: set.filter((p) => d.hollow(p.thin)).length / set.length,
		alarms: set.filter((p) => d.hollow(p.full)).length / set.length,
	});
	const pc = (n: number) => `${(n * 100).toFixed(0)}%`;

	for (const d of DETECTORS) {
		const all = score(PAIRS, d);
		const want = score(wanting, d);
		console.log(
			`        ${d.id.padEnd(18)}${pc(all.caught).padStart(9)}${pc(all.alarms).padStart(14)}` +
				`${pc(want.caught).padStart(10)}${pc(want.alarms).padStart(13)}   ${d.says}`,
		);
	}
	// and the wider check: every real section of a declared part, twin or no twin,
	// so the false-alarm rate is not measured only on sections I built a twin for
	const realSections = LABELLED.flatMap((d) =>
		d.sections
			.filter((x) => x.part && WANTS_SPECIFICS.has(`${d.kind}/${x.part}`))
			.map((x) => x.text),
	);
	for (const d of DETECTORS.filter((x) => ["no-specific", "no-digit", "short"].includes(x.id))) {
		note(
			`wider false alarms, "${d.id}"`,
			`flags ${realSections.filter((t) => d.hollow(t)).length} of ${realSections.length} real sections of declared parts`,
		);
	}
	note(
		"pairs",
		`${PAIRS.length} in all, ${wanting.length} on the ${WANTS_SPECIFICS.size} parts declared as wanting specifics`,
	);
	note(
		"length",
		`${PAIRS.filter((p) => p.thin.length > p.full.length).length} of ${PAIRS.length} hollow versions are LONGER than the real one, so "it is short" cannot win for free`,
	);
}

/* ═══════════════════════════════════════════════════════════════════ live */

async function pool<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += size) {
		out.push(...(await Promise.all(items.slice(i, i + size).map(run))));
	}
	return out;
}

async function live(planner: Planner): Promise<void> {
	/* ---- which kinds does it offer */
	const picks = await pool(ALL, 5, async (d) => {
		const notes = notesOf(d);
		const said = await planner.pick({ notes, segments: segment(notes), brief: "", shelf: shelf() });
		return { d, names: said.map((p) => p.patternId) };
	});

	const labelled = picks.filter((p) => p.d.kind);
	const between = picks.filter((p) => p.d.accepts);
	report(
		"pick: the true kind is on the strip",
		labelled.filter((p) => p.names.includes(p.d.kind as string)).length / labelled.length,
		0.8,
		`  ${labelled.length} documents`,
	);
	report(
		"pick: and it is the card that opens",
		labelled.filter((p) => p.names[0] === p.d.kind).length / labelled.length,
		0.6,
	);
	report(
		"pick: a document between kinds gets a defensible one",
		between.filter((p) => p.names.some((n) => (p.d.accepts as string[]).includes(n))).length /
			between.length,
		0.8,
		`  ${between.length} documents`,
	);
	const counts = picks.map((p) => p.names.length);
	note(
		"how many cards came back",
		`${counts.filter((n) => n === 3).length} of ${counts.length} gave three, ${counts.filter((n) => n === 2).length} gave two, ${counts.filter((n) => n < 2).length} gave one`,
	);

	/* ---- where it puts things, and whether it says the same thing twice */
	const placed = await pool(LABELLED, 5, async (d) => {
		const segments = segment(notesOf(d));
		const [a, b] = await Promise.all([
			planner.place({ segments, brief: "", pattern: patternById(d.kind) }),
			planner.place({ segments, brief: "", pattern: patternById(d.kind) }),
		]);
		return { d, a, b };
	});

	let agreed = 0;
	let sections = 0;
	let steady = 0;
	for (const { d, a, b } of placed) {
		goldOf(d).forEach((part, i) => {
			sections++;
			if (a.placement[i] === part) agreed++;
			if (a.placement[i] === b.placement[i]) steady++;
		});
	}
	report("placement agrees with the label", agreed / sections, 0.75, `  ${sections} sections`);
	report("and the model places the same way twice", steady / sections, 0.85);

	/* ---- does it stay quiet when nothing is missing */
	let quiet = 0;
	const falseAlarms: string[] = [];
	for (const { d, a } of placed) {
		const said = gaps(
			a.placement,
			patternById(d.kind),
			d.lang,
			d.sections.map((x) => x.text),
		);
		if (said.length === 0) quiet++;
		else falseAlarms.push(`${d.id}: ${said.map((g) => g.part).join(", ")}`);
	}
	// with the hollow check live too: the section texts go in, so a part filled by
	// something that does not do its job counts against this number
	report(
		"a complete document is asked nothing",
		quiet / placed.length,
		0.8,
		`  ${placed.length} documents`,
	);
	for (const line of falseAlarms) note("false alarm", line);

	/* ---- a section that says nothing, through the real model */
	const gutted = await pool(
		LABELLED.filter((d) => d.sections.some((s) => s.thin)),
		5,
		async (d) => {
			const segments = segment(notesOf(d, true));
			const said = await planner.place({ segments, brief: "", pattern: patternById(d.kind) });
			return { d, said };
		},
	);
	let stillPlaced = 0;
	let hollowSections = 0;
	let asked = 0;
	for (const { d, said } of gutted) {
		goldOf(d).forEach((part, i) => {
			if (!d.sections[i]?.thin) return;
			hollowSections++;
			if (said.placement[i] === part) stillPlaced++;
		});
		asked += gaps(
			said.placement,
			patternById(d.kind),
			d.lang,
			d.sections.map((x) => x.thin ?? x.text),
		).length;
	}
	note(
		"gutted document, real model",
		`${stillPlaced}/${hollowSections} hollow sections still placed in their own part, ${asked} questions asked`,
	);

	/* ---- cut a part out entirely: is it asked for */
	const cuts = LABELLED.flatMap((d) => {
		const pattern = patternById(d.kind);
		return pattern.parts
			.filter((p) => p.required)
			.map((p) => ({ d, part: p.id, kept: d.sections.filter((s) => s.part !== p.id) }))
			.filter((c) => c.kept.length !== d.sections.length && c.kept.length >= 2);
	});

	const cutResults = await pool(cuts, 5, async (c) => {
		const notes = c.kept.map((s) => s.text).join("\n\n");
		const said = await planner.place({
			segments: segment(notes),
			brief: "",
			pattern: patternById(c.d.kind),
		});
		const asked = gaps(
			said.placement,
			patternById(c.d.kind),
			c.d.lang,
			c.kept.map((x) => x.text),
		).map((g) => g.part);
		return { ...c, asked, placement: said.placement };
	});

	const hit = cutResults.filter((c) => c.asked.includes(c.part));
	// A ceiling, not a target: the floor sits below what this corpus measures, so
	// it catches a regression rather than being scraped past on a good day. Raise
	// it only after several runs say the ceiling itself moved.
	//
	// Every miss is the same structural error — the part immediately after the
	// hole slides into it — and the misses are printed below rather than
	// summarised, because that is the part worth looking at.
	report(
		"gap recall: a part you cut is a part it asks for",
		hit.length / cutResults.length,
		0.7,
		`  ${cutResults.length} cuts`,
	);

	// every miss, and what moved into the hole
	for (const miss of cutResults.filter((c) => !c.asked.includes(c.part))) {
		const took = miss.kept
			.map((s, i) => ({ was: s.part, now: miss.placement[i] }))
			.find((m) => m.now === miss.part);
		note(
			`cut ${miss.part} from ${miss.d.id}`,
			took
				? `"${took.was}" moved into it — asked for ${miss.asked.join(", ") || "nothing"}`
				: `asked for ${miss.asked.join(", ") || "nothing"}`,
		);
	}
}

/* ══════════════════════════════════════════════════════════════════ run */

console.log(
	`\n${ALL.length} documents · ${LABELLED.length} labelled, ${BETWEEN.length} between kinds · ${PAIRS.length} thin/full pairs · ${PATTERNS.length} kinds\n`,
);

console.log("offline");
stability();
intrusion();
validator();
hollow();
detectors();

if (process.argv.includes("--live")) {
	const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
	if (!apiKey) {
		console.log("\nno ANTHROPIC_API_KEY — the live half did not run");
	} else {
		console.log("\nlive");
		await live(createLlmPlanner({ apiKey, model: process.env.OTIS_MODEL ?? "claude-sonnet-4-5" }));
	}
}

console.log(failed === 0 ? "\nALL PASS\n" : `\n${failed} BELOW FLOOR\n`);
process.exit(failed === 0 ? 0 : 1);
