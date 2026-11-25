/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewDescriptor, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { HephaistosChatEditor, HephaistosChatEditorInput, HephaistosChatEditorSerializer } from './hephaistosChatEditor.js';
import { HephaistosChatPanel } from './hephaistosChatPanel.js';
import { HEPHAISTOS_HOME_VIEW_ID, HephaistosHomeViewPane } from './hephaistosHomeView.js';
import { HEPHAISTOS_CHAT_VIEW_ID, HephaistosChatViewPane } from './hephaistosChatView.js';
import { HephaistosWorkspacePanel } from './hephaistosWorkspacePanel.js';
import { HephaistosOrchestratorPanel } from './hephaistosOrchestratorPanel.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INativeEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { HEPHAISTOS_SEARCH_VIEW_ID, HephaistosSearchViewPane } from './hephaistosSearchView.js';
import { HEPHAISTOS_POSTDEV_VIEW_ID, HephaistosPostdevHost, HephaistosPostdevViewPane } from './hephaistosPostdevView.js';
import { HEPHAISTOS_CLI_AGENTS, HEPHAISTOS_PROVIDERS, ICliAgent } from './hephaistosProviders.js';

// --- Éditeur de chat natif --------------------------------------------------

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(HephaistosChatEditor, HephaistosChatEditor.ID, localize('hephaistosChat', "Hephaistos Chat")),
	[new SyncDescriptor(HephaistosChatEditorInput)]
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(
	HephaistosChatEditorInput.ID, HephaistosChatEditorSerializer
);

// --- Commandes ----------------------------------------------------------------

const NEW_PROVIDER_CHAT = 'hephaistos.newProviderChat';
const NEW_CLI_CHAT = 'hephaistos.newCliChat';

async function pickModel(quickInput: IQuickInputService, label: string, models: readonly string[]): Promise<string | undefined> {
	const CUSTOM = localize('hephaistos.customModel', "Saisir un modèle…");
	const pick = await quickInput.pick(
		[...models.map(m => ({ label: m })), { label: CUSTOM }],
		{ placeHolder: localize('hephaistos.pickModel', "Choisir le modèle pour {0}", label) }
	);
	if (!pick) {
		return undefined;
	}
	if (pick.label === CUSTOM) {
		return await quickInput.input({ placeHolder: localize('hephaistos.modelName', "Nom exact du modèle"), prompt: label });
	}
	return pick.label;
}

