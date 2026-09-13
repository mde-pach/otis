import { For, Show } from "solid-js";
import { outlineOf, setShape, shapes, state } from "./state";

/**
 * Choosing the shape of the piece.
 *
 * A run comes back with two or three arrangements, not one, and this is where
 * they are read. Each is your own sections, opening words first, in the order
 * that arrangement puts them — so choosing is reading your text, not reading a
 * label someone put on it.
 *
 * They all arrived in the same request. Moving between them asks nothing, which
 * is why this is a strip and not a decision you are held at.
 */
export function Shapes() {
	return (
		<Show when={shapes().length > 1}>
			<div class="shapes">
				<For each={shapes()}>
					{(one, n) => (
						<button
							type="button"
							class="shape"
							aria-current={state.doc.shape === n()}
							title={one.because}
							onClick={() => void setShape(n())}
						>
							<span class="nm">{one.name}</span>
							<For each={outlineOf(one).slice(0, 5)}>
								{(line) => <span class="ol">{line}</span>}
							</For>
						</button>
					)}
				</For>
			</div>
		</Show>
	);
}
