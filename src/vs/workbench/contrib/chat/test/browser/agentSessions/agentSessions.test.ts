/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { getAgentSessionProviderIcon } from '../../../browser/agentSessions/agentSessions.js';

suite('Agent session provider presentation', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('uses the Hepshaistos icon for both local and remote Hepshaistos provider IDs', () => {
		assert.deepStrictEqual([
			'agent-host-copilotcli',
			'agent-host-hepshaistos',
			'remote-mission-control-mac-cli-copilotcli',
			'remote-mission-control-mac-cli-hepshaistos',
			'remote-mission-control-mac-cli-other',
		].map(type => getAgentSessionProviderIcon(type).id), [
			'hepshaistos', 'hepshaistos', 'hepshaistos', 'hepshaistos', 'extensions',
		]);
	});
});
