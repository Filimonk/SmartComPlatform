-- name: kGetAllOriginConnections
-- param: $1 user_id INT
-- param: $2 origin_id UUID

SELECT 
    oc.id,
    oc.origin_id,
    oc.is_active,
    oc.phone_number,
    oc.mail_address,
    oc.common_identifier
FROM communicationservice_schema.origin_connection oc
JOIN communicationservice_schema.origins_of_group og 
    ON og.origin_id = oc.origin_id
JOIN communicationservice_schema.user_groups ug 
    ON ug.contact_group_id = og.contact_group_id
WHERE ug.user_id = $1
  AND oc.origin_id = $2;
