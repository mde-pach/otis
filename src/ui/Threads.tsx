import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { diffWords, type Run } from "../core";
import { dropped, holes, runs, sourceOf } from "./state";

/**
 * The gutter, and the curves in it.
 *
 * One line per run that came from somewhere, drawn from the measured position
 * of the source range to the measured position of the rendered run — so it
 * stays true when either side is edited, scrolled or resized. A dashed stub
 * with a ring is a piece of your notes the article is not using.
 *
 * When a shortened run is lit, the card that says what was done to it opens
 * here, on its own thread, between the two texts. It belongs to neither: your
 * notes are your notes and the article is the article, and nothing about what
 * happened between them is ever written into either one.
 *
 * The questions sit here for the same reason. A part of this kind of piece that
 * none of your sections went into is a question out of the pattern file, shown
 * where the missing part would go — never dropped into the article as a note to
 * yourself, and never written for you.
 */
export function Threads(props: { lit: number | null }) {
	let svg: SVGSVGElement | undefined;
	const [card, setCard] = createSignal<number | null>(null);
	const [asks, setAsks] = createSignal<{ top: number; part: string; asks: string }[]>([]);

	/** the lit run, when it is one there is something to say about */
	const changed = () => runs().find((r) => r.id === props.lit && r.kind === "reworded") ?? null;

	const rangeRect = (start: number, end: number): DOMRect | null => {
		const host = document.querySelector(".notes");
		const node = host?.firstChild;
		if (!node) return null;
		const length = node.textContent?.length ?? 0;
		if (start >= length) return null;
		const range = document.createRange();
		range.setStart(node, Math.max(0, start));
		range.setEnd(node, Math.min(length, end));
		const rect = range.getBoundingClientRect();
		return rect.height ? rect : null;
	};

	const draw = () => {
		const gutter = svg?.parentElement?.getBoundingClientRect();
		if (!svg || !gutter?.width) return;
		const width = gutter.width;
		const parts: string[] = [];
		let open: number | null = null;

		for (const run of runs()) {
			if (!run.from) continue;
			const node = document.querySelector<HTMLElement>(`[data-run="${run.id}"]`);
			const a = rangeRect(run.from.start, run.from.end);
			const b = node?.getBoundingClientRect();
			if (!a || !b?.height) continue;
			const y1 = a.top + a.height / 2 - gutter.top;
			const y2 = b.top + b.height / 2 - gutter.top;
			const on = props.lit === run.id;
			const dim = props.lit !== null && !on;
			if (on && run.kind === "reworded") open = (y1 + y2) / 2;
			parts.push(
				`<path d="M0 ${y1.toFixed(1)} C ${width * 0.45} ${y1.toFixed(1)}, ${width * 0.55} ${y2.toFixed(1)}, ${width} ${y2.toFixed(1)}" fill="none" stroke="${on ? "#4fc9ec" : "#2b6e90"}" stroke-width="${on ? 2 : 1}" opacity="${on ? 1 : dim ? 0.14 : 0.5}"/>`,
			);
		}

		for (const out of dropped()) {
			const a = rangeRect(out.start, out.end);
			if (!a) continue;
			const y = (a.top + a.height / 2 - gutter.top).toFixed(1);
			parts.push(
				`<path d="M0 ${y} L 17 ${y}" stroke="#35586c" stroke-width="1" stroke-dasharray="2 3"/><circle cx="20" cy="${y}" r="2.5" fill="none" stroke="#35586c"/>`,
			);
		}

		// a required part with nothing in it, shown after the section it would follow
		const placed = runs();
		setAsks(
			holes().flatMap((gap) => {
				const anchor =
					gap.after === null
						? placed[0]
						: (placed.find((r) => r.fromIndex === gap.after) ?? placed[placed.length - 1]);
				const node = anchor
					? document.querySelector<HTMLElement>(`[data-run="${anchor.id}"]`)
					: null;
				const rect = node?.getBoundingClientRect();
				if (!rect) return [];
				const y = rect.bottom - gutter.top - 10;
				// a question for a section scrolled out of sight is not shown at the
				// edge of the gutter — it belongs beside the part it is asking about
				if (y < 6 || y > gutter.height - 24) return [];
				return [{ top: y, part: gap.part, asks: gap.asks }];
			}),
		);

		svg.innerHTML = parts.join("");
		setCard(open);
	};

	const schedule = () => requestAnimationFrame(draw);

	onMount(() => {
		schedule();
		const panes = [...document.querySelectorAll(".scroll")];
		for (const pane of panes) pane.addEventListener("scroll", schedule, { passive: true });
		addEventListener("resize", schedule);
		const observer = new ResizeObserver(schedule);
		if (svg?.parentElement) observer.observe(svg.parentElement);
		onCleanup(() => {
			for (const pane of panes) pane.removeEventListener("scroll", schedule);
			removeEventListener("resize", schedule);
			observer.disconnect();
		});
	});

	createEffect(() => {
		void runs();
		void dropped();
		void holes();
		void props.lit;
		schedule();
	});

	return (
		<div class="gutter">
			<svg ref={svg} aria-hidden="true" />
			<For each={asks()}>
				{(gap) => (
					<div class="ask" style={{ top: `${gap.top}px` }}>
						<span class="p">{gap.part}</span>
						<span class="q">{gap.asks}</span>
					</div>
				)}
			</For>
			<Show when={card() !== null && changed()}>
				{(run) => (
					<div class="card" style={{ top: `${card() as number}px` }}>
						<span class="k">shortened from what you wrote</span>
						<p>
							<For each={diffWords(sourceOf(run() as Run), (run() as Run).md)}>
								{(op) => <span data-op={op.type}>{op.text}</span>}
							</For>
						</p>
					</div>
				)}
			</Show>
		</div>
	);
}
