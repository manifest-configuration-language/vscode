import os from "node:os";
import path from "node:path";

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
    throw new Error(
      "mcl.server.path uses ${workspaceFolder}, but the workspace does not have exactly one folder",
    );
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
