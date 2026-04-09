-- name: kInsertMessageJob
-- param: $1 idempotency_token TEXT
-- param: $2 user_id INT
-- param: $3 origin_connection_id UUID
-- param: $4 contact_id UUID
-- param: $5 connection_id UUID
-- param: $6 text text

INSERT INTO communicationservice_schema.contact_message_jobs (idempotency_token, user_id, origin_connection_id, contact_id, connection_id, text)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (user_id, idempotency_token) 
DO UPDATE SET idempotency_token = EXCLUDED.idempotency_token
RETURNING id;

