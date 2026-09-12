import { For, Show } from "solid-js";
import { displayId } from "../core/project";
import { fragmentText, renameGroup, state, ungrouped } from "./state";

function Fragment(props: { id: string; text: string; tone?: string }) {
	const isCode = () => props.text.trimStart().startsWith("```");
	return (
		<article class={`frag ${props.tone ?? ""}`}>
			<span class="fid">
				{displayId(props.id)}
				{isCode() ? " · code" : ""}
			</span>
			<Show when={isCode()} fallback={<p>{props.text}</p>}>
				<pre>{props.text}</pre>
			</Show>
		</article>
	);
}

export function Pile() {
	return (
		<div class="pile">
			<div>
				<div class="lane-title">
					Groups the tool proposes <span>· rename one and it stops being a proposal</span>
				</div>
				<div class="groups">
					<For each={state.project.groups}>
						{(group) => (
							<section class="group">
								<input
									class="group-label"
									value={group.label}
									aria-label="Group name"
									onChange={(e) => renameGroup(group.id, e.currentTarget.value)}
								/>
								<span class="group-meta">
									{group.fragmentIds.length} fragments · {group.auto ? "proposed" : "yours"}
								</span>
								<For each={group.fragmentIds}>
									{(id) => <Fragment id={id} text={fragmentText(id)} />}
								</For>
							</section>
						)}
					</For>

					<Show when={ungrouped().length > 0}>
						<section class="group loose">
							<span class="group-label static">Ungrouped</span>
							<span class="group-meta">{ungrouped().length} fragments · fit nowhere yet</span>
							<For each={ungrouped()}>
								{(fragment) => <Fragment id={fragment.id} text={fragment.text} />}
							</For>
						</section>
					</Show>
				</div>
			</div>

			<aside>
				<div class="lane-title">
					Ambient facts <span>· never a judgment</span>
				</div>
				<Show
					when={state.duplicates().length > 0}
					fallback={<p class="hint">No near-duplicate fragments above 0.90.</p>}
				>
					<For each={state.duplicates()}>
						{(pair) => (
							<div class="dupcard">
								<span class="hd">
									{Math.round(pair.score * 100)}% similar · {displayId(pair.a)} and{" "}
									{displayId(pair.b)}
								</span>
								<p>{fragmentText(pair.a)}</p>
								<p class="muted">{fragmentText(pair.b)}</p>
							</div>
						)}
					</For>
				</Show>
			</aside>
		</div>
	);
}
