import { createSignal, For, Show } from "solid-js";
import { REACH, type Reach } from "../core";
import { hasKey, setApiKey, setBrief, setModel, setReach, state } from "./state";

const SUGGESTIONS = [
	"A post-mortem for engineers who weren't there. Lead with the numbers and don't end on the fix.",
	"A short note for my own team — the mechanism, the fix, and whether it's shipped.",
	"An explanation for someone who has never touched this. One mechanism at a time.",
];

/**
 * The only chrome there is: what you are making, and how far it may go.
 *
 * Nothing here is a button or a chip. The brief is edited where it sits; Enter
 * applies it, Escape puts it back.
 */
export function Capsule() {
	const [open, setOpen] = createSignal(false);
	const [settings, setSettings] = createSignal(false);
	let field: HTMLSpanElement | undefined;

	const apply = () => {
		const said = (field?.textContent ?? "").trim();
		field?.blur();
		if (said !== state.doc.brief) void setBrief(said);
	};

	return (
		<>
			<Show when={open()}>
				<div class="hints">
					<span class="lab">or start from one of these</span>
					<For each={SUGGESTIONS}>
						{(said) => (
							<button
								type="button"
								onMouseDown={(event) => {
									event.preventDefault();
									if (field) field.textContent = said;
									void setBrief(said);
									setOpen(false);
								}}
							>
								{said}
							</button>
						)}
					</For>
					<Show when={!hasKey()}>
						<span class="lab warn">a key is needed before any of this moves your text</span>
					</Show>
				</div>
			</Show>

			<Show when={settings()}>
				<div class="hints keys">
					<span class="lab">your key stays in this browser</span>
					<input
						id="otis-key"
						class="field"
						type="password"
						placeholder="sk-ant-…"
						value={state.apiKey()}
						onChange={(event) => setApiKey(event.currentTarget.value)}
					/>
					<input
						id="otis-model"
						class="field"
						aria-label="model"
						value={state.model()}
						onChange={(event) => setModel(event.currentTarget.value)}
					/>
				</div>
			</Show>

			<div class="cap" classList={{ busy: state.busy() }}>
				{/* biome-ignore lint/a11y/useSemanticElements: a contenteditable surface is the interactive element; a textarea cannot render provenance or carry highlight ranges */}
				{/* biome-ignore lint/a11y/useFocusableInteractive: contenteditable is focusable by definition */}
				<span
					class="brief"
					ref={field}
					role="textbox"
					tabindex={0}
					aria-label="what you are making"
					contentEditable
					spellcheck={false}
					onFocus={() => setOpen(true)}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							apply();
						}
						if (event.key === "Escape" && field) {
							field.textContent = state.doc.brief;
							field.blur();
						}
					}}
				>
					{state.doc.brief}
				</span>

				<span class="sep" />

				<span class="dial">
					<span class="track">
						<For each={REACH}>
							{(step) => (
								<button
									type="button"
									aria-label={step.name}
									aria-current={state.doc.reach === step.id}
									onClick={() => void setReach(step.id as Reach)}
								/>
							)}
						</For>
					</span>
					<span class="name">{REACH[state.doc.reach]?.name}</span>
					<span class="does">· {REACH[state.doc.reach]?.does}</span>
				</span>

				<span class="sep" />
				<button type="button" class="cog" onClick={() => setSettings(!settings())}>
					key
				</button>
			</div>

			<Show when={state.message()}>
				<p class="said">{state.message()}</p>
			</Show>
		</>
	);
}
