import { createSignal, For, Show } from "solid-js";
import {
	currentRound,
	finishable,
	keyPresent,
	openCount,
	reopenItem,
	resolveItem,
	runReview,
	state,
	waiveItem,
} from "./state";

export function Review() {
	const [notes, setNotes] = createSignal<Record<string, string>>({});

	return (
		<div>
			<div class="toolbar">
				<button type="button" class="btn primary" onClick={() => void runReview()}>
					Run a review round
				</button>
				<Show when={!keyPresent()}>
					<span class="hint">
						without a key you get the measured items only — counts, orphans, empty slots, repeats
					</span>
				</Show>
			</div>

			<Show
				when={currentRound()}
				fallback={<p class="hint">No rounds yet. A round freezes when you run it.</p>}
			>
				{(round) => (
					<>
						<div class="facts">
							<span>
								round <b>{round().index}</b>
							</span>
							<span>
								<b>{round().items.length - openCount()}</b> of <b>{round().items.length}</b>{" "}
								answered
							</span>
							<span class={finishable() ? "" : "flag"}>
								<b>{openCount()}</b> open
							</span>
							<span class="spacer">{round().rationale}</span>
						</div>

						<div class="items">
							<For each={round().items}>
								{(item) => (
									<div class={`item ${item.status !== "open" ? "done" : ""}`}>
										<span class={`t ${item.source === "judged" ? "t-judged" : "t-measured"}`}>
											{item.kind} · {item.source}
										</span>
										<div class="body">
											<strong>{item.question}</strong>
											<Show when={item.fragmentIds?.length}>
												<p>fragments: {item.fragmentIds?.join(", ")}</p>
											</Show>
											<Show when={item.note}>
												<p>waived — {item.note}</p>
											</Show>
										</div>
										<div class="acts">
											<Show
												when={item.status === "open"}
												fallback={
													<button
														type="button"
														class="btn tiny"
														onClick={() => void reopenItem(item.id)}
													>
														reopen
													</button>
												}
											>
												<button
													type="button"
													class="btn tiny"
													onClick={() => void resolveItem(item.id)}
												>
													resolved
												</button>
												<input
													class="note"
													placeholder="reason to waive"
													value={notes()[item.id] ?? ""}
													onInput={(e) =>
														setNotes({ ...notes(), [item.id]: e.currentTarget.value })
													}
												/>
												<button
													type="button"
													class="btn tiny"
													onClick={() => void waiveItem(item.id, notes()[item.id] ?? "")}
												>
													waive
												</button>
											</Show>
										</div>
									</div>
								)}
							</For>
						</div>

						<p class={`status ${finishable() ? "" : "is-error"}`}>
							{finishable()
								? "Nothing is waiting for an answer. The article is finishable."
								: `${openCount()} item(s) still open.`}
						</p>
					</>
				)}
			</Show>

			<Show when={state.project.rounds.length > 1}>
				<div class="lane-title" style={{ "margin-top": "18px" }}>
					Earlier rounds <span>· frozen</span>
				</div>
				<For each={[...state.project.rounds].slice(0, -1).reverse()}>
					{(round) => (
						<p class="hint">
							round {round.index} · {round.items.length} items ·{" "}
							{round.items.filter((i) => i.status === "open").length} left open · {round.rationale}
						</p>
					)}
				</For>
			</Show>
		</div>
	);
}
