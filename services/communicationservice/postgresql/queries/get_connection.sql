-- name: kGetConnecton
-- param: $1 connection_id UUID

SELECT 
    c.id,
    c.contact_id,
    c.is_active,
    c.phone_number,
    c.mail_address,
    c.common_identifier
FROM communicationservice_schema.connection c
WHERE c.id = $1;

