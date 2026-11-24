
import express from "express";
import { getPool } from "../config/db.js";
import { requireRole } from "../middleware/authMiddleware.js";
import { logActivity } from "../utils/activityLogger.js";

const router = express.Router();

router.use(requireRole("admin", "editor"));

// =====================================
// CASE FIELDS
// =====================================

const revisionFields = {
  title: "title",
  case_number: "case_number",
  petitioner: "petitioner",
  respondent: "respondent",
  citation: "citation",
  court_id: "court_id",
  decision_year: "decision_year",
  decision_date: "decision_date",
  judgment_text: "judgment_text",
  pdf_url: "pdf_url",
  source_url: "source_url"
};

function validateCaseUpdates(body) {
  const proposed = {};

  for (const field of Object.keys(revisionFields)) {
    if (!Object.hasOwn(body, field)) continue;

    let value = body[field];

    if (field === "title") {
      if (typeof value !== "string" || !value.trim()) {
        throw new Error("Case title cannot be empty");
      }

      value = value.trim();
    }

    if (field === "court_id" && value !== null) {
      if (
        !Number.isInteger(Number(value)) ||
        Number(value) <= 0
      ) {
        throw new Error("Invalid court ID");
      }

      value = Number(value);
    }

    if (field === "decision_year" && value !== null) {
      if (
        !Number.isInteger(Number(value)) ||
        Number(value) < 1800 ||
        Number(value) > 2200
      ) {
        throw new Error("Invalid decision year");
      }

      value = Number(value);
    }

    if (
      value !== null &&
      field !== "court_id" &&
      field !== "decision_year" &&
      typeof value !== "string"
    ) {
      throw new Error(`Invalid value for ${field}`);
    }

    if (typeof value === "string") {
      value = value.trim();
    }

    proposed[field] = value === "" ? null : value;
  }

  if (Object.keys(proposed).length === 0) {
    throw new Error("No valid fields provided for update");
  }

  return proposed;
}

function normalizeCaseData(row) {
  return {
    title: row.title,
    case_number: row.case_number,
    petitioner: row.petitioner,
    respondent: row.respondent,
    citation: row.citation,
    court_id: row.court_id === null
      ? null
      : Number(row.court_id),
    decision_year: row.decision_year === null
      ? null
      : Number(row.decision_year),
    decision_date: row.decision_date
      ? new Date(row.decision_date).toISOString().slice(0, 10)
      : null,
    judgment_text: row.judgment_text,
    pdf_url: row.pdf_url,
    source_url: row.source_url
  };
}

function createRevisionMarkdown(previousData, proposedData) {
  const lines = ["## Proposed Case Changes", ""];

  for (const field of Object.keys(revisionFields)) {
    const oldValue = previousData[field] ?? null;
    const newValue = proposedData[field] ?? null;

    if (String(oldValue ?? "") === String(newValue ?? "")) {
      continue;
    }

    lines.push(`### ${field}`);
    lines.push("");
    lines.push("**Previous:**");
    lines.push("```text");
    lines.push(String(oldValue ?? "(empty)"));
    lines.push("```");
    lines.push("");
    lines.push("**Proposed:**");
    lines.push("```text");
    lines.push(String(newValue ?? "(empty)"));
    lines.push("```");
    lines.push("");
  }

  if (lines.length === 2) {
    return "";
  }

  return lines.join("\n");
}

function isAdmin(req) {
  return req.currentUser.role === "admin";
}

// =====================================
// GET ALL CASES
// =====================================

