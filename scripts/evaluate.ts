/**
 * Measuring the thing rather than arguing for it.
 *
 * Two of these run offline and for nothing, because the mechanism made them
 * deterministic — which is most of the argument for the mechanism. Two need a
 * key, and are the ones that would have caught a post-mortem being offered to
 * an essay about responsibility.
 *
 *   bun run evaluate              the free ones
 *   ANTHROPIC_API_KEY=… bun run evaluate --live
 */

import { readdirSync, readFileSync } from "node:fs";
import { createLlmPlanner } from "../src/adapters/llm/llm-planner";
import { PATTERNS, patternById, shelf } from "../src/adapters/patterns";
import { build, check, gaps, type Placement, read, segment } from "../src/core";

interface Labelled {
	id: string;
	kind: string;
	lang: "en" | "fr";
	note: string;
	absent?: string[];
	sections: { part: string; text: string }[];
}

const here = new URL("../fixtures/labelled/", import.meta.url);
const CASES: Labelled[] = readdirSync(here)
	.filter((name) => name.endsWith(".json"))
	.map((name) => JSON.parse(readFileSync(new URL(name, here), "utf8")) as Labelled);

const notesOf = (one: Labelled) => one.sections.map((s) => s.text).join("\n\n");
const goldOf = (one: Labelled): Placement => one.sections.map((s) => s.part);

let failed = 0;
function report(name: string, score: number, floor: number, detail = "") {
	const ok = score >= floor;
	if (!ok) failed++;
	const shown = `${(score * 100).toFixed(1)}%`;
	console.log(`${ok ? "  ok  " : "  FAIL"} ${name} — ${shown} (floor ${floor * 100}%)${detail}`);
}

function planFor(one: Labelled, placement: Placement) {
	return {
		basis: notesOf(one),
		shapes: [{ patternId: one.kind, because: "", placement }],
		format: {},
		short: {},
	};
}

/* ------------------------------------------------------------------ stability
 * The order is a function of the placement and the pattern file, and of nothing
 * else. So the same answer said differently — as an object, as an array, with
 * its keys in another order — has to produce the same article, every time.
 */
function stability(): void {
	let same = 0;
	let total = 0;

	for (const one of CASES) {
		const notes = notesOf(one);
		const pattern = patternById(one.kind);
		const gold = goldOf(one);
		const want = build(notes, planFor(one, gold), { reach: 2, pattern }).runs.map(
			(r) => r.fromIndex,
		);

		const asObject = Object.fromEntries(gold.map((part, index) => [index, part]));
		const shuffled = Object.fromEntries(
			[...gold.entries()].sort(() => Math.random() - 0.5).map(([index, part]) => [index, part]),
		);
		const forms: unknown[] = [gold, asObject, shuffled];

		for (let round = 0; round < 40; round++) {
			const form = forms[round % forms.length];
			const placement = read(form, pattern, gold.length);
			const got = build(notes, planFor(one, placement), { reach: 2, pattern }).runs.map(
				(r) => r.fromIndex,
			);
			total++;
			if (JSON.stringify(got) === JSON.stringify(want)) same++;
		}
	}

	report("stability: the same answer is the same article", same / total, 1);
}

/* ------------------------------------------------------------------ intrusion
 * Nothing reaches the article that is not the writer's.
 *
 * A placement alone cannot smuggle text in, so the wording fields are where the
 * measure has to bite: every section is offered a faithful rewording and a
 * poisoned one, over every pattern and a few thousand placements the gates
 * never saw. What must come out is an article containing none of the poison.
 */
const POISON = "and it cost us the quarter";

function planWith(one: Labelled, placement: Placement, wording: boolean) {
	const notes = notesOf(one);
	const segments = segment(notes);
	const format: Record<number, string> = {};
	const short: Record<number, string> = {};
	if (wording) {
		segments.forEach((s, index) => {
			// formatting is not rewriting, so this one is meant to survive
			if (index % 3 === 0) format[index] = `**${s.text}**`;
			// and these two are lies about themselves, which must not
			if (index % 3 === 1) format[index] = `${s.text} ${POISON}`;
			if (index % 3 === 2) short[index] = `${s.text.split(" ").slice(0, 6).join(" ")} ${POISON}`;
		});
	}
	return { basis: notes, shapes: [{ patternId: one.kind, because: "", placement }], format, short };
}

