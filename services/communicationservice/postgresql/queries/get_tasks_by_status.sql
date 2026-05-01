-- name: kGetTasksByStatus
-- param: $1 user_id INT
-- param: $2 contact_id UUID
-- param: $3 status TEXT

SELECT 
  ct.id,
  ct.text,
  ct.due_date,
  ct.status::TEXT
FROM communicationservice_schema.contacts_of_group AS cog
JOIN communicationservice_schema.user_groups AS ug
  ON cog.contact_group_id = ug.contact_group_id
JOIN communicationservice_schema.contact_task AS ct
  ON cog.contact_id = ct.contact_id
WHERE ug.user_id = $1
  AND cog.contact_id = $2
  AND ct.status = $3::task_status_type
ORDER BY ct.due_date ASC;

