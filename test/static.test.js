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
  const blocks = {};
  let path = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      path = line.trim();
      blocks[path] = {};
    } else if (path) {
      const idx = line.indexOf(":");
      blocks[path][line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return blocks;
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
    expect(contact).toContain('rel="noopener"');
    for (const file of htmlFiles()) {
      if (file.endsWith("contact/index.html")) continue;
      const html = readFileSync(file, "utf8");
      expect(html, relative(root, file)).not.toContain("widget.js");
      expect(html, relative(root, file)).not.toContain("calendly-inline-widget");
    }
  });

  it("parses _headers and allows Calendly and Turnstile on /contact/", () => {
    const blocks = parseHeaders(readFileSync(join(root, "_headers"), "utf8"));
    const csp = blocks["/contact/*"]["Content-Security-Policy"];
    expect(csp).toContain("https://assets.calendly.com");
    expect(csp).toContain("https://challenges.cloudflare.com");
    expect(csp).toContain("https://calendly.com");
    expect(csp).toContain("https://*.calendly.com");
    expect(blocks["/*"]["Content-Security-Policy"]).toContain("frame-src 'none'");
    expect(blocks["/api/*"]["Cache-Control"]).toBe("no-store");
  });
});
