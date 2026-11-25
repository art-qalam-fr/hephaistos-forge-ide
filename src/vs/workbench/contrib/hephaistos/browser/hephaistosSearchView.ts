/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Michel Chevalier / Hephaistos contributors. Port natif de la recherche Everything du kit
 *  (search-ext) : webview riche + pont :7478 + navigation/explorateur/preview.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener, findParentWithClass, getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { localize } from '../../../../nls.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStorageService, StorageScope } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IOverlayWebview, IWebview, IWebviewService, WebviewContentPurpose } from '../../webview/browser/webview.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { hephaistosSearchHtml } from './hephaistosSearchHtml.js';

export const HEPHAISTOS_SEARCH_VIEW_ID = 'hephaistos.searchView';

const BRIDGE_URL = 'http://127.0.0.1:7478';
const SEARCH_STATE_KEY = 'hephaistos.search.panelState';
const MAX_RESULTS = 500;

const IMG_MIME: Record<string, string> = {
	png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
	bmp: 'image/bmp', webp: 'image/webp', ico: 'image/x-icon', svg: 'image/svg+xml',
};

interface ISearchMsg {
	type?: string;
	seq?: number;
	path?: string;
	dir?: boolean;
	query?: string;
	sort?: string;
	descending?: boolean;
	kind?: string;
	parent?: string;
	name?: string;
	ext?: string;
	paths?: string[];
	state?: unknown;
}

interface IBrowseItem { name: string; path: string; dir: boolean; size: number; mtime?: number | null; ico?: string }

/** Hôte natif du protocole de la webview search-ext (media/search/panel.js). */
export class HephaistosSearchHost {

	static attach(
		webview: IWebview,
		services: {
			fileService: IFileService;
			editorService: IEditorService;
			commandService: ICommandService;
			clipboardService: IClipboardService;
			nativeHostService: INativeHostService;
			storageService: IStorageService;
			workspaceService: IWorkspaceContextService;
			envService: INativeEnvironmentService;
		},
	): void {
		const host = new HephaistosSearchHost(webview, services);
		webview.onDidDispose(() => host.dispose());
		host.init();
	}

	private readonly disposables = new DisposableStore();
	private disposed = false;
	private lastSearchController?: AbortController;

	private constructor(
		private readonly webview: IWebview,
		private readonly services: {
			fileService: IFileService;
			editorService: IEditorService;
			commandService: ICommandService;
			clipboardService: IClipboardService;
			nativeHostService: INativeHostService;
			storageService: IStorageService;
			workspaceService: IWorkspaceContextService;
			envService: INativeEnvironmentService;
		},
	) { }

	private init(): void {
		this.disposables.add(this.webview.onMessage(e => { void this.onMessage(e.message as ISearchMsg); }));
		this.render();
	}

	private render(): void {
		const persisted = this.loadState();
		const ws = this.services.workspaceService.getWorkspace().folders[0]?.uri.fsPath ?? '';
		const boot = JSON.stringify({ persisted, workspace: ws }).replace(/</g, '\\u003c');
		this.webview.setHtml(hephaistosSearchHtml(boot));
	}

	private loadState(): unknown {
		try { return JSON.parse(this.services.storageService.get(SEARCH_STATE_KEY, StorageScope.PROFILE, '{}')); }
		catch { return {}; }
	}

	private post(msg: unknown): void {
		if (!this.disposed) { this.webview.postMessage(msg); }
	}

	private async onMessage(msg: ISearchMsg): Promise<void> {
		if (this.disposed) { return; }
		try {
			switch (msg.type) {
				case 'search': return await this.search(msg);
				case 'browse': return await this.browse(msg);
				case 'open': return await this.open(msg);
				case 'reveal':
					return await this.services.commandService.executeCommand('revealInExplorer', URI.file(msg.path!));
				case 'copyPath':
					return await this.services.clipboardService.writeText(msg.path!);
				case 'openContaining':
					return await this.services.nativeHostService.showItemInFolder(msg.path!);
				case 'dragStart': return; // bookkeeping côté webview
				case 'submitToAgent': return await this.submitToAgent(msg.paths ?? []);
				case 'fsCreate': return await this.fsCreate(msg);
				case 'preview': return await this.preview(msg);
				case 'statPath': return await this.statPath(msg);
				case 'saveFolderHistory':
					this.services.storageService.store(SEARCH_STATE_KEY, JSON.stringify(msg.state ?? {}), StorageScope.PROFILE, 0);
					return;
				case 'getFolderHistory':
				case 'ready':
					this.post({ type: 'folderHistory', state: this.loadState() });
					return;
			}
		} catch (e) {
			this.post({ type: 'error', seq: msg.seq, message: String(e instanceof Error ? e.message : e) });
		}
	}

