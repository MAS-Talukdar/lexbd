
import express from "express";
import bcrypt from "bcrypt";
import { getPool } from "../config/db.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

// Every route in this file is Admin-only
router.use(requireRole("admin"));

const allowedRoles = ["editor", "contributor", "user"];

// GET /api/admin/users
// List users with pagination
router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit, 10) || 20)
    );

    const offset = (page - 1) * limit;
    const pool = getPool();

    const [usersResult, countResult] = await Promise.all([
      pool.query(
        `SELECT id, name, email, role, is_active, created_at
         FROM users
         ORDER BY created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query("SELECT COUNT(*) FROM users")
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        page,
        limit,
        totalUsers: Number(countResult.rows[0].count)
      },
      users: usersResult.rows
    });

  } catch (error) {
    console.error("User list error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not retrieve users"
    });
  }
});


// POST /api/admin/users
// Create Editor, Contributor or User account
router.post("/", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof role !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required"
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name must be between 1 and 100 characters"
      });
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanEmail.length > 254
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    if (password.length < 12 || password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be between 12 and 72 characters"
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Admin accounts cannot be created here."
      });
    }

    const pool = getPool();

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, name, email, role, is_active, created_at`,
      [cleanName, cleanEmail, passwordHash, role]
    );

    // Activity Log: User Created
    await logActivity({
      actorUserId: req.currentUser.id,
      action: "CREATE_USER",
      entityType: "USER",
      entityId: result.rows[0].id,
      description: `Created user: ${result.rows[0].name} (${result.rows[0].email})`
    });

    res.status(201).json({
      success: true,
      message: "User account created successfully",
      user: result.rows[0]
    });

  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    console.error("User creation error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not create user account"
    });
  }
});


// PATCH /api/admin/users/:id/status
// Activate or deactivate non-admin accounts
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    if (typeof is_active !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_active must be true or false"
      });
    }

    if (
      String(req.session.user.id) === id &&
      is_active === false
    ) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account"
      });
    }

    const pool = getPool();

    const result = await pool.query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2 AND role <> 'admin'
       RETURNING id, name, email, role, is_active`,
      [is_active, id]
    );

    if (result.rows.length === 0) {
      const existingUser = await pool.query(
        "SELECT id, role FROM users WHERE id = $1",
        [id]
      );

      if (existingUser.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      return res.status(403).json({
        success: false,
        message: "Admin account status cannot be changed here"
      });
    }

    const updatedUser = result.rows[0];

    // Activity Log: User Activated or Deactivated
    await logActivity({
      actorUserId: req.currentUser.id,
      action: is_active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "USER",
      entityId: updatedUser.id,
      description: `${is_active ? "Activated" : "Deactivated"} user: ${updatedUser.name} (${updatedUser.email})`
    });

    res.status(200).json({
      success: true,
      message: "User status updated successfully",
      user: updatedUser
    });

  } catch (error) {
    console.error("User status update error:", error.message);

    res.status(500).json({
      success: false,
      message: "Could not update user status"
    });
  }
});

export default router;
