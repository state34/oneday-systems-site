import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");

// Split so this guard does not itself contain the host names it scans for.
const googleFontHosts = ["fonts." + "google" + "apis.com", "fonts." + "gst" + "atic.com"];

// fonts/FONTS.md records the download URL of the vendored woff2.
// It is not linked from any page and stays outside public/. Every other source
// file, and the published tree (Cloudflare Pages serves public/ only), must
// stay free of those hosts.
const provenance = join(root, "fonts", "FONTS.md");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}

describe("self-hosted fonts", () => {
  it("keeps font provenance outside the published tree", () => {
    expect(existsSync(provenance)).toBe(true);
    expect(provenance.startsWith(`${join(root, "public")}/`)).toBe(false);
    expect(existsSync(join(root, "public", "fonts", "montserrat-latin.woff2"))).toBe(true);
    expect(existsSync(join(root, "public", "fonts", "OFL.txt"))).toBe(true);
  });

  it("fails if a Google font host appears in source or published output", () => {
    const hits = [];
    for (const file of walk(root)) {
      if (file === provenance) continue;
      const hay = readFileSync(file).toString("latin1").toLowerCase();
      for (const host of googleFontHosts) {
        if (hay.includes(host)) hits.push(`${relative(root, file)} (${host})`);
      }
    }
    expect(hits).toEqual([]);
  });
});
