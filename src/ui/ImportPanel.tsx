import { createSignal } from "solid-js";
import { importText } from "./state";

export function ImportPanel(props: { compact?: boolean }) {
	const [text, setText] = createSignal("");
	const [over, setOver] = createSignal(false);

	const submit = async () => {
		const value = text().trim();
		if (!value) return;
		setText("");
		await importText(value);
	};

	// The textarea is the drop target: it is already the interactive element, so
	// dropping a file lands exactly where typing would.
	const onDrop = async (event: DragEvent) => {
		event.preventDefault();
		setOver(false);
		const file = event.dataTransfer?.files?.[0];
		if (file) await importText(await file.text());
	};

	return (
		<section class={`import ${over() ? "is-over" : ""} ${props.compact ? "is-compact" : ""}`}>
			<label class="lane-title" for="import-text">
				{props.compact ? "Add more notes" : "Paste your notes, or drop a text file here"}
			</label>
			<textarea
				id="import-text"
				value={text()}
				rows={props.compact ? 3 : 10}
				placeholder={"One thought per paragraph. Blank lines split them.\nCode fences stay whole."}
				onInput={(e) => setText(e.currentTarget.value)}
				onDragOver={(e) => {
					e.preventDefault();
					setOver(true);
				}}
				onDragLeave={() => setOver(false)}
				onDrop={onDrop}
			/>
			<div class="row">
				<button type="button" class="btn primary" onClick={submit}>
					Split into fragments
				</button>
				<span class="hint">Nothing is sent anywhere. Splitting is string work.</span>
			</div>
		</section>
	);
}
