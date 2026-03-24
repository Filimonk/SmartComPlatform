\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TYPE channel_type AS ENUM ('aura_connect', 'sms', 'telegram', 'mail');

CREATE TABLE channel_categories (
    channel channel_type PRIMARY KEY,
    category_type TEXT
);
INSERT INTO channel_categories (channel, category_type) VALUES
('sms', 'phone'), ('telegram', 'phone'), ('aura_connect', 'phone'), ('mail', 'mail');


CREATE TABLE connection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel channel_type NOT NULL,
    is_attached BOOLEAN DEFAULT TRUE,
    
    phone_number TEXT UNIQUE DEFAULT NULL,
    mail_address TEXT UNIQUE DEFAULT NULL,

    detached_connection_identifier TEXT DEFAULT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    CONSTRAINT check_single_identifier CHECK (
        (is_attached = FALSE) OR
        (num_nonnulls(phone_number, mail_address) = 1)
    ),

    CONSTRAINT phone_format_check CHECK (phone_number ~ '^\+[1-9]\d{8,14}$'),
    CONSTRAINT mail_format_check  CHECK (mail_address ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),

    CONSTRAINT check_detached_cleanup CHECK (
        (is_attached = TRUE) OR (phone_number IS NULL AND mail_address IS NULL)
    )
);


CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp_connection 
BEFORE UPDATE ON connection
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

