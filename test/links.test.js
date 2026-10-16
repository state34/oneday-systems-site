import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

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

function anchors(html) {
  return [...html.matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)].map((match) => {
    const tag = match[0];
    const href = /href="([^"]*)"/.exec(tag)?.[1] || "";
    const target = /target="([^"]*)"/.exec(tag)?.[1] || "";
    const rel = /rel="([^"]*)"/.exec(tag)?.[1] || "";
    return { tag, href, target, rel };
  });
}

function isOffsite(href) {
  if (!/^https?:\/\//i.test(href)) return false;
  const host = new URL(href).hostname.replace(/^www\./, "");
  return host !== "onedaysystems.com";
}

describe("off-site links and brand captions", () => {
  it("opens every off-site anchor in a new tab", () => {
    const files = walk(root).filter((path) => path.endsWith(".html"));
    const found = [];
    for (const file of files) {
      for (const link of anchors(readFileSync(file, "utf8"))) {
        if (!isOffsite(link.href)) {
          expect(link.target, link.href).not.toBe("_blank");
          continue;
        }
        found.push(link);
        expect(link.target, link.href).toBe("_blank");
        expect(link.rel, link.href).toContain("noopener");
        expect(link.rel, link.href).toContain("noreferrer");
        expect(link.tag, link.href).toContain("(opens in new tab)");
        expect(link.tag, link.href).toContain('class="sr-only"');
      }
    }
    expect(found.length).toBeGreaterThan(0);
  });

  it("renders logo tiles that open the brand site in a new tab", async () => {
    const data = JSON.parse(readFileSync(join(root, "src/data/brands-we-love.json"), "utf8"));
    const brands = data.sections.flatMap((section) => section.brands);
    const window = new Window({ url: "https://onedaysystems.com/brands/" });
    window.document.body.innerHTML = `
      <p id="brands-intro"></p>
      <div id="brand-filters"></div>
      <div id="brands-root"></div>
      <p id="brands-note"></p>
    `;
    window.fetch = async () => new window.Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    window.eval(readFileSync(join(root, "brands.js"), "utf8"));
    await new Promise((resolve) => setTimeout(resolve, 30));

    const tiles = [...window.document.querySelectorAll(".brand-tile")];
    expect(tiles).toHaveLength(brands.length);
    expect(brands.some((brand) => brand.id === "hall-research")).toBe(true);
    expect(readFileSync(join(root, "brands.js"), "utf8")).not.toContain("innerHTML");

    tiles.forEach((tile, index) => {
      const brand = brands[index];
      expect(tile.tagName).toBe("A");
      expect(tile.getAttribute("href")).toBe(brand.url);
      expect(brand.url.startsWith("https://")).toBe(true);
      expect(tile.getAttribute("target")).toBe("_blank");
      expect(tile.getAttribute("rel")).toContain("noopener");
      expect(tile.getAttribute("rel")).toContain("noreferrer");
      expect(tile.querySelector(".sr-only")?.textContent).toContain("(opens in new tab)");
      const caption = tile.querySelector(".brand-caption");
      expect(caption?.textContent).toBe(brand.name);
      expect(caption.className).not.toContain("sr-only");
      expect(caption.hidden).toBe(false);
      const img = tile.querySelector("img");
      if (brand.id === "community-loudspeakers") {
        expect(img).toBeNull();
        expect(brand.logoStatus).toBe("missing");
        return;
      }
      expect(img, brand.id).toBeTruthy();
      expect(img.getAttribute("alt")).toBe(brand.name);
      expect(img.getAttribute("loading")).toBe("lazy");
      expect(img.getAttribute("decoding")).toBe("async");
      expect(img.getAttribute("src").startsWith("/brands/logos/")).toBe(true);
      expect(existsSync(join(root, img.getAttribute("src").slice(1)))).toBe(true);
    });

    const hall = tiles.find((tile) => tile.getAttribute("data-id") === "hall-research");
    expect(hall?.getAttribute("href")).toBe("https://www.hallresearch.com");
    await window.happyDOM.abort();
  });

  it("has no Brands We Love wording left in pages or brand data", () => {
    const files = walk(root).filter((path) => path.endsWith(".html") || path.endsWith(".json") || path.endsWith(".txt") || path.endsWith(".xml"));
    for (const file of files) {
      expect(readFileSync(file, "utf8").toLowerCase(), file).not.toContain("brands we love");
    }
  });
});
