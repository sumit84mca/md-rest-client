import * as vscode from "vscode";
import { resolveEnvironmentVariables } from "../env/environmentService";
import { ParsedHttpRequest, RequestExecutionResult, EnvironmentVariables } from "../types";
import { tryParseJson } from "../utils/text";

export function prepareRequest(rawRequest: string, documentUri: vscode.Uri): string {
  const environmentVariables = resolveEnvironmentVariables(documentUri);
  const requestVariables = parseRequestVariables(rawRequest, environmentVariables);

  return rawRequest
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().match(/^@[\w.-]+\s*=/))
    .map((line) => resolveTemplateVariables(line, requestVariables, environmentVariables))
    .join("\n")
    .trim();
}

export async function executeHttpRequest(rawRequest: string): Promise<RequestExecutionResult> {
  const parsedRequest = parseHttpRequest(rawRequest);
  const init: RequestInit = { method: parsedRequest.method, headers: parsedRequest.headers };
  if (parsedRequest.body && parsedRequest.method !== "GET" && parsedRequest.method !== "HEAD") {
    init.body = parsedRequest.body;
  }

  const response = await fetch(parsedRequest.url, init);
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  const text = await response.text();
  const parsedJsonBody = tryParseJson(text);

  return {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    body: text.length > 100000 ? `${text.slice(0, 100000)}\n\n... truncated ...` : text,
    parsedJsonBody
  };
}

function parseRequestVariables(rawRequest: string, environmentVariables: EnvironmentVariables): EnvironmentVariables {
  const requestVariables: EnvironmentVariables = {};
  const lines = rawRequest.split(/\r?\n/);

  for (const line of lines) {
    const match = line.trim().match(/^@([\w.-]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = resolveTemplateVariables(match[2].trim(), requestVariables, environmentVariables);
    requestVariables[key] = value;
  }

  return requestVariables;
}

function resolveTemplateVariables(
  value: string,
  requestVariables: EnvironmentVariables,
  environmentVariables: EnvironmentVariables
): string {
  return value.replace(/\{\{([\w.-]+)\}\}/g, (_match, name: string) => {
    if (name in requestVariables) {
      return requestVariables[name];
    }
    if (name in environmentVariables) {
      return environmentVariables[name];
    }
    throw new Error(`Variable "${name}" not found in request or rest-client.environmentVariables.`);
  });
}

function parseHttpRequest(rawRequest: string): ParsedHttpRequest {
  const lines = rawRequest
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trimStart();
      return !(trimmed.startsWith("###") || trimmed.startsWith("#") || trimmed.startsWith("//"));
    });

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  if (lines.length === 0) {
    throw new Error("Request block is empty.");
  }

  const requestLine = lines[0].trim();
  const requestMatch = requestLine.match(/^([A-Z]+)\s+(\S+)$/i);
  if (!requestMatch) {
    throw new Error("First line must be: METHOD URL");
  }

  const method = requestMatch[1].toUpperCase();
  let url = requestMatch[2];
  const headers: Record<string, string> = {};
  let nextLineIndex = 1;

  while (nextLineIndex < lines.length) {
    const line = lines[nextLineIndex];
    const trimmed = line.trim();
    if (trimmed === "") {
      nextLineIndex += 1;
      break;
    }
    if (trimmed.startsWith("?") || trimmed.startsWith("&")) {
      url += trimmed;
      nextLineIndex += 1;
      continue;
    }
    const headerMatch = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!headerMatch) {
      throw new Error(`Invalid URL continuation or header line: "${line}"`);
    }
    break;
  }

  for (let i = nextLineIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") {
      nextLineIndex = i + 1;
      break;
    }
    const headerMatch = line.trim().match(/^([^:]+):\s*(.*)$/);
    if (!headerMatch) {
      throw new Error(`Invalid header line: "${line}"`);
    }
    headers[headerMatch[1].trim()] = headerMatch[2].trim();
    nextLineIndex = i + 1;
  }

  const body = nextLineIndex < lines.length ? lines.slice(nextLineIndex).join("\n").trim() : undefined;
  return { method, url, headers, body };
}
