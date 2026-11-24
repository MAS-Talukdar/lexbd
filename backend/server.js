
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import connectDB, { getPool } from "./config/db.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  let server;
  let isShuttingDown = false;

  try {
    // Connect to Neon PostgreSQL
    await connectDB();

    // Start Express server
    server = app.listen(PORT, () => {
      console.log("------------------------------------");
      console.log("LEXBD");
      console.log("PostgreSQL: Connected");
      console.log(`Server running on port ${PORT}`);
      console.log(`Local URL: http://localhost:${PORT}`);
      console.log(`Health Check: http://localhost:${PORT}/api/health`);
      console.log("------------------------------------");
    });

    // Graceful shutdown
    const shutdown = async (reason, exitCode = 0) => {
      if (isShuttingDown) return;

      isShuttingDown = true;

      console.log(`Shutting down server: ${reason}`);

      server.close(async () => {
        try {
          await getPool().end();

          console.log("Server and database connections closed.");
          process.exit(exitCode);
        } catch (error) {
          console.error("Shutdown error:", error.message);
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));

    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      shutdown("Uncaught Exception", 1);
    });

    process.on("unhandledRejection", (reason) => {
      console.error("Unhandled Rejection:", reason);
      shutdown("Unhandled Rejection", 1);
    });

  } catch (error) {
    console.error("Server startup failed:", error.message);

    try {
      await getPool().end();
    } catch {
      // Database pool may not have initialized
    }

    process.exit(1);
  }
};

startServer();
