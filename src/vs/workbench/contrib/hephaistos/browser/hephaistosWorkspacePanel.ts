/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { FileAccess } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { joinPath } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { asWebviewUri } from '../../webview/common/webview.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { ACTIVE_GROUP } from '../../../services/editor/common/editorService.js';
import { AGENT_ICON_FILES } from './media/agentIconManifest.js';
import { HEPHAISTOS_PROVIDERS } from './hephaistosProviders.js';
import { HephaistosChatPanel } from './hephaistosChatPanel.js';

const GRAPH_KEY = 'hephaistos.swat.graph';
const DEFAULT_ICON_THEME = 'commando';

interface IGraph { version: 1; name: string; entrySessionId: string | null; nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }

function emptyGraph(): IGraph {
	return { version: 1, name: 'SWAT', entrySessionId: null, nodes: [], edges: [] };
}

export class HephaistosWorkspacePanel {

	private static current: HephaistosWorkspacePanel | undefined;
	private graph: IGraph;

	private constructor(
		private readonly input: ReturnType<IWebviewWorkbenchService['openWebview']>,
		private readonly storageService: IStorageService,
		private readonly fileService: IFileService,
		private readonly notificationService: INotificationService,
		private readonly viewsService: IViewsService,
		private readonly schemasUri: URI,
	) {
		try {
			this.graph = { ...emptyGraph(), ...JSON.parse(storageService.get(GRAPH_KEY, StorageScope.PROFILE, '{}')) };
		} catch {
			this.graph = emptyGraph();
		}
		input.webview.onMessage(e => { void this.onMessage(e.message as { type?: string; [k: string]: unknown }); });
		Event.once(input.webview.onDidDispose)(() => { if (HephaistosWorkspacePanel.current === this) { HephaistosWorkspacePanel.current = undefined; } });
		this.render();
	}

