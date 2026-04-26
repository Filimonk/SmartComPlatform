-- name: kGetOriginByOriginConnectionId
-- param: $1 origin_connection_id UUID

SELECT 
    o.id,
    o.name,
    o.channel::TEXT,
    o.api_key,
    o.email_server_address
FROM communicationservice_schema.origin_connection oc
JOIN communicationservice_schema.origin o 
    ON o.id = oc.origin_id
WHERE oc.id = $1;

