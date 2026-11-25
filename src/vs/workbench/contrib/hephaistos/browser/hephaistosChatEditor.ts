/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, clearNode, addDisposableListener, EventType } from '../../../../base/browser/dom.js';
import { status } from '../../../../base/browser/ui/aria/aria.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IEditorOpenContext, IEditorSerializer } from '../../../common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorInputCapabilities, IUntypedEditorInput } from '../../../common/editor.js';
import { HEPHAISTOS_PROVIDERS, IChatMessage, IHephaistosProvider, sendProviderChat } from './hephaistosProviders.js';

export class HephaistosChatEditorInput extends EditorInput {

	static readonly ID = 'workbench.editors.hephaistosChat';

	readonly providerId: string;
	readonly model: string;
	private readonly _resource: URI;

	constructor(providerId: string, model: string, resource?: URI) {
		super();
		this.providerId = providerId;
		this.model = model;
		this._resource = resource ?? URI.from({ scheme: 'hephaistos-chat', path: `/${providerId}/${encodeURIComponent(model)}` });
	}

	override get resource(): URI { return this._resource; }

	override get typeId(): string { return HephaistosChatEditorInput.ID; }
	override get editorId(): string { return HephaistosChatEditorInput.ID; }
	override get capabilities(): EditorInputCapabilities { return EditorInputCapabilities.Readonly | EditorInputCapabilities.Singleton; }

	override getName(): string { return `Chat ${this.providerId} · ${this.model}`; }

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return other instanceof HephaistosChatEditorInput && other.providerId === this.providerId && other.model === this.model;
	}
}

export class HephaistosChatEditorSerializer implements IEditorSerializer {
	canSerialize(): boolean { return true; }
	serialize(input: HephaistosChatEditorInput): string {
		return JSON.stringify({ provider: input.providerId, model: input.model });
	}
	deserialize(instantiationService: IInstantiationService, raw: string): HephaistosChatEditorInput {
		const { provider, model } = JSON.parse(raw);
		return instantiationService.createInstance(HephaistosChatEditorInput, provider, model);
	}
}

export class HephaistosChatEditor extends EditorPane {

	static readonly ID = 'workbench.editors.hephaistosChat.pane';

	private messagesEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private statusEl!: HTMLElement;
	private headerEl!: HTMLElement;
	private messages: IChatMessage[] = [];
	private sending = false;
	private readonly editorDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
	) {
		super(HephaistosChatEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		const root = append(parent, $('.hephaistos-chat'));
		root.style.display = 'flex';
		root.style.flexDirection = 'column';
		root.style.height = '100%';
		root.style.padding = '0 12px 12px';

		this.headerEl = append(root, $('div'));
		this.headerEl.style.padding = '10px 0';
		this.headerEl.style.fontWeight = '600';
		this.headerEl.style.borderBottom = '1px solid var(--vscode-panel-border)';

		this.messagesEl = append(root, $('div'));
		this.messagesEl.setAttribute('role', 'log');
		this.messagesEl.setAttribute('aria-live', 'polite');
		this.messagesEl.setAttribute('aria-label', localize('hephaistos.messages', "Messages du chat"));
		this.messagesEl.style.flex = '1';
		this.messagesEl.style.overflowY = 'auto';
		this.messagesEl.style.padding = '8px 0';

		const footer = append(root, $('div'));
		footer.style.display = 'flex';
		footer.style.gap = '8px';
		footer.style.alignItems = 'flex-end';

		this.inputEl = append(footer, $('textarea')) as HTMLTextAreaElement;
		this.inputEl.setAttribute('aria-label', localize('hephaistos.messageInput', "Message à envoyer"));
		this.inputEl.placeholder = 'Message… (Entrée = envoyer, Maj+Entrée = saut de ligne)';
		this.inputEl.rows = 3;
		this.inputEl.style.flex = '1';
		this.inputEl.style.resize = 'none';
		this.inputEl.style.background = 'var(--vscode-input-background)';
		this.inputEl.style.color = 'var(--vscode-input-foreground)';
		this.inputEl.style.border = '1px solid var(--vscode-input-border, transparent)';
		this.inputEl.style.padding = '6px';
		this.inputEl.style.fontFamily = 'inherit';

		const sendBtn = append(footer, $('button')) as HTMLButtonElement;
		sendBtn.textContent = 'Envoyer';
		sendBtn.setAttribute('aria-label', localize('hephaistos.send', "Envoyer le message"));
		sendBtn.style.padding = '6px 14px';

		this.statusEl = append(root, $('div'));
		this.statusEl.style.fontSize = '11px';
		this.statusEl.style.opacity = '0.7';
		this.statusEl.style.paddingTop = '6px';

		this.editorDisposables.add(addDisposableListener(sendBtn, EventType.CLICK, () => this.send()));
		this.editorDisposables.add(addDisposableListener(this.inputEl, EventType.KEY_DOWN, e => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				this.send();
			}
		}));
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		if (input instanceof HephaistosChatEditorInput) {
			const provider = HEPHAISTOS_PROVIDERS.find(p => p.id === input.providerId);
			this.headerEl.textContent = `Fournisseur : ${provider?.label ?? input.providerId}   ·   Modèle : ${input.model}`;
			this.messages = [];
			clearNode(this.messagesEl);
			this.appendMessage('system', `Nouveau chat connecté à ${provider?.label ?? input.providerId} — modèle « ${input.model} ». La clé API est lue depuis les variables système.`);
		}
	}

	private provider(): IHephaistosProvider | undefined {
		const input = this.input;
		return input instanceof HephaistosChatEditorInput ? HEPHAISTOS_PROVIDERS.find(p => p.id === input.providerId) : undefined;
	}

	private appendMessage(role: 'user' | 'assistant' | 'system' | 'error', text: string): void {
		const el = append(this.messagesEl, $('div'));
		el.style.margin = '6px 0';
		el.style.padding = '8px 10px';
		el.style.borderRadius = '6px';
		el.style.whiteSpace = 'pre-wrap';
		el.style.maxWidth = '85%';
		if (role === 'user') {
			el.style.marginLeft = 'auto';
			el.style.background = 'var(--vscode-button-secondaryBackground)';
		} else if (role === 'assistant') {
			el.style.background = 'var(--vscode-editor-inactiveSelectionBackground)';
		} else {
			el.style.background = role === 'error' ? 'var(--vscode-inputValidation-errorBackground)' : 'transparent';
			el.style.opacity = '0.8';
			el.style.fontSize = '12px';
			el.style.margin = '4px 0';
		}
		el.textContent = text;
		this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
	}

	private async send(): Promise<void> {
		const text = this.inputEl.value.trim();
		const provider = this.provider();
		const input = this.input as HephaistosChatEditorInput;
		if (!text || !provider || this.sending) {
			return;
		}
		this.sending = true;
		this.inputEl.value = '';
		this.appendMessage('user', text);
		this.messages.push({ role: 'user', content: text });
		this.statusEl.textContent = 'Envoi…';
		status(localize('hephaistos.sending', "Envoi du message au fournisseur"));
		try {
			const reply = await sendProviderChat(provider, input.model, this.messages);
			this.messages.push({ role: 'assistant', content: reply });
			this.appendMessage('assistant', reply);
			this.statusEl.textContent = '';
			status(localize('hephaistos.received', "Réponse reçue"));
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			this.appendMessage('error', `Erreur : ${msg}`);
			this.statusEl.textContent = 'Erreur';
			status(localize('hephaistos.sendError', "Erreur lors de l'envoi du message"));
		} finally {
			this.sending = false;
		}
	}

	override layout(): void { /* DOM gère seul */ }
}
