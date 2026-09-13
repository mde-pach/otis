/**
 * Just enough Markdown.
 *
 * The article is rendered so the writer reads the result rather than the
 * source, but each run has to stay one addressable span — provenance is drawn
 * over it. So this renders a run's inline marks and reports its block type,
 * and the caller wraps the result. No library: the surface is bold, italic,
 * code, headings, list items, and that is the whole of it.
 */

export type Block = "p" | "h2" | "h3" | "li" | "code";

export function blockOf(md: string): Block {
	if (md.startsWith("### ")) return "h3";
	if (md.startsWith("## ")) return "h2";
	if (/^[-*]\s/.test(md)) return "li";
	if (md.startsWith("```")) return "code";
	return "p";
}

export function stripMarker(md: string): string {
	return md
		.replace(/^#{2,3}\s+/, "")
		.replace(/^[-*]\s+/, "")
		.replace(/^```\w*\n?|\n?```$/g, "");
}

export function escapeHtml(text: string): string {
	return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inline marks only. The text is escaped first, so nothing authored can inject. */
export function inline(md: string): string {
	return escapeHtml(md)
		.replace(/`([^`]+)`/g, "<code>$1</code>")
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
		.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener">$1</a>');
}
