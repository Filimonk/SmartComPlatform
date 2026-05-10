\connect aura_connect

SET search_path TO communicationservice_schema;


CREATE TABLE ai_taskproposer_settings (
    organization_group_id UUID PRIMARY KEY REFERENCES organization_group (id),
   
    ai_taskproposer_url TEXT DEFAULT 'https://d5dqim731v91csc1n2me.xxg4zr82.apigw.yandexcloud.net/task/propose',
    ai_taskproposer_timeout INTERVAL DEFAULT '10 seconds',
    ai_taskproposer_instruction TEXT DEFAULT $$
Ты - ассистент оператора связи, который видет историю переписки с клиентом.
У оператора есть техническая возможность создания задачи по клиенту с указанием даты и времени выполнения.
Эта задача отображается в списке на выполнение, когда подходит срок у этого оператора или одного из его команды.
Это необходимо, чтобы не забывать про договоренности с клиентом. И вовремя их исполнять.
Тебе же необходимо прочитать историю переписки, если видишь, что с клиентом достиглась какая-то договоренность,
которую необходимо внести в систему, ты должен описать в таком виде:
  Надо ли создать задачу? Известно время и дата выполнения?
    Если да, то напиши текст, описывающий, что надо сделать, заполни дату и время и выстави флаг isProposed!
  Если нет — выстави булеву переменную в false.
Время указывай с точностью до часа (округление вниз).
Все сообщения переданы в хронологическом состоянии! У каждого сообщения указано время отсылки, ориентируйся на это, когда в сообщении договориваются о временни через относительность на момент написания сообщения.
Заметь, что в сообщениях время и дата могут быть разрозненные, тебе же надо собрать финальную дату и время договора и упаковать в openapi формат строки date-time. Собирается же он в YYYY-MM-DDThh:mm:ssZ , заметь, я всегда хочу, что бы ты считал, что тебе все время указанно в Z зоне, и ты сам возвращал время в Z зоне (просто не преобразовывай, а выводи время так, как договорились!)!
$$,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);


CREATE OR REPLACE FUNCTION add_ai_taskproposer_settings_on_organization_group_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO communicationservice_schema.ai_taskproposer_settings (organization_group_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION communicationservice_schema.add_ai_taskproposer_settings_on_organization_group_insert()
OWNER TO CURRENT_USER;

GRANT EXECUTE ON FUNCTION communicationservice_schema.add_ai_taskproposer_settings_on_organization_group_insert()
TO communicationservice;

CREATE TRIGGER trg_add_ai_taskproposer_settings_on_organization_group_insert
AFTER INSERT ON communicationservice_schema.organization_group
FOR EACH ROW
EXECUTE FUNCTION communicationservice_schema.add_ai_taskproposer_settings_on_organization_group_insert();


CREATE TABLE message_with_taskproposer_status (
    message_id UUID NOT NULL REFERENCES message (id),
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    
    PRIMARY KEY (message_id)
);


CREATE OR REPLACE FUNCTION add_message_with_taskproposer_status_on_message_insert()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO communicationservice_schema.message_with_taskproposer_status (message_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION communicationservice_schema.add_message_with_taskproposer_status_on_message_insert()
OWNER TO CURRENT_USER;

GRANT EXECUTE ON FUNCTION communicationservice_schema.add_message_with_taskproposer_status_on_message_insert()
TO communicationservice;

CREATE TRIGGER trg_add_message_with_taskproposer_status_on_message_insert
AFTER INSERT ON communicationservice_schema.message
FOR EACH ROW
EXECUTE FUNCTION communicationservice_schema.add_message_with_taskproposer_status_on_message_insert();

