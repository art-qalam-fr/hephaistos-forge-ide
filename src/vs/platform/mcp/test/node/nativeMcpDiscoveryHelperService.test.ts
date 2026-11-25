/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { homedir } from 'os';
import { join } from '../../../../base/common/path.js';
import { IProcessEnvironment } from '../../../../base/common/platform.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { NativeMcpDiscoveryHelperService } from '../../node/nativeMcpDiscoveryHelperService.js';

suite('NativeMcpDiscoveryHelperService', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('reads native configuration roots from the process environment', async () => {
		const data = await new NativeMcpDiscoveryHelperService({
			HEPSHAISTOS_HOME: '/custom/hepshaistos',
			APPDATA: '/custom/app-data',
			XDG_CONFIG_HOME: '/custom/config',
		}).load();

		assert.deepStrictEqual({
			copilotHome: data.copilotHome?.path,
			winAppData: data.winAppData?.path,
			xdgHome: data.xdgHome?.path,
		}, {
			copilotHome: '/custom/hepshaistos',
			winAppData: '/custom/app-data',
			xdgHome: '/custom/config',
		});
	});

	const cases: { name: string; environment: IProcessEnvironment; shellEnvironment: IProcessEnvironment; expectedHome: string | undefined }[] = [
		{ name: 'uses a shell-only Hepshaistos home on GUI launches', environment: {}, shellEnvironment: { HEPSHAISTOS_HOME: '/shell/hepshaistos' }, expectedHome: '/shell/hepshaistos' },
		{ name: 'lets the shell Hepshaistos home override the process environment', environment: { HEPSHAISTOS_HOME: '/process/hepshaistos' }, shellEnvironment: { HEPSHAISTOS_HOME: '/shell/hepshaistos' }, expectedHome: '/shell/hepshaistos' },
		{ name: 'preserves the process Hepshaistos home when shell resolution is skipped or fails', environment: { HEPSHAISTOS_HOME: '/process/hepshaistos' }, shellEnvironment: {}, expectedHome: '/process/hepshaistos' },
		{ name: 'uses the default Hepshaistos home when neither environment sets it', environment: {}, shellEnvironment: {}, expectedHome: URI.file(join(homedir(), '.hepshaistos')).path },
		{ name: 'uses the default Hepshaistos home when the shell clears it', environment: { HEPSHAISTOS_HOME: '/process/hepshaistos' }, shellEnvironment: { HEPSHAISTOS_HOME: '' }, expectedHome: URI.file(join(homedir(), '.hepshaistos')).path },
	];

	for (const { name, environment, shellEnvironment, expectedHome } of cases) {
		test(name, async () => {
			const data = await new NativeMcpDiscoveryHelperService({
				...environment,
				APPDATA: '/process/app-data',
				XDG_CONFIG_HOME: '/process/config',
			}, async () => ({
				...shellEnvironment,
				APPDATA: '/shell/app-data',
				XDG_CONFIG_HOME: '/shell/config',
			})).load();

			assert.deepStrictEqual({
				copilotHome: data.copilotHome?.path,
				winAppData: data.winAppData?.path,
				xdgHome: data.xdgHome?.path,
			}, {
				copilotHome: expectedHome,
				winAppData: '/process/app-data',
				xdgHome: '/process/config',
			});
		});
	}
});
