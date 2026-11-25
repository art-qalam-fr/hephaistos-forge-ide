/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { joinPath } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { getPanelHtml } from './hephaistosOrchHtml.js';

const WS_URL = 'ws://127.0.0.1:7477';

/** Moniteur Orchestrateur natif : webview du kit + relais WebSocket vers ws://127.0.0.1:7477. */
export class HephaistosOrchestratorPanel {

	private static current: HephaistosOrchestratorPanel | undefined;

	private ws: WebSocket | undefined;
	private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
	private disposed = false;

	private constructor(
		private readonly input: ReturnType<IWebviewWorkbenchService['openWebview']>,
		private readonly fileService: IFileService,
		private readonly editorService: IEditorService,
		private readonly notificationService: INotificationService,
		private readonly workspaceContextService: IWorkspaceContextService,
	) {
		input.webview.onMessage(e => { void this.onMessage(e.message as { command?: string; [k: string]: unknown }); });
		Event.once(input.webview.onDidDispose)(() => {
			this.disposed = true;
			this.closeWs();
			if (HephaistosOrchestratorPanel.current === this) {
				HephaistosOrchestratorPanel.current = undefined;
			}
		});
		this.render();
	}

	static open(
		fileService: IFileService,
		editorService: IEditorService,
		notificationService: INotificationService,
		workspaceContextService: IWorkspaceContextService,
		webviewWorkbenchService: IWebviewWorkbenchService,
	): void {
		if (HephaistosOrchestratorPanel.current) {
			webviewWorkbenchService.revealWebview(HephaistosOrchestratorPanel.current.input, ACTIVE_GROUP, false);
			return;
		}
		const input = webviewWorkbenchService.openWebview(
			{
				title: localize('hephaistos.orchTitle', "Orchestrateur Hephaistos"),
				options: { enableFindWidget: true, retainContextWhenHidden: true },
				contentOptions: {
					allowScripts: true,
					localResourceRoots: [FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media')],
				},
				extension: undefined,
			},
			'hephaistosOrchestrator',
			localize('hephaistos.orchTitle', "Orchestrateur"),
			undefined,
			{ group: ACTIVE_GROUP, preserveFocus: false },
		);
		HephaistosOrchestratorPanel.current = new HephaistosOrchestratorPanel(input, fileService, editorService, notificationService, workspaceContextService);
	}

	private render(): void {
		const media = FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media');
		this.input.webview.setHtml(getPanelHtml('vscode-resource: https: data:', media));
	}

	private post(message: unknown): void {
		if (!this.disposed) {
			void this.input.webview.postMessage(message);
		}
	}

	private async wsUrl(): Promise<string> {
		let token = '';
		const folder = this.workspaceContextService.getWorkspace().folders[0]?.uri;
		if (folder) {
			try {
				const raw = await this.fileService.readFile(joinPath(folder, '.agent', 'ws-bridge.token'));
				token = raw.value.toString().trim();
			} catch { /* token absent */ }
		}
		const params = new URLSearchParams();
		if (token) {
			params.set('token', token);
		}
		params.set('idePid', String(Date.now() % 100000));
		return `${WS_URL}?${params}`;
	}

	private async connectWs(): Promise<void> {
		if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
			return;
		}
		try {
			this.ws = new WebSocket(await this.wsUrl());
		} catch {
			this.post({ type: 'ws_status', connected: false });
			this.scheduleReconnect();
			return;
		}
		this.ws.onopen = () => {
			this.post({ type: 'ws_status', connected: true });
			this.ws?.send(JSON.stringify({ command: 'refresh' }));
		};
		this.ws.onmessage = e => {
			try { this.post(JSON.parse(String(e.data))); } catch { /* trame invalide */ }
		};
		this.ws.onclose = () => {
			this.post({ type: 'ws_status', connected: false });
			this.scheduleReconnect();
		};
		this.ws.onerror = () => { /* close suivra */ };
	}

	private scheduleReconnect(): void {
		if (this.disposed || this.reconnectTimer) {
			return;
		}
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = undefined;
			void this.connectWs();
		}, 5000);
	}

	private closeWs(): void {
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = undefined;
		}
		this.ws?.close();
		this.ws = undefined;
	}

	private async onMessage(message: { command?: string; [k: string]: unknown }): Promise<void> {
		switch (message.command) {
			case 'ready':
				await this.connectWs();
				return;
			case 'openFile':
				if (typeof message.path === 'string') {
					await this.editorService.openEditor({ resource: URI.file(message.path) });
				}
				return;
			case 'restart_bridge':
				this.notificationService.info(localize('hephaistos.orchRestart', "Redémarrage du bridge : lance-le depuis le kit (ws-bridge)"));
				return;
			case 'open_full_panel':
			case 'dispose':
				return;
			default:
				// refresh, delete_task, clear_tasks, provider_toggle, provider_order,
				// comms-clear, send_to_chat … : relayé tel quel au bridge WS.
				if (this.ws?.readyState === WebSocket.OPEN) {
					this.ws.send(JSON.stringify(message));
				} else {
					await this.connectWs();
				}
		}
	}
}
