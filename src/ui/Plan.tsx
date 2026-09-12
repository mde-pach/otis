import { For, Show } from "solid-js";
import { blocksInSlot } from "../core/draft";
import { displayId } from "../core/project";
import { SKELETONS, skeletonById } from "../core/skeletons";
import { chooseSkeleton, place, state, unplaced } from "./state";

export function Plan() {
	const skeleton = () => skeletonById(state.project.skeletonId);

	return (
		<div class="pile">
			<div>
				<div class="lane-title">
					Skeleton <span>· you choose it; the tool only audits it</span>
				</div>
				<select
					class="picker"
					value={state.project.skeletonId ?? ""}
					onChange={(e) => void chooseSkeleton(e.currentTarget.value)}
				>
					<option value="">— pick a structure —</option>
					<For each={SKELETONS}>{(s) => <option value={s.id}>{s.name}</option>}</For>
				</select>

				<Show
					when={skeleton()}
					fallback={<p class="hint">Nothing is audited until you pick one.</p>}
				>
					{(s) => (
						<div class="slots">
							<For each={s().slots}>
								{(slot) => {
									const blocks = () => blocksInSlot(state.project, slot.id);
									return (
										<section class={`slot ${blocks().length === 0 ? "empty" : ""}`}>
											<span class="slot-name">{slot.name}</span>
											<span class="slot-hint">{slot.hint}</span>
											<Show
												when={blocks().length > 0}
												fallback={<span class="slot-empty">empty — nothing placed here yet</span>}
											>
												<For each={blocks()}>
													{(block) => (
														<p class="slot-block">
															<span class="fid">{displayId(block.fragmentId)}</span>{" "}
															{block.text.slice(0, 110)}
														</p>
													)}
												</For>
											</Show>
										</section>
									);
								}}
							</For>
						</div>
					)}
				</Show>
			</div>

			<aside>
				<div class="lane-title">
					Not in the draft <span>· {unplaced().length} fragments</span>
				</div>
				<Show
					when={skeleton()}
					fallback={<p class="hint">Pick a skeleton and these become placeable.</p>}
				>
					{(s) => (
						<For each={unplaced()}>
							{(fragment) => (
								<div class="frag">
									<span class="fid">{displayId(fragment.id)}</span>
									<p>{fragment.text.slice(0, 160)}</p>
									<select
										class="picker small"
										onChange={(e) => {
											const slot = e.currentTarget.value;
											e.currentTarget.value = "";
											if (slot) void place(fragment.id, slot);
										}}
									>
										<option value="">place in…</option>
										<For each={s().slots}>
											{(slot) => <option value={slot.id}>{slot.name}</option>}
										</For>
									</select>
								</div>
							)}
						</For>
					)}
				</Show>
			</aside>
		</div>
	);
}
