-- name: kSetTaskProposeConfiguration
-- param: $1 user_id UUID
-- param: $2 url TEXT
-- param: $3 timeout INTERVAL
-- param: $4 instruction TEXT

UPDATE communicationservice_schema.ai_taskproposer_settings tp
SET
    ai_taskproposer_url = $2,
    ai_taskproposer_timeout = $3 * INTERVAL '1 second',
    ai_taskproposer_instruction = $4
FROM communicationservice_schema.organization_group og
JOIN communicationservice_schema.organization_group_users ogu
    ON ogu.organization_group_id = og.id
WHERE og.id = tp.organization_group_id AND ogu.user_id = $1
RETURNING tp.ai_taskproposer_url, tp.ai_taskproposer_timeout, tp.ai_taskproposer_instruction;

