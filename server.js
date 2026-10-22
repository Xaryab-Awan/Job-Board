require("dotenv").config();
const express = require("express");
const db = require("./database");

const app = express();
app.use(express.json());
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
app.listen(3000, () => console.log("Running on http://localhost:3000"));
