import * as vscode from "vscode";
import {
  buildEnvironmentPickItems,
  NO_ENVIRONMENT_LABEL,
  resolveEnvironment,
  updateSelectedEnvironment
} from "./env/environmentService";
import { executeHttpRequest, prepareRequest } from "./http/requestExecutor";
import { buildPreviewHtml } from "./preview/markdownPreview";
import { buildResponsePreviewHtml } from "./response/responsePreview";

export function activate(context: vscode.ExtensionContext): void {
  let responseViewColumn: vscode.ViewColumn | undefined;
  let responsePanel: vscode.WebviewPanel | undefined;
  let openPreviewPanels = 0;
  let lastPreviewDocumentUri: vscode.Uri | undefined;
  const environmentStatusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  environmentStatusBar.name = "Markdown REST Environment";
  environmentStatusBar.command = "markdownRestPreview.switchEnvironment";

  context.subscriptions.push(environmentStatusBar);

  const updateEnvironmentStatusBar = (documentUri?: vscode.Uri): void => {
    if (!documentUri) {
      environmentStatusBar.text = NO_ENVIRONMENT_LABEL;
      environmentStatusBar.tooltip = "Switch REST Client Environment";
      environmentStatusBar.show();
      return;
    }
    const environment = resolveEnvironment(documentUri);
    environmentStatusBar.text = environment.name ?? NO_ENVIRONMENT_LABEL;
    environmentStatusBar.tooltip = "Switch REST Client Environment";
    environmentStatusBar.show();
  };

  const switchEnvironmentCommand = vscode.commands.registerCommand(
    "markdownRestPreview.switchEnvironment",
    async () => {
      const targetUri = lastPreviewDocumentUri ?? vscode.window.activeTextEditor?.document.uri;
      if (!targetUri) {
        vscode.window.showErrorMessage("Open a markdown file first.");
        return;
      }

      const { items } = buildEnvironmentPickItems(targetUri);
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select REST Client Environment"
      });
      if (!selected) {
        return;
      }

      await updateSelectedEnvironment(targetUri, selected.name);
      updateEnvironmentStatusBar(targetUri);
    }
  );

  const openPreviewCommand = vscode.commands.registerCommand("markdownRestPreview.open", async (resource?: vscode.Uri) => {
    const document = await resolveMarkdownDocument(resource);
    if (!document) {
      vscode.window.showErrorMessage("Open a markdown file first.");
      return;
    }

    const sourceEditor = await vscode.window.showTextDocument(document, { preview: false });
    responseViewColumn = nextViewColumn(sourceEditor.viewColumn);

    const panel = vscode.window.createWebviewPanel(
      "markdownRestPreview",
      `Markdown REST Preview: ${document.fileName.split("\\").pop() ?? "Untitled"}`,
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    let activeDocument = document;
    let requestMap = new Map<string, string>();
    openPreviewPanels += 1;
    lastPreviewDocumentUri = activeDocument.uri;

    const render = (active: vscode.TextDocument): void => {
      const parsed = buildPreviewHtml(active.getText());
      requestMap = new Map(parsed.requests.map((request) => [request.id, request.raw]));
      panel.webview.html = parsed.html;
      lastPreviewDocumentUri = active.uri;
      updateEnvironmentStatusBar(active.uri);
    };

    render(activeDocument);

    const changeSub = vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.uri.toString() === activeDocument.uri.toString()) {
        render(activeDocument);
      }
    });

    const editorSub = vscode.window.onDidChangeActiveTextEditor((nextEditor) => {
      if (!nextEditor) {
        return;
      }

      if (nextEditor.document.languageId === "markdown") {
        activeDocument = nextEditor.document;
        render(activeDocument);
      }
    });

    const configSub = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("markdownRestPreview.environment", activeDocument.uri) ||
          event.affectsConfiguration("rest-client.environmentVariables", activeDocument.uri) ||
          event.affectsConfiguration("rest-client.environmentVariables") ||
          event.affectsConfiguration("rest-client", activeDocument.uri)) {
        updateEnvironmentStatusBar(activeDocument.uri);
      }
    });

    panel.onDidDispose(() => {
      changeSub.dispose();
      editorSub.dispose();
      configSub.dispose();
      openPreviewPanels = Math.max(0, openPreviewPanels - 1);
      if (openPreviewPanels === 0) {
        environmentStatusBar.hide();
      }
    });

    panel.webview.onDidReceiveMessage(async (message: { type: string; requestId: string }) => {
      if (message.type !== "executeRequest") {
        return;
      }

      const rawRequest = requestMap.get(message.requestId);
      if (!rawRequest) {
        vscode.window.showErrorMessage("Request block not found.");
        return;
      }

      panel.webview.postMessage({
        type: "requestExecutionState",
        requestId: message.requestId,
        running: true
      });

      try {
        const resolvedRequest = prepareRequest(rawRequest, activeDocument.uri);
        const result = await executeHttpRequest(resolvedRequest);
        const targetColumn = responseViewColumn ?? vscode.ViewColumn.Beside;

        if (!responsePanel) {
          responsePanel = vscode.window.createWebviewPanel(
            "markdownRestResponse",
            "MarkREST Response",
            targetColumn,
            { enableScripts: false, retainContextWhenHidden: true }
          );
          responsePanel.onDidDispose(() => {
            responsePanel = undefined;
          });
          context.subscriptions.push(responsePanel);
        }

        responsePanel.webview.html = buildResponsePreviewHtml(result);
        responsePanel.reveal(targetColumn, true);
      } catch (error) {
        vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        panel.webview.postMessage({
          type: "requestExecutionState",
          requestId: message.requestId,
          running: false
        });
      }
    });
  });

  context.subscriptions.push(openPreviewCommand, switchEnvironmentCommand);
}

async function resolveMarkdownDocument(resource?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (resource) {
    const doc = await vscode.workspace.openTextDocument(resource);
    if (doc.languageId === "markdown") {
      return doc;
    }
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor?.document.languageId === "markdown") {
    return activeEditor.document;
  }

  return undefined;
}

function nextViewColumn(current?: vscode.ViewColumn): vscode.ViewColumn {
  if (current === vscode.ViewColumn.One) {
    return vscode.ViewColumn.Two;
  }
  if (current === vscode.ViewColumn.Two) {
    return vscode.ViewColumn.Three;
  }
  return vscode.ViewColumn.Beside;
}

export function deactivate(): void {}
