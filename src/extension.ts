import * as vscode from "vscode";
import { LanguageClient, RevealOutputChannelOn, State, Trace } from "vscode-languageclient/node";
import {
  createMCLDocumentSelector,
  resolveServerPath,
  SingleWatcherOwner,
} from "./extensionUtilities.mjs";

const CONFIGURATION_SECTION = "mcl";
const OUTPUT_CHANNEL_NAME = "MCL Language Server";

let client: LanguageClient | undefined;
let outputChannel: vscode.LogOutputChannel | undefined;
let fileWatcherOwner: SingleWatcherOwner<vscode.FileSystemWatcher> | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME, { log: true });
  context.subscriptions.push(outputChannel);
  fileWatcherOwner = new SingleWatcherOwner();
  const activeWatcherOwner = fileWatcherOwner;
  context.subscriptions.push(new vscode.Disposable(() => activeWatcherOwner.dispose()));

  context.subscriptions.push(
    vscode.commands.registerCommand("mcl.restartLanguageServer", async () => {
      if (!client) {
        await startLanguageClient();
        return;
      }

      await client.restart();
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
        await restartLanguageClient();
        return;
      }

      if (event.affectsConfiguration("mcl.trace.server")) {
        client?.setTrace(getTraceLevel());
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await restartLanguageClient();
    }),
  );

  await startLanguageClient();
}

export async function deactivate(): Promise<void> {
  const activeClient = client;
  client = undefined;
  if (activeClient) {
    await activeClient.stop();
  }
  fileWatcherOwner?.dispose();
  fileWatcherOwner = undefined;
}

async function startLanguageClient(): Promise<void> {
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
    synchronize: {
      configurationSection: CONFIGURATION_SECTION,
      fileEvents: fileWatcherOwner!.get(() => vscode.workspace.createFileSystemWatcher("**/*.mcl")),
    },
    outputChannel,
    traceOutputChannel: outputChannel,
    trace: getTraceLevel(),
    revealOutputChannelOn: RevealOutputChannelOn.Error,
    initializationOptions: {},
  };

  client = new LanguageClient("mcl", "MCL Language Server", serverOptions, clientOptions);

  try {
    await client.start();
    outputChannel?.appendLine(`MCL Language Serverを起動しました: ${command} ${args.join(" ")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    outputChannel?.appendLine(`MCL Language Serverを起動できませんでした: ${message}`);
    await vscode.window.showErrorMessage(
      `MCL Language Serverを起動できませんでした。設定 mcl.server.path と実行環境を確認してください。`,
    );
    client = undefined;
  }
}

async function restartLanguageClient(): Promise<void> {
  const activeClient = client;
  client = undefined;
  if (activeClient) {
    await activeClient.stop();
  }
  await startLanguageClient();
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
