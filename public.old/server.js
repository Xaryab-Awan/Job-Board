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

// ---------- ACCESS CHECKS ----------
// For API routes: answer with JSON and a status code.
function requireLogin(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ error: "Not logged in" });
  next();
}

// For pages: send the visitor to the login page.
function requireLoginPage(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  next();
}

function requireAdminPage(req, res, next) {
  if (!req.session.user) return res.redirect("/login.html");
  if (req.session.user.role !== "admin") return res.redirect("/");
  next();
}

// ---------- PAGE GUARDS ----------
// These MUST come before express.static. Static files are served by the
// first middleware that matches, so a guard placed after it never runs.
app.get(["/", "/index.html", "/profile.html"], requireLoginPage);
app.get("/admin.html", requireAdminPage);
app.use("/css", express.static("public/css"));
app.use("/js", express.static("public/js"));
app.use(express.static("public/html"));

// ---------- ADS ----------
app.get("/api/ads", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ads.id, ads.title, ads.short_description, ads.location,
              ads.wage, ads.working_time, companies.name AS company_name
       FROM ads JOIN companies ON ads.company_id = companies.id
       ORDER BY ads.created_at DESC, ads.id DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/ads/:id", requireLogin, async (req, res) => {
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

// APPLY: the applicant is always the logged-in user (their profile details
// are linked to the application through user_id).
app.post("/api/ads/:id/applications", requireLogin, async (req, res) => {
  try {
    const message = (req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message is required" });

    const [ads] = await db.query("SELECT id FROM ads WHERE id = ?", [
      req.params.id,
    ]);
    if (ads.length === 0)
      return res.status(404).json({ error: "Ad not found" });

    await db.query(
      "INSERT INTO applications (ad_id, user_id, message) VALUES (?, ?, ?)",
      [req.params.id, req.session.user.id, message],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- AUTH ----------
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
    if (
      !user ||
      !user.password_hash ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
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

// ---------- MY PROFILE ----------
// GET: the logged-in user's details, read fresh from the database.
app.get("/api/me", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id, name, email, phone FROM users WHERE id = ?",
      [req.session.user.id],
    );
    if (rows.length === 0) {
      // The account was deleted (for example by an admin): end the session.
      return req.session.destroy(() =>
        res.status(401).json({ error: "Not logged in" }),
      );
    }
    // The role comes from the session, because that is what the server
    // enforces on the admin routes.
    res.json({ ...rows[0], role: req.session.user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT: the user edits their own details. The id comes from the session,
// never from the request, and the role can never be changed here.
app.put("/api/me", requireLogin, async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    const email = (req.body.email || "").trim();
    const phone = (req.body.phone || "").trim();
    const { password } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: "Name and email are required" });
    }
    const [taken] = await db.query(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email, req.session.user.id],
    );
    if (taken.length > 0) {
      return res.status(409).json({ error: "Email already used" });
    }

    const data = { name, email, phone: phone || null };
    if (password) data.password_hash = await bcrypt.hash(password, 10);

    await db.query("UPDATE users SET ? WHERE id = ?", [
      data,
      req.session.user.id,
    ]);
    req.session.user.name = name;
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN ----------
const adminTables = {
  users: ["name", "email", "phone", "role"],
  companies: ["name", "website", "location"],
  ads: [
    "title",
    "short_description",
    "full_description",
    "wage",
    "location",
    "working_time",
    "company_id",
    "owner_id",
  ],
  applications: ["ad_id", "user_id", "message"],
};

function requireAdmin(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ error: "Not logged in" });
  if (req.session.user.role !== "admin")
    return res.status(403).json({ error: "Admins only" });
  next();
}
function checkTable(req, res, next) {
  if (!adminTables[req.params.table])
    return res.status(404).json({ error: "Unknown table" });
  next();
}
const admin = [requireAdmin, checkTable];

function pickFields(table, body) {
  const data = {};
  adminTables[table].forEach((f) => {
    if (body[f] !== undefined) data[f] = body[f] === "" ? null : body[f];
  });
  return data;
}

// LIST (paginated)
app.get("/api/admin/:table", admin, async (req, res) => {
  try {
    const table = req.params.table;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM ??", [
      table,
    ]);
    const [rows] = await db.query(
      "SELECT * FROM ?? ORDER BY id DESC LIMIT ? OFFSET ?",
      [table, limit, (page - 1) * limit],
    );
    rows.forEach((r) => delete r.password_hash);
    res.json({ rows, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// CREATE
app.post("/api/admin/:table", admin, async (req, res) => {
  try {
    const table = req.params.table;
    const data = pickFields(table, req.body);
    if (table === "users" && req.body.password) {
      data.password_hash = await bcrypt.hash(req.body.password, 10);
    }
    const [r] = await db.query("INSERT INTO ?? SET ?", [table, data]);
    res.status(201).json({ id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.sqlMessage || "Invalid data" });
  }
});

// UPDATE
app.put("/api/admin/:table/:id", admin, async (req, res) => {
  try {
    const table = req.params.table;
    const data = pickFields(table, req.body);
    if (table === "users" && req.body.password) {
      data.password_hash = await bcrypt.hash(req.body.password, 10);
    }
    const [r] = await db.query("UPDATE ?? SET ? WHERE id = ?", [
      table,
      data,
      req.params.id,
    ]);
    if (r.affectedRows === 0)
      return res.status(404).json({ error: "Record not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.sqlMessage || "Invalid data" });
  }
});

// DELETE
app.delete("/api/admin/:table/:id", admin, async (req, res) => {
  try {
    const [r] = await db.query("DELETE FROM ?? WHERE id = ?", [
      req.params.table,
      req.params.id,
    ]);
    if (r.affectedRows === 0)
      return res.status(404).json({ error: "Record not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res
      .status(400)
      .json({ error: err.sqlMessage || "Cannot delete this record" });
  }
});

app.listen(3001, () => console.log("Running on http://localhost:3001"));