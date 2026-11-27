import express from "express";
import { getPool } from "../config/db.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only Admin can manage legal classifications.
router.use(requireRole("admin"));

// GET all subjects and topics, including inactive records.
router.get("/", async (req, res) => {
  try {
    const result = await getPool().query(`
            SELECT
                id,
                name,
                parent_id,
                description,
                is_active,
                created_at
            FROM legal_topics
            ORDER BY parent_id NULLS FIRST, name ASC
        `);

    return res.status(200).json({
      success: true,
      classifications: result.rows,
    });
  } catch (error) {
    console.error("Classification retrieval error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve classifications",
    });
  }
});

// POST create a Subject or Topic.
router.post("/", async (req, res) => {
  try {
    const { name, description = null, parent_id = null } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Classification name is required",
      });
    }

    if (description !== null && typeof description !== "string") {
      return res.status(400).json({
        success: false,
        message: "Invalid description",
      });
    }

    const pool = getPool();

    if (parent_id !== null) {
      const parentId = Number(parent_id);

      if (!Number.isSafeInteger(parentId) || parentId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid Subject ID",
        });
      }

      const parent = await pool.query(
        `SELECT id, parent_id, is_active
                 FROM legal_topics
                 WHERE id = $1`,
        [parentId],
      );

      if (
        !parent.rows.length ||
        parent.rows[0].parent_id !== null ||
        !parent.rows[0].is_active
      ) {
        return res.status(400).json({
          success: false,
          message: "Select an active Legal Subject",
        });
      }
    }

    const duplicate = await pool.query(
      `SELECT id
             FROM legal_topics
             WHERE parent_id IS NOT DISTINCT FROM $1
               AND LOWER(name) = LOWER($2)
             LIMIT 1`,
      [parent_id === null ? null : Number(parent_id), name.trim()],
    );

    if (duplicate.rows.length) {
      return res.status(409).json({
        success: false,
        message: "A classification with this name already exists here",
      });
    }

    const result = await pool.query(
      `INSERT INTO legal_topics
                (name, parent_id, description, is_active)
             VALUES ($1, $2, $3, TRUE)
             RETURNING id, name, parent_id, description, is_active, created_at`,
      [
        name.trim(),
        parent_id === null ? null : Number(parent_id),
        description?.trim() || null,
      ],
    );

    return res.status(201).json({
      success: true,
      message: "Classification created successfully",
      classification: result.rows[0],
    });
  } catch (error) {
    console.error("Classification creation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not create classification",
    });
  }
});

// PATCH rename, edit description, deactivate or reactivate.
router.patch("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid classification ID",
      });
    }

    const { name, description, is_active } = req.body;

    if (
      name === undefined &&
      description === undefined &&
      is_active === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "No changes provided",
      });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return res.status(400).json({
        success: false,
        message: "Classification name cannot be empty",
      });
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid description",
      });
    }

    if (is_active !== undefined && typeof is_active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false",
      });
    }

    const pool = getPool();

    const existing = await pool.query(
      `SELECT id, parent_id
             FROM legal_topics
             WHERE id = $1`,
      [id],
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Classification not found",
      });
    }

    if (name !== undefined) {
      const duplicate = await pool.query(
        `SELECT id
                 FROM legal_topics
                 WHERE parent_id IS NOT DISTINCT FROM $1
                   AND LOWER(name) = LOWER($2)
                   AND id <> $3
                 LIMIT 1`,
        [existing.rows[0].parent_id, name.trim(), id],
      );

      if (duplicate.rows.length) {
        return res.status(409).json({
          success: false,
          message: "A classification with this name already exists here",
        });
      }
    }

    const result = await pool.query(
      `UPDATE legal_topics
             SET
                name = COALESCE($1, name),
                description = CASE
                    WHEN $2 THEN $3
                    ELSE description
                END,
                is_active = COALESCE($4, is_active)
             WHERE id = $5
             RETURNING id, name, parent_id, description, is_active, created_at`,
      [
        name === undefined ? null : name.trim(),
        description !== undefined,
        description === undefined ? null : description?.trim() || null,
        is_active === undefined ? null : is_active,
        id,
      ],
    );

    return res.status(200).json({
      success: true,
      message: "Classification updated successfully",
      classification: result.rows[0],
    });
  } catch (error) {
    console.error("Classification update error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not update classification",
    });
  }
});

export default router;
