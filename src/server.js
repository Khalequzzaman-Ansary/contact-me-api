require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger");
const Contact = require("./models/Contact");
const authenticate = require("./middleware/auth");

const app = express();
app.get("/docs.json", (req, res) => res.json(swaggerSpec));
const PORT = process.env.PORT || 4000;

/* ---- DB (MongoDB) ---- */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Missing DATABASE_URL in environment (.env)");
  process.exit(1);
}

mongoose
  .connect(connectionString)
  .then(() => console.log("[DB] MongoDB connected ✅"))
  .catch((err) => {
    console.error("[DB] MongoDB connection failed:", err.message);
    process.exit(1);
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
// Serve static files from src directory (for dark mode assets)
app.use("/src", express.static(__dirname));

// CDN options to ensure assets load correctly on Vercel
const swaggerUiOptions = {
  customCssUrl: "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui.min.css",
  customCss: require("fs").readFileSync(__dirname + "/swagger-dark.css", "utf8"),
  customJs: [
    "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-bundle.js",
    "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.0.0/swagger-ui-standalone-preset.js",
    "/src/swagger-toggle.js",
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

// ---- SSE clients (real-time) ----
const sseClients = new Set();

function broadcastSSE(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

app.get("/api/health", (req, res) => {
  const dbUp = mongoose.connection.readyState === 1;
  res.json({ ok: true, uptime: process.uptime(), db: dbUp ? "up" : "down" });
});


app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body ?? {};

  // basic presence check (Mongoose handles detailed validation)
  if (!name || !email || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const contact = await Contact.create({
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    });

    const created = {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      message: contact.message,
      createdAt: contact.createdAt.toISOString(),
    };

    console.log("[CONTACT] request body:", req.body);
    console.log("[CONTACT] response body:", created);

    // real-time push
    broadcastSSE("contact:new", created);

    return res.status(201).json(created);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ error: err.message });
    }
    console.error("[DB] insert failed:", err);
    return res.status(500).json({ error: "Database error" });
  }
});

app.get("/api/contact", async (req, res) => {
  try {
    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const rows = contacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      message: c.message,
      createdAt: c.createdAt.toISOString(),
    }));
    res.json(rows);
  } catch (err) {
    console.error("[DB] select failed:", err);
    res.status(500).json({ error: "Database error" });
  }
});


app.delete("/api/contact", authenticate, async (req, res) => {
  try {
    await Contact.deleteMany({});
    const Counter = require("./models/Counter");
    await Counter.findByIdAndUpdate(
      { _id: "contactId" },
      { $set: { seq: 0 } },
      { returnDocument: "after", upsert: true }
    );
    res.json({ ok: true, message: "All contacts deleted, counter reset" });
  } catch (err) {
    console.error("[DB] delete failed:", err);
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
