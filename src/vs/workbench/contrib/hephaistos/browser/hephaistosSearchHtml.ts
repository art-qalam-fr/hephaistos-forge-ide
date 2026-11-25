/*---------------------------------------------------------------------------------------------
 *  Copyright (c) 2026 Michel Chevalier / Hephaistos contributors. Port natif de l'UI search-ext (hephaistos2-kit).
 *--------------------------------------------------------------------------------------------*/

import { FileAccess } from '../../../../base/common/network.js';
import { joinPath } from '../../../../base/common/resources.js';
import { asWebviewUri } from '../../webview/common/webview.js';

const BODY = "<!-- Shared webview DOM fragment — single source of truth.\n     Injected into preview.html by serve_preview.py (dev) and read by\n     searchView.js _html() (extension). Edit HERE, not in both places. -->\n<div id=\"toolbar\">\n  <input id=\"q\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\"\n         data-i18n-ph=\"ph\"\n         placeholder=\"Search everything&hellip; (ext:py;txt, size:&gt;10mb, dm:today, folder:)\">\n  <select id=\"filter\" data-i18n-title=\"tFilter\">\n    <option value=\"\" data-i18n=\"fAll\">All</option>\n    <option value=\"audio\" data-i18n=\"fAudio\">Audio</option>\n    <option value=\"compressed\" data-i18n=\"fCompressed\">Compressed</option>\n    <option value=\"doc\" data-i18n=\"fDoc\">Document</option>\n    <option value=\"exe\" data-i18n=\"fExe\">Executable</option>\n    <option value=\"folder\" data-i18n=\"fFolder\">Folder</option>\n    <option value=\"image\" data-i18n=\"fImage\">Image</option>\n    <option value=\"video\" data-i18n=\"fVideo\">Video</option>\n  </select>\n</div>\n<div id=\"status\" data-i18n=\"sHint\">Type to search&hellip;</div>\n<div id=\"crumbs\">\n  <span class=\"navbtn\" id=\"navBack\" data-i18n-title=\"tBack\">&#x25C0;</span>\n  <span class=\"navbtn\" id=\"navFwd\" data-i18n-title=\"tFwd\">&#x25B6;</span>\n  <span class=\"navbtn\" id=\"navUp\" data-i18n-title=\"tUp\">&#x2B06;</span>\n  <span class=\"navbtn\" id=\"navSearch\" data-i18n-title=\"tSearch\">&#x1F50D;</span>\n  <span id=\"crumbTrail\"></span>\n  <span id=\"dirFavChips\"></span>\n</div>\n<!-- fixed header — never scrolls; its table is width-synced with the body -->\n<div id=\"headWrap\">\n  <table id=\"headTable\"><colgroup id=\"headCols\"></colgroup><thead><tr id=\"headRow\"></tr></thead></table>\n</div>\n<div id=\"resultsWrap\">\n  <table id=\"results\"><colgroup id=\"bodyCols\"></colgroup><tbody id=\"tbody\"></tbody></table>\n</div>\n<div id=\"resizeGrip\" data-i18n-title=\"tGrip\" title=\"Drag to resize\"></div>\n<div id=\"actions\">\n  <button id=\"actExplore\" data-i18n-title=\"tExplore\" title=\"Open containing folder in Explorer\">&#x1F4C2;</button>\n  <button id=\"actSubmit\" data-i18n-title=\"tSubmit\" title=\"Submit selection to agent (copies paths + opens chat)\">&#x1F4CE;</button>\n  <span class=\"sep\"></span>\n  <button id=\"actNewFile\" data-i18n-title=\"tNewFile\" title=\"New file in selected folder\">&#x1F4C4;&#xFE0E;+</button>\n  <button id=\"actNewDir\" data-i18n-title=\"tNewDir\" title=\"New folder in selected folder\">&#x1F4C1;+</button>\n  <span class=\"sep\"></span>\n  <button id=\"actPreview\" data-i18n-title=\"tPreview\" title=\"Toggle preview pane\">&#x1F441;</button>\n  <span class=\"sep\"></span>\n  <select id=\"favList\" data-i18n-title=\"tFavs\" title=\"Favorite files — open instantly\">\n    <option value=\"\" data-i18n=\"favHeader\">&#x2605; Favorites</option>\n  </select>\n  <button id=\"actFavAdd\" data-i18n-title=\"tFavAdd\" title=\"Add selection to favorites\">&#x2B50;+</button>\n  <button id=\"actFavDel\" data-i18n-title=\"tFavDel\" title=\"Remove selected favorite\">&#x2715;</button>\n  <button id=\"actSettings\" data-i18n-title=\"tSettings\" title=\"Settings\">&#x2699;</button>\n</div>\n<div id=\"previewWrap\" class=\"hidden\"><div id=\"previewBox\"></div></div>\n<div id=\"previewGrip\" class=\"hidden\" data-i18n-title=\"tGrip\" title=\"Drag to resize\"></div>\n<div id=\"settingsMenu\" class=\"hidden\">\n  <div class=\"item\" data-lang=\"en\">English</div>\n  <div class=\"item\" data-lang=\"fr\">Fran&ccedil;ais</div>\n  <div class=\"item\" data-lang=\"es\">Espa&ntilde;ol</div>\n  <div class=\"item\" data-lang=\"de\">Deutsch</div>\n</div>\n<div id=\"ctxMenu\" class=\"hidden\">\n  <div class=\"item\" data-act=\"open\" data-i18n=\"mOpen\">Open</div>\n  <div class=\"item\" data-act=\"copyPath\" data-i18n=\"mCopyPath\">Copy Path</div>\n  <div class=\"item\" data-act=\"openContaining\" data-i18n=\"mOpenContaining\">Open Containing Folder</div>\n  <div class=\"item\" data-act=\"reveal\" data-i18n=\"mReveal\">Reveal in Explorer</div>\n  <div class=\"sep\"></div>\n  <div class=\"item\" data-act=\"submit\" data-i18n=\"mSubmit\">Submit to Agent</div>\n  <div class=\"item\" data-act=\"newFile\" data-i18n=\"mNewFile\">New File Here</div>\n  <div class=\"item\" data-act=\"newDir\" data-i18n=\"mNewDir\">New Folder Here</div>\n</div>\n";

export function hephaistosSearchHtml(bootJson: string): string {
	const mediaRoot = FileAccess.asFileUri('vs/workbench/contrib/hephaistos/browser/media/search');
	const media = (f: string) => asWebviewUri(joinPath(mediaRoot, f));
	const nonce = String(Date.now()) + String(Math.random()).slice(2);
	const css = media('panel.css').toString();
	const js = media('panel.js').toString();
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src vscode-resource: 'unsafe-inline' https:; script-src 'nonce-${nonce}'; font-src vscode-resource: https: data:; img-src vscode-resource: https: data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${css}">
<title>Hephaistos Search</title>
</head>
<body>
${BODY}
<script nonce="${nonce}">window.__HPHE_BOOT__ = ${bootJson};</script>
<script nonce="${nonce}" src="${js}"></script>
</body>
</html>`;
}
