-- name: select_child_by_id
-- param: $1 id int

SELECT id, name, age
FROM new_schema.children
WHERE id = $1;

