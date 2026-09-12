/**
 * Choosing a shape, and laying the writer's paragraphs into it.
 *
 * The shapes themselves are a fixed library of roles — a post-mortem always has
 * a cause — so that two runs can be compared and "why this shape?" has an
 * answer. What the model does is decide which shape this pile already is, and
 * which paragraph plays which role.
 *
 * It returns ids. It never returns text.
 */

import type { Fragment, Skeleton } from "../../core/types";
import { askJson, type LlmConfig } from "./claude-client";

const PICK = `You are choosing which of several documented article shapes a pile of notes already has.

You are given the writer's paragraphs and a list of shapes, each one a set of roles.
Pick the shape whose roles the notes already fill best. Do not invent a shape.
Say why in one sentence, in plain words, naming what in the notes decided it.

Reply with JSON only: {"shapeId":"postmortem","because":"..."}`;

const ASSIGN = `You lay a writer's own paragraphs into the roles of one article shape.

Rules you must not break:
- Never write, rewrite or summarise anything. You return paragraph ids and nothing else.
- A paragraph goes in the role it plays, not the role its words resemble. Two paragraphs about the same subject can play different roles.
- Order the ids inside a role so the section reads.
- A role with nothing to fill it stays empty. That is a useful answer, not a failure.
- A paragraph that plays no role is left out entirely. Do not force it in.
- No paragraph appears twice.

Reply with JSON only: {"slots":[{"slotId":"cause","fragmentIds":["f05","f06"]}],"leftOut":["f08"]}`;

export interface Pick {
	shapeId: string;
	because: string;
}

export async function pickShape(
	config: LlmConfig,
	fragments: Fragment[],
	shapes: readonly Skeleton[],
): Promise<Pick | null> {
	if (fragments.length === 0) return null;

	const listing = fragments.map((f) => `${f.id}: ${f.text.replace(/\s+/g, " ")}`).join("\n");
	const menu = shapes
		.map(
			(s) => `${s.id} — ${s.name}: ${s.summary}. roles: ${s.slots.map((x) => x.role).join(", ")}`,
		)
		.join("\n");

	const raw = await askJson<Pick>(config, {
		system: PICK,
		user: `Shapes:\n${menu}\n\nParagraphs:\n${listing}`,
		maxTokens: 300,
		validate: (value) => {
			const v = value as Partial<Pick>;
			if (typeof v?.shapeId !== "string") throw new Error("expected a shapeId");
			return { shapeId: v.shapeId, because: String(v.because ?? "") };
		},
	});

	return shapes.some((s) => s.id === raw.shapeId) ? raw : null;
}

export interface Layout {
	slots: { slotId: string; fragmentIds: string[] }[];
	leftOut: string[];
}

export async function layOut(
	config: LlmConfig,
	fragments: Fragment[],
	shape: Skeleton,
): Promise<Layout> {
	const listing = fragments.map((f) => `${f.id}: ${f.text.replace(/\s+/g, " ")}`).join("\n");
	const roles = shape.slots.map((s) => `${s.id} — ${s.role}: ${s.hint}`).join("\n");

	const raw = await askJson<Layout>(config, {
		system: ASSIGN,
		user: `Shape: ${shape.name}\n\nRoles:\n${roles}\n\nParagraphs:\n${listing}`,
		maxTokens: 1200,
		validate: (value) => {
			const v = value as Partial<Layout>;
			if (!Array.isArray(v?.slots)) throw new Error("expected a slots array");
			return {
				slots: v.slots.map((s) => ({
					slotId: String(s?.slotId ?? ""),
					fragmentIds: Array.isArray(s?.fragmentIds) ? s.fragmentIds.map(String) : [],
				})),
				leftOut: Array.isArray(v.leftOut) ? v.leftOut.map(String) : [],
			};
		},
	});

	// Nothing the model says about ids or slots is taken on trust.
	const known = new Set(fragments.map((f) => f.id));
	const seen = new Set<string>();

	const slots = shape.slots.map((slot) => {
		const proposed = raw.slots.find((s) => s.slotId === slot.id);
		const fragmentIds = (proposed?.fragmentIds ?? []).filter((id) => {
			if (!known.has(id) || seen.has(id)) return false;
			seen.add(id);
			return true;
		});
		return { slotId: slot.id, fragmentIds };
	});

	return { slots, leftOut: fragments.map((f) => f.id).filter((id) => !seen.has(id)) };
}
