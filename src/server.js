require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");

const app = express();
app.get("/docs.json", (req, res) => res.json(swaggerSpec));
const PORT = process.env.PORT || 4000;

/* ---- DB ---- */
if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment (.env)");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") 
    ? false 
    : { rejectUnauthorized: false }, // Required for cloud DBs (Neon/Supabase)
});

// ---- middleware
app.use(
  helmet({
    contentSecurityPolicy: false, 
    crossOriginEmbedderPolicy: false,
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "10kb" }));

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  })
);

app.use(
  rateLimit({
    windowMs: 60 * 1000, // 1 min
    max: 30, // 30 req/min per IP
  })
);


// ---- swagger
// CDN options to ensure assets load correctly on Vercel
const swaggerUiOptions = {
  customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css",
  customJs: [
    "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-bundle.js",
    "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-standalone-preset.js",
  ],
};

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 50px;">
      <h1>Contact API is Running</h1>
      <p>Status: <span style="color: green;">Active</span></p>
      <a href="/docs" style="font-size: 1.2rem; color: blue;">View Documentation</a>
    </div>
  `);
});

// ---- in-memory storage (replace with DB later)
const messages = [];

// ---- SSE clients (real-time)
const sseClients = new Set();

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

app.get("/api/health", (req, res) => {
  pool
    .query("SELECT 1 AS ok")
    .then(() => res.json({ ok: true, uptime: process.uptime(), db: "up" }))
    .catch(() => res.json({ ok: true, uptime: process.uptime(), db: "down" }));
});


app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body ?? {};

  // bare-minimum validation (you can upgrade to zod/joi later)
  if (typeof name !== "string" || name.trim().length < 2 || name.length > 80) {
    return res.status(400).json({ error: "Invalid name" });
  }
  if (
    typeof email !== "string" ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 160
  ) {
    return res.status(400).json({ error: "Invalid email" });
  }
  if (
    typeof message !== "string" ||
    message.trim().length < 5 ||
    message.length > 2000
  ) {
    return res.status(400).json({ error: "Invalid message" });
  }

const cleanName = name.trim();
  const cleanEmail = email.trim();
  const cleanMessage = message.trim();

  try {
    const result = await pool.query(
      `INSERT INTO contact_messages (name, email, message)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, message, created_at`,
      [cleanName, cleanEmail, cleanMessage]
    );

    const row = result.rows[0];
    const created = {
      id: Number(row.id),
      name: row.name,
      email: row.email,
      message: row.message,
      createdAt: row.created_at.toISOString(),
    };

    console.log("[CONTACT] request body:", req.body);
    console.log("[CONTACT] response body:", created);

  // real-time push
  broadcastSSE("contact:new", created);

   return res.status(201).json(created);
  } catch (err) {
    console.error("[DB] insert failed:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/contact", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, message, created_at
       FROM contact_messages
       ORDER BY created_at DESC
       LIMIT 200`
    );
    const rows = result.rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      email: r.email,
      message: r.message,
      createdAt: r.created_at.toISOString(),
    }));
    res.json(rows);
  } catch (err) {
    console.error("[DB] select failed:", err);
    res.status(500).json({ error: "Database error" });
  }

});


app.get("/api/contact/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // keep-alive ping
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25000);

  sseClients.add(res);

  req.on("close", () => {
    clearInterval(ping);
    sseClients.delete(res);
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Contact API running: http://localhost:${PORT}`);
    console.log(`Swagger UI:         http://localhost:${PORT}/docs`);
  });
}

// Export the app for Vercel
module.exports = app;
