import os from "node:os";
import path from "node:path";

export class SingleWatcherOwner {
  #watcher;
  #disposed = false;

  get(createWatcher) {
    if (this.#disposed) {
      throw new Error("The file watcher owner has been disposed");
    }

    this.#watcher ??= createWatcher();
    return this.#watcher;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }

    this.#disposed = true;
    this.#watcher?.dispose();
    this.#watcher = undefined;
  }
}

export function createMCLDocumentSelector() {
  return [
    { scheme: "file", language: "mcl" },
    { scheme: "untitled", language: "mcl" },
  ];
}

export function resolveServerPath(
  configuredPath,
  workspaceFolderPath,
  workingDirectory = process.cwd(),
  homeDirectory = os.homedir(),
  platform = process.platform,
) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const hasWorkspaceFolder = typeof workspaceFolderPath === "string" && workspaceFolderPath !== "";

  if (configuredPath.includes("${workspaceFolder}") && !hasWorkspaceFolder) {
    throw new Error("mcl.server.path uses ${workspaceFolder}, but no workspace folder is open");
  }

  let expandedPath = configuredPath.replaceAll("${workspaceFolder}", workspaceFolderPath ?? "");
  if (expandedPath === "~" || expandedPath.startsWith("~/") || expandedPath.startsWith("~\\")) {
    expandedPath = pathApi.join(homeDirectory, expandedPath.slice(2));
  }

  if (pathApi.isAbsolute(expandedPath)) {
    return pathApi.normalize(expandedPath);
  }

  if (expandedPath.includes("/") || expandedPath.includes("\\")) {
    const baseDirectory = hasWorkspaceFolder ? workspaceFolderPath : workingDirectory;
    return pathApi.resolve(baseDirectory, expandedPath);
  }

  return expandedPath;
}
