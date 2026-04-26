\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE origin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'Безымянный источник' NOT NULL,
    channel channel_type,
    api_key TEXT,
    email_server_address TEXT,
    provider TEXT,
    
    requires_action BOOLEAN NOT NULL DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_requires_action() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.channel IS NULL OR NEW.api_key IS NULL THEN
        NEW.requires_action := TRUE;
    ELSIF NEW.channel = 'mail' AND NEW.email_server_address IS NULL THEN
        NEW.requires_action := TRUE;
    ELSIF (NEW.channel = 'sms' OR NEW.channel = 'whatsapp') AND NEW.provider IS NULL THEN
        NEW.requires_action := TRUE;
    ELSE
        NEW.requires_action := FALSE;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_requires_action_origin
BEFORE INSERT OR UPDATE ON origin
FOR EACH ROW EXECUTE FUNCTION set_requires_action();

    
CREATE TRIGGER trg_update_timestamp_origin
BEFORE UPDATE ON origin
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

