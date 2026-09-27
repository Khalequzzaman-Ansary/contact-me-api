require("dotenv").config();
const jwt = require("jsonwebtoken");

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error("Missing JWT_SECRET in environment (.env)");
  process.exit(1);
}

const token = jwt.sign({ role: "admin" }, secret, { expiresIn: "1h" });
console.log("Generated JWT token (expires in 1 hour):");
console.log(token);