function intrusion(): void {
	let clean = 0;
	let total = 0;
	let kept = 0;
	let offered = 0;
	let example = "";

	for (const one of CASES) {
		const notes = notesOf(one);
		const count = segment(notes).length;
		for (const pattern of PATTERNS) {
			for (let round = 0; round < 120; round++) {
				const placement: Placement = Array.from({ length: count }, () => {
					const part = pattern.parts[Math.floor(Math.random() * (pattern.parts.length + 1))];
					return part ? part.id : null;
				});
				const built = build(notes, planWith({ ...one, kind: pattern.id }, placement, true), {
					reach: 3,
					pattern,
					lang: one.lang,
				});
				total++;
				offered += built.runs.length;
				kept += built.runs.filter((run) => run.kind === "kept").length;
				const foreign = built.runs.find((run) => run.md.includes(POISON));
				if (foreign) example = foreign.md.slice(-60);
				else clean++;
			}
		}
	}

	report(
		"intrusion: nothing the model added reaches the article",
		clean / total,
		1,
		example && ` — ${example}`,
	);
	report("and the formatting that did not lie is still yours", kept / offered, 0.6);
}

/* ------------------------------------------------------------------ the check
 * The validator is the whole of the independence claim, so it is measured too:
 * nonsense must be caught, and whatever survives must never name a part that is
 * not in the file.
 */
function validator(): void {
	const junk = [
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
			const violations = check(bad, pattern, 3);
			if (violations.length > 0) caught++;
			const placement = read(bad, pattern, 3);
			if (placement.every((id) => id === null || ids.has(id))) sound++;
		}
	}

	const total = PATTERNS.length * junk.length;
	report("the check catches a bad answer", caught / total, 1);
	report("and nothing it lets through invents a part", sound / total, 1);
}

/* ---------------------------------------------------------------------- live */
async function live(): Promise<void> {
	const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
	if (!apiKey) {
		console.log("\n  no ANTHROPIC_API_KEY — pick precision and gap recall not measured");
		return;
	}
	const planner = createLlmPlanner({
		apiKey,
		model: process.env.OTIS_MODEL ?? "claude-sonnet-4-5",
	});

	// pick precision: is the kind these notes actually are among the three?
	let hit = 0;
	let first = 0;
	for (const one of CASES) {
		const notes = notesOf(one);
		const picks = await planner.pick({
			notes,
			segments: segment(notes),
			brief: "",
			shelf: shelf(),
		});
		const names = picks.map((p) => p.patternId);
		if (names.includes(one.kind)) hit++;
		if (names[0] === one.kind) first++;
		console.log(`       ${one.id}: ${names.join(", ")} (is ${one.kind})`);
	}
	report("pick: the true kind is on the strip", hit / CASES.length, 0.75);
	report("pick: and it is the card that opens", first / CASES.length, 0.5);

	// placement agreement: how often the model puts a section where the label says
	let agreed = 0;
	let placedTotal = 0;
	// gap recall: cut out everything covering one required part, and see if the
	// tool asks for it. This is the measure that matters — it is the whole claim.
	let asked = 0;
	let cuts = 0;

	for (const one of CASES) {
		const pattern = patternById(one.kind);
		const gold = goldOf(one);

		const whole = await planner.place({
			segments: segment(notesOf(one)),
			brief: "",
			pattern,
		});
		gold.forEach((part, index) => {
			placedTotal++;
			if (whole.placement[index] === part) agreed++;
		});

		// parts the notes are known not to cover must come back as questions
		for (const missing of one.absent ?? []) {
			cuts++;
			const said = gaps(whole.placement, pattern, one.lang).map((g) => g.part);
			if (said.includes(missing)) asked++;
			console.log(
				`       ${one.id}: knowingly missing ${missing} — asked: ${said.join(", ") || "nothing"}`,
			);
		}

		for (const part of pattern.parts.filter((p) => p.required)) {
			const kept = one.sections.filter((s) => s.part !== part.id);
			if (kept.length === one.sections.length || kept.length < 2) continue;
			cuts++;
			const cut = { ...one, sections: kept };
			const placed = await planner.place({
				segments: segment(notesOf(cut)),
				brief: "",
				pattern,
			});
			const said = gaps(placed.placement, pattern, one.lang).map((g) => g.part);
			if (said.includes(part.id)) asked++;
			else
				console.log(`       ${one.id}: cut ${part.id}, asked for ${said.join(", ") || "nothing"}`);
		}
	}

	report("placement agrees with the label", agreed / placedTotal, 0.6);
	report("gap recall: a part you cut is a part it asks for", asked / cuts, 0.7);
}

console.log(`\n${CASES.length} labelled documents, ${PATTERNS.length} kinds\n`);
console.log("offline");
stability();
intrusion();
validator();

if (process.argv.includes("--live")) {
	console.log("\nlive");
	await live();
}

console.log(failed === 0 ? "\nALL PASS\n" : `\n${failed} BELOW FLOOR\n`);
process.exit(failed === 0 ? 0 : 1);
