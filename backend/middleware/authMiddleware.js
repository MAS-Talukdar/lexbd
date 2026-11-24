
import { getPool } from "../config/db.js";

// =====================================
// Verify Current User
// =====================================

const verifyCurrentUser = async (req, res) => {
    if (!req.session?.user?.id) {
        res.status(401).json({
            success: false,
            message: "Authentication required. Please login."
        });

        return null;
    }

    const result = await getPool().query(
        `SELECT id, name, email, role, is_active
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [req.session.user.id]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
        await new Promise((resolve) => {
            req.session.destroy((error) => {
                if (error) {
                    console.error(
                        "Session destruction error:",
                        error.message
                    );
                }

                resolve();
            });
        });

        res.clearCookie("lexbd.sid", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        res.status(401).json({
            success: false,
            message: "Your account is inactive or no longer exists."
        });

        return null;
    }

    req.currentUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
    };

    req.session.user = req.currentUser;

    return req.currentUser;
};

// =====================================
// Require Authentication
// =====================================

export const requireAuth = async (req, res, next) => {
    try {
        const user = await verifyCurrentUser(req, res);

        if (!user) return;

        return next();
    } catch (error) {
        console.error("Authentication error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Could not verify authentication."
        });
    }
};

// =====================================
// Require Specific Role
// =====================================

export const requireRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            // Reuse already verified user when available
            const user = req.currentUser ||
                await verifyCurrentUser(req, res);

            if (!user) return;

            if (!allowedRoles.includes(user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "You do not have permission to access this resource."
                });
            }

            return next();
        } catch (error) {
            console.error("Role authorization error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not verify user permissions."
            });
        }
    };
};
