/**
 * The key lives in localStorage, which is safe only because this page loads no
 * third-party script. If that ever changes, this has to move.
 */

const KEY = "otis.apiKey";
const MODEL = "otis.model";

export const DEFAULT_MODEL = "claude-sonnet-4-5";

export function loadKey(): string {
	try {
		return localStorage.getItem(KEY) ?? "";
	} catch {
		return "";
	}
}

export function saveKey(value: string): void {
	try {
		if (value) localStorage.setItem(KEY, value);
		else localStorage.removeItem(KEY);
	} catch {
		// a private window that refuses storage is not an error worth interrupting for
	}
}

export function loadModel(): string {
	try {
		return localStorage.getItem(MODEL) || DEFAULT_MODEL;
	} catch {
		return DEFAULT_MODEL;
	}
}

export function saveModel(value: string): void {
	try {
		localStorage.setItem(MODEL, value || DEFAULT_MODEL);
	} catch {
		// as above
	}
}

export function hasKey(): boolean {
	return loadKey().trim().length > 0;
}
