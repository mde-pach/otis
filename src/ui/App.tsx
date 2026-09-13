import { createSignal, onMount, Show } from "solid-js";
import { About } from "./About";
import { Article } from "./Article";
import { Capsule } from "./Capsule";
import { Notes } from "./Notes";
import { Shapes } from "./Shapes";
import { dropped, init, runs } from "./state";
import { Threads } from "./Threads";

export default function App() {
	const [tab, setTab] = createSignal<"write" | "about">("write");

	/** One thing is lit at a time, named by run id. Both panes read from this. */
	const [lit, setLit] = createSignal<number | null>(null);

	const litSegment = () => {
		const id = lit();
		if (id === null) return null;
		return runs().find((run) => run.id === id)?.fromIndex ?? null;
	};

	const fromNotes = (index: number | null) => {
		if (index === null) return setLit(null);
		const hit = runs().find((run) => run.fromIndex === index);
		setLit(hit ? hit.id : null);
	};

	onMount(() => void init());

	return (
		<main class="shell">
			<header class="top">
				<span class="mark">otis</span>
				<nav>
					<button type="button" aria-current={tab() === "write"} onClick={() => setTab("write")}>
						write
					</button>
					<button type="button" aria-current={tab() === "about"} onClick={() => setTab("about")}>
						about
					</button>
				</nav>
			</header>

			<Show when={tab() === "write"} fallback={<About />}>
				<div class="app">
					<Notes lit={litSegment()} dropped={dropped()} onHover={fromNotes} />
					<Threads lit={lit()} />
					<Article lit={lit()} onHover={setLit} shapes={<Shapes />} />
					<Capsule />
				</div>
			</Show>
		</main>
	);
}
