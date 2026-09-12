import { createMemo, For, Show } from "solid-js";
import { diffWords } from "../core/diff";
import { displayId } from "../core/project";
import { deriveState } from "../core/provenance";
import type { Fragment } from "../core/types";
import type { PeekData } from "./Peek";
import { articleMarkdown, editBlock, editTitle, sections, state } from "./state";

const KIND = {
	verbatim: "yours",
	edited: "edited",
	"reword-accepted": "rephrased",
	"written-here": "yours",
} as const;

/**
 * The article, as text.
 *
 * Your words carry no mark, because they are the norm. Only what changed is
 * marked — the altered words inside a rephrasing, and any heading the tool
 * wrote. Everything is editable, and editing makes it yours.
 */
export function Article(props: {
	onPeek: (data: PeekData | null) => void;
	onLight: (refs: string[]) => void;
}) {
	const fragments = createMemo(() => new Map(state.project.fragments.map((f) => [f.id, f])));

	/** Hover and blur are wired on the node: a linter does not recognise either on text. */
	const wireLeave = (node: HTMLDivElement) => {
		node.addEventListener("mouseleave", () => {
			props.onPeek(null);
			props.onLight([]);
		});
	};

	const wireHover = (node: HTMLElement, data: () => Omit<PeekData, "x" | "y">) => {
		node.addEventListener("mouseenter", (event) => {
			const d = data();
			props.onPeek({ ...d, x: event.clientX + 16, y: event.clientY + 14 });
			props.onLight(d.refs.map((r) => r.replace("#", "f")));
		});
	};

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(articleMarkdown());
		} catch {
			// a browser that refuses the clipboard is not worth interrupting for
		}
	};

	return (
		<section class="pane">
			<div class="pane-head">
				<span>Article</span>
				<span class="pane-right quiet">editable — change anything</span>
			</div>

			<div class="scroll" ref={wireLeave}>
				<article class="doc">
					<For each={sections()}>
						{(section) => (
							<Show when={section.blocks.length > 0}>
								<Show when={section.title}>
									{(title) => (
										<h2
											contentEditable
											spellcheck={false}
											classList={{ mark: title().source === "tool" }}
											ref={(node) => {
												wireHover(node, () => ({
													kind: title().source === "tool" ? "generated" : "edited",
													before: "",
													after: title().text,
													refs: [],
												}));
												node.addEventListener("blur", () => {
													void editTitle(section.slotId, node.textContent ?? "");
												});
											}}
										>
											{title().text}
										</h2>
									)}
								</Show>

								<For each={section.blocks}>
									{(block) => {
										const fragment = () =>
											fragments().get(block.fragmentId) as Fragment | undefined;
										const before = () => fragment()?.text ?? "";
										const kind = () => {
											const f = fragment();
											return f ? KIND[deriveState(block, f)] : "yours";
										};
										return (
											<p
												contentEditable
												spellcheck={false}
												ref={(node) => {
													wireHover(node, () => ({
														kind: kind(),
														before: kind() === "yours" ? "" : before(),
														after: block.text,
														refs: [displayId(block.fragmentId)],
													}));
													node.addEventListener("blur", () => {
														void editBlock(block.id, node.textContent ?? "");
													});
												}}
											>
												<Show when={kind() === "rephrased"} fallback={block.text}>
													<For each={diffWords(before(), block.text)}>
														{(op) =>
															op.type === "del" ? null : op.type === "ins" ? (
																<span class="changed">{op.text}</span>
															) : (
																op.text
															)
														}
													</For>
												</Show>
											</p>
										);
									}}
								</For>
							</Show>
						)}
					</For>

					<Show when={state.project.blocks.length === 0}>
						<p class="quiet">
							Nothing here yet. Write on the left and press Organise — every word that lands here
							will be one of yours.
						</p>
					</Show>
				</article>
			</div>

			<div class="pane-foot">
				<span class="quiet">{state.message()}</span>
				<button type="button" class="act" onClick={() => void copy()}>
					Copy
				</button>
			</div>
		</section>
	);
}
