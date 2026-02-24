\connect aura_connect

CREATE TABLE IF NOT EXISTS communicationservice_schema.users (
    name TEXT PRIMARY KEY,
    count INTEGER DEFAULT(1)
);

