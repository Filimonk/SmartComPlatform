\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE origin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'Безымянный источник' NOT NULL,
    channel channel_type,
    api_key TEXT,
    email_server_address TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE TRIGGER trg_update_timestamp_origin
BEFORE UPDATE ON origin
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

