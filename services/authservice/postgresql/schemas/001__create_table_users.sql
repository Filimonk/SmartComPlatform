\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE authserviceschema.users (
    id SERIAL PRIMARY KEY,
    login VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    -- created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

