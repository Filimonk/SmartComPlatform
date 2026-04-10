\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE message (
    id UUID UNIQUE DEFAULT gen_random_uuid(),
    
    origin_connection_id UUID NOT NULL REFERENCES origin_connection(id),
    connection_id UUID NOT NULL REFERENCES connection(id),
    text TEXT NOT NULL,
    
    PRIMARY KEY (id),
    
    contact_message_job_id UUID REFERENCES contact_message_jobs(id),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

