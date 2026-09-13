/**
 * The two things that are not pure.
 *
 * Everything above these is arithmetic over the writer's own text and runs with
 * no key, no network and no storage. Both ports are small on purpose: a planner
 * that returns a Plan, and somewhere to keep the document.
 */

import type { Doc, Plan, Segment } from "./types";

export interface PlanRequest {
	/** the notes the plan will be stamped with, so it can be told apart from a later edit */
	notes: string;
	segments: Segment[];
	/** what the writer said they are making, in their own words */
	brief: string;
	/** the whole of the reference note being passed as context */
	pattern: string;
}

export interface Planner {
	plan(request: PlanRequest): Promise<Plan>;
}

export interface DocStore {
	load(id: string): Promise<Doc | null>;
	save(doc: Doc): Promise<void>;
}
