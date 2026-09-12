/// <reference lib="webworker" />
/**
 * Embedding runs here, never on the main thread. A frozen text box while a model
 * thinks is the fastest way to make this feel worse than a text file.
 */

import { env, pipeline } from "@huggingface/transformers";

env.allowLocalModels = false;

const MODEL = "Xenova/all-MiniLM-L6-v2";

type Extractor = Awaited<ReturnType<typeof pipeline<"feature-extraction">>>;

let extractor: Extractor | null = null;
let device: "webgpu" | "wasm" = "wasm";

async function load(): Promise<Extractor> {
	if (extractor) return extractor;

	const hasWebGPU = "gpu" in navigator && (await navigator.gpu?.requestAdapter()) != null;
	try {
		if (hasWebGPU) {
			extractor = await pipeline("feature-extraction", MODEL, {
				device: "webgpu",
				dtype: "fp32",
				progress_callback: (p: unknown) => self.postMessage({ type: "loading", detail: p }),
			});
			device = "webgpu";
			return extractor;
		}
	} catch {
		// fall through to wasm — a slower embedder beats no embedder
	}

	extractor = await pipeline("feature-extraction", MODEL, {
		device: "wasm",
		dtype: "q8",
		progress_callback: (p: unknown) => self.postMessage({ type: "loading", detail: p }),
	});
	device = "wasm";
	return extractor;
}

self.onmessage = async (event: MessageEvent) => {
	const { id, type, texts } = event.data ?? {};
	if (type !== "embed") return;

	try {
		const run = await load();
		self.postMessage({ type: "ready", device });

		const vectors: Float32Array[] = [];
		const batchSize = 16;
		for (let i = 0; i < texts.length; i += batchSize) {
			const batch = texts.slice(i, i + batchSize);
			const output = await run(batch, { pooling: "mean", normalize: true });
			const rows = output.tolist() as number[][];
			for (const row of rows) vectors.push(Float32Array.from(row));
			self.postMessage({
				type: "progress",
				id,
				done: Math.min(i + batchSize, texts.length),
				total: texts.length,
			});
		}

		self.postMessage(
			{ type: "result", id, device, vectors },
			vectors.map((v) => v.buffer),
		);
	} catch (error) {
		self.postMessage({ type: "error", id, message: (error as Error).message });
	}
};
