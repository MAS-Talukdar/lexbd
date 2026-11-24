
import { getPool } from "../config/db.js";

async function logActivity({
    actorUserId,
    action,
    entityType,
    entityId = null,
    description
}) {
    try {
        const pool = getPool();

        await pool.query(
            `INSERT INTO activity_logs (
                actor_user_id,
                action,
                entity_type,
                entity_id,
                description
            )
            VALUES ($1, $2, $3, $4, $5)`,
            [
                actorUserId || null,
                action,
                entityType,
                entityId,
                description
            ]
        );

    } catch (error) {
        console.error("Activity Logger Error:", error.message);
    }
}

export { logActivity };
