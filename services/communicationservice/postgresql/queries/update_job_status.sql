-- name: kUpdateJobStatus
-- param: $1 job_id UUID
-- param: $2 status TEXT

UPDATE communicationservice_schema.contact_message_jobs
SET status = $2::communicationservice_schema.message_status
WHERE id = $1;