	static open(storageService: IStorageService, fileService: IFileService, notificationService: INotificationService, webviewWorkbenchService: IWebviewWorkbenchService, environmentService: INativeEnvironmentService, viewsService: IViewsService): void {
		if (HephaistosWorkspacePanel.current) {
			webviewWorkbenchService.revealWebview(HephaistosWorkspacePanel.current.input, ACTIVE_GROUP, false);
			HephaistosWorkspacePanel.current.push();
			return;
		}
		const input = webviewWorkbenchService.openWebview(
			{
				title: localize('hephaistos.swatTitle', "Espace de travail Hephaistos"),
				options: { enableFindWidget: true, retainContextWhenHidden: true },
				contentOptions: {
					allowScripts: true,
					localResourceRoots: [FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media')],
				},
				extension: undefined,
			},
			'hephaistosSwatWorkspace',
			localize('hephaistos.swatTitle', "Espace de travail"),
			undefined,
			{ group: ACTIVE_GROUP, preserveFocus: false },
		);
		HephaistosWorkspacePanel.current = new HephaistosWorkspacePanel(input, storageService, fileService, notificationService, viewsService, joinPath(environmentService.userHome, '.hephaistos-workflow-schemas.json'));
	}

	private render(): void {
		const media = FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media');
		const nonce = Math.random().toString(36).slice(2);
		const scriptUri = asWebviewUri(URI.joinPath(media, 'workspace.js'));
		const styleUri = asWebviewUri(URI.joinPath(media, 'workspace.css'));
		const agentsUri = asWebviewUri(URI.joinPath(media, 'agents', DEFAULT_ICON_THEME));
		const icons = AGENT_ICON_FILES[DEFAULT_ICON_THEME] ?? [];
		this.input.webview.setHtml(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: data: http: https:; style-src vscode-resource: 'unsafe-inline'; font-src vscode-resource: data:; script-src vscode-resource: 'nonce-${nonce}'; frame-src http://127.0.0.1:* http://localhost:*; connect-src vscode-resource: http://127.0.0.1:* http://localhost:*;">
  <link rel="stylesheet" href="${styleUri}">
  <title>Espace de travail Hephaistos</title>
</head>
<body>
  <div id="root">
    <div class="workspace-boot" role="status">
      <strong>Hephaistos · Espace de travail</strong>
      <span>Chargement du canvas React Flow…</span>
    </div>
  </div>
  <script nonce="${nonce}">
        window.__agentsUri = "${agentsUri}";
        window.__agentsFallbackUri = "${agentsUri}";
        window.__agentIcons = ${JSON.stringify(icons)};
        window.__agentsFallbackIcons = ${JSON.stringify(icons)};
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`);
	}

	private workflowView(): object {
		const sessions = HephaistosChatPanel.listSessions(this.storageService);
		const byId = new Map(sessions.map(s => [s.id, s]));
		const nodes = this.graph.nodes.map(n => {
			const session = byId.get(String(n.sessionId));
			const kind = String(n.cardKind ?? (session ? 'devin' : 'bleubite'));
			return {
				...n, id: n.sessionId, type: 'agent',
				data: {
					sessionId: n.sessionId,
					title: session?.title ?? n.title ?? n.role ?? String(n.sessionId).split('/').pop(),
					kind, cardKind: n.cardKind, provider: session?.provider ?? n.provider,
					model: session?.model ?? '', role: n.role, task: n.task,
					skills: n.skills ?? [], bound: n.bound, mcps: n.mcps ?? [],
					external: !session, isEntry: n.sessionId === this.graph.entrySessionId,
					tone: kind === 'agy' ? 'blue' : kind === 'devin' ? 'amber' : 'green',
				},
			};
		});
		const visibleIds = new Set(nodes.map(n => n.id));
		return {
			graph: { ...this.graph },
			nodes,
			edges: this.graph.edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target)),
			catalog: {
				roles: ['coordonnateur', 'codeur', 'testeur', 'auditeur', 'architecte'],
				skills: [],
				providers: HEPHAISTOS_PROVIDERS.map(p => ({ id: p.id, label: p.label })),
				agents: sessions.map(s => ({ sessionId: s.id, title: s.title, role: 'agent', provider: s.provider, model: s.model })),
			},
		};
	}

	private push(): void {
		void this.input.webview.postMessage({ type: 'workflow_state', workflow: this.workflowView() });
	}

	private save(): void {
		this.storageService.store(GRAPH_KEY, JSON.stringify(this.graph), StorageScope.PROFILE, StorageTarget.MACHINE);
	}

	private async schemas(): Promise<unknown[]> {
		try {
			const raw = await this.fileService.readFile(this.schemasUri);
			return (JSON.parse(raw.value.toString()) as { schemas?: unknown[] }).schemas ?? [];
		} catch {
			return [];
		}
	}

	private async writeSchemas(schemas: unknown[]): Promise<void> {
		await this.fileService.writeFile(this.schemasUri, VSBuffer.fromString(JSON.stringify({ schemas }, null, 2)));
	}

	private async onMessage(message: { type?: string; [k: string]: unknown }): Promise<void> {
		switch (message.type) {
			case 'ready':
			case 'refresh_state':
				this.push();
				return;
			case 'workflow_change':
				if (message.graph && typeof message.graph === 'object') {
					this.graph = { ...this.graph, ...(message.graph as IGraph), version: 1 };
					this.save();
				}
				return;
			case 'schemas_list':
				void this.input.webview.postMessage({ type: 'schemas_state', schemas: await this.schemas() });
				return;
			case 'schema_save': case 'schema_create': {
				const name = String(message.name ?? 'schema');
				const schemas = await this.schemas() as { id?: string; name?: string }[];
				const schema = { id: `schema-${Date.now().toString(36)}`, name, graph: this.graph };
				const i = schemas.findIndex(s => s.name === name);
				if (i >= 0) { schemas[i] = schema; } else { schemas.push(schema); }
				await this.writeSchemas(schemas);
				void this.input.webview.postMessage({ type: 'schemas_state', schemas });
				return;
			}
			case 'schema_load': {
				const schemas = await this.schemas() as { id?: string; graph?: IGraph }[];
				const found = schemas.find(s => s.id === message.id);
				if (found?.graph) {
					this.graph = { ...emptyGraph(), ...found.graph, version: 1 };
					this.save();
					this.push();
				}
				return;
			}
			case 'schema_delete': {
				const schemas = (await this.schemas() as { id?: string }[]).filter(s => s.id !== message.id);
				await this.writeSchemas(schemas);
				void this.input.webview.postMessage({ type: 'schemas_state', schemas });
				return;
			}
			case 'add_agent':
				this.addAgent(message);
				return;
			case 'open_agent':
				await this.openAgent(message);
				return;
			case 'remove_agent': {
				const sid = String(message.sessionId ?? '');
				this.graph.nodes = this.graph.nodes.filter(n => String(n.sessionId) !== sid);
				this.graph.edges = this.graph.edges.filter(e => String(e.source) !== sid && String(e.target) !== sid);
				this.save();
				this.push();
				return;
			}
			case 'add_card':
			case 'add_svc':
			case 'assign_agent':
			case 'bind_active':
			case 'run_workflow':
			case 'point_agent':
				this.notificationService.info(localize('hephaistos.swatWip', "SWAT : orchestration des agents en cours de port natif ({0})", String(message.type)));
				return;
			default:
				return;
		}
	}

	private addAgent(message: { provider?: unknown; role?: unknown; agent?: unknown; [k: string]: unknown }): void {
		const agent = message.agent as { sessionId?: string; provider?: string; role?: string; title?: string } | undefined;
		const free = { x: 120 + this.graph.nodes.length * 60, y: 120 + this.graph.nodes.length * 40 };
		if (agent?.sessionId) {
			if (!this.graph.nodes.some(n => String(n.sessionId) === agent.sessionId)) {
				this.graph.nodes.push({ sessionId: agent.sessionId, role: agent.role ?? 'agent', task: '', skills: [], title: agent.title, provider: agent.provider, position: free });
			}
			this.save();
			this.push();
			return;
		}
		const provider = String(message.provider ?? 'omniroute');
		if (provider.startsWith('svc-')) {
			this.graph.nodes.push({ sessionId: `svc-${Date.now().toString(36)}`, role: String(message.role ?? provider), task: '', skills: [], title: provider, provider, cardKind: 'svc', position: free });
			this.save();
			this.push();
			return;
		}
		const session = HephaistosChatPanel.createSession(provider, this.storageService);
		this.graph.nodes.push({ sessionId: session.id, role: String(message.role ?? 'agent'), task: '', skills: [], title: session.title, provider: session.provider, cardKind: session.provider === 'agy' ? 'agy' : 'devin', position: free });
		this.save();
		this.push();
		this.notificationService.info(localize('hephaistos.swatAgentCreated', "Agent {0} créé — chat disponible dans « Hephaistos Chat »", session.title));
	}

	private async openAgent(message: { sessionId?: unknown; [k: string]: unknown }): Promise<void> {
		const sid = String(message.sessionId ?? '');
		if (!sid) { return; }
		HephaistosChatPanel.focusSession(sid, this.storageService);
		await this.viewsService.openViewContainer('workbench.view.hephaistos.chat', true);
	}
}
