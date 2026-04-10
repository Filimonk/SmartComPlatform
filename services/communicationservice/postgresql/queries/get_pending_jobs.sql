-- name: kGetPendingJobs

WITH cte AS (
    SELECT id
    FROM communicationservice_schema.contact_message_jobs
    WHERE status = 'pending'
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT 10
)
UPDATE communicationservice_schema.contact_message_jobs j
SET status = 'processing',
    updated_at = now()
FROM cte
WHERE j.id = cte.id
RETURNING
    j.id,
    j.user_id,
    j.origin_connection_id,
    j.contact_id,
    j.connection_id,
    j.text;
    
