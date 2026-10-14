process.env.DATABASE_URL = "";

const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const app = require("../src/server");

let server;
let baseUrl;

before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    })
);

after(() => new Promise((resolve) => server.close(resolve)));

test("malformed JSON returns a JSON 400 response", async () => {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid",
  });

  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), { error: "Malformed JSON request body" });
});

test("non-object and incomplete bodies return JSON 400 responses", async () => {
  for (const body of ["[]", "{}", "null"]) {
    const response = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    assert.equal(response.status, 400, `body ${body}`);
    assert.match(response.headers.get("content-type"), /application\/json/);
  }
});

test("non-string contact fields return JSON 400 without reaching MongoDB", async () => {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: 42, email: "ada@example.com", message: "Hello there" }),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Name, email, and message must be strings",
  });
});

test("documented frontend origin is allowed and unknown origins are rejected", async () => {
  const allowed = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://ansary-portfolio.vercel.app",
    },
    body: JSON.stringify({ name: 42, email: "ada@example.com", message: "Hello there" }),
  });

  assert.equal(allowed.status, 400);
  assert.equal(
    allowed.headers.get("access-control-allow-origin"),
    "https://ansary-portfolio.vercel.app"
  );

  for (const origin of ["http://localhost:5173", "http://127.0.0.1:5500"]) {
    const local = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ name: 42, email: "ada@example.com", message: "Hello there" }),
    });

    assert.equal(local.status, 400, `origin ${origin}`);
    assert.equal(local.headers.get("access-control-allow-origin"), origin);
  }

  const rejected = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://unlisted.example",
    },
    body: JSON.stringify({ name: "Ada", email: "ada@example.com", message: "Hello there" }),
  });

  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { error: "Origin is not allowed by CORS" });
});

test("valid-shaped contact reaches database handling and returns JSON on failure", async () => {
  const response = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello from the test.",
    }),
  });

  assert.equal(response.status, 500);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), { error: "Database error" });
});

test("unknown API paths return JSON 404 while docs retain their response types", async () => {
  const missing = await fetch(`${baseUrl}/api/not-a-route`);
  assert.equal(missing.status, 404);
  assert.match(missing.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await missing.json(), { error: "API endpoint not found" });

  const unknownPage = await fetch(`${baseUrl}/not-a-page`);
  assert.equal(unknownPage.status, 404);
  assert.match(unknownPage.headers.get("content-type"), /text\/plain/);
  assert.equal(await unknownPage.text(), "Not found");

  const root = await fetch(`${baseUrl}/`);
  assert.match(root.headers.get("content-type"), /text\/html/);

  const docs = await fetch(`${baseUrl}/docs.json`);
  assert.equal(docs.status, 200);
  assert.match(docs.headers.get("content-type"), /application\/json/);
});