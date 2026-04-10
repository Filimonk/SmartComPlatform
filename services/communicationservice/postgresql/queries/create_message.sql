-- name: kCreateMessage
-- param: $1 origin_connection_id UUID
-- param: $2 connection_id UUID
-- param: $3 text TEXT
-- param: $4 contact_message_job_id UUID

INSERT INTO communicationservice_schema.message (
    origin_connection_id,
    connection_id,
    text,
    contact_message_job_id
)
VALUES (
    $1,
    $2,
    $3,
    $4
)
RETURNING message.id;

