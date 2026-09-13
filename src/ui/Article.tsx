import { createSignal, For, type JSX } from "solid-js";
import { blockOf, inline, type Run, stripMarker } from "../core";
import { editRun, markdown, runs } from "./state";

/**
 * The article: Markdown, rendered.
 *
 * One section in, one section out, in the order the chosen shape gave them.
 * Colour alone says where a word came from, and the output is output — nothing
 * is ever inserted into it to explain itself, and nothing is drawn over it
 * either. What a shortening did opens in the gutter, on that run's own thread.
 */
export function Article(props: {
	lit: number | null;
	onHover: (id: number | null) => void;
	shapes?: JSX.Element;
}) {
	const [copied, setCopied] = createSignal(false);

	const copy = async () => {
		await navigator.clipboard?.writeText(markdown());
		setCopied(true);
		setTimeout(() => setCopied(false), 1400);
	};

	const attrs = (run: Run) => ({
		"data-run": String(run.id),
		"data-key": run.key,
		"data-kind": run.kind,
		classList: { lit: props.lit === run.id },
		onMouseEnter: () => props.onHover(run.id),
		innerHTML: inline(stripMarker(run.md)),
	});

	const body = (run: Run) => {
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
			<div class="ph">
				<span>the article</span>
				<button type="button" class="copy" onClick={() => void copy()}>
					{copied() ? "copied" : "copy markdown"}
				</button>
			</div>

			{props.shapes}

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
					<For each={runs()}>{(run) => body(run)}</For>
				</div>
			</div>
		</section>
	);
}
