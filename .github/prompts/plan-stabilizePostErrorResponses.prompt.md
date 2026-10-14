## Plan: Stabilize POST Error Responses

The POST failure appears before the handler: it reproduces locally and on Vercel, and there is no `[DB] insert failed` log. Add a consistent JSON error boundary plus explicit body validation, with a focused check that malformed requests fail as JSON and never reach the database. If valid requests still return 500, use the existing DB health check and function logs to identify a separate database cause.

**Steps**

1. In `src/server.js`, add API JSON not-found handling and a final Express error handler after routes. Classify JSON parser errors (malformed body and payload too large) with appropriate 4xx statuses; ensure the response content type is JSON and do not expose internal stack details. Preserve existing HTML root/docs behavior.
2. Update `POST /api/contact` request validation to require a JSON object with string `name`, `email`, and `message` values before calling `.trim()` or connecting to MongoDB. Return 400 JSON for missing, incorrectly typed, or schema-invalid input rather than allowing type errors to become 500s.
3. Add focused tests using Node's built-in test/HTTP tooling (no new dependency unless the existing lockfile/test setup supports one). Cover malformed JSON, missing and non-string fields, JSON content type/status, and a valid-shaped request reaching the database path. Do not treat a DB-unavailable 500 as the parsing/input fix failing; record that separately.
4. Run the focused test command. Then manually verify `GET /api/health` and a valid `POST /api/contact`; if health reports DB down or the POST still returns 500, inspect deployment environment configuration and MongoDB logs rather than masking the database error.

**Relevant files**

- `src/server.js` — body parser registration, POST handler, and route/error middleware ordering.
- `package.json` — configure the focused test script if needed.
- `src/models/Contact.js` — reference schema validation and save hook; no change planned unless a reproduced model-level failure points here.

**Verification**

1. Malformed JSON sent to `POST /api/contact` returns a JSON 400, not an HTML body.
2. Missing or non-string fields return JSON 400 without a MongoDB connection attempt.
3. Valid-shaped input either returns 201 with the created contact when MongoDB is available, or a sanitized JSON 500 with a corresponding server-side cause when unavailable.
4. Confirm existing `/`, `/docs`, and `/docs.json` responses remain functional.

**Decisions**

- Preserve successful POST behavior and existing status conventions; prevent pre-route middleware errors from surfacing as HTML.
- The reported absence of the insert-failure log means the current evidence does not support assuming MongoDB is the root cause. Keep database diagnosis as a separate verification branch if 500 persists for a well-formed request.
- Do not read, print, or commit `.env` values. A local `.env` appears to contain a MongoDB credential; rotate it if it has been committed or shared.
