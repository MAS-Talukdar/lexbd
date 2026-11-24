import express from "express";
import { getPool } from "../config/db.js";

const router = express.Router();

// GET /api/legislation
// Get all legislation
router.get("/", async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        l.id,
        l.title,
        l.short_title,
        l.year,
        l.jurisdiction,
        COUNT(DISTINCT ls.id)::INTEGER AS total_sections,
        COUNT(DISTINCT c.id)::INTEGER AS total_published_cases
      FROM legislation l
      LEFT JOIN legislation_sections ls
        ON ls.legislation_id = l.id
      LEFT JOIN case_legislation cl
        ON cl.legislation_id = l.id
      LEFT JOIN cases c
        ON c.id = cl.case_id
        AND c.status = 'published'
      GROUP BY
        l.id,
        l.title,
        l.short_title,
        l.year,
        l.jurisdiction
      ORDER BY l.year DESC NULLS LAST, l.title ASC
    `);

    res.status(200).json({
      success: true,
      totalLegislation: result.rows.length,
      legislation: result.rows,
    });
  } catch (error) {
    console.error("Get legislation error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve legislation",
    });
  }
});


/*
 * GET /api/legislation/:id/sections
 * Get all sections belonging to a specific legislation.
 */

router.get("/:id/sections", async (req, res) => {
    try {
        const legislationId = Number(req.params.id);

        if (!Number.isSafeInteger(legislationId) || legislationId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid legislation ID"
            });
        }

        const pool = getPool();

        // Check whether legislation exists
        const legislationResult = await pool.query(
            `SELECT id, title, short_title, year
             FROM legislation
             WHERE id = $1`,
            [legislationId]
        );

        if (legislationResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Legislation not found"
            });
        }

        // Get all sections of the selected legislation
        const sectionsResult = await pool.query(
            `SELECT
                id,
                legislation_id,
                section_label,
                section_title,
                section_text
             FROM legislation_sections
             WHERE legislation_id = $1
             ORDER BY section_label ASC`,
            [legislationId]
        );

        return res.status(200).json({
            success: true,
            legislation: legislationResult.rows[0],
            totalSections: sectionsResult.rows.length,
            sections: sectionsResult.rows
        });

    } catch (error) {
        console.error("Get legislation sections error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve legislation sections"
        });
    }
});

// GET /api/legislation/:id
// Get individual legislation with sections and related cases
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();

    const legislationId = Number(req.params.id);

    if (!Number.isSafeInteger(legislationId) || legislationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid legislation ID",
      });
    }

    // Get legislation details
    const legislationResult = await pool.query(
      `
        SELECT
          id,
          title,
          short_title,
          year,
          jurisdiction
        FROM legislation
        WHERE id = $1
      `,
      [legislationId],
    );

    if (legislationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Legislation not found",
      });
    }

    // Get all sections of this legislation
    const sectionsResult = await pool.query(
      `
        SELECT
          id,
          section_label,
          section_title,
          section_text
        FROM legislation_sections
        WHERE legislation_id = $1
        ORDER BY section_label ASC
      `,
      [legislationId],
    );

    // Get published cases related to this legislation
    const casesResult = await pool.query(
      `
        SELECT DISTINCT
          c.id,
          c.title,
          c.case_number,
          c.petitioner,
          c.respondent,
          c.citation,
          c.decision_year,
          c.decision_date,
          co.name AS court_name
        FROM case_legislation cl
        JOIN cases c
          ON c.id = cl.case_id
        LEFT JOIN courts co
          ON co.id = c.court_id
        WHERE cl.legislation_id = $1
          AND c.status = 'published'
        ORDER BY c.decision_date DESC NULLS LAST
      `,
      [legislationId],
    );

    res.status(200).json({
      success: true,
      legislation: {
        ...legislationResult.rows[0],
        totalSections: sectionsResult.rows.length,
        sections: sectionsResult.rows,
        totalPublishedCases: casesResult.rows.length,
        cases: casesResult.rows,
      },
    });
  } catch (error) {
    console.error("Get legislation details error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve legislation details",
    });
  }
});

export default router;