class NewProviderChatAction extends Action2 {
	constructor() {
		super({
			id: NEW_PROVIDER_CHAT,
			title: localize2('hephaistos.newProviderChat', "Hephaistos : nouveau chat fournisseur"),
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const storageService = accessor.get(IStorageService);
		const webviewWorkbenchService = accessor.get(IWebviewWorkbenchService);
		const quickInput = accessor.get(IQuickInputService);
		const terminalService = accessor.get(ITerminalService);
		const pick = await quickInput.pick(
			HEPHAISTOS_PROVIDERS.map(p => ({ label: p.label, description: p.id, provider: p })),
			{ placeHolder: localize('hephaistos.pickProvider', "Choisir le fournisseur du nouveau chat") }
		);
		HephaistosChatPanel.create(storageService, webviewWorkbenchService, terminalService, pick?.provider.id);
	}
}

class NewCliChatAction extends Action2 {
	constructor() {
		super({
			id: NEW_CLI_CHAT,
			title: localize2('hephaistos.newCliChat', "Hephaistos : nouveau chat agent CLI"),
			f1: true,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInput = accessor.get(IQuickInputService);
		const terminalService = accessor.get(ITerminalService);

		const agentPick = await quickInput.pick(
			HEPHAISTOS_CLI_AGENTS.map(a => ({ label: a.label, description: a.command, agent: a })),
			{ placeHolder: localize('hephaistos.pickAgent', "Choisir l'agent CLI") }
		);
		const agent: ICliAgent | undefined = agentPick?.agent;
		if (!agent) {
			return;
		}
		const model = await pickModel(quickInput, agent.label, agent.models);
		if (!model) {
			return;
		}

		const terminal = await terminalService.createTerminal({ config: { name: `Chat : ${agent.label}${model !== 'default' ? ` · ${model}` : ''}` } });
		terminal.focus();
		const useFlag = agent.modelFlag && model !== 'default';
		terminal.sendText(useFlag ? `${agent.command} ${agent.modelFlag!(model)}` : agent.command, true);
		if (!agent.modelFlag && model !== 'default') {
			// le TUI gère la sélection via sa commande interne /model
			setTimeout(() => terminal.sendText(`/model ${model}`, true), 2500);
		}
	}
}

registerAction2(NewProviderChatAction);
registerAction2(NewCliChatAction);

// Bouton « + » dans le titre de la vue chat ancrée à droite
class NewDockedChatAction extends Action2 {
	constructor() {
		super({
			id: 'hephaistos.newDockedChat',
			title: localize2('hephaistos.newDockedChat', "Nouveau chat"),
			icon: Codicon.plus,
			f1: true,
			menu: [{
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', 'hephaistos.chatView'),
				group: 'navigation',
				order: 0,
			}],
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const storageService = accessor.get(IStorageService);
		const quickInput = accessor.get(IQuickInputService);
		const webviewWorkbenchService = accessor.get(IWebviewWorkbenchService);
		const terminalService = accessor.get(ITerminalService);
		const pick = await quickInput.pick(
			HEPHAISTOS_PROVIDERS.map(p => ({ label: p.label, description: p.id, provider: p })),
			{ placeHolder: localize('hephaistos.pickProvider', "Choisir le fournisseur du nouveau chat") }
		);
		if (!pick) {
			return;
		}
		HephaistosChatPanel.create(storageService, webviewWorkbenchService, terminalService, pick.provider.id);
	}
}
registerAction2(NewDockedChatAction);

// Bouton « × » : ferme la vue chat (re-ouvrable par l'icône de la barre droite)
class CloseChatViewAction extends Action2 {
	constructor() {
		super({
			id: 'hephaistos.closeChatView',
			title: localize2('hephaistos.closeChatView', "Fermer le chat"),
			icon: Codicon.close,
			f1: false,
			menu: [{
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', 'hephaistos.chatView'),
				group: 'navigation',
				order: 100,
			}],
		});
	}
	run(accessor: ServicesAccessor): void {
		accessor.get(IViewsService).closeView('hephaistos.chatView');
	}
}
registerAction2(CloseChatViewAction);

// --- Vue « Recherche » Hephaistos (conteneur activité) -------------------------

const HEPHAISTOS_VIEW_CONTAINER = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: 'workbench.view.hephaistos',
	title: localize2('hephaistosView', "Hephaistos"),
	icon: Codicon.flame,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['workbench.view.hephaistos', { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: false,
}, ViewContainerLocation.Sidebar);

const searchViewDescriptor: IViewDescriptor = {
	id: HEPHAISTOS_SEARCH_VIEW_ID,
	name: localize2('hephaistosSearch', "Recherche"),
	ctorDescriptor: new SyncDescriptor(HephaistosSearchViewPane),
	canToggleVisibility: false,
	canMoveView: true,
};

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([searchViewDescriptor], HEPHAISTOS_VIEW_CONTAINER);

// --- Barre d'icônes fixe à droite (AuxiliaryBar) -------------------------------

const HEPHAISTOS_AUX_CONTAINER = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: 'workbench.view.hephaistos.aux',
	title: localize2('hephaistosAux', "Hephaistos"),
	icon: Codicon.flame,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['workbench.view.hephaistos.aux', { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: false,
}, ViewContainerLocation.AuxiliaryBar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: HEPHAISTOS_HOME_VIEW_ID,
	name: localize2('hephaistosHome', "Hephaistos"),
	ctorDescriptor: new SyncDescriptor(HephaistosHomeViewPane),
	canToggleVisibility: false,
	canMoveView: false,
}], HEPHAISTOS_AUX_CONTAINER);

// Icône fixe « Hephaistos Chat » dans la barre latérale secondaire
const HEPHAISTOS_CHAT_CONTAINER = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: 'workbench.view.hephaistos.chat',
	title: localize2('hephaistosChatContainer', "Hephaistos Chat"),
	icon: Codicon.commentDiscussion,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['workbench.view.hephaistos.chat', { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: false,
	order: 0,
}, ViewContainerLocation.AuxiliaryBar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: HEPHAISTOS_CHAT_VIEW_ID,
	name: localize2('hephaistosChatViewName', "Chat"),
	ctorDescriptor: new SyncDescriptor(HephaistosChatViewPane),
	canToggleVisibility: true,
	canMoveView: true,
}], HEPHAISTOS_CHAT_CONTAINER);

// Icône fixe « PostDev » (post-its du kit) dans la barre latérale secondaire
const HEPHAISTOS_POSTDEV_CONTAINER = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry).registerViewContainer({
	id: 'workbench.view.hephaistos.postdev',
	title: localize2('hephaistosPostdev', "PostDev"),
	icon: Codicon.note,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, ['workbench.view.hephaistos.postdev', { mergeViewWithContainerWhenSingleView: true }]),
	hideIfEmpty: false,
	order: 1,
}, ViewContainerLocation.AuxiliaryBar);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: HEPHAISTOS_POSTDEV_VIEW_ID,
	name: localize2('hephaistosPostdevViewName', "Post-its"),
	ctorDescriptor: new SyncDescriptor(HephaistosPostdevViewPane),
	canToggleVisibility: false,
	canMoveView: true,
}], HEPHAISTOS_POSTDEV_CONTAINER);

