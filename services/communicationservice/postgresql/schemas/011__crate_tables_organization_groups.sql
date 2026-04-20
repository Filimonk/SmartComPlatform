\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE organization_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    name TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES organization (id),
    UNIQUE (name, organization_id),
    
    description TEXT,
    
    priority INT NOT NULL,
    UNIQUE (priority, organization_id),
    CHECK (priority >= 0),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE organization_group_users (
    organization_group_id UUID REFERENCES organization_group (id),
    user_id INT NOT NULL REFERENCES authserviceschema.users(id),
    
    PRIMARY KEY (organization_group_id, user_id),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION add_organization_and_admin_group_on_authserviceschema_users_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    v_organization_id UUID;
    v_organization_group_id UUID;
BEGIN
    INSERT INTO communicationservice_schema.organization
    VALUES (DEFAULT)
    RETURNING id INTO v_organization_id;
    
    INSERT INTO communicationservice_schema.organization_group (name, organization_id, priority)
    VALUES ('admin', v_organization_id, 0)
    RETURNING id INTO v_organization_group_id;

    INSERT INTO communicationservice_schema.organization_group_users (organization_group_id, user_id)
    VALUES (v_organization_group_id, NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION communicationservice_schema.add_organization_and_admin_group_on_authserviceschema_users_insert()
OWNER TO CURRENT_USER;

GRANT EXECUTE ON FUNCTION communicationservice_schema.add_organization_and_admin_group_on_authserviceschema_users_insert()
TO auth;

CREATE TRIGGER trg_add_organization_and_admin_group_on_authserviceschema_users_insert
AFTER INSERT ON authserviceschema.users
FOR EACH ROW
EXECUTE FUNCTION communicationservice_schema.add_organization_and_admin_group_on_authserviceschema_users_insert();

