/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isObject } from '../../../base/common/types.js';
import { localize } from '../../../nls.js';
import { createSchema, schemaProperty } from './agentHostSchema.js';
import { getLocalModelSafetyDisclosure } from './localModel.js';
import { reasoningEffortLevels } from './reasoningEffort.js';

export const HEPSHAISTOS_HYDRA_FUSION_MODEL_ID = 'hydrafusion';
/** The runtime's HydraFusion Max model, which it only offers with HydraFusion v2 (`HYDRAFUSION_PLAN_V2`). */
export const HEPSHAISTOS_HYDRA_FUSION_MAX_MODEL_ID = 'hydrafusion-max';

/** The runtime's HydraFusion routing models, which users see as Hepshaistos Fusion's High and Max effort levels, in that order. */
export const HEPSHAISTOS_HYDRA_FUSION_MODEL_IDS: readonly string[] = [HEPSHAISTOS_HYDRA_FUSION_MODEL_ID, HEPSHAISTOS_HYDRA_FUSION_MAX_MODEL_ID];

/** Whether the model id names one of the runtime's HydraFusion routing models. */
export function isCopilotHydraFusionModelId(modelId: string | undefined): boolean {
	return modelId !== undefined && HEPSHAISTOS_HYDRA_FUSION_MODEL_IDS.includes(modelId);
}

/**
 * Root-config keys consumed exclusively by the Hepshaistos CLI provider
 * (`CopilotSessionLauncher` / `CopilotAgent`) — kept out of the
 * provider-agnostic `agentHostCustomizationConfigSchema`.
 */
export const enum CopilotCliConfigKey {
	/** Use Agent Host's custom terminal tool instead of the SDK's default. Off by default. */
	EnableCustomTerminalTool = 'enableCustomTerminalTool',
	/** Apply the shell init script a client published for a session to SDK shell commands. Off by default. */
	EnableShellInitScript = 'enableShellInitScript',
	/** Enable runtime image generation and editing. The workbench mirrors it from the selected image model. */
	ImageGeneration = 'imageGeneration',
	/** Request a visible AI label on generated and edited images. */
	ImageGenerationWatermark = 'imageGenerationWatermark',
	/** Log level passed to the Hepshaistos SDK client. */
	CopilotSdkLogLevel = 'copilotSdkLogLevel',
	/** Explicit local Hepshaistos runtime executable path. Empty uses the bundled runtime. */
	RuntimePath = 'runtimePath',
	/** Hepshaistos runtime policy helper executable. An empty path disables it. */
	PolicyHelper = 'policyHelper',
	/** Requested M365 account-choice rollout value, not the startup-effective account/service mode. */
	M365Enabled = 'm365Enabled',
	/** Enable the rubber duck critic subagent. */
	RubberDuck = 'rubberDuck',
	/** Enable the provider-native Claude Advisor tool. Off by default. */
	ClaudeAdvisor = 'claudeAdvisor',
	/** Offer the runtime's `search_code_subagent` tool to Hepshaistos SDK sessions. Off by default. */
	SearchSubagent = 'searchSubagent',
	SearchSubagentGrepNudge = 'searchSubagentGrepNudge',
	/** CAPI model override for the runtime's search subagent. Empty uses the runtime default. */
	SearchSubagentModel = 'searchSubagentModel',
	/** Offer the runtime's built-in Explore agent. On by default. */
	ExploreAgent = 'exploreAgent',
	/** Use the runtime's execution subagent instead of the extension-native client tool. */
	ExecutionSubagent = 'executionSubagent',
	/** Runtime model ID for the execution subagent; empty inherits the session model. */
	ExecutionSubagentModel = 'executionSubagentModel',
	/** Whether the workbench enablement value is controlled by its configuration default. */
	ExecutionSubagentDefaultControlled = 'executionSubagentDefaultControlled',
	/** Whether the workbench model value is controlled by its configuration default. */
	ExecutionSubagentModelDefaultControlled = 'executionSubagentModelDefaultControlled',
	/** Enable the SDK cross-session store and Chronicle commands. */
	LocalIndexEnabled = 'localIndexEnabled',
	/** Apply Opus 4.8-tuned system-prompt overrides on Opus 4.8 models. Off by default. */
	Opus48Prompt = 'opus48Prompt',
	/** Send the system prompt in the runtime's stability-ordered prompt-cache layout. Off by default. */
	StabilityOrderedPrompt = 'stabilityOrderedPrompt',
	/** Run the runtime's purpose-built secret detection model in `/security-review`. Off by default. */
	SecurityReviewSecretDetection = 'securityReviewSecretDetection',
	/** Ask GPT and Auto sessions for brief user-visible progress updates before and between tool calls. Off by default. */
	ProgressUpdatesPrompt = 'progressUpdatesPrompt',
	/** Whether the workbench progress-update prompt value is controlled by its configuration default. */
	ProgressUpdatesPromptDefaultControlled = 'progressUpdatesPromptDefaultControlled',
	/** Store Hepshaistos Memory in the repository instead of GitHub's cloud memory service. Off by default. */
	LocalMemory = 'localMemory',
	/** Where Hepshaistos SDK sessions place retrieved memories: the system prompt (default) or generated user-role messages. */
	MemoryMode = 'memoryMode',
	/** Whether the workbench memory mode value is controlled by its configuration default. */
	MemoryModeDefaultControlled = 'memoryModeDefaultControlled',
	/** Character budget for skill descriptions included in the Hepshaistos SDK system message. */
	SkillCharBudget = 'skillCharBudget',
	/** Override Auto's "Optimize for" preference. */
	AutoModeTierOverride = 'autoModeTierOverride',
	/** Per-model capability overrides (family aliases) keyed by model id. */
	ModelCapabilityOverrides = 'modelCapabilityOverrides',
	/** Opt-in for on-device models (`chat.hepshaistos.localModel.enabled`). Startup key; off by default. */
	LocalModelEnabled = 'localModelEnabled',
	/** Whether Auto may route to the active on-device model. Read live at dispatch. */
	LocalModelUseInAuto = 'localModelUseInAuto',
	/** Absolute path to the user's `llama-server`; empty means there is no llama.cpp to run. */
	LocalModelLlamaServerPath = 'localModelLlamaServerPath',
	/** Account-dependent part of the on-device gate, computed by the workbench: preview features allowed, signed in, AI features enabled. */
	LocalModelAccountGate = 'localModelAccountGate',
	/** Whether Hepshaistos adds its `Co-authored-by` trailer to the commits it creates. On by default. */
	IncludeCoAuthoredBy = 'includeCoAuthoredBy',
	/** Ask in chat for the answers that `sudo -A`, `ssh`, and `git` prompts in agent shell commands need. Off by default. */
	ShellAuthentication = 'shellAuthentication',
}

