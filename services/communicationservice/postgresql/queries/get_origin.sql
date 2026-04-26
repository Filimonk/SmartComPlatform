-- name: kGetOrigin
-- param: $1 user_id INT
-- param: $2 origin_id UUID

SELECT 
    o.id,
    o.name,
    o.channel::TEXT,
    o.api_key,
    o.email_server_address,
    o.provider,
    o.requires_action,
    o.created_at,
    o.updated_at
FROM communicationservice_schema.origin o
WHERE o.id = $2
  AND EXISTS (
    SELECT 1
    FROM communicationservice_schema.origins_of_group og
    JOIN communicationservice_schema.user_groups ug 
      ON ug.contact_group_id = og.contact_group_id
    WHERE og.origin_id = o.id
      AND ug.user_id = $1
  ) 
;

