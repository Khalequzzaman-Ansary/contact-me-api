process.env.DATABASE_URL = "";
process.env.JWT_SECRET = "test-secret";

const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
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

test("health check returns structured uptime when the database is unavailable", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const health = await response.json();

  assert.equal(response.status, 503);
  assert.equal(health.ok, false);
  assert.equal(health.db, "down");
  assert.deepEqual(Object.keys(health.uptime).sort(), ["days", "hours", "minutes", "seconds"]);
  assert.ok(Number.isInteger(health.uptime.days) && health.uptime.days >= 0);
  assert.ok(health.uptime.hours >= 0 && health.uptime.hours <= 23);
  assert.ok(health.uptime.minutes >= 0 && health.uptime.minutes <= 59);
  assert.ok(health.uptime.seconds >= 0 && health.uptime.seconds <= 59);
});

test("get contact by ID validates IDs and returns JSON for database errors", async () => {
  for (const id of ["0", "not-a-number", "9007199254740992"]) {
    const invalidId = await fetch(`${baseUrl}/api/contact/${id}`);
    assert.equal(invalidId.status, 400, `id ${id}`);
    assert.deepEqual(await invalidId.json(), {
      error: "Contact ID must be a positive integer",
    });
  }

  const validIdWithoutDatabase = await fetch(`${baseUrl}/api/contact/1`);
  assert.equal(validIdWithoutDatabase.status, 500);
  assert.deepEqual(await validIdWithoutDatabase.json(), { error: "Database error" });
});

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

test("delete by ID requires authentication and validates IDs before database access", async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/contact/1`, { method: "DELETE" });
  assert.equal(unauthenticated.status, 401);
  assert.deepEqual(await unauthenticated.json(), {
    error: "Missing or invalid Authorization header",
  });

  const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET);
  for (const id of ["0", "9007199254740992"]) {
    const invalidId = await fetch(`${baseUrl}/api/contact/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    assert.equal(invalidId.status, 400, `id ${id}`);
    assert.deepEqual(await invalidId.json(), {
      error: "Contact ID must be a positive integer",
    });
  }

  const validIdWithoutDatabase = await fetch(`${baseUrl}/api/contact/1`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(validIdWithoutDatabase.status, 500);
  assert.deepEqual(await validIdWithoutDatabase.json(), { error: "Database error" });
});

test("documented frontend origin is allowed and unknown origins are rejected", async () => {
  for (const origin of [
    "https://ansary-portfolio.vercel.app",
    "https://contact-api-brown.vercel.app",
  ]) {
    const allowed = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
      },
      body: JSON.stringify({ name: 42, email: "ada@example.com", message: "Hello there" }),
    });

    assert.equal(allowed.status, 400, `origin ${origin}`);
    assert.equal(allowed.headers.get("access-control-allow-origin"), origin);
  }

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
  const openApi = await docs.json();
  assert.ok(openApi.paths["/api/contact"].delete);
  assert.ok(openApi.paths["/api/contact/{id}"].get);
  assert.ok(openApi.paths["/api/contact/{id}"].delete);
  const uptimeSchema = openApi.paths["/api/health"].get.responses[200].content["application/json"].schema;
  assert.deepEqual(uptimeSchema.properties.uptime.required, ["days", "hours", "minutes", "seconds"]);

  const swaggerInit = await fetch(`${baseUrl}/docs/swagger-ui-init.js`);
  const swaggerConfig = await swaggerInit.text();
  assert.equal(swaggerInit.status, 200);
  assert.ok(swaggerConfig.includes("operationsSorter"));
  assert.ok(
    swaggerConfig.indexOf('"GET /api/contact"') <
      swaggerConfig.indexOf('"GET /api/contact/{id}"')
  );
  assert.ok(
    swaggerConfig.indexOf('"GET /api/contact/{id}"') <
      swaggerConfig.indexOf('"DELETE /api/contact"')
  );
});