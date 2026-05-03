-- name: kUpdateSettings
-- param: $1 user_id UUID
-- param: $2 greeting_message TEXT

UPDATE communicationservice_schema.settings sc
SET
    greeting_message = $2
FROM communicationservice_schema.organization_group og
JOIN communicationservice_schema.organization_group_users ogu
    ON ogu.organization_group_id = og.id
WHERE og.id = sc.organization_group_id AND ogu.user_id = $1
RETURNING sc.greeting_message;