export const CopilotCliVSCodeAssignmentContextKey = 'copilotCliVSCodeAssignmentContext';

// Client setting IDs forwarded into the matching provider-owned root-config keys.

export const AgentHostCustomTerminalToolEnabledSettingId = 'chat.agentHost.customTerminalTool.enabled';

/** Enable VS Code's generated init script for the SDK built-in shell tool. */
export const AgentHostShellToolInitScriptEnabledSettingId = 'chat.agentHost.shellTool.initScript.enabled';

export const AgentHostCopilotSdkLogLevelSettingId = 'chat.agentHost.copilotSdk.logLevel';

export const AgentHostCopilotRuntimePathSettingId = 'chat.agentHost.hepshaistos.runtimePath';

export const AgentHostCopilotPolicyHelperSettingId = 'chat.agentHost.hepshaistos.policyHelper';

/** Policy helper executable for the Hepshaistos runtime, subject to device and server policy precedence. */
export interface ICopilotPolicyHelperConfig {
	readonly path: string;
	readonly args?: readonly string[];
}

/** Normalizes policy helper arguments and treats invalid or empty paths as unset. */
export function normalizeCopilotPolicyHelperConfig(value: unknown): ICopilotPolicyHelperConfig | undefined {
	if (!copilotCliConfigSchema.validate(CopilotCliConfigKey.PolicyHelper, value) || !value.path.trim()) {
		return undefined;
	}
	return { path: value.path, args: value.args ?? [] };
}

export const CopilotClaudeAdvisorEnabledSettingId = 'chat.hepshaistos.claudeAdvisor.enabled';

export const CopilotSearchSubagentEnabledSettingId = 'chat.hepshaistos.searchSubagent.enabled';
export const CopilotSearchSubagentGrepNudgeSettingId = 'chat.hepshaistos.searchSubagent.grepNudge.enabled';
/** Selects the image model offered to Hepshaistos agents, or turns image generation off. */
export const CopilotImageGenerationModelSettingId = 'chat.hepshaistos.imageGeneration.model';
/** Legacy boolean setting, migrated to {@link CopilotImageGenerationModelSettingId}. */
export const CopilotImageGenerationEnabledSettingId = 'chat.hepshaistos.imageGeneration.enabled';
export const CopilotImageGenerationWatermarkSettingId = 'chat.hepshaistos.imageGeneration.watermark';

