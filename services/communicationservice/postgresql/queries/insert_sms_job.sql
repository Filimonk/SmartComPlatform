-- name: kInsertSmsJob
-- param: $1 chat_id text
-- param: $2 text int

INSERT INTO communicationservice_schema.sms_jobs (chat_id, text)
VALUES ($1, $2)
RETURNING id;

