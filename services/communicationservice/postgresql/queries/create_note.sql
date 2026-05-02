-- name: kCreateNote
-- param: $1 user_id INT
-- param: $2 contact_id UUID
-- param: $3 text TEXT

INSERT INTO communicationservice_schema.contact_note (
    contact_id,
    text
)
SELECT
    $2,
    $3
FROM communicationservice_schema.contacts_of_group AS cog
JOIN communicationservice_schema.user_groups AS ug ON cog.contact_group_id = ug.contact_group_id
WHERE ug.user_id = $1
  AND cog.contact_id = $2
RETURNING id;