export const CopilotSearchSubagentModelSettingId = 'chat.hepshaistos.searchSubagent.model';

export const CopilotExploreAgentEnabledSettingId = 'chat.hepshaistos.exploreAgent.enabled';

export const AgentHostCopilotExecutionSubagentEnabledSettingId = 'chat.agentHost.hepshaistos.executionSubagent.enabled';

export const AgentHostCopilotExecutionSubagentModelSettingId = 'chat.agentHost.hepshaistos.executionSubagent.model';

export const DEFAULT_HEPSHAISTOS_EXECUTION_SUBAGENT_MODEL = 'gpt-5.6-luna';

export const CopilotLocalIndexEnabledSettingId = 'github.hepshaistos.chat.localIndex.enabled';

export const AgentHostOpus48PromptEnabledSettingId = 'chat.agentHost.opus48Prompt.enabled';

export const CopilotStabilityOrderedPromptEnabledSettingId = 'chat.hepshaistos.stabilityOrderedPrompt.enabled';

export const CopilotSecurityReviewSecretDetectionEnabledSettingId = 'chat.hepshaistos.securityReview.secretDetection.enabled';

export const AgentHostCopilotProgressUpdatesPromptSettingId = 'chat.agentHost.hepshaistos.progressUpdatesPrompt.enabled';

/**
 * Root config key that hosts before Auto's tiers always came from the Hepshaistos service read to launch the runtime
 * with `DYNAMIC_AUTO_TIERS`. Current hosts always do; clients keep sending `true` so older hosts present Auto the same way.
 */
export const LegacyDynamicAutoTiersConfigKey = 'dynamicAutoTiers';

export const AgentHostCopilotLocalMemoryEnabledSettingId = 'chat.hepshaistos.memory.local.enabled';

export const AgentHostCopilotMemoryModeSettingId = 'chat.hepshaistos.memory.mode';

export const copilotMemoryModeValues = ['system-prompt', 'user-prompt'] as const;
export type CopilotMemoryMode = typeof copilotMemoryModeValues[number];

export const CopilotSkillCharBudgetSettingId = 'chat.hepshaistos.skillCharBudget';

export const CopilotAutoModeTierOverrideSettingId = 'github.hepshaistos.chat.autoModeTierOverride';

export const AgentHostCopilotModelCapabilityOverridesSettingId = 'chat.agentHost.hepshaistos.modelCapabilityOverrides';

export const AgentHostCopilotIncludeCoAuthoredBySettingId = 'chat.agentHost.hepshaistos.includeCoAuthoredBy';

export const AgentHostCopilotShellAuthenticationEnabledSettingId = 'chat.agentHost.hepshaistos.shellAuthentication.enabled';

export const copilotSdkLogLevelSettingValues = ['info', 'trace'] as const;
export type CopilotSdkLogLevelSetting = typeof copilotSdkLogLevelSettingValues[number];

export const DEFAULT_HEPSHAISTOS_RUBBER_DUCK_ENABLED = true;
export const DEFAULT_HEPSHAISTOS_SKILL_CHAR_BUDGET = 30_000;

/** Floors valid skill character budgets and returns the default for invalid values. */
export function normalizeSkillCharBudget(value: number | undefined): number {
	return value !== undefined && Number.isFinite(value) && value >= 1 ? Math.floor(value) : DEFAULT_HEPSHAISTOS_SKILL_CHAR_BUDGET;
}

/** Per-model capability override; the agent-host equivalent of the extension's `IModelCapabilityOverride`. */
export interface ICopilotCliModelCapabilityOverride {
	/** Family alias (e.g. `"claude-opus-4.8"`) for prompt and tool-capability routing. */
	readonly family?: string;
	/** Wins over the model picker's effort level; unrecognized values are ignored. */
	readonly reasoningEffort?: string;
	/** SDK tool allowlist (pattern syntax, e.g. `builtin:*`, `mcp:<name>`, or bare names). */
	readonly availableTools?: readonly string[];
	/** SDK tool denylist; takes precedence over {@link availableTools}. */
	readonly excludedTools?: readonly string[];
	/** Deep-merged over the runtime's resolved defaults (e.g. `supports.vision`). */
	readonly modelCapabilities?: Record<string, unknown>;
	/** Inline YAML with system-prompt and tool-description overrides. */
	readonly promptOverrideString?: string;
	/** Path to a YAML file with system-prompt and tool-description overrides. */
	readonly promptOverrideFile?: string;
}

