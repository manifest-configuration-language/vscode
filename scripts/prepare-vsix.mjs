import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const grammar = manifest.contributes?.grammars?.find((entry) => entry.scopeName === "source.mcl");
if (!grammar) throw new Error("package.json does not declare the source.mcl grammar.");

const grammarPackagePath = import.meta
  .resolve("@manifest-configuration-language/language/textmate");
const grammarSource = await readFile(new URL(grammarPackagePath), "utf8");

const destination = resolve(root, grammar.path);
await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, grammarSource);
