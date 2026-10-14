# Contact API

An Express and MongoDB API for contact form submissions. It supports contact creation and listing, private message deletion, real-time notifications with Server-Sent Events, and OpenAPI documentation.

- Production API: <https://contact-api-brown.vercel.app/>
- Interactive API documentation: <https://contact-api-brown.vercel.app/docs>
- OpenAPI document: <https://contact-api-brown.vercel.app/docs.json>

## Features

- Store contact messages in MongoDB using Mongoose.
- List up to 200 recent messages.
- Notify connected clients about new messages through SSE.
- Privately delete one contact by its numeric API ID or delete all contacts.
- Inspect service/database health and readable process uptime.
- Use JSON error responses for API errors, with request validation, CORS, Helmet, logging, and rate limiting.

## Local Setup

Requirements: Node.js, npm, and a MongoDB database.

```bash
npm install
```

Create a root `.env` from the example file and set real credentials:

```bash
cp .env.example .env
```

On PowerShell, use `Copy-Item .env.example .env` instead. Configure:

| Variable       | Required                      | Description                                                                                            |
| -------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` | Yes                           | MongoDB connection string, such as `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/contact-db`. |
| `JWT_SECRET`   | Yes for private delete routes | Secret used to sign and verify admin bearer tokens. Use a long, random value.                          |
| `CORS_ORIGIN`  | No                            | Comma-separated list of additional exact browser origins allowed to call the API.                      |
| `PORT`         | No                            | Local HTTP port. Defaults to `4000`.                                                                   |

Start the server:

```bash
node src/server.js
```

The server prints its local URL and attempts to connect to MongoDB. After a successful connection it prints `MongoDB connected successfully ✓`. If the database connection fails, the HTTP server still starts and logs the connection failure; database-dependent requests will not succeed until connectivity is restored.

Run the automated tests with:

```bash
npm test
```

The test suite uses Node's built-in test runner and intentionally disables the database connection for isolated HTTP tests.

## API Reference

All routes are also listed in Swagger UI at `/docs` and in `/docs.json`.

| Method   | Path                  | Auth         | Purpose                                                                                                                     |
| -------- | --------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/`                   | No           | Basic service status page.                                                                                                  |
| `GET`    | `/api/health`         | No           | API and database status, with uptime split into days, hours, minutes, and seconds. Returns `503` if MongoDB is unavailable. |
| `POST`   | `/api/contact`        | No           | Create a contact message.                                                                                                   |
| `GET`    | `/api/contact`        | No           | List up to 200 contacts, newest first.                                                                                      |
| `GET`    | `/api/contact/stream` | No           | Receive `contact:new` events over Server-Sent Events.                                                                       |
| `DELETE` | `/api/contact/{id}`   | Bearer token | Delete one contact by its numeric API ID.                                                                                   |
| `DELETE` | `/api/contact`        | Bearer token | Delete all contacts and reset the contact ID counter.                                                                       |
| `GET`    | `/docs`               | No           | Interactive Swagger documentation.                                                                                          |
| `GET`    | `/docs.json`          | No           | OpenAPI JSON document.                                                                                                      |

### Health Check

Example response when the database is available:

```json
{
  "ok": true,
  "uptime": {
    "days": 0,
    "hours": 0,
    "minutes": 3,
    "seconds": 26
  },
  "db": "up"
}
```

When the database is unavailable, the endpoint returns HTTP `503`, with `ok: false` and `db: "down"`; the `uptime` object is still included.

### Create a Contact

Send JSON with a name (2–80 characters), email (up to 160 characters), and message (5–2000 characters):

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","message":"Hello from the contact form."}' \
  http://localhost:4000/api/contact
```

On success, the API responds with HTTP `201` and a contact object containing the numeric `id`, submitted fields, and `createdAt` timestamp. The contact is also broadcast to connected SSE clients.

### List Contacts

```bash
curl http://localhost:4000/api/contact
```

Returns an array of up to 200 contacts, sorted newest first.

### Delete Contacts

Both delete operations require an admin JWT in the `Authorization` header. Generate a one-hour token using the local `JWT_SECRET`:

```bash
node src/generate-token.js
```

Keep the printed token private. Delete one contact using the numeric `id` returned by the API:

```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/contact/123
```

The response is `200` when deleted, `400` for an invalid ID, `401` for a missing or invalid token, and `404` if the contact does not exist. Deleting one contact does not reset the ID counter.

Delete all contacts (destructive; also resets the ID counter):

```bash
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:4000/api/contact
```

### Real-Time Events

Clients connected to `/api/contact/stream` receive a `contact:new` event whenever a contact is created:

```javascript
const events = new EventSource("http://localhost:4000/api/contact/stream");
events.addEventListener("contact:new", (event) => {
  const contact = JSON.parse(event.data);
  console.log("New contact:", contact);
});
```

## CORS and Security

For browser requests, `CORS_ORIGIN` must contain the exact origin of the frontend page (scheme, hostname, and port), not the API URL. Separate multiple origins with commas, for example:

```env
CORS_ORIGIN=http://localhost:3000,https://your-frontend.example
```

The API already permits its configured production frontend/API origins and loopback development hosts (`localhost`, `127.0.0.1`, and `::1`). Other origins must be listed explicitly. CORS is a browser policy, not an authentication mechanism.

The service uses Helmet, Morgan request logging, a 10 KB JSON body limit, and a rate limit of 30 requests per minute per IP. Keep `.env` out of source control and never expose `DATABASE_URL`, `JWT_SECRET`, or generated JWTs in client-side code.

## Deployment on Vercel

The Vercel function entry point is `api/server.js`, which exports the Express app from `src/server.js`. `vercel.json` rewrites incoming paths to that function. Configure `DATABASE_URL` and `JWT_SECRET` in the Vercel project environment; set `CORS_ORIGIN` to any additional frontend origins, then redeploy after changing environment variables or code.

## Project Structure

```text
api/server.js                 Vercel function entry point
src/server.js                 Express app, routes, middleware, and DB connection
src/swagger.js                OpenAPI specification
src/models/Contact.js         Contact schema and numeric ID generation
src/models/Counter.js         Contact ID counter schema
src/middleware/auth.js        Bearer JWT authentication
src/generate-token.js         Local one-hour admin token generator
src/swagger-dark.css          Swagger UI theme
src/swagger-toggle.js         Swagger UI theme toggle
test/contact-api.test.js      HTTP tests
vercel.json                   Vercel routing configuration
```

## License

ISC (see `package.json`).
