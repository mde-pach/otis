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

	const geometry = await page.evaluate((isStacked) => {
		const vh = window.innerHeight;
		return {
			vh,
			pageScrolls: document.documentElement.scrollHeight > vh + 1,
			panes: [...document.querySelectorAll(".pane")].map((pane) => {
				const box = pane.getBoundingClientRect();
				const scroll = pane.querySelector(".scroll");
				return {
					name: pane.querySelector(".ph")?.textContent,
					height: Math.round(box.height),
					scrolls: scroll ? scroll.scrollHeight > scroll.clientHeight : null,
				};
			}),
		};
	}, stacked);

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
	}));
	check("every section reaches the article", article.runs > 20, `${article.runs} runs`);
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

	check("no console errors", errors.length === 0, errors[0]);
	await page.close();
}

await browser.close();
stopServer();

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILING`}`);
process.exit(failures === 0 ? 0 : 1);
