
import dotenv from "dotenv";
import pg from "pg";
import bcrypt from "bcrypt";

dotenv.config();

const { Pool } = pg;

const createAdmin = async () => {
  const requiredVariables = [
    "DATABASE_URL",
    "ADMIN_NAME",
    "ADMIN_EMAIL",
    "ADMIN_PASSWORD"
  ];

  for (const variable of requiredVariables) {
    if (!process.env[variable]) {
      throw new Error(`${variable} is missing from .env`);
    }
  }

  const name = process.env.ADMIN_NAME.trim();
  const email = process.env.ADMIN_EMAIL.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (password.length < 12) {
    throw new Error("Admin password must be at least 12 characters.");
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: true
    }
  });

  try {
    // Check whether an admin with this email already exists
    const existingAdmin = await pool.query(
      "SELECT id, email, role FROM users WHERE email = $1",
      [email]
    );

    if (existingAdmin.rows.length > 0) {
      console.log("An account with this email already exists.");
      console.log("No account was changed.");
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin account
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', TRUE)
       RETURNING id, name, email, role`,
      [name, email, passwordHash]
    );

    console.log("Admin account created successfully!");
    console.log(result.rows[0]);

  } finally {
    await pool.end();
  }
};

createAdmin().catch((error) => {
  console.error("Admin creation failed:", error.message);
  process.exitCode = 1;
});
