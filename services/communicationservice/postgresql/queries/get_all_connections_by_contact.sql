-- name: kGetAllConnectionsByContact
-- param: $1 user_id INT
-- param: $2 contact_id UUID

SELECT 
    c.id,
    c.contact_id,
    c.is_active,
    c.phone_number,
    c.mail_address,
    c.common_identifier
FROM communicationservice_schema.connection c
JOIN communicationservice_schema.contacts_of_group cg 
    ON cg.contact_id = c.contact_id
JOIN communicationservice_schema.user_groups ug 
    ON ug.contact_group_id = cg.contact_group_id
WHERE ug.user_id = $1
  AND c.contact_id = $2;

