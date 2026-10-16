import { describe, expect, it, vi, afterEach } from "vitest";
import { onRequest } from "../functions/api/contact.js";

const SECRET = "turnstile-secret-value";
const RESEND = "resend-api-key-value";
const FROM = "One Day Systems <noreply@onedaysystems.com>";
const TO = "notes-go-here@example.com";

function kv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: vi.fn(async (key) => (store.has(key) ? store.get(key) : null)),
    put: vi.fn(async (key, value) => {
      store.set(key, value);
    }),
  };
}

function env(extra = {}) {
  return {
    RESEND_API_KEY: RESEND,
    CONTACT_TO: TO,
    CONTACT_FROM: FROM,
    TURNSTILE_SECRET_KEY: SECRET,
    CONTACT_RL: kv(),
    ...extra,
  };
}

function goodBody(over = {}) {
  return {
    name: "Ada Lovelace",
    email: "ada@example.com",
    company: "Analytical Engines",
    phone: "555-0100",
    message: "We need a room that just works for the board.",
    started: Date.now() - 5000,
    turnstile: "token-ok",
    ...over,
  };
}

function request(body, { method = "POST", origin, headers = {}, url } = {}) {
  const host = "site-rebuild.oneday-systems-site.pages.dev";
  return new Request(url || `https://${host}/api/contact`, {
    method,
    headers: {
      origin: origin === undefined ? `https://${host}` : origin,
      "content-type": "application/json",
      accept: "application/json",
      "cf-connecting-ip": "203.0.113.10",
      "cf-ipcountry": "US",
      ...headers,
    },
    body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(body),
  });
}

function mockFetch({ turnstile = true, resendStatus = 200, resendBody = { id: "email_1" }, hostname = "site-rebuild.oneday-systems-site.pages.dev", action = "contact" } = {}) {
  const calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url, opts) => {
    calls.push({ url: String(url), opts });
    if (String(url).includes("siteverify")) {
      return new Response(JSON.stringify({ success: turnstile, hostname, action }), { status: 200 });
    }
    if (String(url).includes("api.resend.com")) {
      return new Response(JSON.stringify(resendStatus === 200 ? resendBody : { message: "resend-internal-detail" }), {
        status: resendStatus,
      });
    }
    return new Response("unexpected", { status: 500 });
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

async function post(body, options = {}, envExtra) {
  const res = await onRequest({ request: request(body, options), env: env(envExtra) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* redirect */ }
  return { res, text, json };
}

describe("contact function", () => {
  it("returns 405 on GET", async () => {
    mockFetch();
    const { res, json } = await post(undefined, { method: "GET" });
    expect(res.status).toBe(405);
    expect(json).toEqual({ ok: false, error: "method" });
  });

  it("returns 403 for a foreign origin", async () => {
    mockFetch();
    const { res, json, text } = await post(goodBody(), { origin: "https://evil.example" });
    expect(res.status).toBe(403);
    expect(json.error).toBe("origin");
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(RESEND);
  });

  it("honeypot returns 200 and sends nothing", async () => {
    const calls = mockFetch();
    const { res, json } = await post(goodBody({ website: "https://spam.example" }));
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(calls.some((c) => c.url.includes("resend"))).toBe(false);
    expect(calls.some((c) => c.url.includes("siteverify"))).toBe(false);
  });

  it("rejects a too-fast submit", async () => {
    const calls = mockFetch();
    const { res, json } = await post(goodBody({ started: Date.now() }));
    expect(res.status).toBe(400);
    expect(json.error).toBe("fast");
    expect(calls.some((c) => c.url.includes("resend"))).toBe(false);
  });

  it.each([
    ["empty name", { name: "  " }],
    ["long name", { name: "a".repeat(101) }],
    ["bad email", { email: "not-an-email" }],
    ["long email", { email: `${"a".repeat(250)}@b.co` }],
    ["short message", { message: "too short" }],
    ["long message", { message: "m".repeat(5001) }],
    ["long company", { company: "c".repeat(201) }],
    ["long phone", { phone: "1".repeat(201) }],
    ["crlf in name", { name: "Ada\r\nBcc: x" }],
    ["crlf in email", { email: "ada@example.com\nBcc: x" }],
  ])("rejects %s", async (_label, over) => {
    mockFetch();
    const { res, json } = await post(goodBody(over));
    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid");
  });

  it("rejects a Turnstile failure", async () => {
    const calls = mockFetch({ turnstile: false });
    const { res, json } = await post(goodBody());
    expect(res.status).toBe(400);
    expect(json.error).toBe("turnstile");
    expect(calls.some((c) => c.url.includes("resend"))).toBe(false);
  });

  it("rejects Turnstile from the wrong host or action", async () => {
    mockFetch({ hostname: "evil.example" });
    const wrongHost = await post(goodBody());
    expect(wrongHost.res.status).toBe(400);
    expect(wrongHost.json.error).toBe("turnstile");
    mockFetch({ action: "login" });
    const wrongAction = await post(goodBody());
    expect(wrongAction.res.status).toBe(400);
    expect(wrongAction.json.error).toBe("turnstile");
  });

  it("returns 429 once the hourly rate limit is hit", async () => {
    mockFetch();
    const shared = env();
    let last;
    for (let i = 0; i < 5; i += 1) {
      last = await onRequest({
        request: request(goodBody(), { headers: { "cf-connecting-ip": "203.0.113.20" } }),
        env: shared,
      });
      expect(last.status).toBe(200);
    }
    const blocked = await onRequest({
      request: request(goodBody(), { headers: { "cf-connecting-ip": "203.0.113.20" } }),
      env: shared,
    });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ ok: false, error: "rate" });
  });

  it("returns 429 once the daily site-wide limit is hit", async () => {
    mockFetch();
    const shared = env();
    for (let i = 0; i < 50; i += 1) {
      const res = await onRequest({
        request: request(goodBody(), { headers: { "cf-connecting-ip": `203.0.113.${i}` } }),
        env: shared,
      });
      expect(res.status).toBe(200);
    }
    const blocked = await onRequest({
      request: request(goodBody(), { headers: { "cf-connecting-ip": "198.51.100.9" } }),
      env: shared,
    });
    expect(blocked.status).toBe(429);
  });

  it("sends through Resend with CONTACT_TO and the visitor reply_to", async () => {
    const calls = mockFetch();
    const { res, json, text } = await post(goodBody());
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    const mail = calls.find((c) => c.url.includes("api.resend.com"));
    const payload = JSON.parse(mail.opts.body);
    expect(payload.to).toEqual([TO]);
    expect(payload.reply_to).toBe("ada@example.com");
    expect(payload.from).toBe(FROM);
    expect(payload.subject).toBe("Website note from Ada Lovelace");
    expect(mail.opts.headers.authorization).toBe(`Bearer ${RESEND}`);
    expect(text).not.toContain(RESEND);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("resend-internal-detail");
  });

  it("returns a generic error when Resend responds 5xx", async () => {
    mockFetch({ resendStatus: 502 });
    const { res, json, text } = await post(goodBody());
    expect(res.status).toBe(502);
    expect(json).toEqual({ ok: false, error: "send" });
    expect(text).not.toContain("resend-internal-detail");
    expect(text).not.toContain(RESEND);
    expect(text).not.toContain(SECRET);
  });

  it("does not put secrets in a validation error", async () => {
    mockFetch();
    const { text } = await post(goodBody({ email: "nope" }));
    expect(text).not.toContain(RESEND);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(FROM);
  });
});
