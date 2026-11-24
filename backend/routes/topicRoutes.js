
import express from "express";
import { getPool } from "../config/db.js";

const router = express.Router();

// GET /api/topics
// Get all legal topics with their parent topic
router.get("/", async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        child.id,
        child.name,
        child.description,
        child.parent_id,
        parent.name AS parent_name,
        COUNT(DISTINCT c.id)::INTEGER AS total_published_cases
      FROM legal_topics child
      LEFT JOIN legal_topics parent
        ON parent.id = child.parent_id
      LEFT JOIN case_topics ct
        ON ct.topic_id = child.id
      LEFT JOIN cases c
        ON c.id = ct.case_id
        AND c.status = 'published'
      GROUP BY
        child.id,
        child.name,
        child.description,
        child.parent_id,
        parent.name
      ORDER BY child.name ASC
    `);

    res.status(200).json({
      success: true,
      totalTopics: result.rows.length,
      topics: result.rows
    });

  } catch (error) {
    console.error("Get topics error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve legal topics"
    });
  }
});


// GET /api/topics/:id
// Get individual topic and related published cases
router.get("/:id", async (req, res) => {
  try {
    const pool = getPool();

    const topicId = Number(req.params.id);

    if (!Number.isSafeInteger(topicId) || topicId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid topic ID"
      });
    }

    // Get topic details
    const topicResult = await pool.query(
      `
        SELECT
          child.id,
          child.name,
          child.description,
          child.parent_id,
          parent.name AS parent_name
        FROM legal_topics child
        LEFT JOIN legal_topics parent
          ON parent.id = child.parent_id
        WHERE child.id = $1
      `,
      [topicId]
    );

    if (topicResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Legal topic not found"
      });
    }

    // Get related cases
    const casesResult = await pool.query(
      `
        SELECT
          c.id,
          c.title,
          c.case_number,
          c.citation,
          c.petitioner,
          c.respondent,
          c.decision_year,
          c.decision_date,
          co.name AS court_name
        FROM case_topics ct
        JOIN cases c
          ON c.id = ct.case_id
        LEFT JOIN courts co
          ON co.id = c.court_id
        WHERE ct.topic_id = $1
          AND c.status = 'published'
        ORDER BY c.decision_date DESC NULLS LAST
      `,
      [topicId]
    );

    // Get child topics
    const childrenResult = await pool.query(
      `
        SELECT id, name, description
        FROM legal_topics
        WHERE parent_id = $1
        ORDER BY name ASC
      `,
      [topicId]
    );

    res.status(200).json({
      success: true,
      topic: topicResult.rows[0],
      totalPublishedCases: casesResult.rows.length,
      cases: casesResult.rows,
      subtopics: childrenResult.rows
    });

  } catch (error) {
    console.error("Get topic details error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve topic details"
    });
  }
});

export default router;
