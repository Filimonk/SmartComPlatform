\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TYPE channel_type AS ENUM ('aura_connect', 'sms', 'telegram', 'mail', 'whatsapp');

CREATE TABLE channel_categories (
    channel channel_type PRIMARY KEY,
    category_type TEXT
);
INSERT INTO channel_categories (channel, category_type) VALUES
('sms', 'phone_number'), ('mail', 'mail_address'), ('telegram', 'common_identifier'), ('aura_connect', 'common_identifier'), ('whatsapp', 'phone_number');


CREATE TABLE connection (
    id UUID DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- PRIMARY KEY (id, contact_id),
    PRIMARY KEY (id),
    
    channel channel_type NOT NULL,
    
    phone_number      TEXT DEFAULT NULL,
    mail_address      TEXT DEFAULT NULL,
    common_identifier TEXT DEFAULT NULL,
    
    CONSTRAINT check_single_identifier CHECK (
        num_nonnulls(phone_number, mail_address, common_identifier) = 1
    ),

    CONSTRAINT phone_format_check CHECK (phone_number ~ '^[1-9]\d{8,14}$'),
    CONSTRAINT mail_format_check  CHECK (mail_address ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