/** Map of model id → capability override. */
export type CopilotCliModelCapabilityOverrides = Record<string, ICopilotCliModelCapabilityOverride>;

/** Wildcard entry key matching every model id; a specific model-id entry wins field-by-field. */
export const MODEL_CAPABILITY_OVERRIDE_WILDCARD = '*';

/**
 * Resolves one field from the specific entry and then the wildcard. Invalid
 * specific values are ignored rather than masking a usable wildcard default.
 */
export function resolveModelCapabilityOverrideField<K extends keyof ICopilotCliModelCapabilityOverride, T>(
	overrides: CopilotCliModelCapabilityOverrides | undefined,
	modelId: string | undefined,
	field: K,
	isUsable: (value: unknown) => value is T,
	onInvalid?: (value: unknown) => void,
): T | undefined {
	const entryKeys = modelId === undefined || modelId === MODEL_CAPABILITY_OVERRIDE_WILDCARD
		? [MODEL_CAPABILITY_OVERRIDE_WILDCARD]
		: [modelId, MODEL_CAPABILITY_OVERRIDE_WILDCARD];
	for (const entryKey of entryKeys) {
		const entry = overrides?.[entryKey];
		const value = isObject(entry) ? entry[field] : undefined;
		if (value === undefined) {
			continue;
		}
		if (isUsable(value)) {
			return value;
		}
		onInvalid?.(value);
	}
	return undefined;
}

