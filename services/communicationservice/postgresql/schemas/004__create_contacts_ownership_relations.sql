\connect aura_connect

SET search_path TO communicationservice_schema;



CREATE TABLE contact_group (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_group_of_user BOOLEAN NOT NULL DEFAULT false,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE TABLE user_groups (
    user_id INT NOT NULL REFERENCES authserviceschema.users(id),
    contact_group_id UUID NOT NULL REFERENCES contact_group(id),
    
    PRIMARY KEY (user_id, contact_group_id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE TABLE contacts_of_group (
    contact_group_id UUID REFERENCES contact_group(id), 
    contact_id UUID REFERENCES contact(id),
    
    PRIMARY KEY (contact_group_id, contact_id),
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


-- TODO создать различение users (может просто по флагу), и создавать группу только для пользователей-операторов
CREATE OR REPLACE FUNCTION add_contact_group_of_user_on_authserviceschema_users_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
DECLARE
    v_group_id UUID;
BEGIN
    INSERT INTO communicationservice_schema.contact_group (contact_group_of_user)
    VALUES (TRUE)
    RETURNING id INTO v_group_id;

    INSERT INTO communicationservice_schema.user_groups (user_id, contact_group_id)
    VALUES (NEW.id, v_group_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION communicationservice_schema.add_contact_group_of_user_on_authserviceschema_users_insert()
OWNER TO CURRENT_USER;
-- TODO тут current_user - root, что плохо, мы даем неограниченной доступ этой функции, надо создать нового brige пользователя и вешать на него

GRANT EXECUTE ON FUNCTION communicationservice_schema.add_contact_group_of_user_on_authserviceschema_users_insert()
TO auth;
-- TODO вынести это, что бы тут не было жестко заданно имя

CREATE TRIGGER trg_add_contact_group_of_user_on_authserviceschema_users_insert
AFTER INSERT ON authserviceschema.users
FOR EACH ROW
EXECUTE FUNCTION communicationservice_schema.add_contact_group_of_user_on_authserviceschema_users_insert();

