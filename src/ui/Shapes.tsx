import { For, Show } from "solid-js";
import { kindOf, setShape, shapes, state } from "./state";

/**
 * Choosing the kind of piece.
 *
 * A card is a pattern: one kind, one arrangement, one card. What it shows comes
 * out of the pattern file and nowhere else — the name of the kind, what that
 * kind of piece does, and its parts in the order it puts them, dashed where the
 * piece can go without one. It reads the same on every document, because it is
 * describing a shape and not previewing a result.
 *
 * The one line that is about you is why this kind was picked for these notes.
 * Choosing a card that has not been organised yet asks once and keeps what
 * comes back, so going back to one is free.
 */
export function Shapes() {
	return (
		<Show when={shapes().length > 1}>
			<div class="shapes">
				<For each={shapes()}>
					{(one, n) => {
						const kind = () => kindOf(one);
						return (
							<button
								type="button"
								class="shape"
								aria-current={state.doc.shape === n()}
								aria-busy={state.doc.shape === n() && state.busy()}
								onClick={() => void setShape(n())}
							>
								<span class="nm">{kind()?.id ?? one.patternId}</span>
								<Show when={kind()?.does}>
									<span class="does">{kind()?.does}</span>
								</Show>
								<span class="parts">
									<For each={kind()?.parts ?? []}>
										{(part, at) => (
											<>
												<Show when={at() > 0}>
													<s>›</s>
												</Show>
												<em classList={{ opt: !part.required }}>{part.id}</em>
											</>
										)}
									</For>
								</span>
								<Show when={one.because}>
									<span class="why">{one.because}</span>
								</Show>
							</button>
						);
					}}
				</For>
			</div>
		</Show>
	);
}
