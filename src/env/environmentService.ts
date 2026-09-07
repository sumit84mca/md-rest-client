import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { EnvironmentResolution, EnvironmentVariables } from "../types";

export const NO_ENVIRONMENT_LABEL = "No Environment";

export type EnvironmentPickItem = vscode.QuickPickItem & { name: string | undefined };

export function resolveEnvironmentVariables(documentUri: vscode.Uri): EnvironmentVariables {
  return resolveEnvironment(documentUri).variables;
}

export function resolveEnvironment(documentUri: vscode.Uri): EnvironmentResolution {
  const envConfigRaw = getEnvironmentDefinitions(documentUri);
  const extensionConfig = vscode.workspace.getConfiguration("markdownRestPreview", documentUri);
  const selectedEnvironment = extensionConfig.get<string>("environment");

  let envName: string | undefined;
  if (selectedEnvironment && envConfigRaw[selectedEnvironment]) {
    envName = selectedEnvironment;
  } else if (selectedEnvironment && !envConfigRaw[selectedEnvironment]) {
    const fallback = Object.keys(envConfigRaw).find((name) => name !== "$shared");
    envName = fallback;
  } else {
    envName = undefined;
  }

  const shared = envConfigRaw.$shared ?? {};
  const selected = envName ? envConfigRaw[envName] ?? {} : {};
  return {
    name: envName,
    variables: { ...shared, ...selected }
  };
}

export function getEnvironmentDefinitions(documentUri: vscode.Uri): Record<string, EnvironmentVariables> {
  const allConfig = vscode.workspace.getConfiguration(undefined, documentUri);
  const restClientConfig = vscode.workspace.getConfiguration("rest-client", documentUri);
  const envConfigFromSection =
    restClientConfig.get<Record<string, EnvironmentVariables>>("environmentVariables") ?? {};
  const envConfigFromFlatKey =
    allConfig.get<Record<string, EnvironmentVariables>>("rest-client.environmentVariables") ?? {};
  const envConfigFromFile = loadEnvironmentVariablesFromSettingsFile(documentUri);
  return mergeEnvironmentMaps(envConfigFromSection, envConfigFromFlatKey, envConfigFromFile);
}

export function buildEnvironmentPickItems(documentUri: vscode.Uri): {
  currentEnvironment: string | undefined;
  items: EnvironmentPickItem[];
} {
  const environmentMap = getEnvironmentDefinitions(documentUri);
  const currentEnvironment = resolveEnvironment(documentUri).name;
  const userEnvironments = Object.keys(environmentMap)
    .filter((name) => name !== "$shared")
    .sort((a, b) => a.localeCompare(b))
    .map<EnvironmentPickItem>((name) => ({
      name,
      label: name,
      description: name === currentEnvironment ? "$(check)" : undefined
    }));

  const items: EnvironmentPickItem[] = [
    {
      name: undefined,
      label: NO_ENVIRONMENT_LABEL,
      description: "You can still use variables defined in the $shared environment"
    },
    ...userEnvironments
  ];

  return { currentEnvironment, items };
}

export async function updateSelectedEnvironment(targetUri: vscode.Uri, name: string | undefined): Promise<void> {
  const config = vscode.workspace.getConfiguration("markdownRestPreview", targetUri);
  const target = vscode.workspace.workspaceFolders
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
  await config.update("environment", name ?? "", target);
}

function mergeEnvironmentMaps(
  ...maps: Array<Record<string, EnvironmentVariables>>
): Record<string, EnvironmentVariables> {
  const merged: Record<string, EnvironmentVariables> = {};
  for (const current of maps) {
    for (const [envName, envValues] of Object.entries(current ?? {})) {
      merged[envName] = { ...(merged[envName] ?? {}), ...normalizeEnvironmentValues(envValues) };
    }
  }
  return merged;
}

function normalizeEnvironmentValues(raw: EnvironmentVariables): EnvironmentVariables {
  const normalized: EnvironmentVariables = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    normalized[key] = String(value ?? "");
  }
  return normalized;
}

function loadEnvironmentVariablesFromSettingsFile(documentUri: vscode.Uri): Record<string, EnvironmentVariables> {
  if (documentUri.scheme !== "file") {
    return {};
  }

  for (const settingsFile of candidateSettingsFiles(documentUri.fsPath)) {
    if (!fs.existsSync(settingsFile)) {
      continue;
    }
    try {
      const raw = fs.readFileSync(settingsFile, "utf8");
      const parsed = JSON.parse(raw) as { ["rest-client.environmentVariables"]?: Record<string, EnvironmentVariables> };
      return parsed["rest-client.environmentVariables"] ?? {};
    } catch {
      return {};
    }
  }
  return {};
}

function candidateSettingsFiles(filePath: string): string[] {
  const candidates: string[] = [];
  let current = path.dirname(filePath);
  let depth = 0;

  while (depth < 10) {
    candidates.push(path.join(current, ".vscode", "settings.json"));
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
    depth += 1;
  }

  return candidates;
}
