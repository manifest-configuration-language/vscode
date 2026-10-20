import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  createMCLDocumentSelector,
  resolveServerPath,
  SingleWatcherOwner,
} from "../src/extensionUtilities.mjs";

test("MCL document selector includes saved and untitled documents", () => {
  assert.deepEqual(createMCLDocumentSelector(), [
    { scheme: "file", language: "mcl" },
    { scheme: "untitled", language: "mcl" },
  ]);
});

test("single watcher owner reuses one watcher and disposes it once", () => {
  let created = 0;
  let disposed = 0;
  const owner = new SingleWatcherOwner();
  const createWatcher = () => {
    created += 1;
    return { dispose: () => (disposed += 1) };
  };

  const first = owner.get(createWatcher);
  for (let index = 0; index < 10; index += 1) {
    assert.equal(owner.get(createWatcher), first);
  }

  assert.equal(created, 1);
  owner.dispose();
  owner.dispose();
  assert.equal(disposed, 1);
  assert.throws(() => owner.get(createWatcher), /disposed/);
});

test("server path uses the first workspace folder as its relative base", () => {
  const roots = ["/work/first", "/work/second"];
  assert.equal(
    resolveServerPath("./bin/mcl", roots[0], "/extension-host"),
    path.posix.resolve(roots[0], "./bin/mcl"),
  );
  assert.equal(
    resolveServerPath("${workspaceFolder}/bin/mcl", roots[0], "/extension-host"),
    path.posix.resolve(roots[0], "bin/mcl"),
  );
  assert.equal(resolveServerPath("mcl", roots[0]), "mcl");
  assert.equal(resolveServerPath("/opt/mcl", roots[0]), "/opt/mcl");
  assert.equal(
    resolveServerPath("./bin/mcl", undefined, "/extension-host"),
    "/extension-host/bin/mcl",
  );
  assert.equal(
    resolveServerPath("~/bin/mcl", roots[0], "/extension-host", "/home/user"),
    "/home/user/bin/mcl",
  );
  assert.throws(
    () => resolveServerPath("${workspaceFolder}/bin/mcl", undefined),
    /no workspace folder is open/,
  );
});

test("Windows server paths resolve against the first workspace folder", () => {
  assert.equal(
    resolveServerPath(
      ".\\bin\\mcl.exe",
      "C:\\work\\first",
      "C:\\extension-host",
      undefined,
      "win32",
    ),
    "C:\\work\\first\\bin\\mcl.exe",
  );
  assert.equal(
    resolveServerPath(
      "${workspaceFolder}\\bin\\mcl.exe",
      "C:\\work\\first",
      undefined,
      undefined,
      "win32",
    ),
    "C:\\work\\first\\bin\\mcl.exe",
  );
  assert.equal(
    resolveServerPath("mcl.exe", "C:\\work\\first", undefined, undefined, "win32"),
    "mcl.exe",
  );
});

test("language configuration indents MCL declaration and block endings", async () => {
  const configURL = new URL("../language-configuration.json", import.meta.url);
  const configuration = JSON.parse(await readFile(configURL, "utf8"));
  const increase = new RegExp(configuration.indentationRules.increaseIndentPattern);
  const decrease = new RegExp(configuration.indentationRules.decreaseIndentPattern);

  for (const line of [
    "let value =",
    "export let value: Resource =",
    "fn make(name: String) -> Resource =",
    "export fn labels(name: String) -> Map<String, String> = # defaults",
    "metadata:",
    "  value: # comment",
    "with:",
    "node:",
    "else:",
  ]) {
    assert.match(line, increase, `${line} should increase indentation`);
  }

  for (const line of ["let value = 1", "let value = other == true", "# let value ="]) {
    assert.doesNotMatch(line, increase, `${line} should not increase indentation`);
  }

  assert.match("else:", decrease);
  assert.match("  ]", decrease);
});
