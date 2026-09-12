import { Show } from "solid-js";
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

/** What it was, shown rather than described. */
export function Peek(props: { data: PeekData | null }) {
	const ops = () => (props.data?.before ? diffWords(props.data.before, props.data.after) : []);

	return (
		<Show when={props.data}>
			{(d) => (
				<aside class="peek" style={{ left: `${d().x}px`, top: `${d().y}px` }} aria-hidden="true">
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
