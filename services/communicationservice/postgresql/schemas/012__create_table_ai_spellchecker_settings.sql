\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE ai_spellchecker_settings (
    organization_group_id UUID PRIMARY KEY REFERENCES organization_group (id),
   
    ai_spellchecker_url TEXT DEFAULT 'https://d5dqim731v91csc1n2me.xxg4zr82.apigw.yandexcloud.net/spellcheck',
    ai_spellchecker_timeout INTERVAL DEFAULT '10 seconds',
    ai_spellchecker_instruction TEXT DEFAULT 'Please correct the following text',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION add_ai_spellchecker_settings_on_organization_group_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO communicationservice_schema.ai_spellchecker_settings (organization_group_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION communicationservice_schema.add_ai_spellchecker_settings_on_organization_group_insert()
OWNER TO CURRENT_USER;

GRANT EXECUTE ON FUNCTION communicationservice_schema.add_ai_spellchecker_settings_on_organization_group_insert()
TO communicationservice;

CREATE TRIGGER trg_add_ai_spellchecker_settings_on_organization_group_insert
AFTER INSERT ON communicationservice_schema.organization_group
FOR EACH ROW
EXECUTE FUNCTION communicationservice_schema.add_ai_spellchecker_settings_on_organization_group_insert();

