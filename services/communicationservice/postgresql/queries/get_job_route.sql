-- name: kGetJobRoute
-- param: $1 user_id INT
-- param: $2 contact_id UUID

SELECT
    m.origin_connection_id,
    m.connection_id
FROM communicationservice_schema.user_groups ug
JOIN communicationservice_schema.origins_of_group og
    ON ug.contact_group_id = og.contact_group_id
-- Сначала джойним origin, так как группа привязана к нему
JOIN communicationservice_schema.origin o
    ON o.id = og.origin_id
-- Теперь джойним connection этого источника
JOIN communicationservice_schema.origin_connection oc
    ON oc.origin_id = o.id
-- Ищем сообщения, отправленные через этот коннекшн
JOIN communicationservice_schema.message m
    ON m.origin_connection_id = oc.id
JOIN communicationservice_schema.connection c
    ON c.id = m.connection_id
WHERE ug.user_id = $1
  AND c.contact_id = $2
ORDER BY m.created_at DESC
LIMIT 1;

