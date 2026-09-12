/**
 * The layout check.
 *
 * A pane whose footer has slid off the bottom of the window looks fine in a
 * screenshot of the top of the page — which is how the Organise button once
 * shipped unreachable. So this asserts the things a screenshot cannot: that no
 * pane is taller than the window, that the overflow scrolls inside the pane
 * rather than taking the page with it, that both footers are still on screen
 * after a long document has been organised, and that the hover card stays
 * inside the window when you hover the far corner.
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

	await page.evaluate((text) => {
		const host = document.querySelector(".notes");
		host.textContent = "";
		for (const piece of text.split(/\n{2,}/).filter(Boolean)) {
			const p = document.createElement("p");
			p.textContent = piece;
			host.append(p);
		}
		host.dispatchEvent(new FocusEvent("blur"));
	}, document_);
	await page.waitForTimeout(600);

	// before anything else: can you even reach the button, without scrolling?
	const button = await page.evaluate(() => {
		const node = [...document.querySelectorAll("button")].find(
			(b) => b.textContent.trim() === "Organise",
		);
		const box = node.getBoundingClientRect();
		return { top: Math.round(box.top), bottom: Math.round(box.bottom), vh: window.innerHeight };
	});
	check(
		"Organise is on screen before any scrolling",
		stacked || (button.bottom <= button.vh && button.top >= 0),
		`bottom ${button.bottom} of ${button.vh}`,
	);

	await page.click("button:has-text('Organise')");
	await page.waitForTimeout(900);

	const geometry = await page.evaluate((isStacked) => {
		const vh = window.innerHeight;
		return {
			vh,
			pageScrolls: document.documentElement.scrollHeight > vh + 1,
			panes: [...document.querySelectorAll(".pane")].map((pane) => {
				const box = pane.getBoundingClientRect();
				const foot = pane.querySelector(".pane-foot");
				// stacked, a lower pane is reached by scrolling the page: bring it into view
				if (isStacked && foot) foot.scrollIntoView({ block: "nearest" });
				const footBox = foot?.getBoundingClientRect();
				const scroll = pane.querySelector(".scroll");
				return {
					name: pane.querySelector(".pane-head span")?.textContent,
					height: Math.round(box.height),
					footVisible: footBox ? footBox.bottom <= vh + 1 && footBox.top >= -1 : null,
					scrolls: scroll ? scroll.scrollHeight > scroll.clientHeight : null,
				};
			}),
		};
	}, stacked);

	for (const pane of geometry.panes) {
		check(
			`${pane.name}: the pane fits the window`,
			stacked || pane.height <= geometry.vh + 1,
			`${pane.height}px in ${geometry.vh}px`,
		);
		if (pane.footVisible !== null) check(`${pane.name}: its footer is on screen`, pane.footVisible);
		if (pane.name !== "Shape")
			check(`${pane.name}: overflow scrolls inside it`, pane.scrolls === true);
	}
	if (!stacked) check("the page itself does not scroll", !geometry.pageScrolls);

	// the hover card, at the corner of the first paragraph and of the last
	const cards = await page.evaluate(async () => {
		const paragraphs = [...document.querySelectorAll(".doc p")];
		const out = [];
		for (const paragraph of [paragraphs[0], paragraphs[paragraphs.length - 1]]) {
			paragraph.scrollIntoView({ block: "center" });
			await new Promise((resolve) => setTimeout(resolve, 60));
			const box = paragraph.getBoundingClientRect();
			paragraph.dispatchEvent(
				new MouseEvent("mouseenter", {
					bubbles: true,
					clientX: Math.round(box.right - 4),
					clientY: Math.round(box.bottom - 4),
				}),
			);
			await new Promise((resolve) => setTimeout(resolve, 120));
			const card = document.querySelector(".peek")?.getBoundingClientRect();
			out.push(
				card
					? {
							inside:
								card.left >= 0 &&
								card.top >= 0 &&
								card.right <= window.innerWidth + 1 &&
								card.bottom <= window.innerHeight + 1,
							where: [
								Math.round(card.left),
								Math.round(card.top),
								Math.round(card.right),
								Math.round(card.bottom),
							],
							window: [window.innerWidth, window.innerHeight],
						}
					: { inside: null },
			);
		}
		return out;
	});
	cards.forEach((card, i) => {
		check(
			`the hover card stays inside the window (${i === 0 ? "first" : "last"} paragraph)`,
			card.inside === true,
			card.where ? `${card.where} in ${card.window}` : "no card appeared",
		);
	});

	check("no console errors", errors.length === 0, errors[0]);
	await page.close();
}

await browser.close();
stopServer();

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILING`}`);
process.exit(failures === 0 ? 0 : 1);
