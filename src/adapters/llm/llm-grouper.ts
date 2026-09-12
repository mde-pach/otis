/**
 * Grouping by argument rather than by vocabulary.
 *
 * Measured on the fixture: the embedding grouper put two descriptions of the
 * same event in different groups (cosine 0.019) and merged a symptom with its
 * own fix because both mention p99 (0.686). This exists because that is not a
 * threshold problem.
 *
 * The model never sees a request to write anything. It returns ids and short
 * labels, and every id is checked against the project before the writer sees it.
 */

import type { Grouper, GroupProposal } from "../../core/ports";
import type { Fragment } from "../../core/types";
import { askJson, type LlmConfig } from "./claude-client";

const SYSTEM = `You sort a writer's own note fragments into groups for one article.

Rules you must not break:
- Never write, rewrite or summarise the writer's sentences. You only return ids and short labels.
- A label is at most four words, lowercase, drawn from what the group is about.
- Group by the argument a fragment makes, not by the words it uses. Two fragments describing the same thing in different vocabulary belong together; two fragments sharing a subject but doing different jobs in the article do not.
- Aim for three to seven groups. A fragment that fits nowhere goes in "ungrouped" — that is a useful answer, not a failure.
- Every fragment id appears exactly once, in a group or in ungrouped.

Reply with JSON only:
{"groups":[{"label":"...","fragmentIds":["f01"]}],"ungrouped":["f07"],"note":"one sentence on how you split them"}`;

interface RawProposal {
	groups: { label: string; fragmentIds: string[] }[];
	ungrouped: string[];
	note?: string;
}

function validate(value: unknown): RawProposal {
	const v = value as Partial<RawProposal>;
	if (!Array.isArray(v?.groups)) throw new Error("expected a groups array");
	return {
		groups: v.groups.map((g) => ({
			label: String(g?.label ?? "untitled"),
			fragmentIds: Array.isArray(g?.fragmentIds) ? g.fragmentIds.map(String) : [],
		})),
		ungrouped: Array.isArray(v.ungrouped) ? v.ungrouped.map(String) : [],
		note: typeof v.note === "string" ? v.note : undefined,
	};
}

export function createLlmGrouper(config: LlmConfig): Grouper {
	return {
		id: `llm-grouper(${config.model})`,

		async propose(fragments: Fragment[]): Promise<GroupProposal> {
			if (fragments.length === 0) {
				return { groups: [], ungroupedFragmentIds: [], rationale: "nothing to group" };
			}

			const known = new Set(fragments.map((f) => f.id));
			const listing = fragments.map((f) => `${f.id}: ${f.text.replace(/\s+/g, " ")}`).join("\n");

			const raw = await askJson<RawProposal>(config, {
				system: SYSTEM,
				user: `Fragments:\n\n${listing}`,
				maxTokens: 2000,
				validate,
			});

			// Nothing the model says about ids is taken on trust.
			const used = new Set<string>();
			const groups = raw.groups
				.map((g) => ({
					label: g.label.trim().slice(0, 48) || "untitled",
					fragmentIds: g.fragmentIds.filter((id) => {
						if (!known.has(id) || used.has(id)) return false;
						used.add(id);
						return true;
					}),
					auto: true,
				}))
				.filter((g) => g.fragmentIds.length > 0);

			const ungrouped = fragments.map((f) => f.id).filter((id) => !used.has(id));

			return {
				groups,
				ungroupedFragmentIds: ungrouped,
				rationale: `${config.model} · grouped by argument${raw.note ? ` · ${raw.note.slice(0, 120)}` : ""}`,
			};
		},
	};
}
