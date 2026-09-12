import { createSignal, onMount } from "solid-js";
import { Article } from "./Article";
import { Notes } from "./Notes";
import { Peek, type PeekData } from "./Peek";
import { Shape } from "./Shape";
import { init, state } from "./state";

export default function App() {
	const [peek, setPeek] = createSignal<PeekData | null>(null);
	const [lit, setLit] = createSignal<string[]>([]);

	onMount(() => {
		void init();
	});

	return (
		<main class="app" classList={{ working: state.phase() === "working" }}>
			<Notes lit={lit()} />
			<Article onPeek={setPeek} onLight={setLit} />
			<Shape />
			<Peek data={peek()} />
		</main>
	);
}
