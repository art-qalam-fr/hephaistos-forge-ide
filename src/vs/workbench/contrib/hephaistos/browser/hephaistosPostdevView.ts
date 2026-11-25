/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Michel Chevalier / Hephaistos contributors. Port natif de PostDev (post-its magnétiques du kit)
 *  : capture de sélection, tableau, paste, persistance profil.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, findParentWithClass, getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IOverlayWebview, IWebview, IWebviewService, WebviewContentPurpose } from '../../webview/browser/webview.js';
import { asWebviewUri } from '../../webview/common/webview.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';

export const HEPHAISTOS_POSTDEV_VIEW_ID = 'hephaistos.postdevView';
const POSTDEV_NOTES_KEY = 'postdev.notes';

interface IPostdevMsg {
	type?: string;
	noteId?: string;
	notes?: unknown;
	text?: string;
	title?: string;
	file?: string | null;
	line?: number | null;
}

interface IPostdevServices {
	storageService: IStorageService;
	clipboardService: IClipboardService;
	editorService: IEditorService;
	codeEditorService: ICodeEditorService;
	workspaceService: IWorkspaceContextService;
	notificationService: INotificationService;
	webviewService: IWebviewService;
}

/** Hôte natif du protocole de la webview postdev (media/postdev/main.js). */
export class HephaistosPostdevHost {

	private static instance: HephaistosPostdevHost | undefined;

	static attach(webview: IWebview, services: IPostdevServices): HephaistosPostdevHost {
		HephaistosPostdevHost.instance?.dispose();
		const host = new HephaistosPostdevHost(webview, services);
		webview.onDidDispose(() => { host.dispose(); if (HephaistosPostdevHost.instance === host) { HephaistosPostdevHost.instance = undefined; } });
		HephaistosPostdevHost.instance = host;
		host.init();
		return host;
	}

	/** Commandes globales (capture sélection, nouveau post-it, tout effacer). */
	static get active(): HephaistosPostdevHost | undefined { return HephaistosPostdevHost.instance; }

	private readonly disposables = new DisposableStore();
	private disposed = false;

	private constructor(
		private readonly webview: IWebview,
		private readonly services: IPostdevServices,
	) { }

	private init(): void {
		this.disposables.add(this.webview.onMessage(e => { void this.onMessage(e.message as IPostdevMsg); }));
		this.render();
	}

