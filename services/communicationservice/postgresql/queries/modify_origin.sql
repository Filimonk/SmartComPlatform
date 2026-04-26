-- name: kModifyOrigin
-- param: $1 user_id INT
-- param: $2 origin_id UUID
-- param: $3 name TEXT (optional)
-- param: $4 channel TEXT (optional)
-- param: $5 api_key TEXT (optional)
-- param: $6 email_server_address TEXT (optional)
-- param: $7 provider TEXT (optional)

UPDATE communicationservice_schema.origin o
SET
    name = COALESCE($3, o.name),
    channel = COALESCE($4::channel_type, o.channel),
    api_key = COALESCE($5, o.api_key),
    email_server_address = COALESCE($6, o.email_server_address),
    provider = COALESCE($7, o.provider),
    updated_at = now()
WHERE o.id = $2
  AND (
       o.requires_action = TRUE
    OR (
        $3 IS NOT NULL
        AND $4 IS NULL
        AND $5 IS NULL
        AND $6 IS NULL
        AND $7 IS NULL
    )
  )
  AND EXISTS (
    SELECT 1
    FROM communicationservice_schema.origins_of_group og
    JOIN communicationservice_schema.user_groups ug 
      ON ug.contact_group_id = og.contact_group_id
    WHERE og.origin_id = o.id
      AND ug.user_id = $1
  ) 
RETURNING id, name, channel::TEXT, api_key, email_server_address, provider, requires_action, created_at, updated_at;
