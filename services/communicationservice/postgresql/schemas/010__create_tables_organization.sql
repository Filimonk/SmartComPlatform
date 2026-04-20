\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE organization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name TEXT NOT NULL DEFAULT 'ООО Организация',
   
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

