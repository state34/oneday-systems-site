const MAX_BODY = 16 * 1024;
const HOUR_LIMIT = 5;
const DAY_LIMIT = 50;
const MIN_DELAY_MS = 3000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequest(context) {
  const { request, env } = context;
  const wantsJson = wantsJsonResponse(request);

  if (request.method !== "POST") {
    return reply(request, wantsJson, 405, "method");
  }

  if (!originAllowed(request)) {
    return reply(request, wantsJson, 403, "origin");
  }

  const parsed = await readBody(request);
  if (parsed.error) {
    return reply(request, wantsJson, parsed.error === "type" ? 415 : 400, "invalid");
  }

  const data = parsed.data || {};
  if (filled(data.website)) {
    return reply(request, wantsJson, 200, null);
  }

  if (tooFast(data.started)) {
    return reply(request, wantsJson, 400, "fast");
  }

  const fields = validate(data);
  if (fields.error) {
    return reply(request, wantsJson, 400, "invalid");
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const turnstile = await verifyTurnstile(env, data.turnstile || data["cf-turnstile-response"], ip);
  if (!turnstile.ok) {
    return reply(request, wantsJson, 400, "turnstile");
  }

  const limited = await rateLimit(env, request, ip);
  if (limited === "missing") {
    return reply(request, wantsJson, 503, "unavailable");
  }
  if (limited === "limited") {
    return reply(request, wantsJson, 429, "rate");
  }

  const sent = await sendMail(env, request, fields);
  if (!sent.ok) {
    console.error("contact send failed", sent.status || "config");
    return reply(request, wantsJson, 502, "send");
  }

  return reply(request, wantsJson, 200, null);
}

function wantsJsonResponse(request) {
  const type = contentType(request);
  const accept = request.headers.get("accept") || "";
  return type === "application/json" || accept.includes("application/json");
}

function contentType(request) {
  return (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
}

function originAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  const host = new URL(request.url).host;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (local) return url.host === host;
  if (url.protocol !== "https:") return false;
  if (url.host === host) return true;
  if (url.hostname === "onedaysystems.com" || url.hostname === "www.onedaysystems.com") return true;
  if (url.hostname === "site-rebuild.oneday-systems-site.pages.dev") return true;
  return url.hostname.endsWith(".oneday-systems-site.pages.dev");
}

async function readBody(request) {
  const declared = Number(request.headers.get("content-length") || "0");
  if (declared > MAX_BODY) return { error: "size" };
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_BODY) return { error: "size" };
  const text = new TextDecoder().decode(buf);
  const type = contentType(request);
  if (type === "application/json") {
    try {
      const data = JSON.parse(text);
      if (!data || typeof data !== "object" || Array.isArray(data)) return { error: "invalid" };
      return { data };
    } catch {
      return { error: "invalid" };
    }
  }
  if (type === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(text);
    return { data: Object.fromEntries(params.entries()) };
  }
  return { error: "type" };
}

function filled(value) {
  return typeof value === "string" && value.trim() !== "";
}

function tooFast(started) {
  const n = Number(started);
  if (!Number.isFinite(n)) return true;
  const delta = Date.now() - n;
  if (delta < MIN_DELAY_MS) return true;
  if (delta > 24 * 60 * 60 * 1000) return true;
  return false;
}

function hasCrlf(value) {
  return /[\r\n]/.test(value);
}

function stripControls(value, keepNewlines) {
  if (keepNewlines) return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return value.replace(/[\u0000-\u001F\u007F]/g, "");
}

function validate(data) {
  const name = typeof data.name === "string" ? data.name : "";
  const email = typeof data.email === "string" ? data.email : "";
  const message = typeof data.message === "string" ? data.message : "";
  const company = typeof data.company === "string" ? data.company : "";
  const phone = typeof data.phone === "string" ? data.phone : "";

  if (hasCrlf(name) || hasCrlf(email)) return { error: "crlf" };

  const cleanName = stripControls(name, false).trim();
  const cleanEmail = stripControls(email, false).trim();
  const cleanMessage = stripControls(message, true).trim();
  const cleanCompany = stripControls(company, false).trim();
  const cleanPhone = stripControls(phone, false).trim();

  if (cleanName.length < 1 || cleanName.length > 100) return { error: "name" };
  if (cleanEmail.length < 3 || cleanEmail.length > 254 || !EMAIL_RE.test(cleanEmail)) return { error: "email" };
  if (cleanMessage.length < 10 || cleanMessage.length > 5000) return { error: "message" };
  if (cleanCompany.length > 200 || cleanPhone.length > 200) return { error: "optional" };

  return {
    name: cleanName,
    email: cleanEmail,
    message: cleanMessage,
    company: cleanCompany,
    phone: cleanPhone,
  };
}

async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY || typeof token !== "string" || token.length < 1 || token.length > 2048) {
    return { ok: false };
  }
  const body = new URLSearchParams();
  body.set("secret", env.TURNSTILE_SECRET_KEY);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);
  let res;
  try {
    res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });
  } catch (err) {
    console.error("turnstile request failed");
    return { ok: false };
  }
  if (!res.ok) return { ok: false };
  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false };
  }
  return { ok: data.success === true };
}

function isLocal(request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

async function rateLimit(env, request, ip) {
  const kv = env.CONTACT_RL;
  if (!kv) return isLocal(request) ? "ok" : "missing";

  const hash = await sha256(ip || "unknown");
  const hourKey = `ip:${hash}`;
  const dayKey = `day:${new Date().toISOString().slice(0, 10)}`;
  const hourCount = Number((await kv.get(hourKey)) || "0");
  const dayCount = Number((await kv.get(dayKey)) || "0");
  if (hourCount >= HOUR_LIMIT || dayCount >= DAY_LIMIT) return "limited";
  await kv.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 });
  await kv.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 });
  return "ok";
}

async function sha256(value) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendMail(env, request, fields) {
  if (!env.RESEND_API_KEY || !env.CONTACT_TO || !env.CONTACT_FROM) return { ok: false, status: "config" };
  const country = request.headers.get("CF-IPCountry") || "";
  const lines = [
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
  ];
  if (fields.company) lines.push(`Company: ${fields.company}`);
  if (fields.phone) lines.push(`Phone: ${fields.phone}`);
  lines.push("", fields.message, "", `Sent: ${new Date().toISOString()}`, `Country: ${country}`);
  const text = lines.join("\n");

  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM,
        to: [env.CONTACT_TO],
        reply_to: fields.email,
        subject: `Website note from ${fields.name}`,
        text,
      }),
    });
  } catch (err) {
    console.error("resend request failed");
    return { ok: false, status: "network" };
  }
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true };
}

function reply(request, wantsJson, status, error) {
  if (!wantsJson) {
    const flag = status === 200 && !error ? "sent" : "error";
    return new Response(null, {
      status: 303,
      headers: {
        location: `/contact/?${flag}=1`,
        "cache-control": "no-store",
      },
    });
  }
  const body = error ? { ok: false, error } : { ok: true };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