router.get("/", async (req, res) => {
  try {
    const pool = getPool();

    const page = Math.max(
      1,
      Number.parseInt(req.query.page, 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const offset = (page - 1) * limit;

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim()
        : "";

    const allowedStatuses = [
      "draft",
      "published",
      "archived"
    ];

    const status =
      typeof req.query.status === "string"
        ? req.query.status.trim().toLowerCase()
        : "";

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status filter"
      });
    }

    const conditions = [];
    const values = [];

    if (search) {
      values.push(`%${search}%`);

      conditions.push(`
        (
          c.title ILIKE $${values.length}
          OR c.case_number ILIKE $${values.length}
          OR c.petitioner ILIKE $${values.length}
          OR c.respondent ILIKE $${values.length}
          OR c.citation ILIKE $${values.length}
        )
      `);
    }

    if (status) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total
       FROM cases c
       ${whereClause}`,
      values
    );

    const total = Number(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT
        c.id,
        c.title,
        c.case_number,
        c.petitioner,
        c.respondent,
        c.citation,
        c.decision_year,
        c.status,
        c.created_at,
        c.updated_at,
        ct.name AS court_name,
        u.name AS created_by_name
       FROM cases c
       LEFT JOIN courts ct ON ct.id = c.court_id
       LEFT JOIN users u ON u.id = c.created_by
       ${whereClause}
       ORDER BY c.created_at DESC, c.id DESC
       LIMIT $${values.length + 1}
       OFFSET $${values.length + 2}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      cases: result.rows
    });

  } catch (error) {
    console.error("Admin case list error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve cases"
    });
  }
});

// =====================================
// GET SINGLE CASE
// =====================================

router.get("/:id", async (req, res) => {
  try {
    const caseId = Number(req.params.id);

    if (!Number.isSafeInteger(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID"
      });
    }

    const pool = getPool();

    const result = await pool.query(
      `SELECT
        id, title, case_number, petitioner, respondent,
        citation, court_id, decision_year, decision_date,
        judgment_text, pdf_url, source_url, status
       FROM cases
       WHERE id = $1`,
      [caseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Case not found"
      });
    }

    let caseData = result.rows[0];

    if (!isAdmin(req) && caseData.status === "published") {
      const pendingResult = await pool.query(
        `SELECT proposed_data
         FROM case_revisions
         WHERE case_id = $1
           AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [caseId]
      );

      if (pendingResult.rows.length > 0) {
        caseData = {
          ...caseData,
          ...pendingResult.rows[0].proposed_data
        };
      }
    }

    return res.status(200).json({
      success: true,
      case: caseData
    });

  } catch (error) {
    console.error("Get single case error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve case"
    });
  }
});

// =====================================
// UPDATE CASE / SUBMIT REVISION
// =====================================

