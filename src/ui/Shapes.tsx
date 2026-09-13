import { For, Show } from "solid-js";
import { setShape, shapes, skeletonOf, state } from "./state";

/**
 * Choosing the shape of the piece.
 *
 * A run comes back with two or three arrangements, not one, and each is laid
 * out here in full: what it leads with, why it is in that order, and the piece
 * it would make — every section by its opening words, numbered by where it sits
 * in your notes, with anything it would leave out said plainly.
 *
 * Nothing is behind a hover and nothing is abbreviated to a symbol. You are
 * picking the shape of your article; you should be able to read all three and
 * say which one you want.
 */
export function Shapes() {
	return (
		<Show when={shapes().length > 1}>
			<div class="shapes">
				<For each={shapes()}>
					{(one, n) => {
						const plan = () => skeletonOf(one);
						return (
							<button
								type="button"
								class="shape"
								aria-current={state.doc.shape === n()}
								onClick={() => void setShape(n())}
							>
								<span class="nm">{one.name}</span>
								<Show when={one.because}>
									<span class="why">{one.because}</span>
								</Show>
								<span class="skel">
									<For each={plan().order}>
										{(line) => (
											<span class="ln">
												<b>{line.n}</b>
												{line.text}
											</span>
										)}
									</For>
								</span>
								<Show when={plan().out.length}>
									<span class="cut">
										<span class="lab">leaves out</span>
										<For each={plan().out}>
											{(line) => (
												<span class="ln">
													<b>{line.n}</b>
													{line.text}
												</span>
											)}
										</For>
									</span>
								</Show>
							</button>
						);
					}}
				</For>
			</div>
		</Show>
	);
}
