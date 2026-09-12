/**
 * Embedder port, backed by transformers.js in a worker. WebGPU when the machine
 * has it, wasm when it doesn't — either way the vectors are comparable, so the
 * id only changes when the *model* changes.
 */

import type { Embedder } from "../../core/ports";
import type { Vector } from "../../core/similarity";

export interface EmbedderEvents {
	onLoading?: (detail: unknown) => void;
	onDevice?: (device: string) => void;
}

export function createTransformersEmbedder(events: EmbedderEvents = {}): Embedder {
	let worker: Worker | null = null;
	let seq = 0;

	const ensureWorker = (): Worker => {
		if (worker) return worker;
		worker = new Worker(new URL("./embed.worker.ts", import.meta.url), { type: "module" });
		return worker;
	};

	return {
		id: "minilm-l6-v2",

		embed(texts: string[], onProgress?: (done: number, total: number) => void): Promise<Vector[]> {
			if (texts.length === 0) return Promise.resolve([]);
			const w = ensureWorker();
			const id = ++seq;

			return new Promise<Vector[]>((resolve, reject) => {
				const handle = (event: MessageEvent) => {
					const data = event.data ?? {};
					if (data.type === "loading") return events.onLoading?.(data.detail);
					if (data.type === "ready") return events.onDevice?.(data.device);
					if (data.id !== id) return;

					if (data.type === "progress") return onProgress?.(data.done, data.total);
					if (data.type === "result") {
						w.removeEventListener("message", handle);
						resolve(data.vectors as Vector[]);
					}
					if (data.type === "error") {
						w.removeEventListener("message", handle);
						reject(new Error(data.message));
					}
				};
				w.addEventListener("message", handle);
				w.postMessage({ type: "embed", id, texts });
			});
		},
	};
}
