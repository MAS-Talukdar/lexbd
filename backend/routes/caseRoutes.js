
import express from "express";
import { getPool } from "../config/db.js";

const router = express.Router();

// =====================================
// GET /api/cases/search
// Advanced Search for Published Cases
// =====================================

router.get("/search", async (req, res) => {
    try {
        const pool = getPool();

        // Pagination
        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            50,
            Math.max(1, parseInt(req.query.limit, 10) || 12)
        );

        const offset = (page - 1) * limit;

        // Search keyword
        const search = String(
            req.query.q || req.query.search || ""
        ).trim();

        // Filter values
        const courtId = req.query.court_id;
        const judgeId = req.query.judge_id;
        const topicId = req.query.topic_id;
        const legislationId = req.query.legislation_id;
        const year = req.query.year;

        const conditions = [
            "c.status = 'published'"
        ];

        const values = [];

        // Search across case fields
        if (search) {
            values.push(`%${search}%`);

            const searchIndex = values.length;

            conditions.push(`
                (
                    c.title ILIKE $${searchIndex}
                    OR c.petitioner ILIKE $${searchIndex}
                    OR c.respondent ILIKE $${searchIndex}
                    OR c.citation ILIKE $${searchIndex}
                    OR c.case_number ILIKE $${searchIndex}
                    OR c.judgment_text ILIKE $${searchIndex}
                )
            `);
        }

        // Validate and apply ID filters
        const idFilters = [
            ["court_id", courtId, "c.court_id"],
        ];

        for (const [name, value, column] of idFilters) {
            if (value !== undefined && value !== "") {
                const id = Number(value);

                if (!Number.isSafeInteger(id) || id <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid ${name}`
                    });
                }

                values.push(id);
                conditions.push(`${column} = $${values.length}`);
            }
        }

        // Judge filter
        if (judgeId !== undefined && judgeId !== "") {
            const id = Number(judgeId);

            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid judge_id"
                });
            }

            values.push(id);

            conditions.push(`
                EXISTS (
                    SELECT 1
                    FROM case_judges cj
                    WHERE cj.case_id = c.id
                    AND cj.judge_id = $${values.length}
                )
            `);
        }

        // Legal Topic filter
        if (topicId !== undefined && topicId !== "") {
            const id = Number(topicId);

            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid topic_id"
                });
            }

            values.push(id);

            conditions.push(`
                EXISTS (
                    SELECT 1
                    FROM case_topics ct
                    WHERE ct.case_id = c.id
                    AND ct.topic_id = $${values.length}
                )
            `);
        }

        // Legislation filter
        if (
            legislationId !== undefined &&
            legislationId !== ""
        ) {
            const id = Number(legislationId);

            if (!Number.isSafeInteger(id) || id <= 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid legislation_id"
                });
            }

            values.push(id);

            conditions.push(`
                EXISTS (
                    SELECT 1
                    FROM case_legislation cl
                    WHERE cl.case_id = c.id
                    AND cl.legislation_id = $${values.length}
                )
            `);
        }

        // Decision Year filter
        if (year !== undefined && year !== "") {
            const decisionYear = Number(year);

            if (
                !Number.isInteger(decisionYear) ||
                decisionYear < 1800 ||
                decisionYear > 2100
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid decision year"
                });
            }

            values.push(decisionYear);

            conditions.push(
                `c.decision_year = $${values.length}`
            );
        }

        const whereClause = conditions.join(" AND ");

        // Count matching cases
        const countQuery = `
            SELECT COUNT(*) AS total
            FROM cases c
            WHERE ${whereClause}
        `;

        const countResult = await pool.query(
            countQuery,
            values
        );

        const total = Number(countResult.rows[0].total);

        // Retrieve matching cases
        const casesQuery = `
            SELECT
                c.id,
                c.title,
                c.case_number,
                c.petitioner,
                c.respondent,
                c.citation,
                c.court_id,
                ct.name AS court_name,
                c.decision_year,
                c.decision_date,
                c.source_url,
                c.pdf_url,
                c.created_at

            FROM cases c

            LEFT JOIN courts ct
                ON ct.id = c.court_id

            WHERE ${whereClause}

            ORDER BY
                c.decision_date DESC NULLS LAST,
                c.created_at DESC

            LIMIT $${values.length + 1}
            OFFSET $${values.length + 2}
        `;

        const casesResult = await pool.query(
            casesQuery,
            [...values, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            success: true,
            message: "Cases retrieved successfully",

            filters: {
                q: search,
                court_id: courtId || null,
                judge_id: judgeId || null,
                topic_id: topicId || null,
                legislation_id: legislationId || null,
                year: year || null
            },

            pagination: {
                currentPage: page,
                limit,
                total,
                totalPages,
                totalCases: total,
                totalPages
            },

            cases: casesResult.rows
        });

    } catch (error) {
        console.error(
            "Advanced case search error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to search cases"
        });
    }
});


// =====================================
// GET /api/cases
// Get Published Cases with Pagination
// =====================================

router.get("/", async (req, res) => {
    try {
        const pool = getPool();

        const page = Math.max(
            1,
            parseInt(req.query.page, 10) || 1
        );

        const limit = Math.min(
            50,
            Math.max(1, parseInt(req.query.limit, 10) || 10)
        );

        const offset = (page - 1) * limit;

        const search = String(
            req.query.search || ""
        ).trim();

        const values = [];
        const conditions = [
            "c.status = 'published'"
        ];

        if (search) {
            values.push(`%${search}%`);

            conditions.push(`
                (
                    c.title ILIKE $${values.length}
                    OR c.petitioner ILIKE $${values.length}
                    OR c.respondent ILIKE $${values.length}
                    OR c.citation ILIKE $${values.length}
                    OR c.case_number ILIKE $${values.length}
                )
            `);
        }

        const whereClause = conditions.join(" AND ");

        const countResult = await pool.query(
            `
                SELECT COUNT(*) AS total
                FROM cases c
                WHERE ${whereClause}
            `,
            values
        );

        const total = Number(countResult.rows[0].total);

        const casesResult = await pool.query(
            `
                SELECT
                    c.id,
                    c.title,
                    c.case_number,
                    c.petitioner,
                    c.respondent,
                    c.citation,
                    c.court_id,
                    ct.name AS court_name,
                    c.decision_year,
                    c.decision_date,
                    c.pdf_url,
                    c.source_url,
                    c.created_at

                FROM cases c

                LEFT JOIN courts ct
                    ON ct.id = c.court_id

                WHERE ${whereClause}

                ORDER BY
                    c.decision_date DESC NULLS LAST,
                    c.created_at DESC

                LIMIT $${values.length + 1}
                OFFSET $${values.length + 2}
            `,
            [...values, limit, offset]
        );

        const totalPages = Math.ceil(total / limit);

        return res.status(200).json({
            success: true,
            message: "Published cases retrieved successfully",

            pagination: {
                currentPage: page,
                limit,
                total,
                totalPages,
                totalCases: total,
                totalPages
            },

            cases: casesResult.rows
        });

    } catch (error) {
        console.error(
            "Get cases error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Failed to retrieve cases"
        });
    }
});


// =====================================
// GET /api/cases/:id
// Get Complete Published Case Details
// =====================================

router.get("/:id", async (req, res) => {
    const caseId = Number(req.params.id);

    if (
        !Number.isSafeInteger(caseId) ||
        caseId <= 0
    ) {
        return res.status(400).json({
            success: false,
            message: "Invalid case ID"
        });
    }

    try {
        const pool = getPool();

        const caseResult = await pool.query(
            `
                SELECT
                    c.id,
                    c.title,
                    c.case_number,
                    c.petitioner,
                    c.respondent,
                    c.citation,
                    c.decision_year,
                    c.decision_date,
                    c.judgment_text,
                    c.pdf_url,
                    c.source_url,
                    c.created_at,
                    c.updated_at,
                    ct.name AS court_name

                FROM cases c

                LEFT JOIN courts ct
                    ON ct.id = c.court_id

                WHERE c.id = $1
                AND c.status = 'published'

                LIMIT 1
            `,
            [caseId]
        );

        if (caseResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Published case not found"
            });
        }

        // Judges
        const judgeResult = await pool.query(
            `
                SELECT j.id, j.name

                FROM case_judges cj

                JOIN judges j
                    ON j.id = cj.judge_id

                WHERE cj.case_id = $1

                ORDER BY j.name
            `,
            [caseId]
        );

        // Legal Topics
        const topicResult = await pool.query(
            `
                SELECT
                    t.id,
                    t.name,
                    t.parent_id,
                    t.description

                FROM case_topics ct

                JOIN legal_topics t
                    ON t.id = ct.topic_id

                WHERE ct.case_id = $1

                ORDER BY t.name
            `,
            [caseId]
        );

        // Legislation and Sections
        const legislationResult = await pool.query(
            `
                SELECT
                    l.id AS legislation_id,
                    l.title AS legislation_title,
                    l.short_title,
                    l.year AS legislation_year,
                    ls.id AS section_id,
                    ls.section_label,
                    ls.section_title,
                    ls.section_text

                FROM case_legislation cl

                JOIN legislation l
                    ON l.id = cl.legislation_id

                JOIN legislation_sections ls
                    ON ls.id = cl.section_id
                    AND ls.legislation_id = cl.legislation_id

                WHERE cl.case_id = $1

                ORDER BY l.title, ls.section_label
            `,
            [caseId]
        );

        return res.status(200).json({
            success: true,

            case: {
                ...caseResult.rows[0],
                judges: judgeResult.rows,
                topics: topicResult.rows,
                legislation: legislationResult.rows
            }
        });

    } catch (error) {
        console.error(
            "Case details error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Could not retrieve case details"
        });
    }
});

export default router;
