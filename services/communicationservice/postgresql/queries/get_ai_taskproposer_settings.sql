-- name: kGetAiTaskproposerSettings
-- param: $1 user_id UUID

SELECT 
    tp.ai_taskproposer_url,
    tp.ai_taskproposer_timeout,
    tp.ai_taskproposer_instruction
FROM communicationservice_schema.organization_group og
JOIN communicationservice_schema.ai_taskproposer_settings tp
    ON og.id = tp.organization_group_id
JOIN communicationservice_schema.organization_group_users ogu
    ON ogu.organization_group_id = og.id
WHERE ogu.user_id = $1
ORDER BY og.priority
LIMIT 1;

