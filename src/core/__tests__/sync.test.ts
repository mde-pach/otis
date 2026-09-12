import { describe, expect, test } from "bun:test";
import { assignToSlots } from "../draft";
import { importDocument, notesText, syncFragments } from "../project";
import { emptyProject } from "../types";

const seed = () => importDocument(emptyProject("p", "t"), "one\n\ntwo\n\nthree").project;

describe("syncFragments", () => {
	test("unchanged paragraphs keep their ids", () => {
		const next = syncFragments(seed(), "one\n\ntwo\n\nthree");
		expect(next.fragments.map((f) => f.id)).toEqual(["f01", "f02", "f03"]);
	});

	test("a new paragraph gets a new id, and never reuses an old one", () => {
		const next = syncFragments(seed(), "one\n\ntwo\n\nthree\n\nfour");
		expect(next.fragments.map((f) => f.id)).toEqual(["f01", "f02", "f03", "f04"]);
		expect(next.fragments[3]?.text).toBe("four");
	});

	test("editing a paragraph makes it a new fragment", () => {
		const next = syncFragments(seed(), "one\n\ntwo, edited\n\nthree");
		expect(next.fragments.map((f) => f.text)).toEqual(["one", "three", "two, edited"]);
		expect(next.fragments.find((f) => f.text === "two, edited")?.id).toBe("f04");
	});

	test("a deleted paragraph nobody is using disappears", () => {
		const next = syncFragments(seed(), "one\n\nthree");
		expect(next.fragments.map((f) => f.id)).toEqual(["f01", "f03"]);
	});

	test("a deleted paragraph the draft still uses is kept, so no block dangles", () => {
		const placed = assignToSlots(seed(), [{ slotId: "body", fragmentIds: ["f02"] }]);
		const next = syncFragments(placed, "one\n\nthree");
		expect(next.fragments.map((f) => f.id)).toEqual(["f01", "f02", "f03"]);
	});

	test("round-trips back to the same document", () => {
		const project = seed();
		expect(notesText(syncFragments(project, notesText(project)))).toBe("one\n\ntwo\n\nthree");
	});
});
