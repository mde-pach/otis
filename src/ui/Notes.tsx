import { createEffect } from "solid-js";
import { organise, repeats, setNotes, state, unusedIds } from "./state";

/**
 * Your notes, as one editable document.
 *
 * Deliberately not a reactive list: a rendered list fights the caret, replacing
 * the paragraph under the cursor every time anything else changes. The text is
 * written into the pane once and then left alone; only the marks — which
 * paragraphs went unused, which repeat another — are repainted, by touching
 * classes rather than replacing nodes.
 */
export function Notes(props: { lit: string[] }) {
	let host: HTMLDivElement | undefined;
	let lastPainted = "";

	const read = () => [...(host?.children ?? [])].map((n) => n.textContent ?? "").join("\n\n");

	const paintText = () => {
		if (!host) return;
		const wanted = state.project.fragments.map((f) => f.text).join("\n\n");
		if (wanted === lastPainted) return;
		lastPainted = wanted;
		host.textContent = "";
		for (const fragment of state.project.fragments) {
			const p = document.createElement("p");
			p.dataset.ref = fragment.id;
			p.textContent = fragment.text;
			host.append(p);
		}
	};

	const paintMarks = () => {
		if (!host) return;
		const unused = unusedIds();
		const repeated = repeats();
		for (const node of host.children) {
			const ref = (node as HTMLElement).dataset.ref ?? "";
			const repeat = repeated.get(ref);
			node.classList.toggle("unused", unused.has(ref));
			node.classList.toggle("lit", props.lit.includes(ref));
			const note = repeat ?? (unused.has(ref) ? "not used" : "");
			if (note) (node as HTMLElement).dataset.note = note;
			else (node as HTMLElement).removeAttribute("data-note");
		}
	};

	createEffect(() => {
		// depend on the fragments and the marks, never on what is being typed
		void state.project.fragments.length;
		void state.project.blocks.length;
		void props.lit;
		paintText();
		paintMarks();
	});

	const wire = (node: HTMLDivElement) => {
		host = node;
		paintText();
		paintMarks();
		node.addEventListener("blur", () => {
			lastPainted = read();
			void setNotes(read());
		});
		node.addEventListener("keydown", (event) => {
			if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
				event.preventDefault();
				lastPainted = read();
				void organise(read());
			}
		});
	};

	return (
		<section class="pane">
			<div class="pane-head">
				<span>Notes</span>
				<span class="pane-right">
					{state.project.fragments.length} ¶ · {unusedIds().size} not used
				</span>
			</div>
			<div class="scroll">
				<div class="notes" ref={wire} contentEditable spellcheck={false} />
			</div>
			<div class="pane-foot">
				<span class="quiet">⌘↵ organises</span>
				<button type="button" class="act lead" onClick={() => void organise(read())}>
					Organise
				</button>
			</div>
		</section>
	);
}
