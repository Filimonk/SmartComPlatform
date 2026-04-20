-- name: kGetAiSpellingcheckerSettings
-- param: $1 user_id UUID

SELECT 
    sc.ai_spellchecker_url,
    sc.ai_spellchecker_timeout,
    sc.ai_spellchecker_instruction
FROM communicationservice_schema.organization_group og
JOIN communicationservice_schema.ai_spellchecker_settings sc
    ON og.id = sc.organization_group_id
JOIN communicationservice_schema.organization_group_users ogu
    ON ogu.organization_group_id = og.id
WHERE ogu.user_id = $1
ORDER BY og.priority
LIMIT 1;

