# Hephaistos Forge IDE

> Fork of Microsoft **Code-OSS** with the **Hephaistos2-Kit** multi-agent
> infrastructure integrated natively — not an extension, part of the workbench.

![Platform](https://img.shields.io/badge/platform-Windows-0078D6?logo=windows&logoColor=white)
![Base](https://img.shields.io/badge/base-Code--OSS-blue)
![Status](https://img.shields.io/badge/status-active%20development-orange)

## Licensing — source available, not uniformly open source

**Original Hephaistos modules require prior written authorization from
Michel Chevalier**, including for non-commercial use, building, execution,
modification and redistribution, except where an independently valid license
or mandatory law provides otherwise. Commercial terms and any royalties are
negotiated separately. Public source visibility does not grant usage rights.

- [Proprietary Hephaistos terms](LICENSE-HEPHAISTOS.txt)
- [Component boundaries and third-party exceptions](LICENSING.md)
- [Microsoft Code-OSS MIT license](LICENSE-CODE-OSS.txt)
- [Third-party notices](ThirdPartyNotices.txt)

The protected original modules include SWAT orchestration, native chats and
providers, ACP integration, Search integration, PostDev and original UI/media.
HPHE and Hephaistos-Kit Search are separately licensed components. Third-party
code and valid earlier grants retain their rights; GitHub platform viewing and
on-platform fork permissions remain effective.

Permission requests: [contact the repository owner](https://github.com/lascard-m).

## What it is

Hephaistos Forge is a VS Code-fork IDE where agentic orchestration is a
first-class citizen of the editor itself:

- **Visual SWAT canvas in the workbench** — the React Flow orchestration board
  (`hephaistos-chats`) ships as a native view: agent/role/provider/service
  cards, execution and tool edges, persisted acyclic DAGs.
- **Real ACP session binding** — live detection of running agent sessions
  (Devin CLI, Antigravity, custom ACP providers) and prompt injection into
  the actual IDE sessions, not simulated chat.
- **hphe-mcp everywhere** — the unified Rust MCP server (58 tools: NTFS $MFT
  search, BM25/semantic/hybrid content search, unified memory KG+vectors+SQLite,
  task orchestrator) is the built-in substrate, no external Everything install.
- **Workspace roster & comms bus** — agent windows, Bleubite workers and n8n /
  ComfyUI service cards share one live roster and an append-only `comms.jsonl`
  bus, coordinated by a head orchestrator agent.

## Status

**Forge v0.1.0-alpha.1 — source preview.** The upstream Code-OSS compatibility
version remains `1.147.0` in `package.json`; Forge releases use their own Git tags.
No packaged binaries or full build validation are provided with this preview.

This public source snapshot is derived from Code-OSS
and includes the Hephaistos workbench integration. It is not a packaged release
or a claim of a self-contained installation: the agent, search and orchestration
features require the corresponding Hephaistos2-Kit local services.

The companion toolkit is available at `art-qalam-fr/hephaistos2-kit`.

## Upstream

This repository is based on [microsoft/vscode (Code-OSS)](https://github.com/microsoft/vscode),
whose upstream portions remain MIT-licensed. See `LICENSE.txt`,
`LICENSE-CODE-OSS.txt` and `ThirdPartyNotices.txt`. The original VS Code
documentation has moved to `docs/upstream/README-vscode.md`.
