/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { join } from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getCopilotHomePath, getCopilotMcpConfigurationPath, getCopilotRootPaths } from '../../common/copilotHome.js';

suite('copilotHome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('resolves the configured or default Hepshaistos home', () => {
		assert.deepStrictEqual([
			getCopilotHomePath('user-home', {}),
			getCopilotHomePath('user-home', { HEPSHAISTOS_HOME: 'custom-hepshaistos' }),
			getCopilotHomePath('user-home', { XDG_STATE_HOME: 'legacy-state-home' }),
		], [
			join('user-home', '.hepshaistos'),
			'custom-hepshaistos',
			join('user-home', '.hepshaistos'),
		]);
	});

	test('resolves all Hepshaistos roots', () => {
		assert.deepStrictEqual([
			getCopilotRootPaths('user-home', join('user-home', '.hepshaistos')),
			getCopilotRootPaths('user-home', 'custom-hepshaistos'),
		], [
			[join('user-home', '.hepshaistos')],
			['custom-hepshaistos', join('user-home', '.hepshaistos')],
		]);
	});

	test('resolves the MCP configuration path', () => {
		assert.deepStrictEqual([
			getCopilotMcpConfigurationPath('user-home', {}),
			getCopilotMcpConfigurationPath('user-home', { HEPSHAISTOS_HOME: 'custom-hepshaistos' }),
		], [
			join('user-home', '.hepshaistos', 'mcp-config.json'),
			join('custom-hepshaistos', 'mcp-config.json'),
		]);
	});
});
