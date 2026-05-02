-- name: kChangeTaskStatus
-- param: $1 user_id INT
-- param: $2 task_id UUID
-- param: $3 status TEXT

UPDATE communicationservice_schema.contact_task ct
SET
    status = $3::task_status_type
FROM communicationservice_schema.contacts_of_group cog
JOIN communicationservice_schema.user_groups ug
  ON ug.contact_group_id = cog.contact_group_id
WHERE cog.contact_id = ct.contact_id
  AND ct.id = $2
  AND ug.user_id = $1
RETURNING ct.id
;