	private render(): void {
		const media = (f: string) => asWebviewUri(joinPath(FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media/postdev'), f)).toString();
		const nonce = String(Date.now()) + String(Math.random()).slice(2);
		this.webview.setHtml(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'unsafe-inline' https:; script-src 'nonce-${nonce}'; font-src vscode-resource: https: data:; img-src vscode-resource: https: data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link href="${media('main.css')}" rel="stylesheet">
<title>PostDev</title>
</head>
<body>
<div class="toolbar">
	<div class="toolbar-row">
		<button id="btnCapture" class="btn btn-primary" title="Capturer la selection active"><span>+ Selection</span></button>
		<button id="btnNew" class="btn btn-secondary" title="Nouveau post-it">+</button>
		<button id="btnPasteNote" class="btn btn-secondary" title="Post-it depuis le presse-papiers">&darr;</button>
		<button id="btnScope" class="btn btn-secondary btn-scope" title="Filtrer par workspace">Tous</button>
		<button id="btnClearAll" class="btn btn-danger" title="Tout effacer">Reset</button>
		<div class="settings-wrap">
			<button id="btnSettings" class="btn btn-secondary" title="Parametres">&#9881;</button>
			<div id="settingsMenu" class="settings-menu">
				<label for="optBoardTheme">Tableau</label>
				<select id="optBoardTheme"><option value="default">Sombre</option><option value="cork">Liege</option><option value="blueprint">Blueprint</option><option value="paper">Papier</option></select>
				<label for="optFont">Police</label>
				<select id="optFont"><option value="mono">Mono</option><option value="sans">Sans-serif</option><option value="hand">Manuscrite</option></select>
				<label for="optFontSize">Taille</label>
				<select id="optFontSize"><option value="small">Petite</option><option value="normal">Normale</option><option value="large">Grande</option></select>
				<label for="optColor">Couleur defaut</label>
				<select id="optColor"><option value="random">Aleatoire</option><option value="yellow">Jaune</option><option value="mint">Menthe</option><option value="cyan">Cyan</option><option value="rose">Rose</option><option value="purple">Lavande</option><option value="orange">Orange</option></select>
			</div>
		</div>
	</div>
	<div class="toolbar-row">
		<div class="search-box"><span class="search-icon">&#128269;</span><input type="text" id="searchInput" class="search-input" placeholder="Rechercher notes, code, URLs..."></div>
	</div>
</div>
<div id="board" class="board-container">
	<div id="emptyState" class="empty-state">
		<div class="empty-icon">&#128204;</div>
		<div><strong>Aucun post-it pour l'instant</strong></div>
		<div style="font-size: 11px;">Selectionnez du texte puis cliquez « + Selection ».</div>
	</div>
</div>
<div id="toast" class="toast"></div>
<script nonce="${nonce}" src="${media('main.js')}"></script>
</body>
</html>`);
	}

	private get notes(): unknown[] {
		try { return JSON.parse(this.services.storageService.get(POSTDEV_NOTES_KEY, StorageScope.PROFILE, '[]')); }
		catch { return []; }
	}

	private post(msg: unknown): void {
		if (!this.disposed) { this.webview.postMessage(msg); }
	}

	private reloadNotes(): void {
		const root = this.services.workspaceService.getWorkspace().folders[0]?.uri.fsPath ?? null;
		this.post({ type: 'initNotes', notes: this.notes, workspaceRoot: root });
	}

	private async onMessage(msg: IPostdevMsg): Promise<void> {
		if (this.disposed) { return; }
		switch (msg.type) {
			case 'ready': this.reloadNotes(); return;
			case 'saveNotes':
				this.services.storageService.store(POSTDEV_NOTES_KEY, JSON.stringify(msg.notes ?? []), StorageScope.PROFILE, 0);
				return;
			case 'requestCapture': this.captureActiveSelection(); return;
			case 'copyToClipboard':
				if (typeof msg.text === 'string') { await this.services.clipboardService.writeText(msg.text); }
				return;
			case 'requestPaste':
				this.post({ type: 'pasteContent', noteId: msg.noteId, text: await this.services.clipboardService.readText() });
				return;
			case 'requestPasteAsNote':
				this.post({ type: 'pasteAsNote', text: await this.services.clipboardService.readText() });
				return;
			case 'sendToDevin': case 'draftToDevin': {
				// Route native : le texte part dans le presse-papiers, à coller dans le chat Hephaistos.
				const t = `[PostDev] ${msg.title || 'Post-it'}\n${msg.text || ''}` + (msg.file ? `\n(source: ${msg.file}${msg.line ? ':L' + msg.line : ''})` : '');
				await this.services.clipboardService.writeText(t);
				this.post({ type: 'devinSent', ok: true, mode: 'clipboard' });
				return;
			}
			case 'openSource':
				if (msg.file) {
					try {
						await this.services.editorService.openEditor({
							resource: URI.file(msg.file),
							options: { selection: { startLineNumber: msg.line || 1, startColumn: 1, endLineNumber: msg.line || 1, endColumn: 1 } },
						});
					} catch {
						this.services.notificationService.notify({ severity: Severity.Warning, message: localize('hephaistos.postdev.noSource', 'Fichier source introuvable : {0}', msg.file) });
					}
				}
				return;
		}
	}

	captureActiveSelection(): void {
		const control = this.services.codeEditorService.getFocusedCodeEditor() ?? this.services.codeEditorService.getActiveCodeEditor();
		const model = control?.getModel();
		const selection = control?.getSelection();
		if (!control || !model || !selection) {
			this.services.notificationService.info(localize('hephaistos.postdev.noEditor', 'Aucun éditeur actif pour capturer la sélection.'));
			return;
		}
		let text = model.getValueInRange(selection);
		if (!text?.trim()) { text = model.getLineContent(selection.startLineNumber); }
		const file = model.uri.fsPath;
		const startLine = selection.startLineNumber;
		const endLine = selection.endLineNumber;
		this.post({
			type: 'capturedSelection',
			title: `${file.split(/[\\/]/).pop()} (${startLine === endLine ? 'L' + startLine : `L${startLine}-${endLine}`})`,
			text, file, line: startLine,
		});
	}

	createNewNote(): void {
		this.post({ type: 'capturedSelection', title: 'Nouveau Post-it', text: '', file: null, line: null });
	}

	clearAllNotes(): void {
		this.services.storageService.store(POSTDEV_NOTES_KEY, '[]', StorageScope.PROFILE, 0);
		this.reloadNotes();
	}

	dispose(): void { this.disposed = true; this.disposables.dispose(); }
}

/**
 * Vue « PostDev » dans la barre latérale : tableau de post-its magnétiques
 * (webview overlay du kit, persistée dans le profil).
 */
export class HephaistosPostdevViewPane extends ViewPane {

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
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IEditorService private readonly editorService: IEditorService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService,
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
		container.setAttribute('aria-label', localize('hephaistos.postdev.aria', 'Tableau PostDev'));
		this._register(addDisposableListener(container, 'focus', e => {
			if (e.target === container) { this.webview?.focus(); }
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
		if (this.activated) { return; }
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
		HephaistosPostdevHost.attach(webview, {
			storageService: this.storageService,
			clipboardService: this.clipboardService,
			editorService: this.editorService,
			codeEditorService: this.codeEditorService,
			workspaceService: this.workspaceService,
			notificationService: this.notificationService,
			webviewService: this.webviewService,
		});
	}

	private layoutWebview(): void {
		if (!this.container || !this.webview) { return; }
		if (!this.rootContainer || !this.rootContainer.isConnected) {
			this.rootContainer = findParentWithClass(this.container, 'monaco-scrollable-element') ?? undefined;
		}
		this.webview.setAnchorElement(this.container, this.rootContainer);
	}
}
