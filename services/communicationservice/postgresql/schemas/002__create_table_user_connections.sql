\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE contact (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT DEFAULT 'Новый контакт',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE TABLE contact_connections (
    contact_id UUID NOT NULL REFERENCES contact(id),
    connection_id UUID NOT NULL REFERENCES connection(id),
    is_active BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    PRIMARY KEY (contact_id, connection_id),
    CONSTRAINT unique_connection_usage UNIQUE (connection_id)
);


CREATE OR REPLACE FUNCTION handle_connection_deactivation()
RETURNS TRIGGER AS $$
DECLARE
    v_category TEXT;
BEGIN
    SELECT channel_categories.category_type INTO v_category
    FROM connection
    JOIN channel_categories ON connection.channel = channel_categories.channel
    WHERE connection.id = NEW.connection_id;
    
    IF v_category IS NULL THEN
        RAISE EXCEPTION 'Критическая ошибка: Канал % не описан в таблице channel_categories!',
        (SELECT channel FROM connection WHERE id = NEW.connection_id);
    END IF;

    IF (OLD.is_active = TRUE AND NEW.is_active = FALSE) THEN
        UPDATE connection
        SET 
            is_attached = FALSE,
            detached_connection_identifier = COALESCE(phone_number, mail_address, common_identifier),
            phone_number = NULL,
            mail_address = NULL,
            common_identifier = NULL
        WHERE id = NEW.connection_id;
        
    ELSIF (OLD.is_active = FALSE AND NEW.is_active = TRUE) THEN
        UPDATE connection
        SET 
            is_attached = TRUE,
            phone_number = CASE 
                WHEN v_category = 'phone_number' THEN detached_connection_identifier 
                ELSE NULL 
            END,
            mail_address = CASE 
                WHEN v_category = 'mail_address' THEN detached_connection_identifier 
                ELSE NULL 
            END,
            common_identifier = CASE 
                WHEN v_category = 'common_identifier' THEN detached_connection_identifier 
                ELSE NULL 
            END,
            detached_connection_identifier = NULL
        WHERE id = NEW.connection_id;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_deactivate_connection
AFTER UPDATE ON contact_connections
FOR EACH ROW
EXECUTE FUNCTION handle_connection_deactivation();


CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp_contact_connections 
BEFORE UPDATE ON contact_connections
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

