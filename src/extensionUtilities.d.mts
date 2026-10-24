export declare function createMCLDocumentSelector(): {
  scheme: string;
  language: string;
}[];

export declare function resolveServerPath(
  configuredPath: string,
  workspaceFolderPath?: string,
  workingDirectory?: string,
  homeDirectory?: string,
  platform?: NodeJS.Platform,
): string;
