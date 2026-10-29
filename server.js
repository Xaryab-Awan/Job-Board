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
app.get(
  ["/", "/index.html", "/profile.html", "/applications.html"],
  requireLoginPage,
);
app.get("/admin.html", requireAdminPage);

// The HTML pages live in public/html, the styles and scripts in their own
// folders. public/ itself is NOT served, so /html/admin.html cannot be used
// to skip the guards above.
app.use("/css", express.static("public/css"));
app.use("/js", express.static("public/js"));
app.use(express.static("public/html"));

// ---------- ADS ----------
// The list only contains the jobs the user has NOT applied to yet.
app.get("/api/ads", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT ads.id, ads.title, ads.short_description, ads.location,
              ads.wage, ads.working_time, companies.name AS company_name
       FROM ads JOIN companies ON ads.company_id = companies.id
       WHERE NOT EXISTS (
         SELECT 1 FROM applications
         WHERE applications.ad_id = ads.id AND applications.user_id = ?
       )
       ORDER BY ads.created_at DESC, ads.id DESC`,
      [req.session.user.id],
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
// are linked to the application through user_id). One application per job.
app.post("/api/ads/:id/applications", requireLogin, async (req, res) => {
  try {
    const message = (req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "Message is required" });

    const [ads] = await db.query("SELECT id FROM ads WHERE id = ?", [
      req.params.id,
    ]);
    if (ads.length === 0)
      return res.status(404).json({ error: "Ad not found" });

    const [already] = await db.query(
      "SELECT id FROM applications WHERE ad_id = ? AND user_id = ?",
      [req.params.id, req.session.user.id],
    );
    if (already.length > 0) {
      return res.status(409).json({ error: "You already applied to this job." });
    }

    await db.query(
      "INSERT INTO applications (ad_id, user_id, message) VALUES (?, ?, ?)",
      [req.params.id, req.session.user.id, message],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    // Two clicks at the same time: the UNIQUE key in the database catches it.
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "You already applied to this job." });
    }
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

// MY APPLICATIONS: the status of everything the user applied to.
// COALESCE: if the job was removed (someone was accepted), we use the title
// and company that were saved on the application at that moment.
app.get("/api/me/applications", requireLogin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT applications.id, applications.message, applications.status,
              applications.created_at,
              COALESCE(ads.title, applications.ad_title) AS ad_title,
              COALESCE(companies.name, applications.company_name) AS company_name
       FROM applications
       LEFT JOIN ads ON applications.ad_id = ads.id
       LEFT JOIN companies ON ads.company_id = companies.id
       WHERE applications.user_id = ?
       ORDER BY applications.created_at DESC, applications.id DESC`,
      [req.session.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------- ADMIN ----------
// Which columns an admin may write in each table (a whitelist).
// The status of an application is NOT in the list on purpose: it can only
// change through the accept / reject route below.
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

// What the admin tables show: names instead of ids (joins), one query per table.
const adminQueries = {
  users: `SELECT id, name, email, phone, role, created_at
          FROM users ORDER BY id DESC LIMIT ? OFFSET ?`,
  companies: `SELECT id, name, website, location
              FROM companies ORDER BY id DESC LIMIT ? OFFSET ?`,
  ads: `SELECT ads.*, companies.name AS company_name, users.name AS owner_name
        FROM ads
        LEFT JOIN companies ON ads.company_id = companies.id
        LEFT JOIN users ON ads.owner_id = users.id
        ORDER BY ads.id DESC LIMIT ? OFFSET ?`,
  applications: `SELECT applications.id, applications.ad_id, applications.user_id,
                        applications.message, applications.status,
                        applications.created_at,
                        COALESCE(ads.title, applications.ad_title) AS ad_title,
                        COALESCE(companies.name, applications.company_name) AS company_name,
                        users.name AS applicant_name
                 FROM applications
                 LEFT JOIN ads ON applications.ad_id = ads.id
                 LEFT JOIN companies ON ads.company_id = companies.id
                 LEFT JOIN users ON applications.user_id = users.id
                 ORDER BY applications.id DESC LIMIT ? OFFSET ?`,
};

// Lists used by the dropdowns of the admin form (id + readable label).
const adminLookups = {
  users: `SELECT id, CONCAT(name, ' (', email, ')') AS label
          FROM users ORDER BY name LIMIT 500`,
  companies: `SELECT id, name AS label FROM companies ORDER BY name LIMIT 500`,
  ads: `SELECT ads.id, CONCAT(ads.title, ' - ', companies.name) AS label
        FROM ads JOIN companies ON ads.company_id = companies.id
        ORDER BY ads.title LIMIT 500`,
};

function requireAdmin(req, res, next) {
  if (!req.session.user)
    return res.status(401).json({ error: "Not logged in" });
  if (req.session.user.role !== "admin")
    return res.status(403).json({ error: "Admins only" });
  next();
}
function checkTable(req, res, next) {
  if (!Object.hasOwn(adminTables, req.params.table))
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

// Turns a MySQL error into a sentence an admin can understand.
function friendlyDbError(err) {
  switch (err.code) {
    case "ER_DUP_ENTRY":
      return "A record with the same value already exists (same email, or the user already applied to this job).";
    case "ER_NO_REFERENCED_ROW_2":
      return "The selected company, job or user does not exist.";
    case "ER_ROW_IS_REFERENCED_2":
      return "This record is still used by other records. Delete those first.";
    case "ER_BAD_NULL_ERROR":
    case "ER_NO_DEFAULT_FOR_FIELD":
      return "Please fill in all the required fields.";
    case "ER_DATA_TOO_LONG":
      return "One of the values is too long.";
    default:
      return err.sqlMessage || "Invalid data";
  }
}

// LOOKUP (dropdown lists)
app.get("/api/admin/lookup/:name", requireAdmin, async (req, res) => {
  if (!Object.hasOwn(adminLookups, req.params.name))
    return res.status(404).json({ error: "Unknown list" });
  try {
    const [rows] = await db.query(adminLookups[req.params.name]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// LIST (paginated)
app.get("/api/admin/:table", admin, async (req, res) => {
  try {
    const table = req.params.table;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM ??", [
      table,
    ]);
    const [rows] = await db.query(adminQueries[table], [
      limit,
      (page - 1) * limit,
    ]);
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
    res.status(400).json({ error: friendlyDbError(err) });
  }
});

// ACCEPT / REJECT an application.
// Rejected: only the status changes.
// Accepted: the job is filled, so in ONE transaction (all steps or none):
//   1. this application becomes "accepted"
//   2. the other pending applications for the same job become "rejected"
//   3. the job title and company are copied onto the applications, so the
//      users can still see what they applied to
//   4. the applications are detached from the job (ad_id = NULL)
//   5. the job is deleted from the database (and so from the board)
app.patch("/api/admin/applications/:id", requireAdmin, async (req, res) => {
  const status = req.body.status;
  if (!["accepted", "rejected"].includes(status)) {
    return res
      .status(400)
      .json({ error: "Status must be accepted or rejected" });
  }

  let conn;
  let result;
  try {
    conn = await db.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query(
      "SELECT id, ad_id, status FROM applications WHERE id = ? FOR UPDATE",
      [req.params.id],
    );
    const application = rows[0];

    if (!application) {
      result = [404, { error: "Application not found" }];
    } else if (application.status !== "pending") {
      result = [409, { error: "This application was already decided." }];
    } else if (status === "accepted" && application.ad_id === null) {
      result = [409, { error: "This job is no longer available." }];
    } else if (status === "rejected") {
      await conn.query(
        "UPDATE applications SET status = 'rejected' WHERE id = ?",
        [application.id],
      );
      result = [200, { ok: true }];
    } else {
      const adId = application.ad_id;
      await conn.query(
        "UPDATE applications SET status = 'accepted' WHERE id = ?",
        [application.id],
      );
      await conn.query(
        `UPDATE applications SET status = 'rejected'
         WHERE ad_id = ? AND id <> ? AND status = 'pending'`,
        [adId, application.id],
      );
      await conn.query(
        `UPDATE applications
         JOIN ads ON applications.ad_id = ads.id
         JOIN companies ON ads.company_id = companies.id
         SET applications.ad_title = ads.title,
             applications.company_name = companies.name
         WHERE applications.ad_id = ?`,
        [adId],
      );
      await conn.query(
        "UPDATE applications SET ad_id = NULL WHERE ad_id = ?",
        [adId],
      );
      await conn.query("DELETE FROM ads WHERE id = ?", [adId]);
      result = [200, { ok: true }];
    }

    if (result[0] === 200) await conn.commit();
    else await conn.rollback();
  } catch (err) {
    console.error(err);
    if (conn) await conn.rollback().catch(() => {});
    result = [500, { error: "Server error" }];
  } finally {
    if (conn) conn.release();
  }
  res.status(result[0]).json(result[1]);
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
    res.status(400).json({ error: friendlyDbError(err) });
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
    res.status(400).json({ error: friendlyDbError(err) });
  }
});

app.listen(3001, () => console.log("Running on http://localhost:3001"));
