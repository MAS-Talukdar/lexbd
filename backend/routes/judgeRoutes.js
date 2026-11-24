
import express from "express";
import { getPool } from "../config/db.js";

const router = express.Router();

// GET /api/judges
// Get all judges
router.get("/", async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        j.id,
        j.name,
        COUNT(DISTINCT c.id)::INTEGER AS total_published_cases
      FROM judges j
      LEFT JOIN case_judges cj
        ON cj.judge_id = j.id
      LEFT JOIN cases c
        ON c.id = cj.case_id
        AND c.status = 'published'
      GROUP BY j.id, j.name
      ORDER BY j.name ASC
    `);

    res.status(200).json({
      success: true,
      totalJudges: result.rows.length,
      judges: result.rows
    });

  } catch (error) {
    console.error("Get judges error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve judges"
    });
  }
});


// GET /api/judges/:id
// Get individual judge details and published cases
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();

    const judgeId = Number(req.params.id);

    if (!Number.isSafeInteger(judgeId) || judgeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid judge ID"
      });
    }

    // Find judge
    const judgeResult = await pool.query(
      `
        SELECT id, name
        FROM judges
        WHERE id = $1
      `,
      [judgeId]
    );

    if (judgeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Judge not found"
      });
    }

    // Find judge's published cases
    const casesResult = await pool.query(
      `
        SELECT
          c.id,
          c.title,
          c.case_number,
          c.petitioner,
          c.respondent,
          c.citation,
          c.decision_year,
          c.decision_date,
          co.name AS court_name
        FROM case_judges cj
        JOIN cases c
          ON c.id = cj.case_id
        LEFT JOIN courts co
          ON co.id = c.court_id
        WHERE cj.judge_id = $1
          AND c.status = 'published'
        ORDER BY c.decision_date DESC NULLS LAST
      `,
      [judgeId]
    );

    res.status(200).json({
      success: true,
      judge: judgeResult.rows[0],
      totalPublishedCases: casesResult.rows.length,
      cases: casesResult.rows
    });

  } catch (error) {
    console.error("Get judge details error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve judge details"
    });
  }
});

export default router;
