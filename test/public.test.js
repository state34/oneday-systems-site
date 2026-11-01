import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const publicDir = join(import.meta.dirname, "..", "public");

// Pages config files. They are not dotfiles; they are the only meta files
// allowed in the published tree.
const allowedMeta = new Set(["_headers", "_redirects"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    acc.push(path);
    if (statSync(path).isDirectory()) walk(path, acc);
  }
  return acc;
}

function problems(rel) {
  const parts = rel.split("/");
  const base = parts[parts.length - 1];
  const found = [];
  if (parts.some((part) => part === "src" || part === "test")) found.push("src-or-test");
  if (base.endsWith(".md")) found.push("markdown");
  if (/^package.*\.json$/.test(base)) found.push("package-json");
  if ((base.startsWith(".") || base.startsWith("_")) && !allowedMeta.has(base)) found.push("dotfile");
  return found;
}

describe("public publish tree", () => {
  it("does not publish package manifests, dotfiles, markdown, test/, or src/", () => {
    const hits = [];
    for (const path of walk(publicDir)) {
      const rel = relative(publicDir, path);
      const found = problems(rel);
      if (found.length) hits.push(`${rel} (${found.join(", ")})`);
    }
    expect(hits).toEqual([]);
  });
});