// --- Commandes placeholder ----------------------------------------------------

class SwatWorkspaceAction extends Action2 {
	constructor() {
		super({ id: 'hephaistos.openSwatWorkspace', title: localize2('hephaistos.swat', "Hephaistos : espace de travail SWAT"), f1: true });
	}
	run(accessor: ServicesAccessor): void {
		HephaistosWorkspacePanel.open(accessor.get(IStorageService), accessor.get(IFileService), accessor.get(INotificationService), accessor.get(IWebviewWorkbenchService), accessor.get(INativeEnvironmentService), accessor.get(IViewsService));
	}
}

class OrchestratorAction extends Action2 {
	constructor() {
		super({ id: 'hephaistos.focusOrchestrator', title: localize2('hephaistos.orch', "Hephaistos : orchestrateur"), f1: true });
	}
	run(accessor: ServicesAccessor): void {
		HephaistosOrchestratorPanel.open(
			accessor.get(IFileService),
			accessor.get(IEditorService),
			accessor.get(INotificationService),
			accessor.get(IWorkspaceContextService),
			accessor.get(IWebviewWorkbenchService),
		);
	}
}

registerAction2(SwatWorkspaceAction);
registerAction2(OrchestratorAction);

// --- Commandes PostDev (kit) --------------------------------------------------

class PostdevCaptureAction extends Action2 {
	constructor() {
		super({ id: 'hephaistos.postdev.capture', title: localize2('hephaistos.postdevCapture', "PostDev : capturer la sélection en post-it"), f1: true });
	}
	run(): void {
		HephaistosPostdevHost.active?.captureActiveSelection();
	}
}

class PostdevNewNoteAction extends Action2 {
	constructor() {
		super({ id: 'hephaistos.postdev.newNote', title: localize2('hephaistos.postdevNew', "PostDev : nouveau post-it"), f1: true });
	}
	run(): void {
		HephaistosPostdevHost.active?.createNewNote();
	}
}

class PostdevClearAction extends Action2 {
	constructor() {
		super({ id: 'hephaistos.postdev.clearAll', title: localize2('hephaistos.postdevClear', "PostDev : effacer tous les post-its"), f1: true });
	}
	run(): void {
		HephaistosPostdevHost.active?.clearAllNotes();
	}
}

registerAction2(PostdevCaptureAction);
registerAction2(PostdevNewNoteAction);
registerAction2(PostdevClearAction);

// --- Menu « Hephaistos » de la barre de titre ---------------------------------

const MENUBAR_HEPHAISTOS = new MenuId('MenubarHephaistosMenu');

MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: MENUBAR_HEPHAISTOS,
	title: {
		...localize2('hephaistosMenu', "Hephaistos"),
		mnemonicTitle: localize({ key: 'mHephaistos', comment: ['&& denotes a mnemonic'] }, "&&Hephaistos"),
	},
	order: 7,
});

MenuRegistry.appendMenuItem(MENUBAR_HEPHAISTOS, {
	group: 'navigation',
	order: 1,
	command: {
		id: NEW_PROVIDER_CHAT,
		title: localize('hephaistos.miNewProviderChat', "Nouveau &&Chat Fournisseur…"),
	},
});

MenuRegistry.appendMenuItem(MENUBAR_HEPHAISTOS, {
	group: 'navigation',
	order: 2,
	command: {
		id: NEW_CLI_CHAT,
		title: localize('hephaistos.miNewCliChat', "Nouveau Chat Agent &&CLI…"),
	},
});

MenuRegistry.appendMenuItem(MENUBAR_HEPHAISTOS, {
	group: 'navigation',
	order: 3,
	command: {
		id: 'hephaistos.openSwatWorkspace',
		title: localize('hephaistos.miSwat', "Espace de &&Travail SWAT"),
	},
});

MenuRegistry.appendMenuItem(MENUBAR_HEPHAISTOS, {
	group: 'navigation',
	order: 4,
	command: {
		id: `${HEPHAISTOS_VIEW_CONTAINER.id}`,
		title: localize('hephaistos.miSearch', "Ouvrir la &&Recherche Everything"),
	},
});

MenuRegistry.appendMenuItem(MENUBAR_HEPHAISTOS, {
	group: 'navigation',
	order: 5,
	command: {
		id: 'hephaistos.focusOrchestrator',
		title: localize('hephaistos.miOrch', "&&Orchestrateur"),
	},
});

MenuRegistry.appendMenuItem(MENUBAR_HEPHAISTOS, {
	group: 'navigation',
	order: 6,
	command: {
		id: 'hephaistos.postdev.capture',
		title: localize('hephaistos.miPostdev', "PostDev : capturer la &&sélection"),
	},
});
