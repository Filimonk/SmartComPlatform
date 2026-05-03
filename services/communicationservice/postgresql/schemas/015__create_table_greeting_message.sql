\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE settings (
    organization_group_id UUID PRIMARY KEY REFERENCES organization_group (id),
   
    greeting_message TEXT DEFAULT 'ЗдравствуйтИ! СпОсибо, что выбрали нас. Будем рады продуктивной и приятной сАвместной работе!',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION add_settings_on_organization_group_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO communicationservice_schema.settings (organization_group_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION communicationservice_schema.add_settings_on_organization_group_insert()
OWNER TO CURRENT_USER;

GRANT EXECUTE ON FUNCTION communicationservice_schema.add_settings_on_organization_group_insert()
TO communicationservice;

CREATE TRIGGER trg_add_settings_on_organization_group_insert
AFTER INSERT ON communicationservice_schema.organization_group
FOR EACH ROW
EXECUTE FUNCTION communicationservice_schema.add_settings_on_organization_group_insert();

