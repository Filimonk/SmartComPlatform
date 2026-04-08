-- name: kCreateOriginConnection
-- param: $1 user_id INT
-- param: $2 origin_id UUID
-- param: $3 phone_number TEXT (optional)
-- param: $4 mail_address TEXT (optional)
-- param: $5 common_identifier TEXT (optional)

INSERT INTO communicationservice_schema.origin_connection (
    origin_id,
    phone_number,
    mail_address,
    common_identifier
)
SELECT
    $2,
    $3,
    $4,
    $5
FROM communicationservice_schema.origins_of_group og
JOIN communicationservice_schema.user_groups ug 
  ON ug.contact_group_id = og.contact_group_id
WHERE ug.user_id = $1
  AND og.origin_id = $2
RETURNING id, origin_id, is_active, phone_number, mail_address, common_identifier;
