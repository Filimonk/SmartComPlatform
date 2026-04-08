\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TYPE message_status AS ENUM ('pending', 'processing', 'sent', 'failed');


CREATE TABLE contact_message_jobs (
    id UUID UNIQUE DEFAULT gen_random_uuid(),
    
    idempotency_token TEXT NOT NULL,
    user_id INT NOT NULL REFERENCES authserviceschema.users(id),
    origin_connection_id UUID REFERENCES origin_connection(id),
    contact_id UUID NOT NULL REFERENCES contact(id),
    connection_id UUID REFERENCES connection(id),
    channel channel_type NOT NULL,
    text TEXT NOT NULL,
    
    PRIMARY KEY (user_id, idempotency_token),

    status message_status NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE INDEX idx_pending_jobs_fifo
ON contact_message_jobs(created_at)
WHERE status = 'pending';


CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_timestamp_contact_message_jobs
BEFORE UPDATE ON contact_message_jobs
FOR EACH ROW EXECUTE FUNCTION update_timestamp();

