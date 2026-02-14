# Contact API

> Enterprise-ready contact form backend — Express + PostgreSQL + SSE + OpenAPI
>
> Live URL: <https://contact-api-brown.vercel.app/>

## Project Overview

Contact API is a lightweight, secure backend for handling contact form submissions. It provides:

- REST endpoints for submitting and listing contact messages
- Server-Sent Events (SSE) for real-time notifications
- OpenAPI (Swagger) documentation served at `/docs`
- Production-ready defaults: Helmet, rate-limiting, CORS, and PostgreSQL connection with SSL support

## Key features

- Robust validation and error handling
- PostgreSQL persistence (uses `contact_messages` table)
- Real-time `contact:new` events over SSE at `/api/contact/stream`
- API docs: `/docs` and machine-readable `/docs.json`
- Ready for Vercel deployment (see `vercel.json`)

## 📁 Folder structure

Below is the repository layout with short descriptions for each file/folder.

```

contact-api
├── package-lock.json
├── package.json
├── README.md
├── src
|  ├── server.js
|  └── swagger.js
└── vercel.json

```

## Quickstart (Local)

1. Install dependencies

```bash
npm install
```

2. Create a `.env` file at the repository root. Example values are present in the repository's `.env` file.

Required environment variables:

- `PORT` — port to bind (default: `4000`)
- `CORS_ORIGIN` — allowed origin for CORS
- `DATABASE_URL` — full Postgres connection string (examples use Neon/Postgres)

3. Run the server

```bash
# Run directly
node src/server.js

# Or with dotenv preloaded
node -r dotenv/config src/server.js
```

The server will expose:

- Web UI docs: `/docs`
- OpenAPI JSON: `/docs.json`
- Health check: `/api/health`
- Contact endpoints: `/api/contact` and `/api/contact/stream`

## API Reference

All endpoints are documented in the OpenAPI spec generated from `src/swagger.js` and accessible through the documentation UI.

- GET `/api/health` — health status JSON
- POST `/api/contact` — submit contact message
  - Body schema: `name` (string, 2–80), `email` (email), `message` (string, 5–2000)
  - Returns: created message object (201)
- GET `/api/contact` — list recent messages (up to 200)
- GET `/api/contact/stream` — Server-Sent Events (SSE). Clients receive `contact:new` events when new messages arrive.

Example curl (submit):

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada Lovelace","email":"ada@example.com","message":"Hello from the contact form."}' \
  http://localhost:4000/api/contact
```

SSE example (javascript client):

```javascript
const es = new EventSource("http://localhost:4000/api/contact/stream");
es.addEventListener("contact:new", (e) => {
  const data = JSON.parse(e.data);
  console.log("New contact:", data);
});
```

## Database schema

The API expects a Postgres table named `contact_messages`. Example migration SQL:

```sql
CREATE TABLE contact_messages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Connections:

- The app reads `DATABASE_URL` from the environment and automatically enables SSL for non-local connections.

## Security & Production Notes

- Uses `helmet` with CSP disabled for ease of docs loading on CDN
- Request logging with `morgan` (dev) and rate limiting (`express-rate-limit`) to protect endpoints
- Ensure `DATABASE_URL` is set to a secure production database and your provider's SSL certs are trusted

## Vercel Deployment

This repository includes `vercel.json` configured to rewrite requests to `server.js` for serverful deployment. If deploying on Vercel:

- Ensure your Vercel project has the `DATABASE_URL` and `CORS_ORIGIN` environment variables configured.
- The code exports the Express `app` to support serverless/serverful deployment patterns.

## Useful files

- OpenAPI setup: [src/swagger.js](src/swagger.js)
- Server entry: [src/server.js](src/server.js)
- Deployment config: [vercel.json](vercel.json)
- Environment example: [.env](.env)

## Contributing

Contributions are welcome. Suggested next steps:

- Add automated tests and CI
- Add migration tooling (e.g. `node-pg-migrate` or `knex`)
- Add input schema validation (Zod/Joi) and centralized error handling

## License

This project uses the ISC license as declared in `package.json`.

---

Built with ❤️ by [Khalequzzaman Ansary](https://ansary-portfolio.vercel.app/)
