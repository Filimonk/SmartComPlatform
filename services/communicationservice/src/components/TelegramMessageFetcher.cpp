#include "TelegramMessageFetcher.hpp"

#include <userver/clients/http/component.hpp>
#include <userver/components/component_context.hpp>
#include <userver/storages/postgres/component.hpp>

#include <userver/formats/json.hpp>

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_io.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::components {

TelegramMessageFetcher::TelegramMessageFetcher(const userver::components::ComponentConfig& config,
                                               const userver::components::ComponentContext& context)
    : LoggableComponentBase(config, context),
      pg_cluster_(context.FindComponent<userver::components::Postgres>("postgres-db").GetCluster()),
      http_client_(context.FindComponent<userver::components::HttpClient>().GetHttpClient()) {

    std::chrono::seconds period{5};
    task_.Start("tg-fetcher-task", {period}, [this] { DoWork(); });
}

void TelegramMessageFetcher::DoWork() {

    try {

        LOG_INFO() << "TG fetcher started";

        const auto origins = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                  R"(
                SELECT oc.id
                FROM communicationservice_schema.origin_connection oc
            )");

        LOG_INFO() << "Found origin connections: " << origins.Size();

        for (const auto& origin_row : origins) {

            const auto origin_connection_id = origin_row["id"].As<boost::uuids::uuid>();

            LOG_INFO() << "Processing origin connection: "
                       << boost::uuids::to_string(origin_connection_id);

            const auto origin = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                     R"(
                    SELECT o.api_key
                    FROM communicationservice_schema.origin_connection oc
                    JOIN communicationservice_schema.origin o
                        ON o.id = oc.origin_id
                    WHERE oc.id = $1
                )",
                                                     origin_connection_id);

            if (origin.IsEmpty()) {
                LOG_WARNING() << "Origin not found";
                continue;
            }

            std::optional<std::string> api_key =
                origin[0]["api_key"].As<std::optional<std::string>>();

            if (!api_key.has_value()) {
                LOG_WARNING() << "API key is empty";
                continue;
            }

            const std::string url =
                "https://api.telegram.org/bot" + api_key.value() + "/getUpdates";

            auto response =
                http_client_.CreateRequest().get(url).timeout(std::chrono::seconds{5}).perform();

            if (response->status_code() != 200) {

                LOG_WARNING() << "Telegram returned status: " << response->status_code();

                continue;
            }

            const auto json = userver::formats::json::FromString(response->body());

            if (!json.HasMember("result")) {

                LOG_WARNING() << "Telegram response has no result";

                continue;
            }

            const auto updates = json["result"];

            LOG_INFO() << "Received updates count";

            const auto connections = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                          R"(
                    SELECT id, common_identifier
                    FROM communicationservice_schema.connection
                    WHERE channel = 'telegram'
                )");

            LOG_INFO() << "Loaded TG connections: " << connections.Size();

            /*
             * MAIN MESSAGE PROCESSING
             */

            for (const auto& conn_row : connections) {

                const auto connection_id = conn_row["id"].As<boost::uuids::uuid>();

                std::optional<std::string> chat_id =
                    conn_row["common_identifier"].As<std::optional<std::string>>();

                if (!chat_id.has_value()) {
                    continue;
                }

                for (const auto& update : updates) {

                    if (!update.HasMember("message")) {
                        continue;
                    }

                    const auto msg = update["message"];

                    if (!msg.HasMember("chat") || !msg.HasMember("text") ||
                        !msg.HasMember("date")) {
                        continue;
                    }

                    const auto incoming_chat_id = std::to_string(msg["chat"]["id"].As<long long>());

                    if (incoming_chat_id != chat_id.value()) {
                        continue;
                    }

                    const auto text = msg["text"].As<std::string>();

                    const auto timestamp = msg["date"].As<long long>();

                    const auto exists = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                             R"(
                            SELECT 1
                            FROM communicationservice_schema.message
                            WHERE connection_id = $1
                              AND text = $2
                              AND created_at = to_timestamp($3)
                        )",
                                                             connection_id, text, timestamp);

                    if (!exists.IsEmpty()) {

                        LOG_INFO() << "Message already exists";

                        continue;
                    }

                    pg_cluster_->Execute(ClusterHostType::kMaster,
                                         R"(
                            INSERT INTO communicationservice_schema.message
                            (
                                origin_connection_id,
                                connection_id,
                                text,
                                created_at
                            )
                            VALUES
                            (
                                $1,
                                $2,
                                $3,
                                to_timestamp($4)
                            )
                        )",
                                         origin_connection_id, connection_id, text, timestamp);

                    LOG_INFO() << "Stored TG message: " << text;
                }
            }

            /*
             * AUTO CREATE CONTACTS
             */

            LOG_INFO() << "Starting auto-create pass";

            for (const auto& update : updates) {

                if (!update.HasMember("message")) {
                    continue;
                }

                const auto msg = update["message"];

                if (!msg.HasMember("chat")) {
                    continue;
                }

                const auto incoming_chat_id = std::to_string(msg["chat"]["id"].As<long long>());

                LOG_INFO() << "Checking chat id: " << incoming_chat_id;

                const auto existing_connection = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                                      R"(
                            SELECT id
                            FROM communicationservice_schema.connection
                            WHERE common_identifier = $1
                              AND channel = 'telegram'
                            LIMIT 1
                        )",
                                                                      incoming_chat_id);

                if (!existing_connection.IsEmpty()) {

                    LOG_INFO() << "Connection already exists";

                    continue;
                }

                LOG_INFO() << "Creating new contact for: " << incoming_chat_id;

                const auto new_contact = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                              R"(
                            INSERT INTO communicationservice_schema.contact
                            (
                                name
                            )
                            VALUES
                            (
                                $1
                            )
                            RETURNING id
                        )",
                                                              "Telegram " + incoming_chat_id);

                const auto contact_id = new_contact[0]["id"].As<boost::uuids::uuid>();

                LOG_INFO() << "Created contact: " << boost::uuids::to_string(contact_id);

                const auto new_connection = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                                 R"(
                            INSERT INTO communicationservice_schema.connection
                            (
                                contact_id,
                                channel,
                                common_identifier
                            )
                            VALUES
                            (
                                $1,
                                'telegram',
                                $2
                            )
                            RETURNING id
                        )",
                                                                 contact_id, incoming_chat_id);

                const auto new_connection_id = new_connection[0]["id"].As<boost::uuids::uuid>();

                LOG_INFO() << "Created connection: " << boost::uuids::to_string(new_connection_id);

                const auto origin_id_row = pg_cluster_->Execute(
                    ClusterHostType::kMaster,
                    "SELECT origin_id FROM communicationservice_schema.origin_connection WHERE id "
                    "= $1",
                    origin_connection_id);

                if (origin_id_row.IsEmpty()) {
                    LOG_WARNING() << "Origin not found for origin_connection_id";
                } else {
                    const auto origin_id = origin_id_row[0]["origin_id"].As<boost::uuids::uuid>();

                    const auto groups = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                             R"(
            SELECT contact_group_id
            FROM communicationservice_schema.origins_of_group
            WHERE origin_id = $1
        )",
                                                             origin_id);

                    for (const auto& group_row : groups) {
                        const auto group_id =
                            group_row["contact_group_id"].As<boost::uuids::uuid>();

                        pg_cluster_->Execute(ClusterHostType::kMaster,
                                             R"(
                INSERT INTO communicationservice_schema.contacts_of_group (contact_group_id, contact_id)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            )",
                                             group_id, contact_id);
                    }

                    LOG_INFO() << "Added contact " << boost::uuids::to_string(contact_id) << " to "
                               << groups.Size() << " group(s)";
                }
            }
        }

        LOG_INFO() << "TG fetcher finished";

    } catch (const std::exception& e) {

        LOG_ERROR() << "Telegram fetcher error: " << e.what();
    }
}

} // namespace communicationservice::components