	private async search(msg: ISearchMsg): Promise<void> {
		this.lastSearchController?.abort();
		const ctrl = this.lastSearchController = new AbortController();
		const args = { query: msg.query ?? '', max_results: MAX_RESULTS, sort: msg.sort || 'name', descending: !!msg.descending };
		try {
			const res = await fetch(`${BRIDGE_URL}/tools/call`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'Hephaistos-everything-search__everything_search', arguments: args }),
				signal: ctrl.signal,
			});
			if (!res.ok) { throw new Error(`HTTP ${res.status}`); }
			const data = await res.json() as { content?: { text?: string }[]; results?: unknown };
			let payload: unknown = data.results ?? data;
			if (data.content?.[0]?.text) {
				try { payload = JSON.parse(data.content[0].text); } catch { /* payload brut */ }
			}
			this.post({ type: 'results', seq: msg.seq, payload, renderCap: MAX_RESULTS });
		} catch (e) {
			if (!ctrl.signal.aborted) {
				this.post({ type: 'error', seq: msg.seq, message: String(e instanceof Error ? e.message : e) });
			}
		}
	}

	private async browse(msg: ISearchMsg): Promise<void> {
		const p = msg.path || '';
		const results: IBrowseItem[] = [];
		if (!p) {
			// Niveau PC : lettres de lecteurs présentes + dossiers cloud du home.
			const fs = this.services.fileService;
			const checks = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(async L => {
				const root = URI.file(L + ':\\');
				if (await fs.exists(root)) {
					results.push({ name: L + ':', path: L + ':\\', dir: true, size: 0, ico: '💾' });
				}
			});
			await Promise.all(checks);
			try {
				const home = this.services.envService.userHome;
				const homeStat = await fs.resolve(home, { resolveMetadata: false });
				for (const c of homeStat.children ?? []) {
					if (c.isDirectory && /^(onedrive|google drive|dropbox|icloud)/i.test(c.name)) {
						results.push({ name: c.name, path: c.resource.fsPath, dir: true, size: 0, ico: '☁' });
					}
				}
			} catch { /* home indisponible */ }
			this.post({ type: 'browse', seq: msg.seq, payload: { results, total: results.length } });
			return;
		}
		const stat = await this.services.fileService.resolve(URI.file(p), { resolveMetadata: false });
		for (const c of stat.children ?? []) {
			results.push({ name: c.name, path: c.resource.fsPath, dir: c.isDirectory, size: c.isDirectory ? 0 : (c.size ?? 0), mtime: c.mtime ? c.mtime / 1000 : null });
		}
		results.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
		this.post({ type: 'browse', seq: msg.seq, payload: { results, total: results.length } });
	}

	private async open(msg: ISearchMsg): Promise<void> {
		const uri = URI.file(msg.path!);
		if (msg.dir) {
			await this.services.commandService.executeCommand('revealInExplorer', uri);
		} else {
			await this.services.editorService.openEditor({ resource: uri });
		}
	}

	private async submitToAgent(paths: string[]): Promise<void> {
		if (!paths.length) { return; }
		const text = `[Everything Search] ${paths.length} item(s):\n` + paths.join('\n');
		await this.services.clipboardService.writeText(text);
		this.post({ type: 'status', message: `${paths.length} chemin(s) copiés — collez dans le chat Hephaistos (Ctrl+V)` });
	}

	private async fsCreate(msg: ISearchMsg): Promise<void> {
		const parent = msg.parent;
		const name = String(msg.name || '').trim();
		if (!parent || !name || /[\\/:*?"<>|]/.test(name)) {
			this.post({ type: 'fsCreated', error: 'invalid name or target', parent, name });
			return;
		}
		const target = URI.file(parent + '\\' + name);
		try {
			if (msg.kind === 'dir') {
				await this.services.fileService.createFolder(target);
			} else {
				await this.services.fileService.writeFile(target, VSBuffer.fromString(''));
			}
			this.post({ type: 'fsCreated', path: target.fsPath });
		} catch (e) {
			this.post({ type: 'fsCreated', error: String(e instanceof Error ? e.message : e), path: target.fsPath });
		}
	}

	private async preview(msg: ISearchMsg): Promise<void> {
		const p = msg.path!;
		const uri = URI.file(p);
		try {
			const stat = await this.services.fileService.resolve(uri, { resolveMetadata: true });
			const ext = (msg.ext || '').toLowerCase();
			if (IMG_MIME[ext]) {
				if (stat.size > 8 * 1024 * 1024) {
					this.post({ type: 'preview', path: p, size: stat.size, error: 'image too large (>8 MB)' });
					return;
				}
				const buf = await this.services.fileService.readFile(uri);
				this.post({ type: 'preview', path: p, size: stat.size, kind: 'image', data: `data:${IMG_MIME[ext]};base64,${buf.value.toString()}` });
			} else {
				const buf = await this.services.fileService.readFile(uri, { limits: { size: 64 * 1024 } });
				const bytes = buf.value.buffer;
				if (bytes.indexOf(0) >= 0) {
					this.post({ type: 'preview', path: p, size: stat.size, error: 'binary file — no text preview' });
					return;
				}
				this.post({ type: 'preview', path: p, size: stat.size, kind: 'text', data: buf.value.toString() });
			}
		} catch (e) {
			this.post({ type: 'preview', path: p, error: String(e instanceof Error ? e.message : e) });
		}
	}

	private async statPath(msg: ISearchMsg): Promise<void> {
		let dir = false;
		try {
			const s = await this.services.fileService.resolve(URI.file(msg.path!), { resolveMetadata: true });
			dir = s.isDirectory;
		} catch { /* introuvable */ }
		this.post({ type: 'stat', path: msg.path, dir });
	}

	dispose(): void {
		this.disposed = true;
		this.lastSearchController?.abort();
		this.disposables.dispose();
	}
}

/**
 * Vue « Recherche » (barre d'activité gauche) : héberge la webview search-ext
 * complète via un overlay qui survit aux bascules de visibilité.
 */
export class HephaistosSearchViewPane extends ViewPane {

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
		@IFileService private readonly fileService: IFileService,
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IStorageService private readonly storageService: IStorageService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@INativeEnvironmentService private readonly envService: INativeEnvironmentService,
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
		container.setAttribute('aria-label', localize('hephaistos.searchView.aria', 'Recherche Everything'));
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
		HephaistosSearchHost.attach(webview, {
			fileService: this.fileService,
			editorService: this.editorService,
			commandService: this.commandService,
			clipboardService: this.clipboardService,
			nativeHostService: this.nativeHostService,
			storageService: this.storageService,
			workspaceService: this.workspaceService,
			envService: this.envService,
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

