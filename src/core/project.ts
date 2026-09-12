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

/**
 * The notes are an editable document, so every run reconciles them with the
 * fragments rather than appending blindly.
 *
 * A paragraph whose text is unchanged keeps its id — that is what lets a block
 * placed last week still point at it. Edited or new text becomes a new
 * fragment. A fragment that disappeared from the notes is dropped unless the
 * draft is still using it, because a block must never dangle: the writer can
 * always see the version their article was built from.
 */
export function syncFragments(project: Project, text: string, now = Date.now()): Project {
	const pieces = splitDocument(text);
	const byText = new Map<string, Fragment[]>();
	for (const f of project.fragments) {
		const list = byText.get(f.text);
		if (list) list.push(f);
		else byText.set(f.text, [f]);
	}

	const placed = placedFragmentIds(project);
	const kept: Fragment[] = [];
	let max = project.fragments.reduce((m, f) => {
		const n = Number.parseInt(f.id.replace(/\D/g, ""), 10);
		return Number.isFinite(n) && n > m ? n : m;
	}, 0);

	for (const piece of pieces) {
		const existing = byText.get(piece)?.shift();
		if (existing) {
			kept.push(existing);
		} else {
			kept.push({
				id: `f${String(++max).padStart(2, "0")}`,
				text: piece,
				origin: "imported",
				createdAt: now,
			});
		}
	}

	const keptIds = new Set(kept.map((f) => f.id));
	const stillNeeded = project.fragments.filter((f) => !keptIds.has(f.id) && placed.has(f.id));

	return {
		...project,
		fragments: [...kept, ...stillNeeded].sort((a, b) => a.id.localeCompare(b.id)),
		updatedAt: now,
	};
}

/** The notes, as one document again. */
export function notesText(project: Project): string {
	return project.fragments.map((f) => f.text).join("\n\n");
}
