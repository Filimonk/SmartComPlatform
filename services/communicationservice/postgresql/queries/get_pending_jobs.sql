-- name: kGetPendingJobs

SELECT id, user_id, contact_id, 'sms' AS channel, text
FROM communicationservice_schema.contact_message_jobs
WHERE status = 'pending'
LIMIT 50;
