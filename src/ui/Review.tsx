import { For, Show } from "solid-js";
import { diffWords } from "../core";
import { apply, discard, isRefused, proposal, refuse } from "./state";

/**
 * The step where the writer has their word.
 *
 * A request comes back as a proposal, not an article. Everything it wants to do
 * is listed here in their own text — what moves, what gets shortened and to
 * what, what it would leave out, and what it thinks the piece is missing — and
 * each of those can be turned down on its own before any of it is true.
 *
 * Turning down the order does not throw away the rest. That is the point of
 * listing them apart.
 */
function No(props: { id: string; on: string; off: string }) {
	return (
		<button
			type="button"
			class="no"
			aria-pressed={isRefused(props.id)}
			onClick={() => refuse(props.id, !isRefused(props.id))}
		>
			{isRefused(props.id) ? props.off : props.on}
		</button>
	);
}

export function Review() {
	const it = proposal;

	return (
		<Show when={it()}>
			{(plan) => (
				<div class="rev">
					<div class="rev-in">
						<div class="rev-top">
							<span class="ph">what it proposes</span>
							<span class="rev-say">{plan().because}</span>
						</div>

						<Show when={plan().moved}>
							<section classList={{ off: isRefused("m") }}>
								<h3>
									the order
									<No id="m" on="keep mine" off="kept yours" />
								</h3>
								<ol class="ord">
									<For each={plan().order}>
										{(item) => <li classList={{ moved: item.index !== item.from }}>{item.text}</li>}
									</For>
								</ol>
							</section>
						</Show>

						<Show when={plan().short.length}>
							<section>
								<h3>shorter, same claims</h3>
								<For each={plan().short}>
									{(item) => (
										<div class="item" classList={{ off: isRefused(`s${item.index}`) }}>
											<p class="was">
												<For each={diffWords(item.was, item.now)}>
													{(op) => <span data-op={op.type}>{op.text}</span>}
												</For>
											</p>
											<No id={`s${item.index}`} on="no" off="yours stands" />
										</div>
									)}
								</For>
							</section>
						</Show>

						<Show when={plan().drop.length}>
							<section>
								<h3>it would leave out</h3>
								<For each={plan().drop}>
									{(item) => (
										<div class="item" classList={{ off: isRefused(`d${item.index}`) }}>
											<p class="out">{item.text}</p>
											<No id={`d${item.index}`} on="keep it" off="kept" />
										</div>
									)}
								</For>
							</section>
						</Show>

						<Show when={plan().written.length}>
							<section>
								<h3>what it says is missing</h3>
								<For each={plan().written}>
									{(item) => (
										<div class="item" classList={{ off: isRefused(`w${item.n}`) }}>
											<p class="why">{item.because}</p>
											<p class="draft" data-reach={item.confidence}>
												{item.md}
											</p>
											<No id={`w${item.n}`} on="no" off="not written" />
										</div>
									)}
								</For>
							</section>
						</Show>

						<Show
							when={
								plan().moved || plan().short.length || plan().drop.length || plan().written.length
							}
							fallback={<p class="rev-none">it has nothing to suggest — your text stands</p>}
						>
							{null}
						</Show>

						<div class="rev-do">
							<button type="button" class="go" onClick={() => void apply()}>
								apply what is left
							</button>
							<button type="button" class="cog" onClick={() => void discard()}>
								discard
							</button>
						</div>
					</div>
				</div>
			)}
		</Show>
	);
}
