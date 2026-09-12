/** Pure operations over a Project. Every count in the UI comes from here. */

import { splitDocument } from "./split";
import type { Fragment, FragmentOrigin, Project, ProjectStats } from "./types";

export function nextFragmentId(project: Project): string {
	let max = 0;
	for (const f of project.fragments) {
		const n = Number.parseInt(f.id.replace(/\D/g, ""), 10);
		if (Number.isFinite(n) && n > max) max = n;
	}
	return `f${String(max + 1).padStart(2, "0")}`;
}

export function displayId(fragmentId: string): string {
	return `#${fragmentId.replace(/^f/, "")}`;
}

/** Appends fragments from a pasted or dropped document. Never replaces. */
export function importDocument(
	project: Project,
	text: string,
	origin: FragmentOrigin = "imported",
	now = Date.now(),
): { project: Project; added: Fragment[] } {
	const pieces = splitDocument(text);
	const added: Fragment[] = [];
	let working = project;
	for (const piece of pieces) {
		const id = nextFragmentId(working);
		const fragment: Fragment = { id, text: piece, origin, createdAt: now };
		added.push(fragment);
		working = { ...working, fragments: [...working.fragments, fragment] };
	}
	return { project: { ...working, updatedAt: now }, added };
}

export function fragmentsById(project: Project): Map<string, Fragment> {
	return new Map(project.fragments.map((f) => [f.id, f]));
}

export function groupedFragmentIds(project: Project): Set<string> {
	return new Set(project.groups.flatMap((g) => g.fragmentIds));
}

export function placedFragmentIds(project: Project): Set<string> {
	return new Set(project.blocks.map((b) => b.fragmentId));
}

/** Written and never used. The thing you lose when a month goes by. */
export function orphanFragments(project: Project): Fragment[] {
	const placed = placedFragmentIds(project);
	return project.fragments.filter((f) => !placed.has(f.id));
}

export function ungroupedFragments(project: Project): Fragment[] {
	const grouped = groupedFragmentIds(project);
	return project.fragments.filter((f) => !grouped.has(f.id));
}

export function stats(project: Project): ProjectStats {
	return {
		fragments: project.fragments.length,
		grouped: groupedFragmentIds(project).size,
		placed: placedFragmentIds(project).size,
		unused: orphanFragments(project).length,
	};
}
