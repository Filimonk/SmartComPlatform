\connect aura_connect

CREATE TABLE userprofilerservice_schema.user_account (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- name and so on
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);




SET search_path TO communicationservice_schema;



CREATE TYPE channel_type AS ENUM ('aura_connect', 'sms', 'telegram', 'mail');

CREATE TABLE connection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel channel_type NOT NULL,
    is_attached BOOLEAN DEFAULT TRUE,
    
    -- Channel identifier. exactly one not NULL if is_attached is true
    phone_number TEXT UNIQUE DEFAULT NULL,
    mail_address TEXT UNIQUE DEFAULT NULL,

    -- If is_attached is false, here the value of identifier, and all the identifiers are NULL
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



CREATE TABLE user_connections (
    user_account_id UUID NOT NULL REFERENCES userprofilerservice_schema.user_account(id),
    connection_id UUID NOT NULL REFERENCES connection(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    PRIMARY KEY (user_account_id, connection_id),
    CONSTRAINT unique_connection_usage UNIQUE (connection_id)
);

CREATE OR REPLACE FUNCTION handle_connection_deactivation()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.is_active = TRUE AND NEW.is_active = FALSE) THEN
        UPDATE connection
        SET 
            is_attached = FALSE,
            detached_connection_identifier = COALESCE(phone_number, mail_address),
            phone_number = NULL,
            mail_address = NULL,
            updated_at = now()
        WHERE id = NEW.connection_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deactivate_connection
AFTER UPDATE ON user_connections
FOR EACH ROW
EXECUTE FUNCTION handle_connection_deactivation();



CREATE TYPE message_status AS ENUM ('pending', 'processing', 'sent', 'failed');

CREATE TABLE message_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    addressee_id UUID NOT NULL REFERENCES userprofilerservice_schema.user_account(id),
    channel channel_type NOT NULL,
    connection_identifier TEXT NOT NULL,
    text TEXT NOT NULL,

    status message_status NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_pending_jobs_fifo
ON message_jobs(created_at)
WHERE status = 'pending';



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

CREATE TRIGGER trg_update_timestamp_user_connections 
BEFORE UPDATE ON user_connections
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

