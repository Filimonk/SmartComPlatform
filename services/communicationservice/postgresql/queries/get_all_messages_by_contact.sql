-- name: kGetAllMessagesByContact
-- param: $1 user_id INT
-- param: $2 contact_id UUID

SELECT 
    m.id,
    c.channel::TEXT,
    m.text,
    (m.contact_message_job_id IS NULL) AS is_incoming,
    m.created_at
FROM communicationservice_schema.message m
JOIN communicationservice_schema.connection c
    ON c.id = m.connection_id
JOIN communicationservice_schema.contacts_of_group cg 
    ON cg.contact_id = c.contact_id
JOIN communicationservice_schema.user_groups ug 
    ON ug.contact_group_id = cg.contact_group_id
WHERE ug.user_id = $1
  AND c.contact_id = $2
ORDER BY m.created_at ASC;

