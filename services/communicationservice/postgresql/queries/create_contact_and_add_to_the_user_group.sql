-- name: kCreateContactAndAddToTheUserGroup
-- param: $1 user_id INT

WITH new_contact AS (
    INSERT INTO communicationservice_schema.contact (name)
    VALUES (DEFAULT)
    RETURNING id, name
),
target_group AS (
    SELECT c_group.id
    FROM communicationservice_schema.contact_group AS c_group
    JOIN communicationservice_schema.user_groups AS u_groups ON c_group.id = u_groups.contact_group_id
    WHERE u_groups.user_id = $1
      AND c_group.contact_group_of_user = true
    LIMIT 1
)
INSERT INTO communicationservice_schema.contacts_of_group (contact_group_id, contact_id)
SELECT target_group.id, new_contact.id
FROM target_group, new_contact
RETURNING contact_id, (SELECT name FROM new_contact) AS contact_name;

