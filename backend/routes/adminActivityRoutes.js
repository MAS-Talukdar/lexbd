
import express from "express";
import { getPool } from "../config/db.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only Admin can view activity logs.
router.use(requireRole("admin"));

// GET /api/admin/activity
router.get("/", async (req, res) => {
    try {
        const pool = getPool();

        const requestedLimit = Number.parseInt(req.query.limit, 10);

        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 50)
            : 10;

        const result = await pool.query(
            `SELECT
                al.id,
                al.action,
                al.entity_type,
                al.entity_id,
                al.description,
                al.created_at,
                u.name AS actor_name,
                u.email AS actor_email,
                u.role AS actor_role
             FROM activity_logs al
             LEFT JOIN users u
                ON u.id = al.actor_user_id
             WHERE al.entity_type = 'CASE'
             ORDER BY al.created_at DESC, al.id DESC
             LIMIT $1`,
            [limit]
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            activities: result.rows
        });

    } catch (error) {
        console.error("Admin Activity API Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Unable to load activity logs."
        });
    }
});

export default router;
