import express from "express";
import { getPool } from "../config/db.js";

const router = express.Router();

// GET /api/courts
// Get all courts
router.get("/", async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        c.id,
        c.name,
        c.court_type,
        c.location,
        COUNT(cs.id)::INTEGER AS total_published_cases
      FROM courts c
      LEFT JOIN cases cs
        ON cs.court_id = c.id
        AND cs.status = 'published'
      GROUP BY c.id, c.name, c.court_type, c.location
      ORDER BY c.name ASC
    `);

    res.status(200).json({
      success: true,
      totalCourts: result.rows.length,
      courts: result.rows,
    });
  } catch (error) {
    console.error("Get courts error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve courts",
    });
  }
});

// GET /api/courts/:id
// Get individual court details
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();

    const courtId = Number(req.params.id);

    if (!Number.isSafeInteger(courtId) || courtId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid court ID",
      });
    }

    const courtResult = await pool.query(
      `
        SELECT
          id,
          name,
          court_type,
          location
        FROM courts
        WHERE id = $1
      `,
      [courtId],
    );

    if (courtResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Court not found",
      });
    }

    const casesResult = await pool.query(
      `
        SELECT
          id,
          title,
          case_number,
          citation,
          petitioner,
          respondent,
          decision_year,
          decision_date
        FROM cases
        WHERE court_id = $1
          AND status = 'published'
        ORDER BY decision_date DESC NULLS LAST
      `,
      [courtId],
    );

    res.status(200).json({
      success: true,
      court: courtResult.rows[0],
      totalPublishedCases: casesResult.rows.length,
      cases: casesResult.rows,
    });
  } catch (error) {
    console.error("Get court details error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve court details",
    });
  }
});

export default router;
