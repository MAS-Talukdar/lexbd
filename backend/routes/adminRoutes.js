
import express from "express";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";
import { getPool } from "../config/db.js";
import bcrypt from "bcrypt";

const router = express.Router();

// Any authenticated user
router.get("/dashboard", requireAuth, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to your dashboard",
    user: req.currentUser
  });
});

// Admin only
router.get("/test", requireRole("admin"), (req, res) => {
  res.status(200).json({
    success: true,
    message: "Admin access granted",
    role: req.currentUser.role
  });
});


router.get("/statistics", requireRole("admin"), async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM cases) AS total_cases,

        (SELECT COUNT(*)
         FROM cases
         WHERE status = 'published') AS published_cases,

        (SELECT COUNT(*)
         FROM cases
         WHERE status = 'draft') AS draft_cases,

        (SELECT COUNT(*)
         FROM cases
         WHERE status = 'archived') AS archived_cases,

        (SELECT COUNT(*)
         FROM users) AS total_users,

        (SELECT COUNT(*)
         FROM users
         WHERE is_active = TRUE) AS active_users,

        (SELECT COUNT(*)
         FROM users
         WHERE is_active = FALSE) AS inactive_users,

        (SELECT COUNT(*)
         FROM courts) AS total_courts,

        (SELECT COUNT(*)
         FROM judges) AS total_judges,

        (SELECT COUNT(*)
         FROM legal_topics) AS total_topics,

        (SELECT COUNT(*)
         FROM legislation) AS total_legislation
    `);

    const stats = result.rows[0];

    // PostgreSQL COUNT returns BIGINT as a string.
    // Convert these values into JavaScript numbers.
    const statistics = Object.fromEntries(
      Object.entries(stats).map(([key, value]) => [
        key,
        Number(value)
      ])
    );

    return res.status(200).json({
      success: true,
      message: "Dashboard statistics retrieved successfully",
      statistics,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error("Dashboard statistics error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve dashboard statistics"
    });
  }
});

// =====================================
// GET /api/admin/activity?limit=100
// Get Recent Case Activity Logs
// Admin Only
// =====================================

router.get("/activity", requireRole("admin"), async (req, res) => {
    try {
        const requestedLimit = Number.parseInt(req.query.limit, 10);

        const limit = Number.isInteger(requestedLimit)
            ? Math.min(Math.max(requestedLimit, 1), 100)
            : 100;

        const pool = getPool();

        const result = await pool.query(
            `SELECT
                al.id,
                al.action,
                al.entity_type,
                al.entity_id,
                al.description,
                al.created_at,
                u.name AS actor_name,
                u.email AS actor_email
             FROM activity_logs AS al
             LEFT JOIN users AS u
                ON u.id = al.actor_user_id
             WHERE UPPER(al.entity_type) = 'CASE'
               AND UPPER(al.action) = ANY($1::text[])
             ORDER BY al.created_at DESC, al.id DESC
             LIMIT $2`,
            [[
                "CREATE",
                "UPDATE",
                "PUBLISH",
                "UNPUBLISH",
                "ARCHIVE",
                "RESTORE",
                "UPDATE_RELATIONS"
            ], limit]
        );

        return res.status(200).json({
            success: true,
            total: result.rows.length,
            activities: result.rows
        });

    } catch (error) {
        console.error("Recent activity error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not retrieve recent case activities."
        });
    }
});


// =====================================
// GET /api/admin/users?role=editor
// GET /api/admin/users?role=user
// Get Users by Role
// Admin Only
// =====================================

router.get("/users", requireRole("admin"), async (req, res) => {
    try {
        const role = req.query.role;

        if (!["editor", "user"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Role must be editor or user."
            });
        }

        const pool = getPool();

        const result = await pool.query(
            `SELECT
                id,
                name,
                email,
                role,
                is_active,
                created_at
             FROM users
             WHERE role = $1
             ORDER BY created_at DESC`,
            [role]
        );

        return res.status(200).json({
            success: true,
            role,
            total: result.rows.length,
            users: result.rows
        });

    } catch (error) {
        console.error("Get users error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not retrieve users."
        });
    }
});


// =====================================
// POST /api/admin/users
// Create Editor or User
// Admin Only
// =====================================

router.post("/users", requireRole("admin"), async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        const cleanName = String(name).trim();
        const cleanEmail = String(email).trim().toLowerCase();

        if (cleanName.length < 2 || cleanName.length > 150) {
            return res.status(400).json({
                success: false,
                message: "Name must be between 2 and 150 characters."
            });
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
            cleanEmail.length > 255 ||
            !emailPattern.test(cleanEmail)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
            });
        }

        if (!["editor", "user"].includes(role)) {
            return res.status(400).json({
                success: false,
                message: "Only Editor and User accounts can be created here."
            });
        }

        if (
            typeof password !== "string" ||
            password.length < 12 ||
            Buffer.byteLength(password, "utf8") > 72
        ) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 12 characters and no more than 72 bytes."
            });
        }

        const pool = getPool();

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `INSERT INTO users
                (name, email, password_hash, role, is_active)
             VALUES ($1, $2, $3, $4, TRUE)
             RETURNING
                id, name, email, role, is_active, created_at`,
            [cleanName, cleanEmail, passwordHash, role]
        );

        return res.status(201).json({
            success: true,
            message: `${role} account created successfully.`,
            user: result.rows[0]
        });

    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        console.error("Create user error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not create account."
        });
    }
});


// =====================================
// PATCH /api/admin/users/:id/status
// Activate / Deactivate Editor or User
// Admin Only
// =====================================

router.patch(
    "/users/:id/status",
    requireRole("admin"),
    async (req, res) => {
        try {
            const userId = req.params.id;
            const { is_active } = req.body;

            if (!/^[1-9]\d*$/.test(userId)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID."
                });
            }

            if (typeof is_active !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "is_active must be true or false."
                });
            }

            // Admin cannot deactivate their own account.
            if (
                String(req.currentUser.id) === userId &&
                is_active === false
            ) {
                return res.status(403).json({
                    success: false,
                    message: "You cannot deactivate your own account."
                });
            }

            const pool = getPool();

            // Database-level protection:
            // Admin accounts can never be deactivated here.
            const result = await pool.query(
                `UPDATE users
                 SET
                    is_active = $1,
                    updated_at = NOW()
                 WHERE id = $2
                   AND role IN ('editor', 'user')
                 RETURNING
                    id, name, email, role, is_active`,
                [is_active, userId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Editor or User account not found. Admin accounts cannot be modified here."
                });
            }

            return res.status(200).json({
                success: true,
                message: is_active
                    ? "Account activated successfully."
                    : "Account deactivated successfully.",
                user: result.rows[0]
            });

        } catch (error) {
            console.error("Update user status error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not update account status."
            });
        }
    }
);


export default router;
