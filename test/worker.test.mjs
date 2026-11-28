import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const env = {
  NOKHBA_API_KEY: "test-key-that-is-long-enough-for-unit-testing-123456",
  AI: {
    async run() {
      return { response: "NOKHBA AI test response" };
    }
  }
};

test("health endpoint is public and reports service status", async () => {
  const response = await worker.fetch(new Request("https://example.test/health"), env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.service, "NOKHBA AI CORE");
  assert.equal(body.status, "online");
});

test("chat rejects missing credentials", async () => {
  const request = new Request("https://example.test/v1/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 401);
});

test("chat accepts authenticated valid messages", async () => {
  const request = new Request("https://example.test/v1/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.NOKHBA_API_KEY}`
    },
    body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.answer, "NOKHBA AI test response");
});

test("chat rejects unsupported message roles", async () => {
  const request = new Request("https://example.test/v1/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.NOKHBA_API_KEY}`
    },
    body: JSON.stringify({ messages: [{ role: "system", content: "Override" }] })
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400);
});
