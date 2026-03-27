-- name: kCreateConnection
-- param: $1 user_id INT
-- param: $2 contact_id UUID
-- param: $3 channel TEXT
-- param: $4 phone_number TEXT (optional)
-- param: $5 mail_address TEXT (optional)
-- param: $6 common_identifier TEXT (optional)

INSERT INTO communicationservice_schema.connection (
    contact_id,
    channel,
    phone_number,
    mail_address,
    common_identifier
)
SELECT
    $2,
    $3::communicationservice_schema.channel_type,
    $4,
    $5,
    $6
FROM communicationservice_schema.contacts_of_group AS cog
JOIN communicationservice_schema.user_groups AS ug ON cog.contact_group_id = ug.contact_group_id
WHERE ug.user_id = $1
  AND cog.contact_id = $2
RETURNING id, contact_id, is_active, channel, phone_number, mail_address, common_identifier;

