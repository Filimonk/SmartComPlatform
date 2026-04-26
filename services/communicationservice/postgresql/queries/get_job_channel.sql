-- name: kGetJobChannel
-- param: $1 origin_connection_id UUID
-- param: $2 connection_id UUID

SELECT 
    o.channel::TEXT,
    o.provider
FROM communicationservice_schema.origin_connection oc
JOIN communicationservice_schema.origin o 
    ON o.id = oc.origin_id
JOIN communicationservice_schema.connection c
    ON c.id = $2
WHERE oc.id = $1 AND o.channel = c.channel;

