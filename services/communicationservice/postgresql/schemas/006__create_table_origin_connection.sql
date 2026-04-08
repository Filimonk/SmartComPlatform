\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE origin_connection (
    id UUID DEFAULT gen_random_uuid(),
    origin_id UUID NOT NULL REFERENCES origin(id),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- PRIMARY KEY (id, origin_id),
    PRIMARY KEY (id),
    
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

