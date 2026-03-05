-- name: select_child_by_id
-- param: $1 id int

SELECT id, name, age
FROM model_postgres_service_schema.children
WHERE id = $1;

