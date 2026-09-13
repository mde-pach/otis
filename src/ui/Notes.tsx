import { createEffect, onMount } from "solid-js";
import { segments, setNotes, state } from "./state";

/**
 * What you wrote: one continuous editable text.
 *
 * It is never split into elements. Highlighting goes through the Custom
 * Highlight API, which paints ranges without touching the DOM — so a single
 * line stays a single line, the caret is never clobbered, and a sentence inside
 * that line can still be lit.
 *
 * Keeping that true is most of this file. A browser answers Enter and a paste
 * by building `<div>`s, and `textContent` then reads those back with every line
 * break silently gone — which is how a pasted document once arrived as one
 * unbroken string, with no sections, no threads and nothing to highlight. So
 * line breaks are inserted as text, and anything the browser builds anyway is
 * read properly and flattened back with the caret put where it was.
 */

/** elements a browser uses to mean "a new line starts here" */
const LINE = /^(DIV|P|LI|H[1-6]|BLOCKQUOTE|PRE|TR|SECTION|ARTICLE|UL|OL|TABLE)$/;

/**
 * What the text really says, line breaks and all. Never `textContent`.
 *
 * Breaks are owed rather than written, so an empty `<div><br></div>` — which is
 * how a browser spells a blank line — is worth one line of its own, while the
 * placeholder `<br>` a browser parks at the end of an element is worth nothing,
 * and a block nested in a block does not count twice.
 */
function plainOf(node: Node): string {
	let out = "";
	let owed = 0;

	const put = (text: string) => {
		if (!text) return;
		out += "\n".repeat(owed);
		owed = 0;
		out += text;
	};

	const walk = (parent: Node) => {
		for (const child of Array.from(parent.childNodes)) {
			if (child.nodeType === Node.TEXT_NODE) {
				put(child.nodeValue ?? "");
				continue;
			}
			if (child.nodeType !== Node.ELEMENT_NODE) continue;
			const element = child as HTMLElement;

			if (element.tagName === "BR") {
				owed += 1;
				continue;
			}
			if (LINE.test(element.tagName) && out) owed = Math.max(owed, 1);
			walk(element);
		}
	};

	walk(node);
	return out;
}

export function Notes(props: {
	lit: number | null;
	dropped: { start: number; end: number }[];
	onHover: (index: number | null) => void;
}) {
	let host: HTMLDivElement | undefined;

	const paint = () => {
		if (!host || host.contains(document.activeElement)) return;
		if (plainOf(host) === state.doc.notes) return;
		host.textContent = state.doc.notes;
	};

	/** Where the caret is, counted in the text the writer can see. */
	const caret = (): number | null => {
		const selection = document.getSelection();
		if (!host || !selection || selection.rangeCount === 0) return null;
		const at = selection.getRangeAt(0);
		if (!host.contains(at.startContainer)) return null;
		const before = document.createRange();
		before.selectNodeContents(host);
		before.setEnd(at.startContainer, at.startOffset);
		return plainOf(before.cloneContents()).length;
	};

	/** One text node again, with the caret back where the writer left it. */
	const flatten = (text: string, at: number | null) => {
		if (!host) return;
		host.textContent = text;
		const node = host.firstChild;
		if (at === null || !node) return;
		const put = document.createRange();
		put.setStart(node, Math.min(at, node.textContent?.length ?? 0));
		put.collapse(true);
		const selection = document.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(put);
	};

	const read = () => {
		if (!host) return;
		const text = plainOf(host);
		const single =
			host.childNodes.length === 0 ||
			(host.childNodes.length === 1 && host.firstChild?.nodeType === Node.TEXT_NODE);
		if (!single) flatten(text, caret());
		void setNotes(text);
	};

	/** A line break is a character, not an element. */
	const type = (text: string) => document.execCommand("insertText", false, text);

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
					onBeforeInput={(event) => {
						const kind = (event as InputEvent).inputType;
						if (kind === "insertParagraph" || kind === "insertLineBreak") {
							event.preventDefault();
							type("\n");
						}
					}}
					onPaste={(event) => {
						event.preventDefault();
						const text = event.clipboardData?.getData("text/plain") ?? "";
						type(text.replace(/\r\n?/g, "\n"));
					}}
					onDrop={(event) => {
						const text = event.dataTransfer?.getData("text/plain");
						if (text === undefined) return;
						event.preventDefault();
						type(text.replace(/\r\n?/g, "\n"));
					}}
					onInput={read}
					onBlur={() => {
						read();
						paint();
					}}
				/>
			</div>
		</section>
	);
}
