/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize } from '../../../../nls.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { asWebviewUri } from '../../webview/common/webview.js';
import { IWebview } from '../../webview/browser/webview.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { AGENT_ICON_FILES } from './media/agentIconManifest.js';
import { HEPHAISTOS_PROVIDERS, IChatMessage, listProviderModels, sendProviderChat } from './hephaistosProviders.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';

const STORAGE_KEY = 'hephaistos.chat.sessions';

interface IChatSessionMessage { role: 'user' | 'assistant'; text: string; at: string; thinking?: string; isError?: boolean }
interface IChatDiscussion { id: string; title: string; provider: string; model: string; updatedAt: string; messages: IChatSessionMessage[] }
export interface IChatSession {
	id: string; codename?: string; title: string; provider: string; model: string; mode: string;
	discussionId: string; updatedAt: string; messages: IChatSessionMessage[]; discussions: IChatDiscussion[];
}

const DEFAULT_ICON_THEME = 'commando';

interface IChatPanelHost {
	readonly webview: IWebview;
	setWebviewTitle?(title: string): void;
	dispose(): void;
}

export class HephaistosChatPanel {

	private static openById = new Map<string, HephaistosChatPanel>();
	private static dockWebview: IWebview | undefined;
	private static sessions = new Map<string, IChatSession>();
	private static terminalService: ITerminalService | undefined;

	private disposed = false;
	private isGenerating = false;
	private abort: AbortController | null = null;
	private models: { id: string; provider: string }[] = [];
	private status = '';

	private constructor(
		private readonly input: IChatPanelHost,
		private session: IChatSession,
		private readonly storageService: IStorageService,
	) {
		this.input.webview.onMessage(e => { void this.onMessage(e.message as { type?: string }); });
		Event.once(this.input.webview.onDidDispose)(() => {
			this.disposed = true;
			this.abort?.abort();
			HephaistosChatPanel.openById.delete(this.session.id);
		});
		this.render();
	}

	private static loadSessions(storageService: IStorageService): void {
		if (HephaistosChatPanel.sessions.size !== 0) {
			return;
		}
		try {
			const raw = storageService.get(STORAGE_KEY, StorageScope.PROFILE, '{}');
			for (const s of JSON.parse(raw) as IChatSession[]) {
				HephaistosChatPanel.sessions.set(s.id, s);
			}
		} catch { /* sessions vides */ }
	}

	private static newSession(providerId?: string): IChatSession {
		const id = `chat-${generateUuid().slice(0, 8)}`;
		const provider = HEPHAISTOS_PROVIDERS.find(p => p.id === providerId) ?? HEPHAISTOS_PROVIDERS[0];
		const session: IChatSession = {
			id, title: provider.label, provider: provider.id, model: provider.staticModels[0] ?? '', mode: 'agent',
			discussionId: `disc-${generateUuid().slice(0, 8)}`, updatedAt: new Date().toISOString(), messages: [], discussions: [],
		};
		HephaistosChatPanel.sessions.set(id, session);
		return session;
	}

	/**
	 * Attache une session de chat à un webview quelconque (panneau éditeur ou vue).
	 */
	static attach(webview: IWebview, storageService: IStorageService, session?: IChatSession, terminalService?: ITerminalService): HephaistosChatPanel {
		HephaistosChatPanel.terminalService ??= terminalService;
		HephaistosChatPanel.dockWebview = webview;
		HephaistosChatPanel.loadSessions(storageService);
		session ??= [...HephaistosChatPanel.sessions.values()].at(-1) ?? HephaistosChatPanel.newSession();
		const existing = HephaistosChatPanel.openById.get(session.id);
		if (existing) {
			return existing;
		}
		const panel = new HephaistosChatPanel({ webview, dispose: () => webview.dispose() }, session, storageService);
		HephaistosChatPanel.openById.set(session.id, panel);
		return panel;
	}

	static createSession(providerId: string | undefined, storageService: IStorageService): IChatSession {
		HephaistosChatPanel.loadSessions(storageService);
		const s = HephaistosChatPanel.newSession(providerId);
		storageSave(storageService, [...HephaistosChatPanel.sessions.values()]);
		return s;
	}

