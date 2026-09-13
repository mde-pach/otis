import { createEffect, createSignal, For, type JSX, onCleanup, onMount, Show } from "solid-js";
import { blockOf, diffWords, inline, type Run, stripMarker } from "../core";
import { editRun, markdown, runs, sourceOf } from "./state";

/**
 * The article: Markdown, rendered.
 *
 * One section in, one section out, in the order the chosen shape gave them.
 * Colour alone says where a word came from, and the output is output — nothing
 * is ever inserted into it to explain itself.
 *
 * What a shortening did is shown over the section it did it to, on hover, in a
 * layer above the text. It covers rather than displaces: the article you are
 * reading is the article, whatever you happen to be pointing at.
 */
export function Article(props: {
	lit: number | null;
	onHover: (id: number | null) => void;
	shapes?: JSX.Element;
}) {
	let scroll: HTMLDivElement | undefined;
	const [at, setAt] = createSignal<{ top: number; left: number; width: number } | null>(null);
	const [copied, setCopied] = createSignal(false);

	/** the lit run, when there is something about it worth showing */
	const changed = () => runs().find((r) => r.id === props.lit && r.kind === "reworded") ?? null;

	const place = () => {
		const run = changed();
		const node = run ? scroll?.querySelector<HTMLElement>(`[data-run="${run.id}"]`) : null;
		if (!run || !node || !scroll) return setAt(null);
		const a = node.getBoundingClientRect();
		const b = scroll.getBoundingClientRect();
		setAt({ top: a.top - b.top + scroll.scrollTop, left: a.left - b.left, width: a.width });
	};

	createEffect(() => {
		void props.lit;
		void runs();
		requestAnimationFrame(place);
	});

	onMount(() => {
		const again = () => requestAnimationFrame(place);
		scroll?.addEventListener("scroll", again, { passive: true });
		addEventListener("resize", again);
		onCleanup(() => {
			scroll?.removeEventListener("scroll", again);
			removeEventListener("resize", again);
		});
	});

	const copy = async () => {
		await navigator.clipboard?.writeText(markdown());
		setCopied(true);
		setTimeout(() => setCopied(false), 1400);
	};

	const attrs = (run: Run) => ({
		"data-run": String(run.id),
		"data-key": run.key,
		"data-kind": run.kind,
		...(run.confidence ? { "data-reach": run.confidence } : {}),
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

			<div class="scroll" id="article-scroll" ref={scroll}>
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

				<Show when={at() && changed()}>
					<div
						class="pop"
						style={{
							top: `${(at() as { top: number }).top}px`,
							left: `${(at() as { left: number }).left}px`,
							"min-width": `${Math.max((at() as { width: number }).width, 220)}px`,
						}}
					>
						<span class="k">shortened from what you wrote</span>
						<p>
							<For each={diffWords(sourceOf(changed() as Run), (changed() as Run).md)}>
								{(op) => <span data-op={op.type}>{op.text}</span>}
							</For>
						</p>
					</div>
				</Show>
			</div>
		</section>
	);
}
