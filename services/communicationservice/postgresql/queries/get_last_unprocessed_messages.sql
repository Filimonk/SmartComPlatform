-- name: kGetLastUnprocessedMessages
-- param: $1 user_id INT
-- param: $2 contact_id UUID

WITH
all_chat_messages AS (
    SELECT m.id, m.text, (m.contact_message_job_id IS NULL) AS is_incoming, m.created_at
    FROM communicationservice_schema.message m
    JOIN communicationservice_schema.connection c ON c.id = m.connection_id
    JOIN communicationservice_schema.contacts_of_group cg ON cg.contact_id = c.contact_id
    JOIN communicationservice_schema.user_groups ug ON ug.contact_group_id = cg.contact_group_id
    WHERE ug.user_id = $1
      AND c.contact_id = $2
),
updated_rows AS (
    UPDATE communicationservice_schema.message_with_taskproposer_status mtp
    SET processed = TRUE
    WHERE mtp.processed = FALSE
      AND mtp.message_id IN (SELECT id FROM all_chat_messages)
    RETURNING mtp.message_id
),
last_ten_messages AS (
    SELECT id, text, is_incoming, created_at
    FROM all_chat_messages
    ORDER BY created_at DESC
    LIMIT 10
)
SELECT id, text, is_incoming, created_at
FROM last_ten_messages
WHERE EXISTS (SELECT 1 FROM updated_rows)
ORDER BY created_at ASC;

