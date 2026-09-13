import { createSignal, For, Show } from "solid-js";
import { REACH, type Reach } from "../core";
import {
	clearPlan,
	dropped_plan,
	hasKey,
	isStale,
	run,
	setApiKey,
	setBrief,
	setModel,
	setReach,
	state,
	suggestions,
} from "./state";

/**
 * The only chrome there is: what you are making, how far it may go, and the one
 * control that spends a request.
 *
 * Nothing reaches the model on its own. Typing, moving the dial and rewriting
 * the brief are all free; only `run` asks, and it says so when what you are
 * looking at was made for text you have since changed.
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

	/** What the one button is for, right now. */
	const label = () => {
		if (state.busy()) return "reading…";
		if (dropped_plan()) return "run";
		if (isStale()) return "run again";
		return state.doc.plan ? "run again" : "run";
	};

	return (
		<>
			<Show when={open() && suggestions().length > 0}>
				<div class="hints">
					<span class="lab">from what you pasted</span>
					<For each={suggestions()}>
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

				<button
					type="button"
					class="go"
					classList={{ waiting: isStale() || dropped_plan(), busy: state.busy() }}
					onClick={() => void run()}
				>
					{label()}
				</button>

				<Show when={state.doc.plan}>
					<button type="button" class="cog" onClick={() => void clearPlan()}>
						reset
					</button>
				</Show>

				<button type="button" class="cog" onClick={() => setSettings(!settings())}>
					key
				</button>
			</div>

			<Show when={dropped_plan()}>
				<p class="said warn">
					this is your text, in your order — the last plan was made for a different document
				</p>
			</Show>

			<Show when={state.message() && !dropped_plan()}>
				<p class="said">{state.message()}</p>
			</Show>
		</>
	);
}
