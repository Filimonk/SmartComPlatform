-- name: kGetOriginConnecton
-- param: $1 origin_connection_id UUID

SELECT 
    oc.id,
    oc.origin_id,
    oc.is_active,
    oc.phone_number,
    oc.mail_address,
    oc.common_identifier
FROM communicationservice_schema.origin_connection oc
WHERE oc.id = $1;