router.patch("/:id", async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  let transactionStarted = false;

  try {
    const caseId = Number(req.params.id);

    if (!Number.isSafeInteger(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID"
      });
    }

    const userId = req.currentUser.id;
    const role = req.currentUser.role;

    const proposedUpdates = validateCaseUpdates(req.body);

    await client.query("BEGIN");
    transactionStarted = true;

    const caseResult = await client.query(
      `SELECT *
       FROM cases
       WHERE id = $1
       FOR UPDATE`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        success: false,
        message: "Case not found"
      });
    }

    const currentCase = caseResult.rows[0];

    // Editor editing a Published Case
    if (
      role === "editor" &&
      currentCase.status === "published"
    ) {
      const pendingResult = await client.query(
        `SELECT *
         FROM case_revisions
         WHERE case_id = $1
           AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [caseId]
      );

      const existingRevision = pendingResult.rows[0];

      const previousData = existingRevision
        ? existingRevision.previous_data
        : normalizeCaseData(currentCase);

      const existingProposedData = existingRevision
        ? existingRevision.proposed_data
        : previousData;

      const updatedProposedData = {
        ...existingProposedData,
        ...proposedUpdates
      };

      const changesMarkdown = createRevisionMarkdown(
        previousData,
        updatedProposedData
      );

      if (!changesMarkdown) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(400).json({
          success: false,
          message: "No changes detected"
        });
      }

      let revisionResult;

      if (existingRevision) {
        revisionResult = await client.query(
          `UPDATE case_revisions
           SET proposed_data = $1,
               changes_markdown = $2,
               updated_at = NOW()
           WHERE id = $3
           RETURNING *`,
          [
            JSON.stringify(updatedProposedData),
            changesMarkdown,
            existingRevision.id
          ]
        );

      } else {
        revisionResult = await client.query(
          `INSERT INTO case_revisions (
            case_id,
            submitted_by,
            previous_data,
            proposed_data,
            changes_markdown,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 'pending')
          RETURNING *`,
          [
            caseId,
            userId,
            JSON.stringify(previousData),
            JSON.stringify(updatedProposedData),
            changesMarkdown
          ]
        );
      }

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message: "Changes submitted for Admin approval",
        revision: revisionResult.rows[0]
      });
    }

    // Editor can directly update Draft cases only.
    if (
      role === "editor" &&
      currentCase.status !== "draft"
    ) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(403).json({
        success: false,
        message: "Editors can only directly update draft cases"
      });
    }

    const fields = Object.keys(proposedUpdates);

    const setClause = fields
      .map((field, index) =>
        `"${revisionFields[field]}" = $${index + 1}`
      )
      .join(", ");

    const values = fields.map(
      field => proposedUpdates[field]
    );

    values.push(caseId);

    const updateResult = await client.query(
      `UPDATE cases
       SET ${setClause},
           updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );

    await client.query("COMMIT");
    transactionStarted = false;

    await logActivity({
      actorUserId: userId,
      action: "UPDATE",
      entityType: "CASE",
      entityId: caseId,
      description: `Updated case: ${currentCase.title}`
    });

    return res.status(200).json({
      success: true,
      message: "Case updated successfully",
      case: updateResult.rows[0]
    });

  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Case update error:", error.message);

    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update case"
    });

  } finally {
    client.release();
  }
});

// =====================================
// ADMIN: PENDING CASE REVISIONS
// =====================================

router.get(
  "/revisions/pending",
  requireRole("admin"),
  async (req, res) => {
    try {
      const result = await getPool().query(
        `SELECT
          cr.*,
          c.title AS case_title,
          c.citation AS case_citation,
          u.name AS submitted_by_name
         FROM case_revisions cr
         JOIN cases c ON c.id = cr.case_id
         LEFT JOIN users u ON u.id = cr.submitted_by
         WHERE cr.status = 'pending'
         ORDER BY cr.created_at ASC`
      );

      return res.status(200).json({
        success: true,
        revisions: result.rows
      });

    } catch (error) {
      console.error("Pending revisions error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to load pending revisions"
      });
    }
  }
);

// =====================================
// ADMIN: APPROVE CASE REVISION
// =====================================

