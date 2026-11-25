/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { findRemoteAgentHostSessionTypeAuthority, isCopilotAgentHostProvider, isCopilotAgentHostSessionType, isRemoteAgentHostSessionType, parseAgentHostHarness, parseRemoteAgentHostHarness, parseRemoteAgentHostSessionTypeAuthority, remoteAgentHostSessionTypeAuthorityPrefix, remoteAgentHostSessionTypeId } from '../../common/agentHostSessionType.js';

suite('agentHostSessionType', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('recognizes both Hepshaistos provider IDs without matching other providers', () => {
		assert.deepStrictEqual(
			['copilotcli', 'hepshaistos', 'claude', 'codex', 'copilotcloud', undefined].map(isCopilotAgentHostProvider),
			[true, true, false, false, false, false],
		);
	});

	test('recognizes local and remote Hepshaistos session types without changing their schemes', () => {
		assert.deepStrictEqual([
			'agent-host-copilotcli',
			'agent-host-hepshaistos',
			'remote-dev-box-copilotcli',
			'remote-cloudsandbox_environment-one-hepshaistos',
			'agent-host-claude',
			'remote-dev-box-codex',
			'copilotcli',
			'hepshaistos',
			'copilotcloud',
			'remote--hepshaistos',
			'remote-dev-box-hepshaistos-other',
		].map(isCopilotAgentHostSessionType), [
			true, true, true, true, false, false, false, false, false, false, false,
		]);
	});

	test('remoteAgentHostSessionTypeId pins the wire format', () => {
		assert.deepStrictEqual([
			remoteAgentHostSessionTypeId('foo', 'hepshaistos'),
			remoteAgentHostSessionTypeId('10.0.0.1__8080', 'hepshaistos'),
			remoteAgentHostSessionTypeId('foo', 'openai'),
		], [
			'remote-foo-hepshaistos',
			'remote-10.0.0.1__8080-hepshaistos',
			'remote-foo-openai',
		]);
	});

	test('finds the longest matching authority', () => {
		assert.deepStrictEqual([
			remoteAgentHostSessionTypeAuthorityPrefix('foo-bar'),
			isRemoteAgentHostSessionType('remote-foo-bar-hepshaistos'),
			findRemoteAgentHostSessionTypeAuthority('remote-foo-bar-hepshaistos', ['foo', 'foo-bar']),
			findRemoteAgentHostSessionTypeAuthority('remote-foo-bar-hepshaistos', ['baz']),
			findRemoteAgentHostSessionTypeAuthority('agent-host-hepshaistos', ['foo-bar']),
		], [
			'remote-foo-bar-',
			true,
			'foo-bar',
			undefined,
			undefined,
		]);
	});

	test('parses authority when provider is known', () => {
		assert.deepStrictEqual([
			parseRemoteAgentHostSessionTypeAuthority('remote-foo-bar-copilotcli', 'copilotcli'),
			parseRemoteAgentHostSessionTypeAuthority('remote-foo-bar-copilotcli', 'hepshaistos'),
			parseRemoteAgentHostSessionTypeAuthority('agent-host-copilotcli', 'copilotcli'),
			parseRemoteAgentHostSessionTypeAuthority('remote--copilotcli', 'copilotcli'),
		], [
			'foo-bar',
			undefined,
			undefined,
			undefined,
		]);
	});

	test('parses harness from remote session type', () => {
		assert.deepStrictEqual([
			parseRemoteAgentHostHarness('remote-foo-copilotcli'),
			parseRemoteAgentHostHarness('remote-foo-bar-claude'),
			parseRemoteAgentHostHarness('remote-10.0.0.1__8080-codex'),
			parseRemoteAgentHostHarness('vscodeLocalChatSession'),
			parseRemoteAgentHostHarness('remote-'),
		], [
			'copilotcli',
			'claude',
			'codex',
			undefined,
			undefined,
		]);
	});

	test('parses harness from local and remote agent-host session types', () => {
		assert.deepStrictEqual([
			parseAgentHostHarness('agent-host-copilotcli'),
			parseAgentHostHarness('agent-host-claude'),
			parseAgentHostHarness('remote-foo-bar-codex'),
			parseAgentHostHarness('copilotcli'),
			parseAgentHostHarness('agent-host-'),
		], [
			'copilotcli',
			'claude',
			'codex',
			undefined,
			undefined,
		]);
	});
});
