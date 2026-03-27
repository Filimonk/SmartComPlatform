-- name: kGetAllContacts
-- param: $1 user_id INT

SELECT 
    c.id,
    c.name
FROM communicationservice_schema.contact c
JOIN communicationservice_schema.contacts_of_group cg 
    ON cg.contact_id = c.id
JOIN communicationservice_schema.user_groups ug 
    ON ug.contact_group_id = cg.contact_group_id
WHERE ug.user_id = $1;

