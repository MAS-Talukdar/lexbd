
import pg from "pg";

const { Pool } = pg;

let pool;

const connectDB = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is missing from .env file");
    }

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: true
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error:", error.message);
    });

    const result = await pool.query(`
      SELECT
        NOW() AS current_time,
        current_database() AS database_name
    `);

    console.log("PostgreSQL connected successfully!");
    console.log("Database:", result.rows[0].database_name);
    console.log("Database time:", result.rows[0].current_time);

    return pool;

  } catch (error) {
    console.error("PostgreSQL connection failed!");
    console.error(error.message);

    if (pool) {
      await pool.end().catch(() => {});
      pool = null;
    }

    throw error;
  }
};

export const getPool = () => {
  if (!pool) {
    throw new Error("PostgreSQL pool is not initialized");
  }

  return pool;
};

export default connectDB;
