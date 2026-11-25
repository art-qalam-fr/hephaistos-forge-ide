/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, findParentWithClass, getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IOverlayWebview, IWebviewService, WebviewContentPurpose } from '../../webview/browser/webview.js';
import { asWebviewUri } from '../../webview/common/webview.js';
import { renderHomeHtml } from './hephaistosHomeHtml.js';
import { HephaistosChatPanel } from './hephaistosChatPanel.js';
import { HEPHAISTOS_PROVIDERS } from './hephaistosProviders.js';

export const HEPHAISTOS_HOME_VIEW_ID = 'hephaistos.homeView';
const ORCH_URL = 'http://127.0.0.1:7478';

/** Accueil Hephaistos : webview riche du kit (banniere, orchestrateur, providers, chats recents). */
export class HephaistosHomeViewPane extends ViewPane {

	private container?: HTMLElement;
	private rootContainer?: HTMLElement;
	private webview?: IOverlayWebview;
	private activated = false;
	private readonly webviewDisposables = this._register(new DisposableStore());

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IStorageService private readonly storageService: IStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@IViewsService private readonly viewsService: IViewsService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.onDidChangeBodyVisibility(() => this.updateVisibility()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.container = container;
		this.rootContainer = undefined;
		container.tabIndex = 0;
		container.setAttribute('role', 'document');
		container.setAttribute('aria-label', localize('hephaistos.home.aria', "Accueil Hephaistos"));
		this._register(addDisposableListener(container, 'focus', e => {
			if (e.target === container) {
				this.webview?.focus();
			}
		}));
		this.layoutWebview();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.layoutWebview();
	}

	override focus(): void {
		super.focus();
		this.webview?.focus();
	}

	private updateVisibility(): void {
		if (this.isBodyVisible()) {
			this.activate();
			this.webview?.claim(this, getWindow(this.element), undefined);
		} else {
			this.webview?.release(this);
		}
	}

	private async activate(): Promise<void> {
		if (this.activated) {
			return;
		}
		this.activated = true;
		const webview = this.webview = this.webviewService.createWebviewOverlay({
			title: this.title,
			options: { purpose: WebviewContentPurpose.WebviewView },
			contentOptions: {
				allowScripts: true,
				localResourceRoots: [FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media')],
			},
			extension: undefined,
		});
		this.layoutWebview();
		this.webviewDisposables.add({ dispose: () => { webview.release(this); } });
		webview.onMessage(e => { void this.onMessage(e.message as { type?: string; id?: string; provider?: string }); });
		await this.paint();
	}

	private async paint(): Promise<void> {
		const webview = this.webview;
		if (!webview) {
			return;
		}
		const media = FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media');
		const connected = await this.pingOrchestrator();
		const sessions = HephaistosChatPanel.listSessions(this.storageService).map(s => ({
			id: s.id, title: s.title, mode: s.mode, model: s.model, provider: s.provider,
			updatedAt: s.updatedAt, msgCount: s.messages.length,
		}));
		const providers = HEPHAISTOS_PROVIDERS.map(p => ({ id: p.id, label: p.label, enabled: true }));
		webview.setHtml(renderHomeHtml({
			cspSource: 'vscode-resource: https:',
			banderoleUri: String(asWebviewUri(URI.joinPath(media, 'hephaistos-banderole.jpg'))),
			nonce: Math.random().toString(36).slice(2),
			state: {
				sessions, providers,
				status: connected ? localize('hephaistos.orchOk', "Connecté à l'orchestrateur Hephaistos") : '',
				orchConnected: connected,
			},
		}));
	}

	private async pingOrchestrator(): Promise<boolean> {
		try {
			await fetch(ORCH_URL, { signal: AbortSignal.timeout(1500) });
			return true;
		} catch {
			return false;
		}
	}

	private async onMessage(message: { type?: string; id?: string; provider?: string }): Promise<void> {
		switch (message.type) {
			case 'new':
				await this.commandService.executeCommand('hephaistos.newProviderChat');
				return;
			case 'open_workspace':
				await this.commandService.executeCommand('hephaistos.openSwatWorkspace');
				return;
			case 'open':
				if (message.id) {
					HephaistosChatPanel.focusSession(message.id, this.storageService);
					await this.viewsService.openViewContainer('workbench.view.hephaistos.chat', true);
				}
				return;
			case 'delete':
				if (message.id) {
					HephaistosChatPanel.deleteSession(message.id, this.storageService);
					await this.paint();
				}
				return;
			case 'ping':
				await this.paint();
				return;
		}
	}

	private layoutWebview(): void {
		if (!this.container || !this.webview) {
			return;
		}
		if (!this.rootContainer || !this.rootContainer.isConnected) {
			this.rootContainer = findParentWithClass(this.container, 'monaco-scrollable-element') ?? undefined;
		}
		this.webview.setAnchorElement(this.container, this.rootContainer);
	}
}