	static listSessions(storageService: IStorageService): IChatSession[] {
		HephaistosChatPanel.loadSessions(storageService);
		return [...HephaistosChatPanel.sessions.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
	}

	static deleteSession(id: string, storageService: IStorageService): void {
		HephaistosChatPanel.sessions.delete(id);
		HephaistosChatPanel.openById.get(id)?.dispose();
		storageSave(storageService, [...HephaistosChatPanel.sessions.values()]);
	}

	static focusSession(id: string, storageService: IStorageService): void {
		const s = HephaistosChatPanel.sessions.get(id);
		if (s && HephaistosChatPanel.dockWebview) {
			HephaistosChatPanel.attach(HephaistosChatPanel.dockWebview, storageService, s);
		}
	}

	private dispose(): void {
		this.disposed = true;
	}

	static create(storageService: IStorageService, webviewWorkbenchService: IWebviewWorkbenchService, terminalService?: ITerminalService, providerId?: string): void {
		HephaistosChatPanel.terminalService ??= terminalService;
		HephaistosChatPanel.loadSessions(storageService);
		const session = HephaistosChatPanel.newSession(providerId);
		const input: IChatPanelHost = webviewWorkbenchService.openWebview(
			{
				title: session.title,
				options: { enableFindWidget: true },
				contentOptions: { allowScripts: true, localResourceRoots: [FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media')] },
				extension: undefined,
			},
			'hephaistosChat',
			session.title,
			undefined,
			{ group: ACTIVE_GROUP, preserveFocus: false },
		);
		const panel = new HephaistosChatPanel(input, session, storageService);
		HephaistosChatPanel.openById.set(session.id, panel);
	}

	private save(): void {
		this.session.updatedAt = new Date().toISOString();
		storageSave(this.storageService, [...HephaistosChatPanel.sessions.values()]);
	}

	private render(): void {
		const nonce = Math.random().toString(36).slice(2);
		const media = FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media');
		const webview = this.input.webview;
		const css = asWebviewUri(URI.joinPath(media, 'chat.css'));
		const script = asWebviewUri(URI.joinPath(media, 'chat.js'));
		const agentsUri = asWebviewUri(URI.joinPath(media, 'agents', DEFAULT_ICON_THEME));
		const icons = AGENT_ICON_FILES[DEFAULT_ICON_THEME] ?? [];
		webview.setHtml(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: https: data:; style-src vscode-resource: https: 'unsafe-inline'; script-src 'nonce-${nonce}';">
<link rel="stylesheet" href="${css}"></head><body>
<header class="top">
  <button type="button" id="providerBtn" class="top-provider-btn"><strong id="providerName">Fournisseur</strong></button>
  <span class="spacer"></span>
  <button type="button" id="pointBtn" class="point-pill" title="Pointer cet agent">⌖</button>
  <button type="button" id="historyBtn" class="history-pill"><span>🕒 Historique</span><span class="chevron">▾</span></button>
  <div id="historyMenu" class="dropdown-menu history-dropdown" hidden>
    <div class="history-dropdown-header"><span>Historique</span><button type="button" id="newDiscussionBtn" class="history-new-btn">+ Nouvelle</button></div>
    <div class="search-box"><input type="text" id="historySearch" placeholder="Filtrer…" autocomplete="off"></div>
    <div id="historyList" class="history-scroll-list"></div>
  </div>
</header>
<main id="transcript" class="transcript-container"></main>
<div class="composer-container">
  <div id="slashMenu" class="slash-suggestions" hidden>
    <div class="slash-item" data-cmd="/help"><strong>/help</strong></div>
    <div class="slash-item" data-cmd="/plan"><strong>/plan</strong></div>
    <div class="slash-item" data-cmd="/ask"><strong>/ask</strong></div>
    <div class="slash-item" data-cmd="/agent"><strong>/agent</strong></div>
    <div class="slash-item" data-cmd="/clear"><strong>/clear</strong></div>
    <div class="slash-item" data-cmd="/status"><strong>/status</strong></div>
  </div>
  <div class="composer-box">
    <textarea id="draft" rows="1" placeholder="Tape un message ou '/' pour les commandes..."></textarea>
    <div class="composer-toolbar">
      <div class="selector-group">
        <button type="button" class="pill-btn mode-pill" id="modeBtn"><span class="mode-dot"></span><span id="modeLabel">Agent</span></button>
        <button type="button" class="pill-btn model-pill" id="modelBtn"><span id="modelLabel">Modèle</span></button>
      </div>
      <span class="spacer"></span>
      <div class="composer-actions"><span class="composer-hint">Entrée ↵ pour envoyer</span><button type="button" id="send" class="send-btn" aria-label="Envoyer" disabled><span class="send-icon">↑</span></button></div>
    </div>
  </div>
  <div id="modeMenu" class="dropdown-menu mode-dropdown" hidden></div>
  <div id="modelMenu" class="dropdown-menu model-dropdown" hidden>
    <div class="search-box"><input type="text" id="modelSearch" placeholder="🔍 Rechercher un modèle..." autocomplete="off"></div>
    <div id="modelList" class="model-scroll-list"></div>
  </div>
</div>
<script nonce="${nonce}">window.__agentsUri="${agentsUri}";window.__agentsFallbackUri="${agentsUri}";window.__agentIcons=${JSON.stringify(icons)};window.__agentsFallbackIcons=${JSON.stringify(icons)};</script>
<script nonce="${nonce}" src="${script}"></script>
</body></html>`);
		this.push();
	}

	private push(): void {
		if (this.disposed) {
			return;
		}
		const providers = HEPHAISTOS_PROVIDERS.map(p => ({ id: p.id, label: p.label, enabled: true }));
		const allSessions = [...HephaistosChatPanel.sessions.values()].map(s => ({
			id: s.id, title: s.title, provider: s.provider, model: s.model, discussionId: s.discussionId,
			messageCount: s.messages.length, updatedAt: s.updatedAt,
		}));
		void this.input.webview.postMessage({
			type: 'state', session: this.session, providers, models: this.models,
			status: this.status, isGenerating: this.isGenerating, allSessions,
		});
	}

	private async loadModels(): Promise<void> {
		this.status = localize('hephaistos.querying', 'Interrogation des fournisseurs…');
		this.push();
		const models: { id: string; provider: string }[] = this.models;
		await Promise.all(HEPHAISTOS_PROVIDERS.map(async p => {
			const names = await listProviderModels(p);
			for (const m of names) {
				if (!models.some(e => e.id === m && e.provider === p.id)) {
					models.push({ id: m, provider: p.id });
				}
			}
			this.status = `${models.length} modèles.`;
			this.push();
		}));
	}

	private async onMessage(message: { type?: string; [key: string]: unknown }): Promise<void> {
		switch (message.type) {
			case 'ready': await this.loadModels(); return;
			case 'ping': await this.loadModels(); return;
			case 'meta': {
				const s = this.session;
				this.session = { ...s, mode: String(message.mode ?? s.mode), provider: String(message.provider ?? s.provider), model: String(message.model ?? s.model) };
				this.save(); this.input.setWebviewTitle?.(this.session.provider + ' · ' + this.session.model); this.push();
				return;
			}
			case 'rename':
				if (typeof message.title === 'string' && message.title.trim()) {
					this.session.title = message.title.trim(); this.save(); this.push();
				}
				return;
			case 'clear': case 'new_discussion':
				this.archiveDiscussion();
				this.session.discussionId = `disc-${generateUuid().slice(0, 8)}`;
				this.session.messages = [];
				this.save(); this.push();
				return;
			case 'switch_session': {
				const target = HephaistosChatPanel.sessions.get(String(message.id ?? ''));
				if (!target) { return; }
				this.archiveDiscussion();
				this.session = target;
				this.save(); this.push();
				return;
			}
			case 'new': {
				this.archiveDiscussion();
				this.session = HephaistosChatPanel.newSession(typeof message.provider === 'string' ? message.provider : undefined);
				this.save(); this.push();
				return;
			}
			case 'point_agent': {
				HephaistosChatPanel.focusSession(String(message.sessionId ?? ''), this.storageService);
				return;
			}
			case 'switch_discussion': {
				const target = this.session.discussions.find(d => d.id === message.id);
				if (!target) { return; }
				this.archiveDiscussion();
				this.session.discussions = this.session.discussions.filter(d => d.id !== target.id);
				this.session.discussionId = target.id;
				this.session.messages = [...target.messages];
				this.session.provider = target.provider; this.session.model = target.model;
				this.save(); this.push();
				return;
			}
			case 'get_chat_id':
				void this.input.webview.postMessage({
					type: 'chat_id_response',
					sessionIdentity: {
						sessionId: this.session.id, providerId: this.session.provider, transport: 'hephaistos-workbench',
						model: this.session.model, mode: this.session.mode, title: this.session.title,
						userMessageCount: this.session.messages.filter(m => m.role === 'user').length,
						createdAt: this.session.updatedAt,
					},
				});
				return;
			case 'delete':
				HephaistosChatPanel.sessions.delete(this.session.id);
				this.save(); this.input.dispose();
				return;
			case 'abort':
				this.abort?.abort(); this.abort = null; this.isGenerating = false; this.push();
				return;
			case 'send':
				if (typeof message.text === 'string' && message.text.trim()) {
					await this.send(message.text.trim());
				}
				return;
		}
	}

	private archiveDiscussion(): void {
		if (!this.session.messages.length) { return; }
		const first = this.session.messages.find(m => m.role === 'user');
		const title = (first?.text ?? this.session.title).replace(/\s+/g, ' ').slice(0, 48);
		this.session.discussions = [{
			id: this.session.discussionId, title, provider: this.session.provider, model: this.session.model,
			updatedAt: this.session.updatedAt, messages: [...this.session.messages],
		}, ...this.session.discussions.filter(d => d.id !== this.session.discussionId)].slice(0, 50);
	}

	private async send(text: string): Promise<void> {
		if (this.isGenerating) { return; }
		const session = this.session;
		session.messages.push({ role: 'user', text, at: new Date().toISOString() });
		const idx = session.messages.length;
		session.messages.push({ role: 'assistant', text: '', at: new Date().toISOString() });
		this.isGenerating = true;
		this.abort = new AbortController();
		this.push();
		const provider = HEPHAISTOS_PROVIDERS.find(p => p.id === session.provider) ?? HEPHAISTOS_PROVIDERS[0];
		try {
			const history: IChatMessage[] = session.messages.slice(0, idx).map(m => ({ role: m.role, content: m.text }));
			if (provider.api === 'cli' && provider.cliCommand) {
				const reply = await this.sendViaTerminal(provider, session, history);
				session.messages[idx].text = reply;
				session.messages[idx].isError = false;
				return;
			}
			const reply = await sendProviderChat(provider, session.model, history);
			session.messages[idx].text = reply;
			session.messages[idx].isError = false;
		} catch (e) {
			session.messages[idx].text = `⚠️ **Erreur :** ${e instanceof Error ? e.message : e}`;
			session.messages[idx].isError = true;
		} finally {
			this.isGenerating = false;
			this.abort = null;
			this.save();
			this.push();
		}
	}

	private async sendViaTerminal(provider: { cliCommand?: string; label: string }, session: IChatSession, history: IChatMessage[]): Promise<string> {
		const ts = HephaistosChatPanel.terminalService;
		if (!ts) { throw new Error('Service terminal indisponible'); }
		const name = `hphe-${provider.cliCommand}-${session.id.slice(-6)}`;
		const term = ts.instances.find(t => t.title === name) ?? await ts.createTerminal({ config: { name } });
		const prompt = (history[history.length - 1]?.content ?? '').replace(/"/g, '\\"').replace(/\s+/g, ' ');
		term.sendText(`${provider.cliCommand} -p "${prompt}"`, true);
		return `→ Prompt envoyé au terminal **${name}** — la réponse d'${provider.label} s'affiche dans le terminal intégré.`;
	}
}

function storageSave(storageService: IStorageService, sessions: IChatSession[]): void {
	storageService.store(STORAGE_KEY, JSON.stringify(sessions), StorageScope.PROFILE, StorageTarget.MACHINE);
}
