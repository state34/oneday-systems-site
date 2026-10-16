import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..");

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, acc);
    else acc.push(path);
  }
  return acc;
}

function htmlFiles() {
  return walk(root).filter((path) => path.endsWith(".html"));
}

function parseHeaders(text) {
  const blocks = [];
  let current = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) {
      current = { path: line.trim(), ops: [] };
      blocks.push(current);
    } else if (current) {
      const trimmed = line.trim();
      if (trimmed.startsWith("!")) current.ops.push({ unset: trimmed.slice(1).trim() });
      else {
        const idx = trimmed.indexOf(":");
        current.ops.push({ name: trimmed.slice(0, idx).trim(), value: trimmed.slice(idx + 1).trim() });
      }
    }
  }
  return blocks;
}

function matchPath(pattern, path) {
  const re = new RegExp(`^${pattern.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
  return re.test(path);
}

function resolvedHeaders(text, urlPath) {
  const headers = new Map();
  for (const block of parseHeaders(text)) {
    if (!matchPath(block.path, urlPath)) continue;
    for (const op of block.ops) {
      if (op.unset) headers.delete(op.unset.toLowerCase());
      else {
        const key = op.name.toLowerCase();
        headers.set(key, headers.has(key) ? `${headers.get(key)}, ${op.value}` : op.value);
      }
    }
  }
  return headers;
}

describe("static contact rules", () => {
  it("has no mailto links in HTML or llms.txt", () => {
    const files = [...htmlFiles(), join(root, "llms.txt")];
    for (const file of files) {
      expect(readFileSync(file, "utf8"), relative(root, file)).not.toContain("mailto:");
    }
  });

  it("keeps stan@ only on the privacy page", () => {
    const files = [...htmlFiles(), join(root, "llms.txt"), join(root, "README.md")];
    const hits = files.filter((file) => readFileSync(file, "utf8").includes("stan@onedaysystems.com"));
    expect(hits.map((file) => relative(root, file))).toEqual(["privacy/index.html"]);
  });

  it("keeps expert@ only on the privacy page", () => {
    const hits = htmlFiles().filter((file) => readFileSync(file, "utf8").includes("expert@onedaysystems.com"));
    expect(hits.map((file) => relative(root, file))).toEqual(["privacy/index.html"]);
    const privacy = readFileSync(join(root, "privacy/index.html"), "utf8");
    expect(privacy).not.toContain("mailto:");
  });

  it("has no email key in JSON-LD", () => {
    for (const file of htmlFiles()) {
      const html = readFileSync(file, "utf8");
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      for (const block of blocks) {
        const data = JSON.parse(block[1]);
        expect(JSON.stringify(data), relative(root, file)).not.toContain('"email"');
      }
    }
  });

  it("has no Google Calendar links left", () => {
    for (const file of walk(root)) {
      if (file.includes(`${join("test", "")}`) || file.includes("node_modules")) continue;
      expect(readFileSync(file, "utf8"), relative(root, file)).not.toContain("calendar.app.google");
    }
  });

  it("puts Calendly on the contact page only", () => {
    const contact = readFileSync(join(root, "contact/index.html"), "utf8");
    expect(contact).toContain('class="calendly-inline-widget"');
    expect(contact).toContain('data-url="https://calendly.com/stan-state34/30min?hide_gdpr_banner=1"');
    expect(contact).toContain('href="https://calendly.com/stan-state34/30min"');
    expect(contact).toContain("Open the scheduler at calendly.com");
    expect(contact).toContain('target="_blank"');
    expect(contact).toContain('rel="noopener noreferrer"');
    for (const file of htmlFiles()) {
      if (file.endsWith("contact/index.html")) continue;
      const html = readFileSync(file, "utf8");
      expect(html, relative(root, file)).not.toContain("widget.js");
      expect(html, relative(root, file)).not.toContain("calendly-inline-widget");
    }
  });

  it("gives /contact/ one CSP that allows Turnstile and Calendly", () => {
    const text = readFileSync(join(root, "_headers"), "utf8");
    const contact = resolvedHeaders(text, "/contact/");
    const csp = contact.get("content-security-policy");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://calendly.com");
    expect(csp.match(/default-src/g)).toHaveLength(1);
    expect(csp).not.toContain("frame-src 'none'");
    expect(contact.get("x-frame-options")).toBe("DENY");
    const site = resolvedHeaders(text, "/services/it/");
    expect(site.get("content-security-policy")).toContain("frame-src 'none'");
    expect(site.get("content-security-policy")).not.toContain("calendly.com");
    expect(site.get("strict-transport-security")).toContain("max-age=31536000");
    expect(resolvedHeaders(text, "/api/contact").get("cache-control")).toBe("no-store");
  });
});
