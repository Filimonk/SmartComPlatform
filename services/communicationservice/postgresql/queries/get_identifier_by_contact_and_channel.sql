-- name: kGetPhoneByContact
-- param: $1 contact_id UUID
-- param: $2 channel TEXT

SELECT phone_number
FROM communicationservice_schema.connection
WHERE contact_id = $1
  AND phone_number IS NOT NULL
  AND is_active = true
LIMIT 1;
