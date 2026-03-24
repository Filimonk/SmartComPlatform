-- name: kInsertSmsJob
-- param: $1 user_id INT
-- param: $2 contact_id UUID
-- param: $3 channel channel_type
-- param: $4 text text

INSERT INTO communicationservice_schema.contact_message_jobs (user_id, contact_id, channel, text)
VALUES ($1, $2, $3::communicationservice_schema.channel_type, $4)
RETURNING id;

