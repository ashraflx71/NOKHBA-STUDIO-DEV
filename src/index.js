const MODEL = "@cf/google/gemma-4-26b-a4b-it";
const MAX_PROMPT_CHARS = 6000;
const MAX_OUTPUT_TOKENS = 512;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return new Uint8Array(hash);
}

async function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const [left, right] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

async function authorized(request, env) {
  const configured = env.NOKHBA_API_KEY;
  if (typeof configured !== "string" || configured.length < 32) return false;
  const header = request.headers.get("Authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._~-]{32,})$/.exec(header);
  return Boolean(match && await safeEqual(match[1], configured));
}

function validMessages(messages) {
  if (!Array.isArray(messages) || messages.length < 1 || messages.length > 12) return false;
  return messages.every((item) =>
    item &&
    ["user", "assistant"].includes(item.role) &&
    typeof item.content === "string" &&
    item.content.trim().length > 0 &&
    item.content.length <= MAX_PROMPT_CHARS
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ service: "NOKHBA AI CORE", status: "online", version: "0.1.0", authenticated: false });
    }

    if (url.pathname !== "/v1/chat") {
      return json({ error: "Not found" }, 404);
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
    if (!await authorized(request, env)) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (!env.AI || typeof env.AI.run !== "function") {
      return json({ error: "Workers AI binding is not configured" }, 503);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    if (!validMessages(body.messages)) {
      return json({ error: "messages must contain 1–12 user/assistant messages; each message must be non-empty and within the size limit" }, 400);
    }

    const maxTokens = Number.isInteger(body.max_tokens)
      ? Math.min(Math.max(body.max_tokens, 32), MAX_OUTPUT_TOKENS)
      : 384;

    try {
      const result = await env.AI.run(MODEL, {
        messages: [
          {
            role: "system",
            content: "You are NOKHBA AI, a careful bilingual assistant for the NOKHBA project family. Be accurate, concise, and transparent. Never claim to have inspected, changed, deployed, or repaired a system unless that action was actually performed. Never request or reveal passwords, API tokens, or private credentials. For operational changes, explain risks and require explicit human approval."
          },
          ...body.messages
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
        enable_thinking: false
      });

      const answer = typeof result === "string"
        ? result
        : (result?.response || result?.output_text || result?.result || "");

      if (typeof answer !== "string" || !answer.trim()) {
        return json({ error: "The model returned an empty response" }, 502);
      }

      return json({ answer, model: MODEL, usage: result?.usage || null });
    } catch {
      return json({ error: "AI inference failed; retry later" }, 502);
    }
  }
};
