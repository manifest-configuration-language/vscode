export interface DisposableLike {
  dispose(): void;
}

export declare class SingleWatcherOwner<T extends DisposableLike> {
  get(createWatcher: () => T): T;
  dispose(): void;
}

export declare function createMCLDocumentSelector(): {
  scheme: string;
  language: string;
}[];

export declare function resolveServerPath(
  configuredPath: string,
  workspaceFolderPath: string | undefined,
  workingDirectory?: string,
  homeDirectory?: string,
  platform?: NodeJS.Platform,
): string;
