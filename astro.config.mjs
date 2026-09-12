import solid from "@astrojs/solid-js";
import { defineConfig } from "astro/config";

// Project page on GitHub Pages: https://mde-pach.github.io/otis
export default defineConfig({
	site: "https://mde-pach.github.io",
	base: "/otis",
	integrations: [solid()],
	vite: {
		// transformers.js ships its own wasm/onnx runtime; let it resolve at runtime.
		optimizeDeps: { exclude: ["@huggingface/transformers"] },
		worker: { format: "es" },
	},
});
