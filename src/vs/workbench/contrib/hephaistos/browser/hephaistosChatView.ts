/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, findParentWithClass, getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOverlayWebview, IWebviewService, WebviewContentPurpose } from '../../webview/browser/webview.js';
import { status } from '../../../../base/browser/ui/aria/aria.js';
import { HephaistosChatPanel } from './hephaistosChatPanel.js';

export const HEPHAISTOS_CHAT_VIEW_ID = 'hephaistos.chatView';

/**
 * Vue « Hephaistos Chat » ancrée dans la barre latérale secondaire :
 * héberge la webview de chat du kit (fournisseurs, modèles, discussions, SWAT)
 * via un overlay qui survit aux bascules de visibilité.
 */
export class HephaistosChatViewPane extends ViewPane {

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
		@ITerminalService private readonly terminalService: ITerminalService,
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
		container.setAttribute('aria-label', localize('hephaistos.chatView.aria', "Hephaistos Chat"));
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

	private activate(): void {
		if (this.activated) {
			return;
		}
		this.activated = true;
		const webview = this.webview = this.webviewService.createWebviewOverlay({
			title: this.title,
			options: { purpose: WebviewContentPurpose.WebviewView, enableFindWidget: true },
			contentOptions: {
				allowScripts: true,
				localResourceRoots: [FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media')],
			},
			extension: undefined,
		});
		this.layoutWebview();
		this.webviewDisposables.add({ dispose: () => { webview.release(this); } });
		HephaistosChatPanel.attach(webview, this.storageService, undefined, this.terminalService);
		status(localize('hephaistos.chatReady', "Hephaistos Chat prêt"));
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
