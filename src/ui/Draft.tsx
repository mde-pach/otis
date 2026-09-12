import { createSignal, For, Show } from "solid-js";
import { displayId } from "../core/project";
import { deriveState } from "../core/provenance";
import { skeletonById } from "../core/skeletons";
import type { Block } from "../core/types";
import {
	acceptReword,
	askReword,
	draftSections,
	editBlock,
	exportArticle,
	exportProvenance,
	keyPresent,
	moveBlock,
	pendingFor,
	rejectReword,
	removeBlock,
	revertBlock,
	state,
	writeInDraft,
} from "./state";

const LABEL: Record<string, string> = {
	verbatim: "verbatim",
	edited: "you edited it",
	"reword-accepted": "reworded · you accepted",
	"written-here": "written here",
};

function BlockView(props: { block: Block }) {
	const fragment = () => state.project.fragments.find((f) => f.id === props.block.fragmentId);
	const blockState = () => {
		const f = fragment();
		return f ? deriveState(props.block, f) : "verbatim";
	};

	return (
		<article class={`block state-${blockState()}`}>
			<div class="block-head">
				<span class="fid">
					{displayId(props.block.fragmentId)} · {LABEL[blockState()]}
				</span>
				<span class="block-actions">
					<button type="button" class="btn tiny" onClick={() => void moveBlock(props.block.id, -1)}>
						↑
					</button>
					<button type="button" class="btn tiny" onClick={() => void moveBlock(props.block.id, 1)}>
						↓
					</button>
					<Show when={keyPresent()}>
						<button type="button" class="btn tiny" onClick={() => void askReword(props.block.id)}>
							reword
						</button>
					</Show>
					<Show when={blockState() !== "verbatim" && blockState() !== "written-here"}>
						<button type="button" class="btn tiny" onClick={() => void revertBlock(props.block.id)}>
							revert
						</button>
					</Show>
					<button type="button" class="btn tiny" onClick={() => void removeBlock(props.block.id)}>
						unplace
					</button>
				</span>
			</div>

			<textarea
				class="block-text"
				value={props.block.text}
				rows={Math.max(2, Math.ceil(props.block.text.length / 90))}
				onChange={(e) => void editBlock(props.block.id, e.currentTarget.value)}
			/>

			<For each={pendingFor(props.block.id)}>
				{(r) => (
					<div class="suggestion">
						<span class="hd">suggested rewording · {r.check.reason}</span>
						<p>{r.proposed}</p>
						<div class="row">
							<button type="button" class="btn tiny" onClick={() => void acceptReword(r.id)}>
								use this
							</button>
							<button type="button" class="btn tiny" onClick={() => void rejectReword(r.id)}>
								discard
							</button>
							<span class="hint">your sentence stays until you choose</span>
						</div>
					</div>
				)}
			</For>
		</article>
	);
}

export function Draft() {
	const [typing, setTyping] = createSignal<Record<string, string>>({});
	const hasSkeleton = () => skeletonById(state.project.skeletonId) !== null;

	return (
		<div>
			<div class="toolbar">
				<button type="button" class="btn" onClick={exportArticle}>
					Export markdown
				</button>
				<button type="button" class="btn" onClick={exportProvenance}>
					Export provenance
				</button>
			</div>

			<Show
				when={hasSkeleton()}
				fallback={<p class="hint">Pick a skeleton in Plan, then place fragments here.</p>}
			>
				<For each={draftSections()}>
					{(section) => (
						<section class="draft-section">
							<div class="lane-title">{section.slotName}</div>
							<For each={section.blocks}>{(block) => <BlockView block={block} />}</For>
							<div class="write-in">
								<textarea
									class="block-text"
									rows={2}
									placeholder="write a new sentence here — it becomes a fragment too"
									value={typing()[section.slotId] ?? ""}
									onInput={(e) =>
										setTyping({ ...typing(), [section.slotId]: e.currentTarget.value })
									}
								/>
								<button
									type="button"
									class="btn tiny"
									onClick={() => {
										const text = typing()[section.slotId] ?? "";
										if (!text.trim()) return;
										setTyping({ ...typing(), [section.slotId]: "" });
										void writeInDraft(section.slotId, text);
									}}
								>
									add
								</button>
							</div>
						</section>
					)}
				</For>
			</Show>
		</div>
	);
}
