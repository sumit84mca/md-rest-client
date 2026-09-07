import MarkdownIt from "markdown-it";
import { RequestBlock } from "../types";
import { escapeHtml } from "../utils/text";

export function buildPreviewHtml(markdownSource: string): { html: string; requests: RequestBlock[] } {
  const requests: RequestBlock[] = [];
  let index = 0;

  const transformed = markdownSource.replace(/```http\s*([\s\S]*?)```/gi, (_match, block) => {
    index += 1;
    const id = `req-${index}`;
    const raw = String(block).trim();
    requests.push({ id, raw });
    return [
      `<div class="rest-block" data-request-id="${id}">`,
      `<div class="rest-toolbar"><button class="run-request" data-request-id="${id}">Run</button></div>`,
      `<pre><code class="http-preview">${renderHttpRequestForPreview(raw)}</code></pre>`,
      `</div>`
    ].join("");
  });

  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
  const body = md.render(transformed);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: var(--vscode-font-family); padding: 1rem; line-height: 1.5; color: var(--vscode-editor-foreground); }
    .rest-block { border: 1px solid var(--vscode-panel-border); border-radius: 8px; margin: 1rem 0; overflow: hidden; }
    .rest-toolbar { padding: 0.5rem; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-editorWidget-background); }
    .run-request { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; padding: 0.35rem 0.6rem; cursor: pointer; }
    .run-request:hover { background: var(--vscode-button-hoverBackground); }
    .rest-block pre { margin: 0; padding: 0.75rem; overflow: auto; }
    .http-url { color: var(--vscode-editor-foreground); }
    .http-query-sep, .http-query-equals { color: var(--vscode-editor-foreground); }
    .hljs-comment { color: #57A64A; font-style: italic; }
    .vscode-light .hljs-attribute { color: #c82829; }
    .vscode-dark .hljs-attribute { color: #cc6666; }
    .vscode-high-contrast .hljs-attribute { color: #ff9da4; }
    .vscode-light .hljs-attr { color: #eab700; }
    .vscode-dark .hljs-attr { color: #f0c674; }
    .vscode-high-contrast .hljs-attr { color: #ffeead; }
    .vscode-light .hljs-number, .vscode-light .hljs-literal { color: #f5871f; }
    .vscode-dark .hljs-number, .vscode-dark .hljs-literal { color: #de935f; }
    .vscode-high-contrast .hljs-number, .vscode-high-contrast .hljs-literal { color: #ffc58f; }
    .vscode-light .hljs-string { color: #718c00; }
    .vscode-dark .hljs-string { color: #b5bd68; }
    .vscode-high-contrast .hljs-string { color: #d1f1a9; }
    .vscode-light .hljs-meta, .vscode-light .hljs-tag, .vscode-light .hljs-keyword { color: #8959a8; }
    .vscode-dark .hljs-meta, .vscode-dark .hljs-tag, .vscode-dark .hljs-keyword { color: #b294bb; }
    .vscode-high-contrast .hljs-meta, .vscode-high-contrast .hljs-tag, .vscode-high-contrast .hljs-keyword { color: #ebbbff; }
  </style>
</head>
<body>
  ${body}
  <script>
    const vscode = acquireVsCodeApi();
    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.classList.contains("run-request")) return;
      const requestId = target.getAttribute("data-request-id");
      if (!requestId) return;
      target.setAttribute("data-original-label", target.textContent || "Run");
      target.textContent = "Running...";
      target.setAttribute("disabled", "disabled");
      vscode.postMessage({ type: "executeRequest", requestId });
    });

    window.addEventListener("message", (event) => {
      const message = event.data;
      if (!message || message.type !== "requestExecutionState") return;
      const button = document.querySelector('button.run-request[data-request-id="' + message.requestId + '"]');
      if (!(button instanceof HTMLButtonElement)) return;
      if (message.running) {
        return;
      }
      button.removeAttribute("disabled");
      button.textContent = button.getAttribute("data-original-label") || "Run";
    });
  </script>
</body>
</html>`;

  return { html, requests };
}

function renderHttpRequestForPreview(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const rendered: string[] = [];
  let inBody = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") {
      rendered.push("");
      inBody = true;
      continue;
    }

    const requestMatch = trimmed.match(/^([A-Z]+)\s+(\S+)$/i);
    if (!inBody && requestMatch) {
      rendered.push(
        `<span class="hljs-keyword">${escapeHtml(requestMatch[1].toUpperCase())}</span> ${renderUrlWithQueryColor(requestMatch[2])}`
      );
      continue;
    }
    if (!inBody && (trimmed.startsWith("?") || trimmed.startsWith("&"))) {
      rendered.push(renderQueryContinuationLine(trimmed));
      continue;
    }

    const headerMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!inBody && headerMatch) {
      rendered.push(
        `<span class="hljs-attribute">${escapeHtml(headerMatch[1])}</span>: ${highlightTemplateVariables(escapeHtml(headerMatch[2]))}`
      );
      continue;
    }

    if (trimmed.startsWith("@")) {
      rendered.push(`<span class="hljs-keyword">${escapeHtml(line)}</span>`);
      continue;
    }

    rendered.push(highlightTemplateVariables(escapeHtml(line)));
  }

  return rendered.join("\n");
}

function renderUrlWithQueryColor(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart < 0) {
    return `<span class="http-url">${escapeHtml(url)}</span>`;
  }

  const base = url.slice(0, queryStart);
  const query = url.slice(queryStart + 1);
  return `<span class="http-url">${escapeHtml(base)}</span><span class="http-query-sep">?</span>${renderQueryPairs(query)}`;
}

function renderQueryContinuationLine(line: string): string {
  const prefix = line[0];
  const rest = line.slice(1);
  return `<span class="http-query-sep">${escapeHtml(prefix)}</span>${renderQueryPairs(rest)}`;
}

function renderQueryPairs(query: string): string {
  if (!query) {
    return "";
  }
  return query.split("&").map((part, index) => {
    const separator = index > 0 ? `<span class="http-query-sep">&amp;</span>` : "";
    const eqIndex = part.indexOf("=");
    if (eqIndex < 0) {
      return `${separator}<span class="hljs-attr">${escapeHtml(part)}</span>`;
    }
    const name = part.slice(0, eqIndex);
    const value = part.slice(eqIndex + 1);
    return `${separator}<span class="hljs-attr">${escapeHtml(name)}</span><span class="http-query-equals">=</span><span class="hljs-number">${highlightTemplateVariables(escapeHtml(value))}</span>`;
  }).join("");
}

function highlightTemplateVariables(value: string): string {
  return value.replace(/\{\{[^}]+\}\}/g, (match) => `<span class="hljs-number">${match}</span>`);
}
