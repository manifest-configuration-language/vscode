import * as vscode from "vscode";
import { LanguageClient, RevealOutputChannelOn, State, Trace } from "vscode-languageclient/node";
import { createMCLDocumentSelector, resolveServerPath } from "./extensionUtilities.mjs";

const CONFIGURATION_SECTION = "mcl";
const OUTPUT_CHANNEL_NAME = "MCL Language Server";
const MCL_CLI_INSTALL_URL =
  "https://github.com/manifest-configuration-language/mcl/releases/latest";

let client: LanguageClient | undefined;
let outputChannel: vscode.LogOutputChannel | undefined;
let languageClientQueue: Promise<void> = Promise.resolve();
let deactivating = false;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  deactivating = false;
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME, { log: true });
  context.subscriptions.push(outputChannel);

  context.subscriptions.push(
    vscode.commands.registerCommand("mcl.restartLanguageServer", async () => {
      await enqueueLanguageClientOperation(restartLanguageClient);
      outputChannel?.appendLine("MCL Language Serverを再起動しました。");
    }),
    vscode.commands.registerCommand("mcl.showLanguageServerOutput", () => {
      outputChannel?.show(true);
    }),
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (
        event.affectsConfiguration("mcl.server.path") ||
        event.affectsConfiguration("mcl.server.args")
      ) {
        await enqueueLanguageClientOperation(restartLanguageClient);
        return;
      }

      if (event.affectsConfiguration("mcl.trace.server")) {
        client?.setTrace(getTraceLevel());
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await enqueueLanguageClientOperation(restartLanguageClient);
    }),
  );

  await enqueueLanguageClientOperation(startLanguageClient);
}

export async function deactivate(): Promise<void> {
  deactivating = true;
  await enqueueLanguageClientOperation(async () => {
    const activeClient = client;
    client = undefined;
    if (activeClient) {
      await activeClient.stop();
    }
  });
}

async function startLanguageClient(): Promise<void> {
  if (deactivating) {
    return;
  }

  if (client && client.state !== State.Stopped) {
    return;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  const configuration = vscode.workspace.getConfiguration(
    CONFIGURATION_SECTION,
    workspaceFolder?.uri,
  );
  let command: string;
  try {
    command = resolveServerPath(
      configuration.get<string>("server.path", "mcl").trim() || "mcl",
      workspaceFolder?.uri.fsPath,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.appendLine(`MCL Language Serverのpathを解決できませんでした: ${message}`);
    await vscode.window.showErrorMessage(message);
    return;
  }
  const args = configuration.get<string[]>("server.args", ["lsp"]);
  const serverOptions = {
    command,
    args,
    options: {
      cwd: workspaceFolder?.uri.fsPath,
    },
  };
  const clientOptions = {
    documentSelector: createMCLDocumentSelector(),
    synchronize: { configurationSection: CONFIGURATION_SECTION },
    outputChannel,
    traceOutputChannel: outputChannel,
    trace: getTraceLevel(),
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: {},
  };

  client = new LanguageClient("mcl", "MCL Language Server", serverOptions, clientOptions);

  try {
    await client.start();
    const version = client.initializeResult?.serverInfo?.version;
    outputChannel?.appendLine(
      `MCL Language Serverを起動しました${version ? ` (version ${version})` : ""}: ${command} ${args.join(" ")}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.appendLine(`MCL Language Serverを起動できませんでした: ${message}`);
    const commandNotFound = error instanceof Error && "code" in error && error.code === "ENOENT";
    if (commandNotFound) {
      const selection = await vscode.window.showErrorMessage(
        "MCL CLIが見つかりません。CLIをインストールしてPATHを確認してください。",
        "CLIをインストール",
      );
      if (selection === "CLIをインストール") {
        await vscode.env.openExternal(vscode.Uri.parse(MCL_CLI_INSTALL_URL));
      }
    } else {
      await vscode.window.showErrorMessage(
        "MCL Language Serverを起動できませんでした。設定 mcl.server.path と実行環境を確認してください。",
      );
    }
    client = undefined;
  }
}

async function restartLanguageClient(): Promise<void> {
  if (deactivating) {
    return;
  }

  const activeClient = client;
  client = undefined;
  if (activeClient) {
    await activeClient.stop();
  }
  await startLanguageClient();
}

function enqueueLanguageClientOperation(operation: () => Promise<void>): Promise<void> {
  const result = languageClientQueue.then(operation);
  languageClientQueue = result.catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.appendLine(`MCL Language Serverのライフサイクル操作に失敗しました: ${message}`);
  });
  return languageClientQueue;
}

function getTraceLevel(): Trace {
  const setting = vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION)
    .get<string>("trace.server", "off");
  switch (setting) {
    case "messages":
      return Trace.Messages;
    case "verbose":
      return Trace.Verbose;
    default:
      return Trace.Off;
  }
}
