import { createSignal, For, onMount, Show } from "solid-js";
import { Draft } from "./Draft";
import { ImportPanel } from "./ImportPanel";
import { Pile } from "./Pile";
import { Plan } from "./Plan";
import { Review } from "./Review";
import {
	copyDiagnostics,
	init,
	keyPresent,
	openCount,
	projectStats,
	regroup,
	reset,
	type Surface,
	setApiKey,
	setModel,
	setSurface,
	setTitle,
	state,
} from "./state";

const SURFACES: { id: Surface; name: string }[] = [
	{ id: "pile", name: "Pile" },
	{ id: "plan", name: "Plan" },
	{ id: "draft", name: "Draft" },
	{ id: "review", name: "Review" },
];

export default function App() {
	onMount(() => {
		void init();
	});

	const [copied, setCopied] = createSignal(false);
	const busy = () =>
		["loading-model", "embedding", "grouping", "reviewing"].includes(state.phase());
	const hasFragments = () => state.project.fragments.length > 0;

	return (
		<main class="app">
			<header class="masthead">
				<div class="keyline">
					<span class="eyebrow">Otis</span>
					<Show when={state.device()}>
						<span class="eyebrow">embedder · {state.device()}</span>
					</Show>
					<span class="eyebrow">{keyPresent() ? "key set" : "no key · measured items only"}</span>
				</div>
				<input
					class="title"
					value={state.project.title}
					aria-label="Article title"
					onChange={(e) => void setTitle(e.currentTarget.value)}
				/>
				<p class="lede">
					Your writing is the source of truth. The tool groups it, measures it and asks about it —
					it never writes a sentence of it.
				</p>
			</header>

			<Show when={hasFragments()}>
				<nav class="tabs">
					<For each={SURFACES}>
						{(s) => (
							<button
								type="button"
								class={`btn ${state.surface() === s.id ? "primary" : ""}`}
								onClick={() => setSurface(s.id)}
							>
								{s.name}
								<Show when={s.id === "review" && openCount() > 0}> · {openCount()}</Show>
							</button>
						)}
					</For>
				</nav>

				<div class="facts">
					<span>
						<b>{projectStats().fragments}</b> fragments
					</span>
					<span>
						<b>{projectStats().grouped}</b> grouped
					</span>
					<span>
						<b>{projectStats().placed}</b> in the draft
					</span>
					<span class="flag">
						<b>{projectStats().unused}</b> written, never used
					</span>
					<span class="flag">
						<b>{state.duplicates().length}</b> repeated pairs
					</span>
					<span class="spacer">measurements only — no opinions on this line</span>
				</div>
			</Show>

			<Show when={busy() || state.message()}>
				<p class={`status ${state.phase() === "error" ? "is-error" : ""}`}>
					<Show when={busy()}>
						<span class="spinner" aria-hidden="true" />
					</Show>
					{state.message() || state.phase()}
				</p>
			</Show>

			<Show when={hasFragments()} fallback={<ImportPanel />}>
				<Show when={state.surface() === "pile"}>
					<div class="toolbar">
						<button type="button" class="btn" disabled={busy()} onClick={() => void regroup()}>
							{keyPresent() ? "Re-group with the model" : "Re-group"}
						</button>
						<button type="button" class="btn danger" onClick={() => void reset()}>
							Start over
						</button>
					</div>
					<Show when={state.diagnostics()}>
						{(d) => (
							<div class="facts diag">
								<span>
									cut at <b>{d().cutScore.toFixed(3)}</b>
								</span>
								<span>
									spread <b>{d().clusteringSimilarity.spread.toFixed(3)}</b> centred,{" "}
									<b>{d().rawSimilarity.spread.toFixed(3)}</b> raw
								</span>
								<button
									type="button"
									class="btn link"
									onClick={() => copyDiagnostics().then(setCopied)}
								>
									{copied() ? "copied" : "copy diagnostics"}
								</button>
							</div>
						)}
					</Show>
					<Pile />
					<ImportPanel compact />
				</Show>

				<Show when={state.surface() === "plan"}>
					<Plan />
				</Show>
				<Show when={state.surface() === "draft"}>
					<Draft />
				</Show>
				<Show when={state.surface() === "review"}>
					<Review />
				</Show>
			</Show>

			<details class="settings">
				<summary>Model access</summary>
				<p class="hint">
					Your key stays in this browser and goes only to Anthropic. Grouping, rewording and gap
					questions need it; everything measured works without it.
				</p>
				<div class="row">
					<input
						class="note wide"
						type="password"
						placeholder="sk-ant-…"
						value={state.apiKey()}
						onChange={(e) => setApiKey(e.currentTarget.value)}
					/>
					<input
						class="note"
						value={state.model()}
						aria-label="Model"
						onChange={(e) => setModel(e.currentTarget.value)}
					/>
				</div>
			</details>
		</main>
	);
}
