/**
 * The layout check.
 *
 * Chrome that has slid off the bottom of the window looks fine in a screenshot
 * of the top of the page — which is how a button once shipped unreachable. So
 * this asserts what a screenshot cannot: no pane taller than the window, the
 * overflow scrolling inside the pane rather than taking the page with it, the
 * capsule reachable, every segment arriving in the article, the notes still one
 * text node, and hovering lighting exactly one run and one thread.
 *
 * Run it against a deliberately brutal document at five window sizes:
 *
 *   bun run check:layout
 */

import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const SITE = process.env.OTIS_URL ?? "http://localhost:4321/otis/";
const notes = readFileSync(new URL("../fixtures/cache-p99.notes.md", import.meta.url), "utf8");
/** the fixture three times over, plus one paragraph far longer than any pane */
const document_ = [notes, notes, notes, "x ".repeat(900).trim()].join("\n\n");

const SIZES = [
	{ name: "1440x900", width: 1440, height: 900 },
	{ name: "1280x720", width: 1280, height: 720 },
	{ name: "1024x600", width: 1024, height: 600 },
	{ name: "820x1180", width: 820, height: 1180 },
	{ name: "400x780", width: 400, height: 780 },
];

/** below this the panes stack, and you scroll the page to reach a lower one */
const STACKS_BELOW = 900;

