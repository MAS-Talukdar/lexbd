import express from "express";
import bcrypt from "bcrypt";
import { getPool } from "../config/db.js";
import loginLimiter from "../middleware/loginLimiter.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { OAuth2Client } from "google-auth-library";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);
const router = express.Router();

// POST /api/auth/google
router.post("/google", loginLimiter, async (req, res) => {
  let client;
  let transactionStarted = false;

  try {
    const { credential } = req.body;

    if (typeof credential !== "string" || !credential.trim()) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required",
      });
    }

    // Verify Google ID Token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "Google account verification failed",
      });
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();
    const name = (payload.name || email.split("@")[0]).trim();

    const pool = getPool();
    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // Find an existing Google account
    const existingAccount = await client.query(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.role,
         u.is_active
       FROM oauth_accounts oa
       JOIN users u ON u.id = oa.user_id
       WHERE oa.provider = 'google'
         AND oa.provider_user_id = $1
       FOR UPDATE OF u`,
      [googleId],
    );

    let user;

    if (existingAccount.rows.length > 0) {
      user = existingAccount.rows[0];

      if (!user.is_active) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(403).json({
          success: false,
          message: "Your account is inactive",
        });
      }
    } else {
      // Do not automatically link an existing email account.
      const existingEmail = await client.query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [email],
      );

      if (existingEmail.rows.length > 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message:
            "An account with this email already exists. Please login using your existing method first.",
        });
      }

      // Create a new account with the fixed user role.
      const newUser = await client.query(
        `INSERT INTO users (
           name,
           email,
           password_hash,
           role,
           is_active
         )
         VALUES ($1, $2, NULL, 'user', TRUE)
         RETURNING id, name, email, role, is_active`,
        [name, email],
      );

      user = newUser.rows[0];

      // Link the Google identity to the new account.
      await client.query(
        `INSERT INTO oauth_accounts (
           user_id,
           provider,
           provider_user_id,
           provider_email
         )
         VALUES ($1, 'google', $2, $3)`,
        [user.id, googleId, email],
      );
    }

    await client.query("COMMIT");
    transactionStarted = false;

    // Regenerate session to prevent session fixation.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    // Save session before responding.
    await new Promise((resolve, reject) => {
      req.session.save((error) => {
        if (error) reject(error);
        else resolve();
      });
    });

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      user: req.session.user,
    });

  } catch (error) {
    if (client && transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Google login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Google login failed",
    });

  } finally {
    if (client) {
      client.release();
    }
  }
});

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Validate name
    if (normalizedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name cannot exceed 100 characters",
      });
    }

    // Basic email validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (normalizedEmail.length > 255 || !emailPattern.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Validate password
    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 12 characters and no more than 72 bytes",
      });
    }

    const pool = getPool();

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create account with fixed user role
    const result = await pool.query(
      `INSERT INTO users (
        name,
        email,
        password_hash,
        role,
        is_active
      )
      VALUES ($1, $2, $3, 'user', TRUE)
      RETURNING id, name, email, role, is_active`,
      [normalizedName, normalizedEmail, passwordHash],
    );

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please login.",
      user: result.rows[0],
    });
  } catch (error) {
    // Duplicate email
    if (error.code === "23505") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not create account",
    });
  }
});

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    const result = await getPool().query(
      `SELECT id, name, email, password_hash, role, is_active
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    // Check account status
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive",
      });
    }

    // Verify password
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Regenerate session to prevent session fixation
    req.session.regenerate((error) => {
      if (error) {
        console.error("Session regeneration error:", error.message);

        return res.status(500).json({
          success: false,
          message: "Login failed",
        });
      }

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      };

      req.session.save((saveError) => {
        if (saveError) {
          console.error("Session save error:", saveError.message);

          return res.status(500).json({
            success: false,
            message: "Could not save login session",
          });
        }

        return res.status(200).json({
          success: true,
          message: "Login successful",
          user: req.session.user,
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error.message);

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

// GET /api/auth/me
router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      authenticated: false,
      message: "Not logged in",
    });
  }

  res.status(200).json({
    success: true,
    authenticated: true,
    user: req.session.user,
  });
});

// POST /api/auth/logout

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !currentPassword ||
    !newPassword
  ) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are required",
    });
  }

  if (newPassword.length < 12 || Buffer.byteLength(newPassword, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message:
        "New password must be at least 12 characters and no more than 72 bytes",
    });
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT password_hash
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [req.currentUser.id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash,
    );

    if (!passwordMatches) {
      await client.query("ROLLBACK");

      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      result.rows[0].password_hash,
    );

    if (samePassword) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "New password must be different from the current password",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await client.query(
      `UPDATE users
       SET password_hash = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [newPasswordHash, req.currentUser.id],
    );

    // Revoke every existing session belonging to this user
    await client.query(
      `DELETE FROM user_sessions
       WHERE sess->'user'->>'id' = $1`,
      [String(req.currentUser.id)],
    );

    await client.query("COMMIT");

    // Destroy the current session and clear its cookie
    req.session.destroy((error) => {
      if (error) {
        console.error("Session destruction error:", error.message);
      }

      res.clearCookie("lexbd.sid", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      return res.status(200).json({
        success: true,
        message: "Password changed successfully. Please login again.",
      });
    });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Password change error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not change password",
    });
  } finally {
    client.release();
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Logout failed",
      });
    }

    res.clearCookie("lexbd.sid", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  });
});

export default router;
