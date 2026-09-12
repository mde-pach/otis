import { createEffect, Show } from "solid-js";
import { diffWords } from "../core/diff";

export interface PeekData {
	kind: "yours" | "rephrased" | "generated" | "edited";
	/** The writer's text this came from. Empty when there is none. */
	before: string;
	after: string;
	refs: string[];
	x: number;
	y: number;
}

const SAYS: Record<PeekData["kind"], string> = {
	yours: "your words, unchanged",
	rephrased: "rephrased from your words — nothing added",
	generated: "the tool's words — change it or delete it",
	edited: "yours — you changed it here",
};

const EDGE = 10;

/** What it was, shown rather than described. */
export function Peek(props: { data: PeekData | null }) {
	const ops = () => (props.data?.before ? diffWords(props.data.before, props.data.after) : []);
	let node: HTMLElement | undefined;

	/**
	 * Placed after it has been measured, never from the cursor alone: near the
	 * right edge it would otherwise hang off the window, and a long diff near the
	 * bottom would run past it.
	 */
	const place = () => {
		const data = props.data;
		if (!node || !data) return;
		const box = node.getBoundingClientRect();
		const x =
			data.x + box.width > window.innerWidth - EDGE
				? Math.max(EDGE, data.x - box.width - 32)
				: data.x;
		const y =
			data.y + box.height > window.innerHeight - EDGE
				? Math.max(EDGE, window.innerHeight - box.height - EDGE)
				: data.y;
		node.style.left = `${x}px`;
		node.style.top = `${y}px`;
	};

	createEffect(() => {
		// re-place whenever the hovered thing changes, after it has rendered
		void props.data;
		queueMicrotask(place);
	});

	return (
		<Show when={props.data}>
			{(d) => (
				<aside class="peek" ref={(el) => (node = el)} aria-hidden="true">
					<span class={`peek-kind ${d().kind}`}>
						{d().refs.length ? `${d().refs.join(" + ")} · ` : ""}
						{SAYS[d().kind]}
					</span>

					<Show when={d().kind !== "yours"}>
						<Show
							when={d().before}
							fallback={
								<p class="peek-none">
									Nothing of yours sits under this — the shape asked for a heading and it wrote one.
								</p>
							}
						>
							<p class="peek-diff">
								{ops().map((op) =>
									op.type === "keep" ? (
										op.text
									) : op.type === "del" ? (
										<del>{op.text}</del>
									) : (
										<ins>{op.text}</ins>
									),
								)}
							</p>
							<span class="peek-legend">struck = dropped · boxed = added</span>
						</Show>
					</Show>
				</aside>
			)}
		</Show>
	);
}
