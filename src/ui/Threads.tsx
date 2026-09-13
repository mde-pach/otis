import { createEffect, onCleanup, onMount } from "solid-js";
import { dropped, runs } from "./state";

/**
 * The gutter, and the curves in it.
 *
 * One line per run that came from somewhere, drawn from the measured position
 * of the source range to the measured position of the rendered run — so it
 * stays true when either side is edited, scrolled or resized. A dashed stub
 * with a ring is a piece of your notes the article is not using.
 */
export function Threads(props: { lit: number | null }) {
	let svg: SVGSVGElement | undefined;

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

		svg.innerHTML = parts.join("");
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
		void props.lit;
		schedule();
	});

	return (
		<div class="gutter">
			<svg ref={svg} aria-hidden="true" />
		</div>
	);
}
