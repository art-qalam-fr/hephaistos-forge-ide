# Licensing boundaries — Hephaistos Forge IDE

This repository contains separately licensed components. It is not uniformly
MIT-licensed and the original Hephaistos contributions are not offered as
open-source software in this publication.

## Original Hephaistos contributions — prior written authorization required

[LICENSE-HEPHAISTOS.txt](LICENSE-HEPHAISTOS.txt) governs the original portions
controlled by Michel Chevalier, including all such contributions in:

- `src/vs/workbench/contrib/hephaistos/` and its subdirectories:
  - native home, chat editors, chat panels and provider integration;
  - ACP and CLI session integration;
  - SWAT workspace canvas and orchestrator UI, roster and coordination views;
  - native Search UI and bridge integration;
  - PostDev notes and editor integration;
  - original JavaScript, TypeScript, CSS, HTML, artwork and icon manifests;
- the original Forge identity and integration contributions in `product.json`;
- original Hephaistos-specific integration additions to otherwise upstream
  files, including Hephaistos registration/imports in
  `src/vs/workbench/workbench.common.main.ts` and
  `src/vs/workbench/workbench.desktop.main.ts`;
- other original Hephaistos-specific code, scripts, documentation and media
  controlled by the same rights holder, wherever located in this repository.

This scope does not claim ownership of entire modified upstream files.
Copied boilerplate copyright headers do not transfer ownership of original
Hephaistos contributions to Microsoft; actual incorporated upstream portions
continue to carry Microsoft's copyright and MIT license. Third-party grants
and valid earlier grants always remain effective for their respective material.

## HPHE and Search are separately licensed components

Forge integrates with HPHE and Hephaistos-Kit Search. Their original source is
maintained in `art-qalam-fr/hephaistos2-engine` and
`art-qalam-fr/hephaistos2-search-ext`, each with its own proprietary license.
Public visibility of Forge does not grant authorization to use those components.
Their runtime services and binaries are not silently relicensed by this file.
The original Search integration code present here is subject to the protected
contribution scope above, without overriding valid earlier grants.

## Microsoft Code-OSS and third-party content — original licenses retained

- Microsoft Code-OSS remains MIT-licensed. The original MIT text is preserved
  verbatim in [LICENSE-CODE-OSS.txt](LICENSE-CODE-OSS.txt) and reproduced at the
  root for compatibility with existing upstream references.
- [ThirdPartyNotices.txt](ThirdPartyNotices.txt), other component notices and
  embedded bundled license comments continue to apply.
- In particular, bundled React, React DOM, scheduler, use-sync-external-store,
  React Flow and any other third-party portions of `browser/media/workspace.js`
  retain their applicable licenses; the original Hephaistos UI portions do not
  become MIT-licensed merely by being bundled with those dependencies.
- Other upstream trees, including `copilot_shim/`, are not claimed as original
  Hephaistos work merely because they are included in this repository.

## Earlier publications and platform rights

These notices do not revoke rights validly granted by earlier releases or by
third-party licenses. GitHub's applicable viewing and on-platform fork rights
remain effective. A public repository is not confidential and these terms do
not technically prevent copying. Written permission is required for protected
uses beyond those independently valid rights.

For permission and commercial licensing, contact the owner through
[the GitHub profile](https://github.com/lascard-m). Royalties, if agreed, are
specified in a separate written agreement, not a unilateral public tariff.
