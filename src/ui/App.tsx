import { createSignal, onMount, Show } from "solid-js";
import { ImportPanel } from "./ImportPanel";
import { Pile } from "./Pile";
import { copyDiagnostics, init, projectStats, regroup, reset, state } from "./state";

export default function App() {
	onMount(() => {
		void init();
	});

	const [copied, setCopied] = createSignal(false);
	const busy = () => ["loading-model", "embedding", "grouping"].includes(state.phase());
	const hasFragments = () => state.project.fragments.length > 0;

	return (
		<main class="app">
			<header class="masthead">
				<div class="keyline">
					<span class="eyebrow">Otis</span>
					<span class="eyebrow">Pile</span>
					<Show when={state.device()}>
						<span class="eyebrow">embedder · {state.device()}</span>
					</Show>
				</div>
				<h1>{state.project.title}</h1>
				<p class="lede">
					Your writing is the source of truth. Everything on this screen is a measurement of your
					own fragments — nothing here was generated.
				</p>
			</header>

			<Show when={hasFragments()}>
				<div class="facts">
					<span>
						<b>{projectStats().fragments}</b> fragments
					</span>
					<span>
						<b>{projectStats().grouped}</b> grouped
					</span>
					<span>
						<b>{projectStats().placed}</b> placed in draft
					</span>
					<span class="flag">
						<b>{projectStats().unused}</b> written, never used
					</span>
					<span class="flag">
						<b>{state.duplicates().length}</b> near-duplicate pairs
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
				<div class="toolbar">
					<button type="button" class="btn" disabled={busy()} onClick={() => void regroup()}>
						Re-group fragments
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
								similarity spread <b>{d().clusteringSimilarity.spread.toFixed(3)}</b> after
								centring, <b>{d().rawSimilarity.spread.toFixed(3)}</b> before
							</span>
							<span>
								median <b>{d().rawSimilarity.median.toFixed(3)}</b> raw
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
		</main>
	);
}
