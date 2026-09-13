import { createEffect, onMount } from "solid-js";
import { segments, setNotes, state } from "./state";

/**
 * What you wrote: one continuous editable text.
 *
 * It is never split into elements. Highlighting goes through the Custom
 * Highlight API, which paints ranges without touching the DOM — so a single
 * line stays a single line, the caret is never clobbered, and a sentence inside
 * that line can still be lit.
 */
export function Notes(props: {
	lit: number | null;
	dropped: { start: number; end: number }[];
	onHover: (index: number | null) => void;
}) {
	let host: HTMLDivElement | undefined;

	const paint = () => {
		if (!host || host.contains(document.activeElement)) return;
		if (host.textContent === state.doc.notes) return;
		host.textContent = state.doc.notes;
	};

	/** Ranges, not spans: this is the whole reason the text stays intact. */
	const range = (start: number, end: number): Range | null => {
		const node = host?.firstChild;
		if (!node) return null;
		const length = node.textContent?.length ?? 0;
		if (start >= length) return null;
		const found = document.createRange();
		found.setStart(node, Math.max(0, start));
		found.setEnd(node, Math.min(length, end));
		return found;
	};

	const highlights = () => {
		if (!("highlights" in CSS)) return;
		const all = segments();

		CSS.highlights.delete("otis-lit");
		const one = props.lit === null ? null : all[props.lit];
		const lit = one ? range(one.start, one.end) : null;
		if (lit) CSS.highlights.set("otis-lit", new Highlight(lit));

		CSS.highlights.delete("otis-out");
		const out = props.dropped.map((d) => range(d.start, d.end)).filter(Boolean) as Range[];
		if (out.length) CSS.highlights.set("otis-out", new Highlight(...out));
	};

	onMount(paint);

	createEffect(() => {
		void state.doc.notes;
		paint();
		void props.lit;
		void props.dropped;
		highlights();
	});

	const find = (event: MouseEvent) => {
		const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
		if (!point || point.offsetNode !== host?.firstChild) return props.onHover(null);
		const hit = segments().find((s) => point.offset >= s.start && point.offset <= s.end);
		props.onHover(hit ? hit.index : null);
	};

	return (
		<section class="pane">
			<div class="ph">what you wrote</div>
			<div class="scroll" id="notes-scroll">
				{/* biome-ignore lint/a11y/useSemanticElements: a contenteditable surface is the interactive element; a textarea cannot render provenance or carry highlight ranges */}
				{/* biome-ignore lint/a11y/useFocusableInteractive: contenteditable is focusable by definition */}
				<div
					class="notes"
					ref={host}
					role="textbox"
					aria-multiline="true"
					tabindex={0}
					aria-label="what you wrote"
					contentEditable
					spellcheck={false}
					onMouseMove={find}
					onMouseLeave={() => props.onHover(null)}
					onInput={(event) => void setNotes(event.currentTarget.textContent ?? "")}
					onBlur={() => {
						void setNotes(host?.textContent ?? "");
						paint();
					}}
				/>
			</div>
		</section>
	);
}
