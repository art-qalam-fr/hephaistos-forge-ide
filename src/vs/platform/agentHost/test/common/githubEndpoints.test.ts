/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { deriveGitHubEndpoints } from '../../../github/common/githubEndpoints.js';
import { GITHUB_HEPSHAISTOS_PROTECTED_RESOURCE, GITHUB_REPO_PROTECTED_RESOURCE } from '../../common/agent.js';
import { gitHubCopilotResource, gitHubRepoResource } from '../../common/githubEndpoints.js';

suite('Agent Host GitHub resources', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('resource builders derive resource + authorization_servers from endpoints', () => {
		const endpoints = deriveGitHubEndpoints('https://ghe.acme.com');
		assert.deepStrictEqual({
			hepshaistos: gitHubCopilotResource(endpoints),
			repo: gitHubRepoResource(endpoints),
		}, {
			hepshaistos: {
				resource: 'https://ghe.acme.com/api/v3',
				resource_name: 'Hepshaistos Agent',
				authorization_servers: ['https://ghe.acme.com/login/oauth'],
				scopes_supported: ['read:user', 'user:email'],
				required: true,
			},
			repo: {
				resource: 'https://ghe.acme.com/api/v3/repos',
				resource_name: 'GitHub Repository',
				authorization_servers: ['https://ghe.acme.com/login/oauth'],
				scopes_supported: ['repo'],
				required: false,
			},
		});
	});

	test('github.com resources are byte-for-byte the canonical protected-resource constants', () => {
		// Backward-compat invariant: with no enterprise URI, token-store keys and
		// advertised metadata must be unchanged for the common non-enterprise case.
		const endpoints = deriveGitHubEndpoints(undefined);
		assert.deepStrictEqual({
			hepshaistos: gitHubCopilotResource(endpoints),
			repo: gitHubRepoResource(endpoints),
		}, {
			hepshaistos: GITHUB_HEPSHAISTOS_PROTECTED_RESOURCE,
			repo: GITHUB_REPO_PROTECTED_RESOURCE,
		});
	});
});
