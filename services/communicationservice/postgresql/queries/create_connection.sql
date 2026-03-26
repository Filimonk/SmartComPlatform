-- name: kInsertSmsJob
-- param: $1 idempotency_token TEXT
-- param: $2 user_id INT
-- param: $3 contact_id UUID
-- param: $4 channel channel_type
-- param: $5 text text

INSERT INTO communicationservice_schema.contact_message_jobs (idempotency_token, user_id, contact_id, channel, text)
VALUES ($1, $2, $3, $4::communicationservice_schema.channel_type, $5)
ON CONFLICT (user_id, idempotency_token) 
DO UPDATE SET idempotency_token = EXCLUDED.idempotency_token
RETURNING id;

