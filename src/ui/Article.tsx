import { For } from "solid-js";
import { blockOf, inline, stripMarker } from "../core";
import { editRun, runs } from "./state";

/**
 * The article: Markdown, rendered.
 *
 * Colour alone says where a word came from — nothing is captioned, and there is
 * no menu. A run the writer edits stops being the tool's on the spot, because
 * by then the words are theirs.
 */
export function Article(props: { lit: number | null; onHover: (id: number | null) => void }) {
	const marks = (run: { kind: string; confidence?: string }) => ({
		"data-kind": run.kind,
		...(run.confidence ? { "data-reach": run.confidence } : {}),
	});

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
					<For each={runs()}>
						{(run) => {
							const body = () => inline(stripMarker(run.md));
							const attrs = () => ({
								"data-run": String(run.id),
								"data-key": run.key,
								...marks(run),
								classList: { lit: props.lit === run.id },
								onMouseEnter: () => props.onHover(run.id),
								innerHTML: body(),
							});
							const block = blockOf(run.md);
							if (block === "h2") return <h2 {...attrs()} />;
							if (block === "h3") return <h3 {...attrs()} />;
							if (block === "li") {
								return (
									<ul>
										<li {...attrs()} />
									</ul>
								);
							}
							if (block === "code") return <pre {...attrs()} />;
							return <p {...attrs()} />;
						}}
					</For>
				</div>
			</div>
		</section>
	);
}
