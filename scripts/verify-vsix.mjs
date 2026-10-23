import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import yauzl from "yauzl";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const archivePath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(root, `${sourceManifest.name}-${sourceManifest.version}.vsix`);
try {
  await stat(archivePath);
} catch {
  throw new Error(`VSIX archive is missing: ${archivePath}`);
}

const { files: archiveFiles, manifest: packagedManifestContents } =
  await readVsixEntries(archivePath);
if (!packagedManifestContents) throw new Error("VSIX is missing extension/package.json.");
const packagedManifest = JSON.parse(packagedManifestContents);
const archiveAssetPaths = [
  packagedManifest.main,
  ...(packagedManifest.contributes?.languages ?? []).flatMap((language) => [
    language.configuration,
    language.icon?.light,
    language.icon?.dark,
  ]),
  ...(packagedManifest.contributes?.snippets ?? []).map((snippet) => snippet.path),
].filter(Boolean);
for (const assetPath of archiveAssetPaths) {
  const archiveEntry = `extension/${assetPath.replace(/^\.\//, "")}`;
  if (!archiveFiles.has(archiveEntry)) {
    throw new Error(`VSIX is missing a manifest-referenced asset: ${archiveEntry}`);
  }
}

const grammars = packagedManifest.contributes?.grammars ?? [];
if (grammars.length === 0) throw new Error("VSIX does not declare a TextMate grammar.");
for (const grammar of grammars) {
  const archiveEntry = `extension/${grammar.path.replace(/^\.\//, "")}`;
  if (!archiveFiles.has(archiveEntry)) {
    throw new Error(`VSIX is missing its declared grammar file: ${archiveEntry}`);
  }
}

console.log(
  `Verified ${grammars.length} TextMate grammar(s) and ${archiveAssetPaths.length} manifest asset(s) in ${archivePath}.`,
);

function readVsixEntries(path) {
  return new Promise((resolve, reject) => {
    yauzl.open(path, { lazyEntries: true }, (openError, zipfile) => {
      if (openError) {
        reject(openError);
        return;
      }

      const files = new Set();
      let manifest;
      let settled = false;
      const fail = (error) => {
        if (settled) return;
        settled = true;
        zipfile.close();
        reject(error);
      };

      zipfile.on("error", fail);
      zipfile.on("end", () => {
        if (settled) return;
        settled = true;
        resolve({ files, manifest });
      });
      zipfile.on("entry", (entry) => {
        if (entry.fileName.endsWith("/")) {
          zipfile.readEntry();
          return;
        }

        files.add(entry.fileName);
        if (entry.fileName !== "extension/package.json") {
          zipfile.readEntry();
          return;
        }

        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError) {
            fail(streamError);
            return;
          }

          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", fail);
          stream.on("end", () => {
            manifest = Buffer.concat(chunks).toString("utf8");
            zipfile.readEntry();
          });
        });
      });
      zipfile.readEntry();
    });
  });
}
