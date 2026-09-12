/**
 * Working store. Not the source of truth — that is a file on disk — but what
 * survives a reload. Vectors go in as Float32Array, never as JSON.
 */

import type { ProjectStore } from "../../core/ports";
import type { Vector } from "../../core/similarity";
import type { Project } from "../../core/types";

const DB_NAME = "otis";
const DB_VERSION = 1;
const PROJECTS = "projects";
const VECTORS = "vectors";

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(PROJECTS))
				db.createObjectStore(PROJECTS, { keyPath: "id" });
			if (!db.objectStoreNames.contains(VECTORS)) db.createObjectStore(VECTORS);
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
	return open().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const request = run(db.transaction(store, mode).objectStore(store));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			}),
	);
}

export function createIndexedDbStore(): ProjectStore {
	return {
		async list() {
			const all = await tx<Project[]>(PROJECTS, "readonly", (s) => s.getAll());
			return all
				.map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt }))
				.sort((a, b) => b.updatedAt - a.updatedAt);
		},

		async load(id) {
			return (await tx<Project | undefined>(PROJECTS, "readonly", (s) => s.get(id))) ?? null;
		},

		async save(project) {
			await tx(PROJECTS, "readwrite", (s) => s.put({ ...project, updatedAt: Date.now() }));
		},

		async remove(id) {
			await tx(PROJECTS, "readwrite", (s) => s.delete(id));
			await tx(VECTORS, "readwrite", (s) => s.delete(id));
		},

		async saveVectors(projectId, vectors) {
			await tx(VECTORS, "readwrite", (s) => s.put(vectors, projectId));
		},

		async loadVectors(projectId) {
			return (
				(await tx<Record<string, Vector> | undefined>(VECTORS, "readonly", (s) =>
					s.get(projectId),
				)) ?? {}
			);
		},
	};
}
