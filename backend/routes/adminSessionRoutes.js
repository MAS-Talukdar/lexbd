
import express from "express";
import crypto from "crypto";
import { getPool } from "../config/db.js";
import { requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only administrators can access session management.
router.use(requireRole("admin"));

function createSessionReference(sid) {
    return crypto
        .createHmac("sha256", process.env.SESSION_SECRET)
        .update(sid)
        .digest("hex");
}

// GET /api/admin/sessions
// List active sessions belonging to Editors and Users.
router.get("/", async (req, res) => {
    try {
        const pool = getPool();

        const result = await pool.query(`
            SELECT sid, sess, expire
            FROM user_sessions
            WHERE expire > NOW()
            ORDER BY expire DESC
        `);

        const currentSessionId = req.sessionID;

        const sessions = result.rows
            .filter(row => {
                const user = row.sess?.user;

                if (!user || !user.id || !user.role) {
                    return false;
                }

                // Only show Editor and User sessions.
                if (!["editor", "user"].includes(user.role)) {
                    return false;
                }

                // Do not include the current Admin session.
                if (row.sid === currentSessionId) {
                    return false;
                }

                return true;
            })
            .map(row => {
                const user = row.sess.user;

                return {
                    session_ref: createSessionReference(row.sid),
                    user_id: user.id,
                    name: user.name || "Unknown",
                    email: user.email || null,
                    role: user.role,
                    expires_at: row.expire
                };
            });

        return res.status(200).json({
            success: true,
            total: sessions.length,
            sessions
        });

    } catch (error) {
        console.error("Admin Session List Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to retrieve sessions."
        });
    }
});

// DELETE /api/admin/sessions/:sessionRef
// Revoke one Editor/User session.
router.delete("/:sessionRef", async (req, res) => {
    try {
        const { sessionRef } = req.params;

        if (!/^[a-f0-9]{64}$/i.test(sessionRef)) {
            return res.status(400).json({
                success: false,
                message: "Invalid session reference."
            });
        }

        const pool = getPool();

        const result = await pool.query(`
            SELECT sid, sess
            FROM user_sessions
            WHERE expire > NOW()
        `);

        const currentSessionId = req.sessionID;

        const targetSession = result.rows.find(row => {
            if (row.sid === currentSessionId) {
                return false;
            }

            const user = row.sess?.user;

            if (!user || !["editor", "user"].includes(user.role)) {
                return false;
            }

            const reference = createSessionReference(row.sid);

            return crypto.timingSafeEqual(
                Buffer.from(reference, "hex"),
                Buffer.from(sessionRef, "hex")
            );
        });

        if (!targetSession) {
            return res.status(404).json({
                success: false,
                message: "Active session not found."
            });
        }

        await pool.query(
            "DELETE FROM user_sessions WHERE sid = $1",
            [targetSession.sid]
        );

        return res.status(200).json({
            success: true,
            message: "User session revoked successfully."
        });

    } catch (error) {
        console.error("Admin Session Revoke Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to revoke session."
        });
    }
});

export default router;
