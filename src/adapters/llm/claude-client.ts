/**
 * Talking to Claude from the page, with the writer's own key.
 *
 * Every call here returns JSON that references the writer's fragment or block
 * ids. Nothing the model returns is trusted: callers resolve every id against
 * the project and drop what does not exist. That check is the reason a model is
 * allowed near this material at all.
 */

export interface LlmConfig {
	apiKey: string;
	model: string;
}

const ENDPOINT = "https://api.anthropic.com/v1/messages";

export class LlmError extends Error {}

async function call(
	config: LlmConfig,
	system: string,
	user: string,
	maxTokens: number,
): Promise<string> {
	const response = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": "2023-06-01",
			// Anthropic requires this opt-in for calls made straight from a browser.
			"anthropic-dangerous-direct-browser-access": "true",
		},
		body: JSON.stringify({
			model: config.model,
			max_tokens: maxTokens,
			system,
			messages: [{ role: "user", content: user }],
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new LlmError(`${response.status} ${response.statusText} — ${body.slice(0, 200)}`);
	}

	const data = (await response.json()) as { content?: { type: string; text?: string }[] };
	const text = (data.content ?? [])
		.filter((part) => part.type === "text")
		.map((part) => part.text ?? "")
		.join("");
	if (!text) throw new LlmError("the model returned nothing");
	return text;
}

function extractJson(text: string): unknown {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
	const candidate = (fenced?.[1] ?? text).trim();
	const start = candidate.search(/[[{]/);
	if (start < 0) throw new LlmError("no JSON in the reply");
	return JSON.parse(candidate.slice(start));
}

/**
 * One call, one JSON object, no validation. For callers that judge the answer
 * themselves — a placement is checked against the pattern, and what is wrong
 * with it is what goes back in the re-ask.
 */
export async function askOnce(
	config: LlmConfig,
	options: { system: string; user: string; maxTokens?: number },
): Promise<unknown> {
	const text = await call(config, options.system, options.user, options.maxTokens ?? 2000);
	return extractJson(text);
}

/**
 * One repair attempt, then give up. A model that cannot produce the shape twice
 * is not going to on the third try, and silence beats a mangled suggestion.
 */
export async function askJson<T>(
	config: LlmConfig,
	options: { system: string; user: string; maxTokens?: number; validate: (value: unknown) => T },
): Promise<T> {
	const { system, user, maxTokens = 2000, validate } = options;
	const first = await call(config, system, user, maxTokens);
	try {
		return validate(extractJson(first));
	} catch (error) {
		const repair = await call(
			config,
			system,
			`${user}\n\nYour previous reply could not be used: ${(error as Error).message}\nReply with JSON only, no prose around it.`,
			maxTokens,
		);
		return validate(extractJson(repair));
	}
}