router.post(
  "/revisions/:revisionId/approve",
  requireRole("admin"),
  async (req, res) => {
    const pool = getPool();
    const client = await pool.connect();

    let transactionStarted = false;

    try {
      const revisionId = Number(req.params.revisionId);

      if (!Number.isSafeInteger(revisionId) || revisionId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid revision ID"
        });
      }

      await client.query("BEGIN");
      transactionStarted = true;

      // First obtain the case ID.
      const referenceResult = await client.query(
        `SELECT case_id
         FROM case_revisions
         WHERE id = $1`,
        [revisionId]
      );

      if (!referenceResult.rows.length) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Revision not found"
        });
      }

      const caseId = referenceResult.rows[0].case_id;

      // Lock case first to maintain consistent lock order.
      const caseResult = await client.query(
        `SELECT *
         FROM cases
         WHERE id = $1
         FOR UPDATE`,
        [caseId]
      );

      if (!caseResult.rows.length) {
        throw new Error("Related case not found");
      }

      const currentCase = caseResult.rows[0];

      const revisionResult = await client.query(
        `SELECT *
         FROM case_revisions
         WHERE id = $1
         FOR UPDATE`,
        [revisionId]
      );

      if (!revisionResult.rows.length) {
        throw new Error("Revision not found");
      }

      const revision = revisionResult.rows[0];

      if (revision.status !== "pending") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "Revision has already been reviewed"
        });
      }

      if (String(revision.case_id) !== String(caseId)) {
        throw new Error("Invalid revision relationship");
      }

      if (currentCase.status !== "published") {
        throw new Error("Case is no longer published");
      }

      const proposedData = revision.proposed_data;
      const previousData = revision.previous_data;

      const fields = Object.keys(proposedData || {});

      if (
        !fields.length ||
        fields.some(field => !Object.hasOwn(revisionFields, field))
      ) {
        throw new Error("Invalid revision data");
      }

      // Check whether original case data has changed.
      for (const field of Object.keys(revisionFields)) {
        const oldValue = previousData[field] ?? null;
        const currentValue = normalizeCaseData(currentCase)[field] ?? null;

        if (
          String(oldValue ?? "") !==
          String(currentValue ?? "")
        ) {
          throw new Error(
            `Case data conflict detected in field: ${field}`
          );
        }
      }

      const setClause = fields
        .map((field, index) =>
          `"${revisionFields[field]}" = $${index + 1}`
        )
        .join(", ");

      const values = fields.map(
        field => proposedData[field]
      );

      values.push(caseId);

      const updateResult = await client.query(
        `UPDATE cases
         SET ${setClause},
             updated_at = NOW()
         WHERE id = $${values.length}
         RETURNING id, title, status, updated_at`,
        values
      );

      await client.query(
        `UPDATE case_revisions
         SET status = 'approved',
             reviewed_by = $1,
             reviewed_at = NOW(),
             review_note = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [
          req.currentUser.id,
          typeof req.body.review_note === "string"
            ? req.body.review_note.trim() || null
            : null,
          revisionId
        ]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message: "Revision approved and case updated successfully",
        case: updateResult.rows[0]
      });

    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Revision approval error:", error.message);

      return res.status(400).json({
        success: false,
        message: error.message || "Failed to approve revision"
      });

    } finally {
      client.release();
    }
  }
);

// =====================================
// ADMIN: REJECT CASE REVISION
// =====================================

router.post(
  "/revisions/:revisionId/reject",
  requireRole("admin"),
  async (req, res) => {
    try {
      const revisionId = Number(req.params.revisionId);

      if (!Number.isSafeInteger(revisionId) || revisionId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid revision ID"
        });
      }

      const reviewNote =
        typeof req.body.review_note === "string"
          ? req.body.review_note.trim() || null
          : null;

      const result = await getPool().query(
        `UPDATE case_revisions
         SET status = 'rejected',
             reviewed_by = $1,
             reviewed_at = NOW(),
             review_note = $2,
             updated_at = NOW()
         WHERE id = $3
           AND status = 'pending'
         RETURNING id, status`,
        [
          req.currentUser.id,
          reviewNote,
          revisionId
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({
          success: false,
          message: "Pending revision not found"
        });
      }

      return res.status(200).json({
        success: true,
        message: "Revision rejected successfully",
        revision: result.rows[0]
      });

    } catch (error) {
      console.error("Revision rejection error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Failed to reject revision"
      });
    }
  }
);

// =====================================
// PUBLISH / UNPUBLISH CASE
// =====================================

const changeCasePublicationStatus = (targetStatus) => {
  return async (req, res) => {
    const caseId = Number(req.params.id);

    if (!Number.isSafeInteger(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID"
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const caseResult = await client.query(
        `SELECT id, title, judgment_text, status
         FROM cases
         WHERE id = $1
         FOR UPDATE`,
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Case not found"
        });
      }

      const existingCase = caseResult.rows[0];

      if (existingCase.status === "archived") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "Archived cases cannot be published or unpublished"
        });
      }

      if (existingCase.status === targetStatus) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: `Case is already ${targetStatus}`
        });
      }

      if (
        targetStatus === "published" &&
        (
          !existingCase.title?.trim() ||
          !existingCase.judgment_text?.trim()
        )
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "Case title and judgment text are required before publication"
        });
      }

      const result = await client.query(
        `UPDATE cases
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, title, status, updated_at`,
        [targetStatus, caseId]
      );

      await client.query("COMMIT");

      await logActivity({
        actorUserId: req.currentUser.id,
        action: targetStatus === "published"
          ? "PUBLISH"
          : "UNPUBLISH",
        entityType: "CASE",
        entityId: caseId,
        description: `${targetStatus} case: ${existingCase.title}`
      });

      return res.status(200).json({
        success: true,
        message: targetStatus === "published"
          ? "Case published successfully"
          : "Case moved back to Draft successfully",
        case: result.rows[0]
      });

    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Publication status error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not change case publication status"
      });

    } finally {
      client.release();
    }
  };
};

// =====================================
// ARCHIVE / RESTORE CASE
// =====================================

const changeCaseArchiveStatus = (action) => {
  return async (req, res) => {
    const caseId = Number(req.params.id);

    if (!Number.isSafeInteger(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID"
      });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const caseResult = await client.query(
        `SELECT id, title, status
         FROM cases
         WHERE id = $1
         FOR UPDATE`,
        [caseId]
      );

      if (caseResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Case not found"
        });
      }

      const existingCase = caseResult.rows[0];
      let newStatus;

      if (action === "archive") {
        if (existingCase.status === "archived") {
          await client.query("ROLLBACK");

          return res.status(409).json({
            success: false,
            message: "Case is already archived"
          });
        }

        newStatus = "archived";
      }

      if (action === "restore") {
        if (existingCase.status !== "archived") {
          await client.query("ROLLBACK");

          return res.status(409).json({
            success: false,
            message: "Only archived cases can be restored"
          });
        }

        newStatus = "draft";
      }

      const result = await client.query(
        `UPDATE cases
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING id, title, status, updated_at`,
        [newStatus, caseId]
      );

      if (action === "archive") {
        await client.query(
          `UPDATE case_revisions
           SET status = 'rejected',
               reviewed_by = $1,
               reviewed_at = NOW(),
               review_note = 'Case archived by Admin',
               updated_at = NOW()
           WHERE case_id = $2
             AND status = 'pending'`,
          [req.currentUser.id, caseId]
        );
      }

      await client.query("COMMIT");

      await logActivity({
        actorUserId: req.currentUser.id,
        action: action.toUpperCase(),
        entityType: "CASE",
        entityId: caseId,
        description: `${action} case: ${existingCase.title}`
      });

      return res.status(200).json({
        success: true,
        message: action === "archive"
          ? "Case archived successfully"
          : "Case restored successfully as Draft",
        case: result.rows[0]
      });

    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});

      console.error("Archive/restore error:", error.message);

      return res.status(500).json({
        success: false,
        message: "Could not change case archive status"
      });

    } finally {
      client.release();
    }
  };
};

// =====================================
// ADMIN-ONLY STATUS ROUTES
// =====================================

router.post(
  "/:id/publish",
  requireRole("admin"),
  changeCasePublicationStatus("published")
);

router.post(
  "/:id/unpublish",
  requireRole("admin"),
  changeCasePublicationStatus("draft")
);

router.post(
  "/:id/archive",
  requireRole("admin"),
  changeCaseArchiveStatus("archive")
);

router.post(
  "/:id/restore",
  requireRole("admin"),
  changeCaseArchiveStatus("restore")
);

// =====================================
// CASE RELATIONSHIP UPDATE
// =====================================

async function replaceRelationships(req, res, legacy = false) {
  const caseId = Number(req.params.id);

  if (!Number.isSafeInteger(caseId) || caseId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid case ID"
    });
  }

  const judgeIds = req.body.judge_ids ?? [];
  const topicIds = req.body.topic_ids ?? [];

  const legislationItems = legacy
    ? (req.body.legislation ?? [])
    : (req.body.legislation_sections ?? []);

  if (
    !Array.isArray(judgeIds) ||
    !Array.isArray(topicIds) ||
    !Array.isArray(legislationItems)
  ) {
    return res.status(400).json({
      success: false,
      message: "Relationship fields must be arrays"
    });
  }

  const isValidId = (id) =>
    Number.isSafeInteger(id) && id > 0;

  if (
    !judgeIds.every(isValidId) ||
    !topicIds.every(isValidId)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid judge ID or topic ID"
    });
  }

  if (
    !legislationItems.every(item =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      isValidId(item.legislation_id) &&
      isValidId(item.section_id)
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid legislation relationship"
    });
  }

  const judges = [...new Set(judgeIds)];
  const topics = [...new Set(topicIds)];

  const legislation = [
    ...new Map(
      legislationItems.map(item => [
        `${item.legislation_id}-${item.section_id}`,
        item
      ])
    ).values()
  ];

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const caseResult = await client.query(
      `SELECT id, status
       FROM cases
       WHERE id = $1
       FOR UPDATE`,
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Case not found"
      });
    }

    if (
      !isAdmin(req) &&
      caseResult.rows[0].status !== "draft"
    ) {
      await client.query("ROLLBACK");

      return res.status(403).json({
        success: false,
        message: "Editors can only change relationships of Draft cases"
      });
    }

    if (judges.length > 0) {
      const result = await client.query(
        `SELECT id FROM judges
         WHERE id = ANY($1::bigint[])`,
        [judges]
      );

      if (result.rows.length !== judges.length) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "One or more judge IDs do not exist"
        });
      }
    }

    if (topics.length > 0) {
      const result = await client.query(
        `SELECT id FROM legal_topics
         WHERE id = ANY($1::bigint[])`,
        [topics]
      );

      if (result.rows.length !== topics.length) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "One or more topic IDs do not exist"
        });
      }
    }

    const legislationIds = [
      ...new Set(legislation.map(item => item.legislation_id))
    ];

    if (legislationIds.length > 0) {
      const result = await client.query(
        `SELECT id FROM legislation
         WHERE id = ANY($1::bigint[])`,
        [legislationIds]
      );

      if (result.rows.length !== legislationIds.length) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "One or more legislation IDs do not exist"
        });
      }
    }

    const sectionIds = [
      ...new Set(legislation.map(item => item.section_id))
    ];

    if (sectionIds.length > 0) {
      const result = await client.query(
        `SELECT id, legislation_id
         FROM legislation_sections
         WHERE id = ANY($1::bigint[])`,
        [sectionIds]
      );

      const sectionMap = new Map(
        result.rows.map(row => [
          String(row.id),
          String(row.legislation_id)
        ])
      );

      for (const item of legislation) {
        if (
          sectionMap.get(String(item.section_id)) !==
          String(item.legislation_id)
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "A section does not belong to the specified legislation"
          });
        }
      }
    }

    await client.query(
      "DELETE FROM case_judges WHERE case_id = $1",
      [caseId]
    );

    await client.query(
      "DELETE FROM case_topics WHERE case_id = $1",
      [caseId]
    );

    await client.query(
      "DELETE FROM case_legislation WHERE case_id = $1",
      [caseId]
    );

    for (const judgeId of judges) {
      await client.query(
        `INSERT INTO case_judges (case_id, judge_id)
         VALUES ($1, $2)`,
        [caseId, judgeId]
      );
    }

    for (const topicId of topics) {
      await client.query(
        `INSERT INTO case_topics (case_id, topic_id)
         VALUES ($1, $2)`,
        [caseId, topicId]
      );
    }

    for (const item of legislation) {
      await client.query(
        `INSERT INTO case_legislation
         (case_id, legislation_id, section_id)
         VALUES ($1, $2, $3)`,
        [caseId, item.legislation_id, item.section_id]
      );
    }

    await client.query("COMMIT");

    await logActivity({
      actorUserId: req.currentUser.id,
      action: "UPDATE_RELATIONS",
      entityType: "CASE",
      entityId: caseId,
      description: `Updated relationships for case ID ${caseId}`
    });

    return res.status(200).json({
      success: true,
      message: "Case relationships updated successfully",
      relationships: {
        judge_ids: judges,
        topic_ids: topics,
        legislation_sections: legislation
      }
    });

  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});

    console.error("Case relationship error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Could not update case relationships"
    });

  } finally {
    client.release();
  }
}

router.put("/:id/relationships", (req, res) =>
  replaceRelationships(req, res, false)
);

router.put("/:id/relations", (req, res) =>
  replaceRelationships(req, res, true)
);

// =====================================
// GET CASE RELATIONSHIPS
// =====================================

router.get("/:id/relations", async (req, res) => {
  try {
    const caseId = Number(req.params.id);

    if (!Number.isSafeInteger(caseId) || caseId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid case ID"
      });
    }

    const pool = getPool();

    const caseResult = await pool.query(
      "SELECT id, title FROM cases WHERE id = $1",
      [caseId]
    );

    if (caseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Case not found"
      });
    }

    const judgesResult = await pool.query(
      `SELECT judge_id FROM case_judges
       WHERE case_id = $1
       ORDER BY judge_id`,
      [caseId]
    );

    const topicsResult = await pool.query(
      `SELECT topic_id FROM case_topics
       WHERE case_id = $1
       ORDER BY topic_id`,
      [caseId]
    );

    const legislationResult = await pool.query(
      `SELECT legislation_id, section_id
       FROM case_legislation
       WHERE case_id = $1
       ORDER BY legislation_id, section_id`,
      [caseId]
    );

    return res.status(200).json({
      success: true,
      case: caseResult.rows[0],
      relations: {
        judges: judgesResult.rows.map(row => Number(row.judge_id)),
        topics: topicsResult.rows.map(row => Number(row.topic_id)),
        legislation: legislationResult.rows.map(row => ({
          legislation_id: Number(row.legislation_id),
          section_id: Number(row.section_id)
        }))
      }
    });

  } catch (error) {
    console.error("Get case relations error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve case relationships"
    });
  }
});

// =====================================
// CREATE CASE
// =====================================

router.post("/", async (req, res) => {
  try {
    const {
      title,
      case_number,
      petitioner,
      respondent,
      citation,
      court_id,
      decision_year,
      decision_date,
      judgment_text,
      pdf_url,
      source_url
    } = req.body;

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Case title is required"
      });
    }

    if (
      court_id !== undefined &&
      court_id !== null &&
      (!Number.isInteger(Number(court_id)) || Number(court_id) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid court ID"
      });
    }

    if (
      decision_year !== undefined &&
      decision_year !== null &&
      (
        !Number.isInteger(Number(decision_year)) ||
        Number(decision_year) < 1800 ||
        Number(decision_year) > 2200
      )
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision year"
      });
    }

    const pool = getPool();

    const result = await pool.query(
      `INSERT INTO cases (
        title, case_number, petitioner, respondent, citation,
        court_id, decision_year, decision_date, judgment_text,
        pdf_url, source_url, status, created_by
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, 'draft', $12
      )
      RETURNING
        id, title, case_number, status, created_by, created_at`,
      [
        title.trim(),
        case_number || null,
        petitioner || null,
        respondent || null,
        citation || null,
        court_id ? Number(court_id) : null,
        decision_year ? Number(decision_year) : null,
        decision_date || null,
        judgment_text || null,
        pdf_url || null,
        source_url || null,
        req.currentUser.id
      ]
    );

    await logActivity({
      actorUserId: req.currentUser.id,
      action: "CREATE",
      entityType: "CASE",
      entityId: result.rows[0].id,
      description: `Created case: ${result.rows[0].title}`
    });

    return res.status(201).json({
      success: true,
      message: "Case created successfully as Draft",
      case: result.rows[0]
    });

  } catch (error) {
    console.error("Create case error:", error.message);

    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message: "Invalid court ID or referenced record"
      });
    }

    return res.status(500).json({
      success: false,
      message: "Could not create case"
    });
  }
});

export default router;
