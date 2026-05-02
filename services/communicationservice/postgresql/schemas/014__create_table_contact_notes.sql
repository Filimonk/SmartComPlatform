\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE contact_note (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES communicationservice_schema.contact(id),
    text TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp_contact_note
BEFORE UPDATE ON contact
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

