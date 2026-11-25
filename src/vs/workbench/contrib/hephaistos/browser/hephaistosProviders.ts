/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { env as processEnv } from '../../../../base/common/process.js';

export type HephaistosApi = 'openai' | 'ollama' | 'anthropic' | 'gemini' | 'devin' | 'cli';

export interface IHephaistosProvider {
	readonly id: string;
	readonly label: string;
	readonly api: HephaistosApi;
	readonly baseUrl: string;
	readonly apiKeyEnv: readonly string[];
	readonly staticModels: readonly string[];
	/** commande CLI lancee en terminal pour les providers api:'cli' */
	readonly cliCommand?: string;
}

export interface ICliAgent {
	readonly id: string;
	readonly label: string;
	readonly command: string;
	/** flag de lancement du modèle ; sinon la sélection est envoyée via /model dans le TUI */
	readonly modelFlag?: (model: string) => string;
	readonly models: readonly string[];
}

export const HEPHAISTOS_PROVIDERS: readonly IHephaistosProvider[] = [
	{ id: 'omniroute', label: 'OmniRoute (local, multi-providers)', api: 'openai', baseUrl: 'http://127.0.0.1:20128/v1', apiKeyEnv: ['OMNIROUTE_API_KEY'], staticModels: ['ddgw/claude-haiku-4-5', 'dva/claude-opus-5-max', 'dva/claude-fable-5-1-medium', 'groq/openai/gpt-oss-120b', 'groq/qwen/qwen3.8-27b'] },
	{ id: 'ollama', label: 'Ollama (local)', api: 'ollama', baseUrl: 'http://127.0.0.1:11434', apiKeyEnv: ['OLLAMA_API_KEY'], staticModels: [] },
	{ id: 'nim', label: 'NVIDIA NIM', api: 'openai', baseUrl: 'https://integrate.api.nvidia.com/v1', apiKeyEnv: ['NVIDIA_API_KEY', 'NVIDIA_API_KEY_2'], staticModels: ['nvidia/nemotron-3.5-bolt-e4b', 'nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3.5-lightning-30b-a3b', 'moonshotai/kimi-k3.1-pro', 'z-ai/glm-5.3-flash', 'google/gemma-4-31b-it', 'minimaxai/minimax-m3.1-flash', 'mistralai/mistral-large-4-1t-a52b'] },
	{ id: 'openrouter', label: 'OpenRouter', api: 'openai', baseUrl: 'https://openrouter.ai/api/v1', apiKeyEnv: ['OPENROUTER_API_KEY', 'OPEN_ROUTER_API_KEY'], staticModels: ['openrouter/auto', 'meta-llama/llama-3.3-70b-instruct:free', 'deepseek/deepseek-chat-v3.1:free', 'google/gemma-3-27b-it:free'] },
	{ id: 'groq', label: 'Groq', api: 'openai', baseUrl: 'https://api.groq.com/openai/v1', apiKeyEnv: ['GROQ_API_KEY'], staticModels: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'whisper-large-v3-turbo'] },
	{ id: 'xai', label: 'xAI (Grok)', api: 'openai', baseUrl: 'https://api.x.ai/v1', apiKeyEnv: ['XAI_API_KEY'], staticModels: ['grok-4-fast-non-reasoning', 'grok-4-fast-reasoning', 'grok-code-fast-1'] },
	{ id: 'openai', label: 'OpenAI', api: 'openai', baseUrl: 'https://api.openai.com/v1', apiKeyEnv: ['OPENAI_API_KEY'], staticModels: ['gpt-5.1', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o-mini'] },
	{ id: 'mistral', label: 'Mistral', api: 'openai', baseUrl: 'https://api.mistral.ai/v1', apiKeyEnv: ['MISTRAL_API_KEY', 'MISTRAL_VIBE_API_KEY'], staticModels: ['mistral-large-latest', 'codestral-latest', 'mistral-small-latest', 'devstral-latest'] },
	{ id: 'anthropic', label: 'Anthropic (Claude)', api: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', apiKeyEnv: ['ANTHROPIC_API_KEY'], staticModels: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5-20251001'] },
	{ id: 'gemini', label: 'Google Gemini', api: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', apiKeyEnv: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], staticModels: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3-pro-preview', 'gemini-2.0-flash'] },
	{ id: 'devin', label: 'Devin API (sessions)', api: 'devin', baseUrl: 'https://api.devin.ai', apiKeyEnv: ['DEVIN_API_KEY'], staticModels: ['adaptive', 'swe-2-high', 'swe-2-max', 'sonnet', 'opus'] },
	{ id: 'devin-cli', label: 'Devin CLI (terminal)', api: 'cli', baseUrl: '', apiKeyEnv: [], cliCommand: 'devin', staticModels: ['adaptive', 'swe-2-high', 'swe-2-max', 'sonnet', 'opus'] },
	{ id: 'agy', label: 'Antigravity agy (terminal)', api: 'cli', baseUrl: '', apiKeyEnv: [], cliCommand: 'agy', staticModels: ['gemini-3-pro-high', 'claude-sonnet-4-5', 'gpt-oss-120b'] },
	{ id: 'kilo', label: 'KiloCode CLI (terminal)', api: 'cli', baseUrl: '', apiKeyEnv: [], cliCommand: 'kilo', staticModels: ['default'] },
	{ id: 'hermes', label: 'Hermes CLI (terminal)', api: 'cli', baseUrl: '', apiKeyEnv: [], cliCommand: 'hermes', staticModels: ['default'] },
	{ id: 'opencode', label: 'OpenCode CLI (terminal)', api: 'cli', baseUrl: '', apiKeyEnv: [], cliCommand: 'opencode', staticModels: ['opencode/big-pickle', 'opencode/grok-code'] },
];

