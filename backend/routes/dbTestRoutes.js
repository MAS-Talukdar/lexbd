import express from "express";
import { getPool } from "../config/db.js";

const router = express.Router();

// Test database connection and tables
router.get("/test", async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        current_database() AS database_name,
        NOW() AS database_time,
        (
          SELECT COUNT(*)
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
        ) AS total_tables
    `);

    res.status(200).json({
      success: true,
      message: "Database API is working successfully",
      database: result.rows[0],
    });
  } catch (error) {
    console.error("Database test error:", error.message);

    res.status(500).json({
      success: false,
      message: "Database test failed",
    });
  }
});

export default router;
