import { For, Show } from "solid-js";
import { deriveState } from "../core/provenance";
import { chooseShape, keyPresent, setApiKey, setModel, shapes, state } from "./state";

/** Shape, and where the words came from. Nothing else belongs in a panel. */
export function Shape() {
	const words = () => {
		const fragments = new Map(state.project.fragments.map((f) => [f.id, f]));
		const counts = { yours: 0, rephrased: 0, tool: 0 };
		for (const block of state.project.blocks) {
			const fragment = fragments.get(block.fragmentId);
			const n = block.text.trim().split(/\s+/).filter(Boolean).length;
			if (!fragment) counts.yours += n;
			else if (deriveState(block, fragment) === "reword-accepted") counts.rephrased += n;
			else counts.yours += n;
		}
		for (const title of Object.values(state.project.titles)) {
			const n = title.text.trim().split(/\s+/).filter(Boolean).length;
			if (title.source === "tool") counts.tool += n;
			else counts.yours += n;
		}
		const total = counts.yours + counts.rephrased + counts.tool || 1;
		return {
			yours: Math.round((counts.yours / total) * 100),
			rephrased: Math.round((counts.rephrased / total) * 100),
			tool: Math.round((counts.tool / total) * 100),
			toolWords: counts.tool,
		};
	};

	return (
		<aside class="pane panel">
			<div class="pane-head">
				<span>Shape</span>
			</div>
			<div class="scroll panel-body">
				<div class="opts">
					<button
						type="button"
						class="opt"
						aria-pressed={state.project.skeletonId === "auto"}
						onClick={() => void chooseShape("auto")}
						disabled={!keyPresent()}
					>
						<span>Let it decide</span>
						<small>it reads the notes and picks one</small>
					</button>
					<For each={shapes}>
						{(shape) => (
							<button
								type="button"
								class="opt"
								aria-pressed={state.project.skeletonId === shape.id}
								onClick={() => void chooseShape(shape.id)}
								disabled={!keyPresent() && shape.id !== "as-written"}
							>
								<span>{shape.name}</span>
								<small>{shape.summary}</small>
							</button>
						)}
					</For>
				</div>

				<Show when={state.because()}>
					<p class="quiet">{state.because()}</p>
				</Show>

				<div class="field">
					<span class="label">Where the words come from</span>
					<div class="rows">
						<div class="row">
							<span>yours</span>
							<b>{words().yours}%</b>
						</div>
						<div class="row rephrased">
							<span>rephrased</span>
							<b>{words().rephrased}%</b>
						</div>
						<div class="row tool">
							<span>the tool's</span>
							<b>{words().tool}%</b>
						</div>
					</div>
					<p class="quiet">
						{words().toolWords > 0
							? "Only the headings are the tool's. Rewrite one and it becomes yours."
							: "Every word in the article is yours."}
					</p>
				</div>

				<details class="settings">
					<summary>Model access</summary>
					<p class="quiet">
						Your key stays in this browser. Without it the article keeps the order you wrote in.
					</p>
					<input
						class="input"
						type="password"
						placeholder="sk-ant-…"
						value={state.apiKey()}
						onChange={(e) => setApiKey(e.currentTarget.value)}
					/>
					<input
						class="input"
						aria-label="Model"
						value={state.model()}
						onChange={(e) => setModel(e.currentTarget.value)}
					/>
				</details>
			</div>
		</aside>
	);
}