export const HEPHAISTOS_CLI_AGENTS: readonly ICliAgent[] = [
	{ id: 'devin', label: 'Devin CLI', command: 'devin', modelFlag: m => `--model ${m}`, models: ['adaptive', 'swe-2-high', 'swe-2-max', 'sonnet', 'opus'] },
	{ id: 'agy', label: 'Antigravity (agy)', command: 'agy', models: ['gemini-3-pro-high', 'claude-sonnet-4-5', 'gpt-oss-120b'] },
	{ id: 'kilo', label: 'KiloCode CLI', command: 'kilo', models: ['default'] },
	{ id: 'hermes', label: 'Hermes', command: 'hermes', models: ['default'] },
	{ id: 'opencode', label: 'OpenCode', command: 'opencode', modelFlag: m => `-m ${m}`, models: ['opencode/big-pickle', 'opencode/grok-code'] },
];

export function resolveApiKey(provider: IHephaistosProvider): string | undefined {
	for (const name of provider.apiKeyEnv) {
		const value = processEnv[name];
		if (value) {
			return value;
		}
	}
	return undefined;
}

async function fetchJson(url: string, init: RequestInit, timeoutMs = 15000): Promise<unknown> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		let response: Response;
		try {
			response = await fetch(url, { ...init, signal: controller.signal });
		} catch (e) {
			throw new Error(`Endpoint injoignable (${url.split('/').slice(0, 3).join('/')}) — service arrêté ou proxy bloquant`);
		}
		if (!response.ok) {
			throw new Error(`HTTP ${response.status} ${response.statusText}`);
		}
		return await response.json();
	} finally {
		clearTimeout(timeout);
	}
}

export async function listProviderModels(provider: IHephaistosProvider): Promise<string[]> {
	const key = resolveApiKey(provider);
	const headers: Record<string, string> = key ? { Authorization: `Bearer ${key}` } : {};
	try {
		if (provider.api === 'ollama') {
			const data = await fetchJson(`${provider.baseUrl}/api/tags`, { headers }) as { models?: { name: string }[] };
			const names = (data.models ?? []).map(m => m.name);
			if (names.length) { return names; }
		} else if (provider.api === 'anthropic') {
			const data = await fetchJson(`${provider.baseUrl}/models`, { headers: { 'x-api-key': key ?? '', 'anthropic-version': '2023-06-01' } }) as { data?: { id: string }[] };
			const names = (data.data ?? []).map(m => m.id);
			if (names.length) { return names; }
		} else if (provider.api === 'openai') {
			const data = await fetchJson(`${provider.baseUrl}/models`, { headers }) as { data?: { id: string }[] };
			const names = (data.data ?? []).map(m => m.id);
			if (names.length) { return names; }
		}
	} catch {
		// liste statique en secours
	}
	return [...provider.staticModels];
}

export interface IChatMessage {
	role: 'user' | 'assistant' | 'system';
	content: string;
}

export async function sendProviderChat(provider: IHephaistosProvider, model: string, messages: IChatMessage[]): Promise<string> {
	const key = resolveApiKey(provider);
	switch (provider.api) {
		case 'cli':
			throw new Error('__CLI__');
		case 'openai': {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (key) { headers.Authorization = `Bearer ${key}`; }
			const data = await fetchJson(`${provider.baseUrl}/chat/completions`, {
				method: 'POST', headers,
				body: JSON.stringify({ model, messages, stream: false }),
			}) as { choices?: { message?: { content?: string } }[] };
			return data.choices?.[0]?.message?.content ?? '(réponse vide)';
		}
		case 'ollama': {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (key) { headers.Authorization = `Bearer ${key}`; }
			const data = await fetchJson(`${provider.baseUrl}/api/chat`, {
				method: 'POST', headers,
				body: JSON.stringify({ model, messages, stream: false }),
			}) as { message?: { content?: string } };
			return data.message?.content ?? '(réponse vide)';
		}
		case 'anthropic': {
			if (!key) { throw new Error('ANTHROPIC_API_KEY absente des variables système'); }
			const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n') || undefined;
			const data = await fetchJson(`${provider.baseUrl}/messages`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
				body: JSON.stringify({ model, max_tokens: 4096, system, messages: messages.filter(m => m.role !== 'system') }),
			}) as { content?: { text?: string }[] };
			return data.content?.map(c => c.text ?? '').join('') || '(réponse vide)';
		}
		case 'gemini': {
			if (!key) { throw new Error('GEMINI_API_KEY/GOOGLE_API_KEY absente des variables système'); }
			const contents = messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
			const data = await fetchJson(`${provider.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contents }),
			}) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
			return data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') || '(réponse vide)';
		}
		case 'devin': {
			if (!key) { throw new Error('DEVIN_API_KEY absente — config Devin requise'); }
			const last = messages[messages.length - 1];
			const data = await fetchJson(`${provider.baseUrl}/v1/sessions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
				body: JSON.stringify({ prompt: last?.content ?? '', snapshot_id: null }),
			}) as { session_id?: string; url?: string; is_new_session?: boolean };
			return `Session Devin créée : ${data.url ?? data.session_id ?? '?'}\n\nLe travail continue dans Devin Cloud — réponses visibles dans la session.`;
		}
	}
}
