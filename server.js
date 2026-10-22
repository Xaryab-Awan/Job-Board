require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./database");

const app = express();
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }),
);
app.use(express.static("public"));

app.get("/api/ads", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, title, short_description FROM ads",
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
app.get("/api/ads/:id", async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ads.*, companies.name AS company_name
       FROM ads JOIN companies ON ads.company_id = companies.id
       WHERE ads.id = ?`,
      [req.params.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ error: "Ad not found" });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});
// SIGNUP
app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email and password are required" });
    }
    const [existing] = await db.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already used" });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)",
      [name, email, phone || null, hash],
    );
    req.session.user = { id: result.insertId, name, role: "user" };
    res.status(201).json({ role: "user" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: "Wrong email or password" });
    }
    req.session.user = { id: user.id, name: user.name, role: user.role };
    res.json({ role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGOUT
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// WHO AM I
app.get("/api/me", (req, res) => {
  if (!req.session.user)
    return res.status(401).json({ error: "Not logged in" });
  res.json(req.session.user);
});
app.listen(3001, () => console.log("Running on http://localhost:3001"));
