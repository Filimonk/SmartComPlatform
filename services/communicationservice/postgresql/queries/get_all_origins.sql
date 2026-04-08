-- name: kGetAllOrigins
-- param: $1 user_id INT

SELECT 
    o.id,
    o.name
FROM communicationservice_schema.origin o
JOIN communicationservice_schema.origins_of_group og 
    ON og.origin_id = o.id
JOIN communicationservice_schema.user_groups ug 
    ON ug.contact_group_id = og.contact_group_id
WHERE ug.user_id = $1;
