import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import textmate from "vscode-textmate";
import oniguruma from "vscode-oniguruma";

const root = fileURLToPath(new URL("..", import.meta.url));
const sourceManifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const archivePath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : join(root, `${sourceManifest.name}-${sourceManifest.version}.vsix`);
try {
  await readFile(archivePath);
} catch {
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
  const keywordFixtures = [
    ["rule hardened(container: Container):", "rule"],
    ['require container.enabled == false message "disabled"', "message"],
    ["let deployment = node:", "node"],
    ["let updated = base with:", "with"],
    ["let updated = base without:", "without"],
    ['type App = schema("schema.json")', "schema"],
    ['let label = key("app")', "key"],
  ];
  const operatorFixtures = [
    ['let value = optional ?? "fallback"', "??"],
    ["let predicate = fn(value) => value", "=>"],
    ["fn resourceName(name: String) -> String = name", "->"],
  ];
  const identifierFixtures = [
    ['let is = 1', "is"],
  ];
  const commentFixtures = [
    { source: "foo#bar", comment: "#bar", isComment: false },
    { source: "foo #bar", comment: "#bar", isComment: true },
    { source: "#bar", comment: "#bar", isComment: true },
  ];
  const identifierSource = 'let greeting = "hello"';
  const identifierTokens = textmateGrammar.tokenizeLine(identifierSource).tokens;
  const identifierToken = identifierTokens.find(
    (token) => identifierSource.slice(token.startIndex, token.endIndex) === "greeting",
  );
  assert.ok(
    identifierToken?.scopes.includes("variable.other.mcl"),
    `Expected identifiers to have variable.other.mcl scope; got ${JSON.stringify(identifierTokens)}`,
  );
  for (const [source, keyword] of keywordFixtures) {
    const tokens = textmateGrammar.tokenizeLine(source).tokens;
    const keywordToken = tokens.find(
      (token) => source.slice(token.startIndex, token.endIndex) === keyword,
    );
    assert.ok(
      keywordToken?.scopes.includes("keyword.control.mcl"),
      `Expected ${JSON.stringify(keyword)} to have keyword.control.mcl scope; got ${JSON.stringify(tokens)}`,
    );
  }
  for (const [source, operator] of operatorFixtures) {
    const tokens = textmateGrammar.tokenizeLine(source).tokens;
    const operatorToken = tokens.find(
      (token) => source.slice(token.startIndex, token.endIndex) === operator,
    );
    assert.ok(
      operatorToken?.scopes.includes("keyword.operator.mcl"),
      `Expected ${JSON.stringify(operator)} to have keyword.operator.mcl scope; got ${JSON.stringify(tokens)}`,
    );
  }
  for (const [source, identifier] of identifierFixtures) {
    const tokens = textmateGrammar.tokenizeLine(source).tokens;
    const identifierToken = tokens.find(
      (token) => source.slice(token.startIndex, token.endIndex) === identifier,
    );
    assert.ok(
      identifierToken?.scopes.includes("variable.other.mcl"),
      `Expected ${JSON.stringify(identifier)} to have variable.other.mcl scope; got ${JSON.stringify(tokens)}`,
    );
    assert.ok(
      !identifierToken.scopes.includes("keyword.operator.mcl"),
      `Expected ${JSON.stringify(identifier)} not to have keyword.operator.mcl scope; got ${JSON.stringify(tokens)}`,
    );
  }
  for (const { source, comment, isComment } of commentFixtures) {
    const tokens = textmateGrammar.tokenizeLine(source).tokens;
    const commentToken = tokens.find(
      (token) => source.slice(token.startIndex, token.endIndex) === comment,
    );
    assert.equal(
      commentToken?.scopes.includes("comment.line.number-sign.mcl") ?? false,
      isComment,
      `Expected ${JSON.stringify(comment)} in ${JSON.stringify(source)} to ${isComment ? "have" : "not have"} comment scope; got ${JSON.stringify(tokens)}`,
    );
  }
  registry.dispose();
}

console.log(
  `Verified ${grammars.length} TextMate grammar(s) and ${archiveAssetPaths.length} manifest asset(s) in ${archivePath}.`,
);
