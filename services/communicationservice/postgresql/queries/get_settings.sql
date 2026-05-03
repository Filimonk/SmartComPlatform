-- name: kGetSettings
-- param: $1 user_id UUID

SELECT 
    sc.greeting_message
FROM communicationservice_schema.organization_group og
JOIN communicationservice_schema.settings sc
    ON og.id = sc.organization_group_id
JOIN communicationservice_schema.organization_group_users ogu
    ON ogu.organization_group_id = og.id
WHERE ogu.user_id = $1
ORDER BY og.priority
LIMIT 1;

