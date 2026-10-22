import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import textmate from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

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

  const packagedGrammar = JSON.parse(
    execFileSync("unzip", ["-p", archivePath, archiveEntry], { encoding: "utf8" }),
  );
  if (packagedGrammar.scopeName !== grammar.scopeName || !Array.isArray(packagedGrammar.patterns)) {
    throw new Error(`VSIX grammar does not match its manifest: ${archiveEntry}`);
  }

  const wasmBuffer = await readFile(join(root, "node_modules/vscode-oniguruma/release/onig.wasm"));
  await oniguruma.loadWASM(
    wasmBuffer.buffer.slice(wasmBuffer.byteOffset, wasmBuffer.byteOffset + wasmBuffer.byteLength),
  );
  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (value) => new oniguruma.OnigString(value),
    }),
    loadGrammar: async (scopeName) => (scopeName === grammar.scopeName ? packagedGrammar : null),
  });
  const textmateGrammar = await registry.loadGrammar(grammar.scopeName);
  assert.ok(textmateGrammar, `VSIX grammar does not load: ${grammar.scopeName}`);
  const source = "rule hardened(container: Container):";
  const tokens = textmateGrammar.tokenizeLine(source).tokens;
  const ruleToken = tokens.find(
    (token) => source.slice(token.startIndex, token.endIndex) === "rule",
  );
  assert.ok(
    ruleToken?.scopes.includes("keyword.control.mcl"),
    `Expected the rule declaration keyword to be highlighted; got ${JSON.stringify(tokens)}`,
  );
  registry.dispose();
}

console.log(
  `Verified ${grammars.length} TextMate grammar(s) and ${archiveAssetPaths.length} manifest asset(s) in ${archivePath}.`,
);