let failures = 0;
function check(label, ok, detail) {
	if (!ok) failures++;
	console.log(`${ok ? "  ok  " : "  FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function waitForServer(url, attempts = 60) {
	for (let i = 0; i < attempts; i++) {
		try {
			const response = await fetch(url);
			if (response.ok) return true;
		} catch {
			// not up yet
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	return false;
}

let startedServer = false;
if (!process.env.OTIS_URL) {
	spawn("bun", ["run", "dev"], { stdio: "ignore", detached: true }).unref();
	startedServer = true;
	if (!(await waitForServer(SITE))) {
		console.error("dev server never came up");
		process.exit(1);
	}
}

/** astro dev daemonises, so the spawned process is not the thing to kill */
function stopServer() {
	if (!startedServer) return;
	try {
		spawnSync("bunx", ["astro", "dev", "stop"], { stdio: "ignore" });
	} catch {
		// it will go away with the shell; not worth failing the run over
	}
}

// OTIS_CHROMIUM lets a container with its own chromium skip `playwright install`
const browser = await chromium.launch({
	executablePath: process.env.OTIS_CHROMIUM || undefined,
});

for (const size of SIZES) {
	console.log(`\n== ${size.name}`);
	const stacked = size.width <= STACKS_BELOW;
	const page = await browser.newPage({ viewport: { width: size.width, height: size.height } });
	const errors = [];
	page.on("pageerror", (error) => errors.push(String(error)));
	await page.goto(SITE, { waitUntil: "networkidle" });

	// A REAL paste, not textContent. Setting textContent is the one way to put
	// this document in that a person never uses, and it is why a pasted document
	// once arrived with every line break gone: the browser answers a paste with
	// <div>s, and textContent reads those back as one unbroken string.
	await page.click(".notes");
	await page.evaluate(async (text) => {
		const host = document.querySelector(".notes");
		host.focus();
		const carried = new DataTransfer();
		carried.setData("text/plain", text);
		host.dispatchEvent(
			new ClipboardEvent("paste", { clipboardData: carried, bubbles: true, cancelable: true }),
		);
	}, document_);
	await page.waitForTimeout(200);
	if (!(await page.evaluate(() => document.querySelector(".notes").textContent.length))) {
		await page.click(".notes");
		await page.keyboard.insertText(document_);
	}
	await page.evaluate(() => document.querySelector(".notes").blur());
	await page.waitForTimeout(700);

	// what the tool is working from has to be what was pasted, breaks and all
	const kept = await page.evaluate(
		(text) => ({
			lines: document.querySelector(".notes").textContent.split("\n").length,
			want: text.split("\n").length,
		}),
		document_,
	);
	check(
		"a pasted document keeps its line breaks",
		kept.lines === kept.want,
		`${kept.lines} lines of ${kept.want}`,
	);

	// the capsule is the only chrome: it must be reachable without scrolling
	const capsule = await page.evaluate(() => {
		const box = document.querySelector(".cap").getBoundingClientRect();
		return {
			top: Math.round(box.top),
			bottom: Math.round(box.bottom),
			right: Math.round(box.right),
			vh: window.innerHeight,
			vw: window.innerWidth,
		};
	});
	check(
		"the capsule is on screen",
		capsule.bottom <= capsule.vh + 1 && capsule.top >= 0 && capsule.right <= capsule.vw + 1,
		`bottom ${capsule.bottom} of ${capsule.vh}`,
	);

	const geometry = await page.evaluate(() => {
		const vh = window.innerHeight;
		return {
			vh,
			pageScrolls: document.documentElement.scrollHeight > vh + 1,
			panes: [...document.querySelectorAll(".pane")].map((pane) => {
				const box = pane.getBoundingClientRect();
				const scroll = pane.querySelector(".scroll");
				return {
					name:
						pane.querySelector(".ph span")?.textContent ?? pane.querySelector(".ph")?.textContent,
					height: Math.round(box.height),
					scrolls: scroll ? scroll.scrollHeight > scroll.clientHeight : null,
				};
			}),
		};
	});

	for (const pane of geometry.panes) {
		check(
			`${pane.name}: the pane fits the window`,
			pane.height <= geometry.vh + 1,
			`${pane.height}px in ${geometry.vh}px`,
		);
		check(`${pane.name}: overflow scrolls inside it`, pane.scrolls === true);
	}
	check("the page itself never scrolls", !geometry.pageScrolls);

	// the article must carry the writer's text, and the threads must be drawn
	const article = await page.evaluate(() => ({
		runs: document.querySelectorAll("[data-run]").length,
		threads: document.querySelectorAll(".gutter path").length,
		notesNodes: document.querySelector(".notes").childNodes.length,
		copy: Boolean(document.querySelector(".copy")),
		// the article is the article: nothing about it is ever written into it
		inOutput: document.querySelectorAll(".md .pop, .md .was, .md .card, .md .shapes").length,
	}));
	check("every section reaches the article", article.runs > 20, `${article.runs} runs`);
	check("the markdown can be taken away", article.copy === true);
	check("nothing explains itself inside the output", article.inOutput === 0);
	check(
		"the notes stay one text node, never split into elements",
		article.notesNodes <= 1,
		`${article.notesNodes} nodes`,
	);
	if (!stacked)
		check(
			"a thread is drawn for each run",
			article.threads >= article.runs,
			`${article.threads} threads`,
		);

	// hovering lights the pair: the run, its origin, and the thread between them
	const paired = await page.evaluate(async () => {
		const run = document.querySelectorAll("[data-run]")[2];
		run.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
		await new Promise((resolve) => setTimeout(resolve, 220));
		const bright = [...document.querySelectorAll(".gutter path")].filter(
			(p) => p.getAttribute("opacity") === "1",
		).length;
		return { runLit: document.querySelectorAll("[data-run].lit").length, bright };
	});
	check("hovering lights exactly one run", paired.runLit === 1, `${paired.runLit} lit`);
	if (!stacked)
		check("and brightens exactly one thread", paired.bright === 1, `${paired.bright} bright`);

	// the about page has to be readable too
	await page.click("nav button:nth-child(2)");
	await page.waitForTimeout(250);
	const about = await page.evaluate(() => {
		const doc = document.querySelector(".doc");
		return {
			there: Boolean(doc),
			scrolls: doc ? doc.scrollHeight > doc.clientHeight : false,
			pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
		};
	});
	check("about renders", about.there);
	check("about scrolls inside itself, not the page", !about.pageScrolls);
	await page.click("nav button:nth-child(1)");
	await page.waitForTimeout(200);

	// and again with three kinds on offer: the strip is the tallest thing the
	// article pane ever grows, and it must not push a pane off the window
	await page.evaluate(async (text) => {
		const many = document.querySelectorAll("[data-run]").length;
		// a placement is one part id per section of the writer's own document.
		// Nothing is placed in "cost" or "detection", which are required — so the
		// gutter has two questions to ask and the article still has none in it.
		const placement = Array.from({ length: many }, (_, i) => {
			if (i === 0) return "observed";
			if (i === 1) return "hidden";
			if (i === 2) return "fix";
			if (i === 4) return null;
			return "cause";
		});
		const open = () =>
			new Promise((resolve, reject) => {
				const request = indexedDB.open("otis", 2);
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		const db = await open();
		const got = db.transaction("docs", "readwrite").objectStore("docs").get("current");
		await new Promise((resolve) => {
			got.onsuccess = resolve;
		});
		const doc = got.result ?? { id: "current", notes: text, brief: "", edits: {} };
		doc.notes = text;
		doc.reach = 3;
		doc.shape = 0;
		doc.edits = {};
		doc.plan = {
			basis: text,
			shapes: [
				{ patternId: "post-mortem", because: "an incident with a number in it", placement },
				{
					patternId: "internal-note",
					because: "it is short and it is for a team",
					placement: null,
				},
				{ patternId: "essay", because: "it argues something", placement: null },
			],
			format: {},
			short: {},
		};
		const tx = db.transaction("docs", "readwrite");
		tx.objectStore("docs").put(doc);
		await new Promise((resolve) => {
			tx.oncomplete = resolve;
		});
	}, document_);
	await page.reload({ waitUntil: "networkidle" });
	await page.waitForTimeout(900);

	const offered = await page.evaluate(() => ({
		cards: document.querySelectorAll(".shape").length,
		// a card names its pattern, says what that kind does, and lists its parts
		named: [...document.querySelectorAll(".shape")].every(
			(card) =>
				card.querySelector(".nm")?.textContent &&
				card.querySelector(".does")?.textContent &&
				card.querySelectorAll(".parts em").length > 2,
		),
		// and it is the same description whatever the document says
		static: [...document.querySelectorAll(".shape")].every(
			(card) => !card.textContent.includes("p99"),
		),
		asks: document.querySelectorAll(".gutter .ask").length,
		// a question is asked in the gutter and never written into the article
		inOutput: document.querySelectorAll(".md .ask, .md .pop, .md .was, .md .card").length,
		vh: window.innerHeight,
		tallest: Math.max(
			...[...document.querySelectorAll(".pane")].map((pane) =>
				Math.round(pane.getBoundingClientRect().height),
			),
		),
		pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
	}));
	check("every kind is on offer", offered.cards === 3, `${offered.cards} cards`);
	check("and each card describes its kind", offered.named);
	check("a card says nothing about your document", offered.static);
	if (!stacked)
		check("a part with nothing in it asks you", offered.asks > 0, `${offered.asks} questions`);
	check("and asks in the gutter, never in the article", offered.inOutput === 0);
	check(
		"the panes still fit with the strip in them",
		offered.tallest <= offered.vh + 1,
		`${offered.tallest}px in ${offered.vh}px`,
	);
	check("and the page still never scrolls", !offered.pageScrolls);

	check("no console errors", errors.length === 0, errors[0]);
	await page.close();
}

await browser.close();
stopServer();

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILING`}`);
process.exit(failures === 0 ? 0 : 1);
