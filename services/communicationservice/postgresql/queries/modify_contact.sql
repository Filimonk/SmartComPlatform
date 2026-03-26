-- name: kModifyContact
-- param: $1 user_id INT
-- param: $2 contact_id UUID
-- param: $3 contact_name TEXT (optional)

UPDATE communicationservice_schema.contact c
SET
    name = COALESCE($3, c.name),
    updated_at = now()
WHERE c.id = $2
  AND EXISTS (
    SELECT 1
    FROM communicationservice_schema.contacts_of_group cg
    JOIN communicationservice_schema.user_groups ug ON cg.contact_group_id = ug.contact_group_id
    WHERE cg.contact_id = c.id
      AND ug.user_id = $1
  )
RETURNING
    c.id,
    c.name;

