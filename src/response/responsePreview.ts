import { RequestExecutionResult } from "../types";
import { escapeHtml } from "../utils/text";

export function buildResponsePreviewHtml(result: RequestExecutionResult): string {
  const headerLines = Object.entries(result.headers)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
  const responseBody = result.parsedJsonBody !== undefined ? result.parsedJsonBody : result.body;
  const bodyTree = result.parsedJsonBody !== undefined
    ? `<div class="json-root">${renderJsonNode(responseBody, true)}</div>`
    : `<pre class="json-plain">${escapeHtml(String(responseBody))}</pre>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { height: 100%; }
    body {
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }
    .layout { height: 100vh; overflow: auto; padding: 12px; }
    .status {
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--vscode-textLink-foreground);
    }
    details {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 8px;
      background: var(--vscode-editorWidget-background);
      margin-bottom: 12px;
    }
    summary {
      cursor: pointer;
      font-weight: 600;
      user-select: none;
    }
    pre {
      margin: 8px 0 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--vscode-editor-font-family);
      font-size: 14px;
      line-height: 1.5;
    }
    .json-tree { font-family: var(--vscode-editor-font-family); font-size: 14px; line-height: 1.6; }
    .json-tree details { border: none; padding: 0; background: transparent; margin: 0; }
    .json-tree summary { list-style: none; font-weight: 400; cursor: pointer; }
    .json-tree summary::-webkit-details-marker { display: none; }
    .json-toggle { color: var(--vscode-descriptionForeground); margin-right: 4px; display: inline-block; width: 10px; }
    .json-tree details[open] > summary .json-toggle { transform: rotate(90deg); }
    .json-indent { margin-left: 16px; }
    .json-brace { color: var(--vscode-editor-foreground); }
    .json-line { white-space: pre-wrap; }
    .json-opened-only { display: none; }
    .json-node[open] > summary .json-opened-only { display: inline; }
    .json-node[open] > summary .json-closed-only { display: none; }
    .json-node[open] > .json-opened-only { display: block; }
    .json-key { color: #f0c674; }
    .json-string { color: #b5bd68; }
    .json-number { color: #de935f; }
    .json-boolean { color: #81a2be; }
    .json-null { color: #cc6666; }
    body.vscode-light .json-key { color: #eab700; }
    body.vscode-light .json-string { color: #718c00; }
    body.vscode-light .json-number { color: #f5871f; }
    body.vscode-light .json-boolean { color: #4271ae; }
    body.vscode-light .json-null { color: #c82829; }
    body.vscode-high-contrast .json-key { color: #ffeead; }
    body.vscode-high-contrast .json-string { color: #d1f1a9; }
    body.vscode-high-contrast .json-number { color: #ffc58f; }
    body.vscode-high-contrast .json-boolean { color: #9cdcfe; }
    body.vscode-high-contrast .json-null { color: #ff9da4; }
    .json-plain { margin: 0; }
    .divider { border: none; border-top: 1px solid var(--vscode-panel-border); margin: 12px 0; }
    .json-root { padding-left: 2px; }
  </style>
</head>
<body>
  <div class="layout">
    <div class="status">HTTP ${result.status} ${escapeHtml(result.statusText)}</div>
    <details>
      <summary>Response Headers</summary>
      <pre>${escapeHtml(headerLines || "(none)")}</pre>
    </details>
    <hr class="divider" />
    ${bodyTree}
  </div>
</body>
</html>`;
}

function renderJsonNode(value: unknown, isRoot = false): string {
  return renderJsonValue(value, true, undefined, isRoot);
}

function renderJsonKey(key: string): string {
  return `<span class="json-key">"${escapeHtml(key)}"</span>`;
}

function renderJsonValue(value: unknown, isLast: boolean, key?: string, expand = false): string {
  const isContainer = value !== null && typeof value === "object";
  if (isContainer) {
    return renderJsonContainer(value as Record<string, unknown> | unknown[], isLast, key, expand);
  }
  return `<div class="json-line">${renderJsonLeaf(value, key)}${isLast ? "" : ","}</div>`;
}

function renderJsonContainer(
  value: Record<string, unknown> | unknown[],
  isLast: boolean,
  key?: string,
  expand = false
): string {
  const isArray = Array.isArray(value);
  const openBrace = isArray ? "[" : "{";
  const closeBrace = isArray ? "]" : "}";
  const keyPrefix = key ? `${renderJsonKey(key)}: ` : "";
  const comma = isLast ? "" : ",";

  const children = isArray
    ? (value as unknown[]).map((item, index, arr) => renderJsonValue(item, index === arr.length - 1)).join("")
    : Object.entries(value as Record<string, unknown>)
      .map(([childKey, childValue], index, entries) => renderJsonValue(childValue, index === entries.length - 1, childKey))
      .join("");

  return `<div class="json-tree">
<details class="json-node" open>
  <summary class="json-line"><span class="json-toggle">▸</span>${keyPrefix}<span class="json-opened-only json-brace">${openBrace}</span><span class="json-closed-only json-brace">${openBrace} … ${closeBrace}${comma}</span></summary>
  <div class="json-indent">${children}</div>
  <div class="json-line json-opened-only"><span class="json-brace">${closeBrace}</span>${comma}</div>
</details>
</div>`;
}

function renderJsonLeaf(value: unknown, key?: string): string {
  const keyPrefix = key ? `${renderJsonKey(key)}: ` : "";
  if (typeof value === "string") {
    return `${keyPrefix}<span class="json-string">"${escapeHtml(value)}"</span>`;
  }
  if (typeof value === "number") {
    return `${keyPrefix}<span class="json-number">${String(value)}</span>`;
  }
  if (typeof value === "boolean") {
    return `${keyPrefix}<span class="json-boolean">${String(value)}</span>`;
  }
  if (value === null || value === undefined) {
    return `${keyPrefix}<span class="json-null">null</span>`;
  }
  return `${keyPrefix}<span class="json-string">"${escapeHtml(String(value))}"</span>`;
}
