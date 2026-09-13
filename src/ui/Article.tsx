import { For, Show } from "solid-js";
import { blockOf, inline, paragraphs, type Run, stripMarker } from "../core";
import { editRun, runs } from "./state";

/**
 * The article: Markdown, rendered.
 *
 * Colour alone says where a word came from — nothing is captioned, and there is
 * no menu. A run the writer edits stops being the tool's on the spot, because
 * by then the words are theirs.
 *
 * Sentences from the same paragraph are drawn inside one paragraph, each still
 * its own span, so provenance stays per-sentence while the prose still reads as
 * prose.
 */
export function Article(props: { lit: number | null; onHover: (id: number | null) => void }) {
	const attrs = (run: Run) => ({
		"data-run": String(run.id),
		"data-key": run.key,
		"data-kind": run.kind,
		...(run.confidence ? { "data-reach": run.confidence } : {}),
		classList: { lit: props.lit === run.id },
		onMouseEnter: () => props.onHover(run.id),
		innerHTML: inline(stripMarker(run.md)),
	});

	const one = (run: Run) => {
		const block = blockOf(run.md);
		if (block === "h2") return <h2 {...attrs(run)} />;
		if (block === "h3") return <h3 {...attrs(run)} />;
		if (block === "li")
			return (
				<ul>
					<li {...attrs(run)} />
				</ul>
			);
		if (block === "code") return <pre {...attrs(run)} />;
		return <p {...attrs(run)} />;
	};

	return (
		<section class="pane art">
			<div class="ph">the article</div>
			<div class="scroll" id="article-scroll">
				{/* biome-ignore lint/a11y/useSemanticElements: a contenteditable surface is the interactive element; a textarea cannot render provenance or carry highlight ranges */}
				{/* biome-ignore lint/a11y/useFocusableInteractive: contenteditable is focusable by definition */}
				<div
					class="md"
					role="textbox"
					aria-multiline="true"
					tabindex={0}
					aria-label="the article"
					contentEditable
					spellcheck={false}
					onMouseLeave={() => props.onHover(null)}
					onInput={(event) => {
						const target = (event.target as HTMLElement).closest<HTMLElement>("[data-run]");
						if (target?.dataset.key) void editRun(target.dataset.key, target.textContent ?? "");
					}}
				>
					<For each={paragraphs(runs())}>
						{(group) => (
							<Show when={group.length > 1} fallback={one(group[0] as Run)}>
								<p class="joined">
									<For each={group}>
										{(run, at) => (
											<>
												{at() > 0 ? " " : null}
												<span {...attrs(run)} />
											</>
										)}
									</For>
								</p>
							</Show>
						)}
					</For>
				</div>
			</div>
		</section>
	);
}
