import { For, Show } from "solid-js";
import { bars } from "../core";
import { outlineOf, setShape, shapes, state } from "./state";

/**
 * Choosing the shape of the piece.
 *
 * A run comes back with two or three arrangements, not one. Each is drawn as
 * your own sections — one bar apiece, as wide as that section is long, in the
 * order that arrangement puts them. A section keeps its width wherever it
 * lands, so reading two maps side by side is seeing what moved, which is faster
 * than any name for it. The names are there if you hover.
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
							aria-label={one.name}
							aria-current={state.doc.shape === n()}
							title={[one.name, one.because, "", ...outlineOf(one)].join("\n")}
							onClick={() => void setShape(n())}
						>
							<span class="n">{n() + 1}</span>
							<span class="map">
								<For each={bars(state.doc.notes, one)}>
									{(width) => <i style={{ width: `${Math.round(width * 100)}%` }} />}
								</For>
							</span>
						</button>
					)}
				</For>
			</div>
		</Show>
	);
}
