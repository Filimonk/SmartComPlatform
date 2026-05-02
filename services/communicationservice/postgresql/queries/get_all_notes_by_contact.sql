-- name: kGetAllNotesByContact
-- param: $1 user_id INT
-- param: $2 contact_id UUID

SELECT 
  cn.id,
  cn.text,
  cn.created_at
FROM communicationservice_schema.contacts_of_group AS cog
JOIN communicationservice_schema.user_groups AS ug
  ON cog.contact_group_id = ug.contact_group_id
JOIN communicationservice_schema.contact_note AS cn
  ON cog.contact_id = cn.contact_id
WHERE ug.user_id = $1
  AND cog.contact_id = $2
ORDER BY cn.created_at ASC;