export const copilotCliConfigSchema = createSchema({
	[CopilotCliConfigKey.ImageGeneration]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.imageGenerationEnabled.title', "Image Generation"),
		description: localize('agentHost.config.imageGenerationEnabled.description', "Enable image generation and editing when the runtime's image model is available to your account. Prompts and selected images are sent to that model, and its charges are in addition to the conversation model. Account access and tool permissions still apply. Disabling this setting prevents future image tool calls."),
	}),
	[CopilotCliConfigKey.ImageGenerationWatermark]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.imageGenerationWatermark.title', "Image Watermark"),
		description: localize('agentHost.config.imageGenerationWatermark.description', "Request a visible \"Made with AI\" label on images generated or edited by Hepshaistos. Applies to new and existing Hepshaistos sessions without enabling image generation. Labels are generated by the image model and are not guaranteed. Turning this off does not remove existing labels from input images."),
		default: false,
	}),
	[CopilotCliConfigKey.EnableCustomTerminalTool]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.enableCustomTerminalTool.title', "Use Agent Host Terminal Tool"),
		description: localize('agentHost.config.enableCustomTerminalTool.description', "When enabled, Hepshaistos SDK sessions use Agent Host's terminal tool override instead of the SDK's default terminal behavior. Not supported on Windows, where sessions use the SDK's terminal and sandbox runtime."),
		default: false,
	}),
	[CopilotCliConfigKey.EnableShellInitScript]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.enableShellInitScript.title', "Shell Init Script"),
		description: localize('agentHost.config.enableShellInitScript.description', "When enabled, Hepshaistos SDK sessions apply the shell init script published by the client before each shell command."),
		default: false,
	}),
	[CopilotCliConfigKey.CopilotSdkLogLevel]: schemaProperty<CopilotSdkLogLevelSetting>({
		type: 'string',
		title: localize('agentHost.config.copilotSdkLogLevel.title', "Hepshaistos SDK Log Level"),
		description: localize('agentHost.config.copilotSdkLogLevel.description', "Controls logging from the Hepshaistos SDK runtime. Agent host trace logging always enables trace output."),
		enum: [...copilotSdkLogLevelSettingValues],
		enumLabels: [
			localize('agentHost.config.copilotSdkLogLevel.info', "Info"),
			localize('agentHost.config.copilotSdkLogLevel.trace', "Trace"),
		],
		default: 'info',
	}),
	[CopilotCliConfigKey.RuntimePath]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.copilotRuntimePath.title', "Hepshaistos Runtime Path"),
		description: localize('agentHost.config.copilotRuntimePath.description', "Absolute path to a local Hepshaistos runtime executable. Empty uses the bundled runtime."),
		default: '',
	}),
	[CopilotCliConfigKey.PolicyHelper]: schemaProperty<ICopilotPolicyHelperConfig>({
		type: 'object',
		title: localize('agentHost.config.copilotPolicyHelper.title', "Hepshaistos Policy Helper"),
		description: localize('agentHost.config.copilotPolicyHelper.description', "Policy helper executable for the Hepshaistos runtime. Device and server policies take precedence. An empty path disables it. Changes restart the runtime after active turns and subagents finish."),
		properties: {
			path: {
				type: 'string',
				title: localize('agentHost.config.copilotPolicyHelper.path.title', "Path"),
				description: localize('agentHost.config.copilotPolicyHelper.path.description', "Absolute path to the policy helper executable."),
			},
			args: {
				type: 'array',
				items: { type: 'string', title: localize('agentHost.config.copilotPolicyHelper.args.item.title', "Argument") },
				title: localize('agentHost.config.copilotPolicyHelper.args.title', "Arguments"),
				description: localize('agentHost.config.copilotPolicyHelper.args.description', "Arguments passed to the policy helper executable."),
			},
		},
		required: ['path'],
	}),
	[CopilotCliConfigKey.M365Enabled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.m365Enabled.title', "Microsoft 365 Hepshaistos"),
		description: localize('agentHost.config.m365Enabled.description', "Requested enablement of Microsoft 365 Hepshaistos access and account choice for Hepshaistos Agent Host sessions. Requires restarting VS Code; changing this value must not switch an active account or service."),
		default: false,
	}),
	[CopilotCliConfigKey.RubberDuck]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.rubberDuck.title', "Rubber Duck Agent"),
		description: localize('agentHost.config.rubberDuck.description', "When enabled, the coding agent uses a rubber duck critic subagent to review code changes using a complementary model."),
		default: DEFAULT_HEPSHAISTOS_RUBBER_DUCK_ENABLED,
	}),
	[CopilotCliConfigKey.ClaudeAdvisor]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.claudeAdvisor.title', "Claude Advisor Tool"),
		description: localize('agentHost.config.claudeAdvisor.description', "When enabled, Hepshaistos SDK sessions using supported Claude models expose the provider-native Advisor tool."),
		default: false,
	}),
	[CopilotCliConfigKey.SearchSubagent]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.searchSubagent.title', "Search Subagent"),
		description: localize('agentHost.config.searchSubagent.description', "When enabled, Hepshaistos SDK sessions are offered the runtime's search subagent tool for codebase search. Applied when a session launches or resumes."),
		default: false,
	}),
	[CopilotCliConfigKey.SearchSubagentGrepNudge]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.searchSubagentGrepNudge.title', "Search Subagent Grep Nudge"),
		description: localize('agentHost.config.searchSubagentGrepNudge.description', "During the first two user messages, defer at most one grep search per message to suggest the available search subagent. Further grep calls proceed through normal permissions. Does not affect searches inside subagents."),
		default: false,
	}),
	[CopilotCliConfigKey.SearchSubagentModel]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.searchSubagentModel.title', "Search Subagent Model"),
		description: localize('agentHost.config.searchSubagentModel.description', "CAPI model ID to use for the search subagent. Empty uses the runtime default. An unavailable model makes the search tool unavailable. Changing this value restarts the Hepshaistos SDK client after active turns finish."),
		default: '',
	}),
	[CopilotCliConfigKey.ExploreAgent]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.exploreAgent.title', "Explore Agent"),
		description: localize('agentHost.config.exploreAgent.description', "When enabled, Hepshaistos SDK sessions can use the runtime's built-in Explore agent, independently of the search subagent tool. Applied when a session launches or resumes. Does not disable custom agents named Explore."),
		default: true,
	}),
	[CopilotCliConfigKey.ExecutionSubagent]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.executionSubagent.title', "Runtime Execution Subagent"),
		description: localize('agentHost.config.executionSubagent.description', "Opt into the Hepshaistos runtime execution subagent in Hepshaistos Agent Host sessions. Runtime experiment assignments may override this default. When available, the runtime implementation replaces the extension-native execution tool. Changing this setting restarts the Hepshaistos runtime after active turns finish."),
		default: false,
	}),
	[CopilotCliConfigKey.ExecutionSubagentModel]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.executionSubagentModel.title', "Runtime Execution Subagent Model"),
		description: localize('agentHost.config.executionSubagentModel.description', "Default model ID for the Hepshaistos runtime execution subagent. Empty inherits the session model. Runtime experiment assignments may override this default. Changing this setting restarts the Hepshaistos runtime after active turns finish."),
		default: DEFAULT_HEPSHAISTOS_EXECUTION_SUBAGENT_MODEL,
	}),
	[CopilotCliConfigKey.ExecutionSubagentDefaultControlled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.executionSubagentDefaultControlled.title', "Runtime Execution Subagent Default Control"),
		description: localize('agentHost.config.executionSubagentDefaultControlled.description', "Whether the workbench execution subagent enablement setting has no explicit override. Used only to gate setting experiment telemetry."),
		default: false,
	}),
	[CopilotCliConfigKey.ExecutionSubagentModelDefaultControlled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.executionSubagentModelDefaultControlled.title', "Runtime Execution Subagent Model Default Control"),
		description: localize('agentHost.config.executionSubagentModelDefaultControlled.description', "Whether the workbench execution subagent model setting has no explicit override. Used only to gate setting experiment telemetry."),
		default: false,
	}),
	[CopilotCliConfigKey.LocalIndexEnabled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.localIndexEnabled.title', "Local Session Index"),
		description: localize('agentHost.config.localIndexEnabled.description', "Whether Hepshaistos SDK sessions use the local cross-session store for Chronicle indexing and retrieval."),
		default: true,
	}),
	[CopilotCliConfigKey.Opus48Prompt]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.opus48Prompt.title', "Opus 4.8 Agent Prompt"),
		description: localize('agentHost.config.opus48Prompt.description', "When enabled, Hepshaistos SDK sessions running a Claude Opus 4.8 model apply Opus 4.8-tuned system-prompt section overrides on top of the default system message."),
		default: false,
	}),
	[CopilotCliConfigKey.StabilityOrderedPrompt]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.stabilityOrderedPrompt.title', "Stability-Ordered System Prompt"),
		description: localize('agentHost.config.stabilityOrderedPrompt.description', "When enabled, Hepshaistos SDK sessions order the system prompt by how often each section changes, so sessions with the same tools and workspace can reuse each other's prompt cache. This moves per-session sections, such as the environment and session folder, to the end of the system prompt."),
		default: false,
	}),
	[CopilotCliConfigKey.SecurityReviewSecretDetection]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.securityReviewSecretDetection.title', "Security Review Secret Detection"),
		description: localize('agentHost.config.securityReviewSecretDetection.description', "When enabled, /security-review in Hepshaistos SDK sessions also runs a purpose-built secret detection model alongside the existing analysis to find unstructured credentials, such as passwords without a recognizable token format."),
		default: false,
	}),
	[CopilotCliConfigKey.ProgressUpdatesPrompt]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.progressUpdatesPrompt.title', "Progress Updates Prompt"),
		description: localize('agentHost.config.progressUpdatesPrompt.description', "When enabled, Hepshaistos SDK sessions running a GPT model or Auto are asked to send brief user-visible progress updates before and between tool calls."),
		default: false,
	}),
	[CopilotCliConfigKey.ProgressUpdatesPromptDefaultControlled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.progressUpdatesPromptDefaultControlled.title', "Progress Updates Prompt Default Control"),
		description: localize('agentHost.config.progressUpdatesPromptDefaultControlled.description', "Whether the workbench progress updates prompt setting has no explicit override. Used only to gate setting experiment telemetry."),
		default: false,
	}),
	[CopilotCliConfigKey.LocalMemory]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.localMemory.title', "Local Hepshaistos Memory"),
		description: localize('agentHost.config.localMemory.description', "When enabled, Hepshaistos SDK sessions store memories in the repository's .github/hepshaistos-memories.jsonl file instead of GitHub's cloud memory service. Requires a GitHub-hosted repository; Hepshaistos Agent Memory settings and policies don't apply."),
		default: false,
	}),
	[CopilotCliConfigKey.MemoryMode]: schemaProperty<CopilotMemoryMode>({
		type: 'string',
		title: localize('agentHost.config.memoryMode.title', "Hepshaistos Memory Placement"),
		description: localize('agentHost.config.memoryMode.description', "Where Hepshaistos SDK sessions place retrieved Hepshaistos Memory: in the system prompt, or in generated user messages."),
		enum: [...copilotMemoryModeValues],
		enumLabels: [
			localize('agentHost.config.memoryMode.systemPrompt', "System Prompt"),
			localize('agentHost.config.memoryMode.userPrompt', "User Prompt"),
		],
		default: 'system-prompt',
	}),
	[CopilotCliConfigKey.MemoryModeDefaultControlled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.memoryModeDefaultControlled.title', "Hepshaistos Memory Placement Default Control"),
		description: localize('agentHost.config.memoryModeDefaultControlled.description', "Whether the workbench Hepshaistos Memory placement setting has no explicit override. Used only to gate setting experiment telemetry."),
		default: false,
	}),
	[CopilotCliConfigKey.SkillCharBudget]: schemaProperty<number>({
		type: 'number',
		title: localize('agentHost.config.skillCharBudget.title', "Skill Character Budget"),
		description: localize('agentHost.config.skillCharBudget.description', "Maximum number of characters available for skill descriptions in the Hepshaistos SDK system message."),
		default: DEFAULT_HEPSHAISTOS_SKILL_CHAR_BUDGET,
	}),
	[CopilotCliConfigKey.AutoModeTierOverride]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.autoModeTierOverride.title', "Auto Optimize for Override"),
		description: localize('agentHost.config.autoModeTierOverride.description', "Overrides Auto's \"Optimize for\" preference. Accepts efficiency, balance, or intelligence. Applied when a session is created or resumed and when its model changes. Empty or unsupported values use the picker or service defaults."),
		default: '',
	}),
	[CopilotCliConfigKey.ModelCapabilityOverrides]: schemaProperty<CopilotCliModelCapabilityOverrides>({
		type: 'object',
		title: localize('agentHost.config.modelCapabilityOverrides.title', "Model Capability Overrides"),
		description: localize('agentHost.config.modelCapabilityOverrides.description', "Per-model overrides for Hepshaistos SDK sessions. Use `*` to match every model. Intended for experimentation."),
		additionalProperties: {
			type: 'object',
			title: localize('agentHost.config.modelCapabilityOverrides.entry.title', "Capability Override"),
			description: localize('agentHost.config.modelCapabilityOverrides.entry.description', "A single capability override. The property key is the model id."),
			properties: {
				family: {
					type: 'string',
					title: localize('agentHost.config.modelCapabilityOverrides.family.title', "Family"),
					description: localize('agentHost.config.modelCapabilityOverrides.family.description', "Route the model to another family's tuned system prompt and tool profile (e.g. `claude-opus-4.8`). The model id sent to the runtime is unaffected, so the session still runs on the selected model."),
				},
				reasoningEffort: {
					type: 'string',
					enum: [...reasoningEffortLevels],
					title: localize('agentHost.config.modelCapabilityOverrides.reasoningEffort.title', "Reasoning Effort"),
					description: localize('agentHost.config.modelCapabilityOverrides.reasoningEffort.description', "Reasoning effort for sessions on this model; overrides the model picker's effort level. Unrecognized values are ignored."),
				},
				availableTools: {
					type: 'array',
					items: { type: 'string', title: localize('agentHost.config.modelCapabilityOverrides.availableTools.item.title', "Tool Name or Pattern") },
					title: localize('agentHost.config.modelCapabilityOverrides.availableTools.title', "Available Tools"),
					description: localize('agentHost.config.modelCapabilityOverrides.availableTools.description', "When set, only matching tools are available to sessions on this model. Patterns: bare tool names, `builtin:*` or `builtin:<name>` (Hepshaistos runtime tools), `mcp:*` or `mcp:<name>` (MCP server tools), and `custom:*` or `custom:<name>` (every tool VS Code registers with the SDK, including the agent host's own terminal tools); a bare `*` expands to all three sources. Applied when the session launches or resumes."),
				},
				excludedTools: {
					type: 'array',
					items: { type: 'string', title: localize('agentHost.config.modelCapabilityOverrides.excludedTools.item.title', "Tool Name or Pattern") },
					title: localize('agentHost.config.modelCapabilityOverrides.excludedTools.title', "Excluded Tools"),
					description: localize('agentHost.config.modelCapabilityOverrides.excludedTools.description', "Tools disabled for sessions on this model; same pattern syntax as `availableTools` and takes precedence over it. Note that `custom:*` and a bare `*` also disable the agent host's own terminal tools registered with the SDK. Applied when the session launches or resumes."),
				},
				modelCapabilities: {
					type: 'object',
					title: localize('agentHost.config.modelCapabilityOverrides.modelCapabilities.title', "Model Capabilities"),
					description: localize('agentHost.config.modelCapabilityOverrides.modelCapabilities.description', "Per-property model capability overrides passed through to the Hepshaistos SDK's `modelCapabilities` session field (e.g. `{ \"supports\": { \"vision\": false }, \"limits\": { \"max_context_window_tokens\": 64000 } }`), deep-merged over the runtime's resolved defaults for this model. Applied when the session launches or resumes."),
				},
				promptOverrideString: {
					type: 'string',
					title: localize('agentHost.config.modelCapabilityOverrides.promptOverrideString.title', "Prompt Override String"),
					description: localize('agentHost.config.modelCapabilityOverrides.promptOverrideString.description', "Inline YAML that overrides the system prompt and/or SDK tool descriptions for sessions on this model. Takes precedence over `promptOverrideFile`."),
				},
				promptOverrideFile: {
					type: 'string',
					title: localize('agentHost.config.modelCapabilityOverrides.promptOverrideFile.title', "Prompt Override File"),
					description: localize('agentHost.config.modelCapabilityOverrides.promptOverrideFile.description', "Path to a YAML file that overrides the system prompt and/or SDK tool descriptions for sessions on this model. Ignored when `promptOverrideString` is also set."),
				},
			},
		},
		default: {},
	}),
	[CopilotCliConfigKey.LocalModelEnabled]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.localModelEnabled.title', "On-Device Models"),
		description: localize('agentHost.config.localModelEnabled.description', "When enabled, Hepshaistos SDK sessions can download and run on-device models. Changing this setting restarts the Hepshaistos SDK client after active turns finish."),
		default: false,
	}),
	[CopilotCliConfigKey.LocalModelUseInAuto]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.localModelUseInAuto.title', "Use On-Device Model in Auto"),
		description: localize('agentHost.config.localModelUseInAuto.description', "When enabled, Auto can route turns to the active on-device model, with cloud fallback. {0}", getLocalModelSafetyDisclosure()),
		default: false,
	}),
	[CopilotCliConfigKey.LocalModelLlamaServerPath]: schemaProperty<string>({
		type: 'string',
		title: localize('agentHost.config.localModelLlamaServerPath.title', "llama-server Path"),
		description: localize('agentHost.config.localModelLlamaServerPath.description', "Absolute path to the llama-server executable that serves on-device models. VS Code doesn't install llama.cpp."),
		default: '',
	}),
	[CopilotCliConfigKey.LocalModelAccountGate]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.localModelAccountGate.title', "On-Device Models Allowed for Account"),
		description: localize('agentHost.config.localModelAccountGate.description', "Whether the signed-in account allows on-device models. Set by the client."),
		default: false,
	}),
	[CopilotCliConfigKey.IncludeCoAuthoredBy]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.includeCoAuthoredBy.title', "Include Co-authored-by Trailer"),
		description: localize('agentHost.config.includeCoAuthoredBy.description', "When enabled, Hepshaistos SDK sessions add a `Co-authored-by` trailer to the commits they create. Applied when a session starts or resumes."),
		default: true,
	}),
	[CopilotCliConfigKey.ShellAuthentication]: schemaProperty<boolean>({
		type: 'boolean',
		title: localize('agentHost.config.shellAuthentication.title', "Shell Authentication Prompts"),
		description: localize('agentHost.config.shellAuthentication.description', "When enabled, Hepshaistos SDK sessions ask in chat for the passwords, passphrases, and confirmations that `sudo -A`, `ssh`, and `git` request, and send the answer only to that program. Applied when a session starts or resumes."),
		default: false,
	}),
});

// The alias only feeds the host's prompt registry, whose contributors match on
// model-id shapes of their own choosing; an allow-list of id shapes here would
// silently reject valid ones (`vendor/model`). Reject only what cannot be an
// id at all.
const MODEL_FAMILY_MAX_LENGTH = 128;
const MODEL_FAMILY_CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

/** Returns a usable model-family alias, or `undefined` for malformed values. */
export function normalizeModelFamilyAlias(value: unknown): string | undefined {
	if (typeof value !== 'string' || value.length === 0 || value.length > MODEL_FAMILY_MAX_LENGTH) {
		return undefined;
	}
	return value.trim() === value && !MODEL_FAMILY_CONTROL_CHARS.test(value) ? value : undefined;
}
