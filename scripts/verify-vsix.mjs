import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const archivePath = join(root, `${sourceManifest.name}-${sourceManifest.version}.vsix`);
const archives = (await readdir(root)).filter((name) => name.endsWith(".vsix"));
if (!archives.includes(`${sourceManifest.name}-${sourceManifest.version}.vsix`)) {
  throw new Error(`VSIX archive is missing: ${archivePath}`);
}

const archiveFiles = new Set(
  execFileSync("unzip", ["-Z1", archivePath], { encoding: "utf8" }).trim().split("\n"),
);
const packagedManifest = JSON.parse(
  execFileSync("unzip", ["-p", archivePath, "extension/package.json"], {
    encoding: "utf8",
  }),
);
const grammars = packagedManifest.contributes?.grammars ?? [];
if (grammars.length === 0) throw new Error("VSIX does not declare a TextMate grammar.");

for (const grammar of grammars) {
  const archiveEntry = `extension/${grammar.path.replace(/^\.\//, "")}`;
  if (!archiveFiles.has(archiveEntry)) {
    throw new Error(`VSIX is missing its declared grammar file: ${archiveEntry}`);
  }

  const packagedGrammar = JSON.parse(
    execFileSync("unzip", ["-p", archivePath, archiveEntry], { encoding: "utf8" }),
  );
  if (packagedGrammar.scopeName !== grammar.scopeName || !Array.isArray(packagedGrammar.patterns)) {
    throw new Error(`VSIX grammar does not match its manifest: ${archiveEntry}`);
  }
}

console.log(`Verified ${grammars.length} TextMate grammar(s) in ${archivePath}.`);
