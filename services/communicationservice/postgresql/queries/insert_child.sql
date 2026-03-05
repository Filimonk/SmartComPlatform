-- name: insert_child
-- param: $1 name text
-- param: $2 age int

INSERT INTO communicationservice_schema.children(name, age)
VALUES ($1, $2)
RETURNING id;

