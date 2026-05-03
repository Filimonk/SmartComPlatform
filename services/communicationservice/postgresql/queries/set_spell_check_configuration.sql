-- name: kSetAiSpellingcheckerSettings
-- param: $1 user_id UUID
-- param: $2 url TEXT
-- param: $3 timeout INTERVAL
-- param: $4 instruction TEXT

UPDATE communicationservice_schema.ai_spellchecker_settings sc
SET
    ai_spellchecker_url = $2,
    ai_spellchecker_timeout = $3 * INTERVAL '1 second',
    ai_spellchecker_instruction = $4
FROM communicationservice_schema.organization_group og
JOIN communicationservice_schema.organization_group_users ogu
    ON ogu.organization_group_id = og.id
WHERE og.id = sc.organization_group_id AND ogu.user_id = $1
RETURNING sc.ai_spellchecker_url, sc.ai_spellchecker_timeout, sc.ai_spellchecker_instruction;

