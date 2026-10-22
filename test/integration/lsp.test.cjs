const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const vscode = require("vscode");

suite("MCL language server", () => {
  test("publishes diagnostics and formats an MCL document", async () => {
    const workspace = vscode.workspace.workspaceFolders?.[0];
    assert.ok(workspace, "The integration test requires a workspace folder");
    const binary = path.join(workspace.uri.fsPath, ".vscode-test/mcl-cli/mcl");
    await fs.access(binary);

    const configuration = vscode.workspace.getConfiguration("mcl", workspace.uri);
    const invalidPath = path.join(workspace.uri.fsPath, `test/.lsp-${process.pid}.mcl`);
    const formatPath = path.join(workspace.uri.fsPath, `test/.format-${process.pid}.mcl`);
    const invalidUri = vscode.Uri.file(invalidPath);
    const formatUri = vscode.Uri.file(formatPath);
    try {
      await configuration.update("server.path", binary, vscode.ConfigurationTarget.Global);
      const extension = vscode.extensions.getExtension("walnuts1018.mcl-vscode");
      assert.ok(extension, "The MCL extension must be available in the test host");
      await extension.activate();

      await fs.writeFile(invalidPath, "let value = missing\nemit value\n", "utf8");
      const document = await vscode.workspace.openTextDocument(invalidUri);
      assert.equal(document.languageId, "mcl");

      await waitForDiagnostics(invalidUri, (current) =>
        current.some(
          (diagnostic) =>
            diagnostic.code === "MCL-UNDEFINED" && diagnostic.message.includes("undefined name"),
        ),
      );

      await fs.writeFile(formatPath, 'let value =\n    key: "ok"\nemit value\n', "utf8");
      const diagnosticsPublished = waitForDiagnosticPublication(formatUri);
      const formatDocument = await vscode.workspace.openTextDocument(formatUri);
      await diagnosticsPublished;

      const formatEdits = await vscode.commands.executeCommand(
        "vscode.executeFormatDocumentProvider",
        formatUri,
        { tabSize: 2, insertSpaces: true },
      );
      assert.ok(Array.isArray(formatEdits) && formatEdits.length > 0, "Expected a format edit");

      const formatEdit = new vscode.WorkspaceEdit();
      formatEdit.set(formatUri, formatEdits);
      await vscode.workspace.applyEdit(formatEdit);
      assert.equal(formatDocument.getText(), 'let value =\n  key: "ok"\nemit value\n');
    } finally {
      await fs.rm(invalidPath, { force: true });
      await fs.rm(formatPath, { force: true });
      await configuration.update("server.path", undefined, vscode.ConfigurationTarget.Global);
    }
  });
});

function waitForDiagnostics(uri, predicate) {
  const current = vscode.languages.getDiagnostics(uri);
  if (predicate(current)) {
    return Promise.resolve(current);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.dispose();
      reject(new Error(`Timed out waiting for MCL diagnostics for ${uri.toString()}`));
    }, 15_000);
    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (!event.uris.some((changed) => changed.toString() === uri.toString())) {
        return;
      }

      const diagnostics = vscode.languages.getDiagnostics(uri);
      if (predicate(diagnostics)) {
        clearTimeout(timer);
        subscription.dispose();
        resolve(diagnostics);
      }
    });
  });
}

function waitForDiagnosticPublication(uri) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.dispose();
      reject(new Error(`Timed out waiting for MCL diagnostics for ${uri.toString()}`));
    }, 15_000);
    const subscription = vscode.languages.onDidChangeDiagnostics((event) => {
      if (!event.uris.some((changed) => changed.toString() === uri.toString())) {
        return;
      }

      clearTimeout(timer);
      subscription.dispose();
      resolve();
    });
  });
}
