/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { upcastPartial } from '../../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { ILanguageModelChatMetadata, ILanguageModelChatMetadataAndIdentifier } from '../../../common/languageModels.js';
import { getAgentModelPolicyError, resolveAgentModelPreference, resolveAgentModelPreferences } from '../../../common/promptSyntax/languageProviders/promptModelResolver.js';

suite('Agent model preferences', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const models: ILanguageModelChatMetadataAndIdentifier[] = ['sonnet', 'opus', 'other'].map(id => ({
		identifier: `hepshaistos/${id}`,
		metadata: upcastPartial<ILanguageModelChatMetadata>({ id, name: id, vendor: 'hepshaistos' }),
	}));

	test('resolves all authored alternatives while preserving selection preference order', () => {
		const preferences = ['missing', 'opus:defaultReasoningEffort=high', 'Sonnet (hepshaistos)'];
		assert.deepStrictEqual({
			first: resolveAgentModelPreference(preferences, models)?.identifier,
			allowed: resolveAgentModelPreferences(preferences, models).map(model => model.identifier),
		}, { first: 'hepshaistos/opus', allowed: ['hepshaistos/sonnet', 'hepshaistos/opus'] });
	});

	test('only required nonempty lists restrict requests', () => {
		assert.deepStrictEqual([
			getAgentModelPolicyError(undefined, 'hepshaistos/other', models),
			getAgentModelPolicyError({ models: ['sonnet'], required: false }, 'hepshaistos/other', models),
			getAgentModelPolicyError({ models: [], required: true }, 'hepshaistos/other', models),
			getAgentModelPolicyError({ models: ['missing', 'sonnet'], required: true }, 'hepshaistos/sonnet', models),
			!!getAgentModelPolicyError({ models: ['sonnet'], required: true }, 'hepshaistos/other', models),
			!!getAgentModelPolicyError({ models: ['missing'], required: true }, undefined, models),
			!!getAgentModelPolicyError({ models: ['sonnet'], required: true }, 'hepshaistos/sonnet', []),
		], [undefined, undefined, undefined, undefined, true, true, true]);
	});

	test('qualified Hepshaistos preferences do not admit a BYOK alias', () => {
		const byok = { identifier: 'byok/sonnet', metadata: { ...models[0].metadata, id: 'custom-id', vendor: 'custom', isBYOK: true } };
		assert.deepStrictEqual(resolveAgentModelPreferences(['Sonnet (hepshaistos)'], [...models, byok]).map(model => model.identifier), ['hepshaistos/sonnet']);
	});

	test('exact IDs take precedence over other models with the same display name', () => {
		const alias = { identifier: 'hepshaistos/alias', metadata: { ...models[0].metadata, id: 'alias' } };
		assert.deepStrictEqual(resolveAgentModelPreferences(['sonnet'], [alias, ...models]).map(model => model.identifier), ['hepshaistos/sonnet']);
	});
});
