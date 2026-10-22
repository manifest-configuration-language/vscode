import { defineConfig } from "@vscode/test-cli";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  files: "test/integration/**/*.test.cjs",
  extensionDevelopmentPath: root,
  workspaceFolder: root,
  launchArgs: [
    "--user-data-dir",
    path.join(tmpdir(), `mcl-vscode-test-${process.pid}`),
    "--disable-extensions",
    "--disable-gpu",
    "--no-sandbox",
  ],
  mocha: {
    timeout: 20_000,
  },
});
