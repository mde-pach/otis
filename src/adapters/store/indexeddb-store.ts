/**
 * The document, kept in this browser.
 *
 * One record, because one document is one article. Nothing leaves the machine:
 * the only thing that ever goes out is the call to the model, with the key the
 * writer typed.
 */

import type { Doc, DocStore } from "../../core";

const DB = "otis";
const STORE = "docs";
const VERSION = 2;

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB, VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			// the old store held the slot-and-block model; nothing in it can be read now
			if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
			db.createObjectStore(STORE, { keyPath: "id" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export function createIndexedDbStore(): DocStore {
	return {
		async load(id: string): Promise<Doc | null> {
			try {
				const db = await open();
				return await new Promise((resolve, reject) => {
					const request = db.transaction(STORE, "readonly").objectStore(STORE).get(id);
					request.onsuccess = () => resolve((request.result as Doc) ?? null);
					request.onerror = () => reject(request.error);
				});
			} catch {
				return null;
			}
		},

		async save(doc: Doc): Promise<void> {
			try {
				const db = await open();
				await new Promise<void>((resolve, reject) => {
					const tx = db.transaction(STORE, "readwrite");
					tx.objectStore(STORE).put(doc);
					tx.oncomplete = () => resolve();
					tx.onerror = () => reject(tx.error);
				});
			} catch {
				// a browser refusing storage costs the writer nothing this session
			}
		},
	};
}
