\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE origins_of_group (
    contact_group_id UUID REFERENCES contact_group(id), 
    origin_id UUID REFERENCES origin(id),
    
    PRIMARY KEY (contact_group_id, origin_id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

