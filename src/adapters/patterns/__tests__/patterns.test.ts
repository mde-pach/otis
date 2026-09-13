import { describe, expect, test } from "bun:test";
import { patternFor, subjectOf, suggestFor } from "..";

const ESSAY = `Responsabilité et LLM

Une des erreurs classiques lorsque l'on utilise un LLM est la responsabilité que l'on lui confère.

Avec les LLM comme avec le reste du monde, on ne peut pas régler un problème en établissant une règle qui doit être appliquée par ceux qui en sont la cible.

Pour qu'une règle soit suivie il faut qu'elle respecte ces critères.`;

const INCIDENT = `p99 went from 180ms to 410ms in the week after the rollout.

Redis was healthy the entire time. The incident lasted four days.`;

describe("what the writer said wins", () => {
	test("a brief that names the kind picks it", () => {
		expect(patternFor("article writing to explain llm responsability").id).toBe("how-it-works");
		expect(patternFor("a post-mortem for the team").id).toBe("post-mortem");
	});

	test("with nothing said, the notes are asked instead of a default", () => {
		expect(patternFor("", ESSAY).id).toBe("essay");
		expect(patternFor("", INCIDENT).id).toBe("post-mortem");
	});
});

describe("suggestions come from what was pasted", () => {
	test("the subject is the writer's own first line, never invented", () => {
		expect(subjectOf(ESSAY)).toBe("Responsabilité et LLM");
	});

	test("an essay about responsibility is not offered a post-mortem first", () => {
		const said = suggestFor(ESSAY);
		expect(said).toHaveLength(3);
		expect(said[0]).toContain("Responsabilité et LLM");
		expect(said[0]?.toLowerCase()).not.toContain("post-mortem");
	});

	test("and they are written in the language the notes are in", () => {
		expect(suggestFor(ESSAY)[0]).toMatch(/[éèêàç]/);
		expect(suggestFor(INCIDENT)[0]).not.toMatch(/[éèêàç]/);
	});

	test("nothing pasted, nothing suggested", () => {
		expect(suggestFor("   ")).toHaveLength(0);
	});
});
