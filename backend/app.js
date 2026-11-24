
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import authRoutes from "./routes/authRoutes.js";
import dbTestRoutes from "./routes/dbTestRoutes.js";
import caseRoutes from "./routes/caseRoutes.js";
import courtRoutes from "./routes/courtRoutes.js";
import judgeRoutes from "./routes/judgeRoutes.js";
import topicRoutes from "./routes/topicRoutes.js";
import legislationRoutes from "./routes/legislationRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminCaseRoutes from "./routes/adminCaseRoutes.js";
import adminSessionRoutes from "./routes/adminSessionRoutes.js";
import adminActivityRoutes from "./routes/adminActivityRoutes.js";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

// Validate required environment variables
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is missing from .env");
}

if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is missing from .env");
}

// Trust proxy in production (e.g. Render)
if (isProduction) {
    app.set("trust proxy", 1);
}

// Security middleware
app.use(helmet());

// CORS configuration
const localOrigins = [
    "http://localhost:5000",
    "http://127.0.0.1:5000",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
    "http://localhost:5501",
    "http://127.0.0.1:5501"
];

const configuredOrigins = (process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

if (isProduction && configuredOrigins.length === 0) {
    throw new Error(
        "CLIENT_ORIGINS must contain your production frontend URL."
    );
}

const allowedOrigins = [
    ...new Set([...localOrigins, ...configuredOrigins])
];

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without an Origin header
            if (!origin || allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            console.error("Blocked CORS Origin:", origin);

            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"]
    })
);

// Body parsing
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// PostgreSQL session store
const PgSessionStore = connectPgSimple(session);

const sessionStore = new PgSessionStore({
    conString: process.env.DATABASE_URL,
    tableName: "user_sessions",
    createTableIfMissing: true
});

// Session cookie configuration
const sameSite = (
    process.env.SESSION_COOKIE_SAME_SITE || "lax"
).toLowerCase();

if (!["lax", "strict", "none"].includes(sameSite)) {
    throw new Error(
        "SESSION_COOKIE_SAME_SITE must be lax, strict, or none."
    );
}

if (sameSite === "none" && !isProduction) {
    throw new Error(
        "SameSite=None requires secure cookies in production."
    );
}

// Express session middleware
app.use(
    session({
        store: sessionStore,
        name: "lexbd.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: isProduction,
            sameSite,
            maxAge: 8 * 60 * 60 * 1000
        }
    })
);

// Home route
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Welcome to Bangladesh Case Law Directory API"
    });
});

// Health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Bangladesh Case Law Directory API is running",
        timestamp: new Date().toISOString()
    });
});

// API routes
app.use("/api/database", dbTestRoutes);
app.use("/api/cases", caseRoutes);
app.use("/api/courts", courtRoutes);
app.use("/api/judges", judgeRoutes);
app.use("/api/topics", topicRoutes);
app.use("/api/legislation", legislationRoutes);
app.use("/api/auth", authRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/cases", adminCaseRoutes);
app.use("/api/admin/sessions", adminSessionRoutes);
app.use("/api/admin/activity", adminActivityRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found"
    });
});

// Central error handler
app.use((error, req, res, next) => {
    if (res.headersSent) {
        return next(error);
    }

    if (error.message === "Not allowed by CORS") {
        return res.status(403).json({
            success: false,
            message: "Origin not allowed."
        });
    }

    console.error("Application error:", error.message);

    return res.status(500).json({
        success: false,
        message: "Internal server error"
    });
});

export default app;
