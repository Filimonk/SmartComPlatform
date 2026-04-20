#include "TelegramMessageFetcher.hpp"

#include <userver/clients/http/component.hpp>
#include <userver/components/component_context.hpp>
#include <userver/storages/postgres/component.hpp>

#include <userver/formats/json.hpp>

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_io.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::components {

TelegramMessageFetcher::TelegramMessageFetcher(
    const userver::components::ComponentConfig& config,
    const userver::components::ComponentContext& context)
    : LoggableComponentBase(config, context),
      pg_cluster_(context.FindComponent<userver::components::Postgres>("postgres-db").GetCluster()),
      http_client_(context.FindComponent<userver::components::HttpClient>().GetHttpClient()) {

    std::chrono::seconds period{5};
    task_.Start("tg-fetcher-task", {period}, [this] { DoWork(); });
}

void TelegramMessageFetcher::DoWork() {

    try {
        const auto origins = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            R"(
                SELECT oc.id
                FROM communicationservice_schema.origin_connection oc
            )");

        for (const auto& origin_row : origins) {

            const auto origin_connection_id =
                origin_row["id"].As<boost::uuids::uuid>();

            const auto origin = pg_cluster_->Execute(
                ClusterHostType::kMaster,
                R"(
                    SELECT o.api_key
                    FROM communicationservice_schema.origin_connection oc
                    JOIN communicationservice_schema.origin o
                        ON o.id = oc.origin_id
                    WHERE oc.id = $1
                )",
                origin_connection_id);

            if (origin.IsEmpty()) {
                continue;
            }

            auto field = origin[0]["api_key"];
            std::optional<std::string> api_key =
                field.As<std::optional<std::string>>();

            if (!api_key.has_value()) {
                continue;
            }

            const std::string url =
                "https://api.telegram.org/bot" + api_key.value() + "/getUpdates";

            auto response =
                http_client_.CreateRequest()
                    .get(url)
                    .timeout(std::chrono::seconds{5})
                    .perform();

            if (response->status_code() != 200) {
                continue;
            }

            const auto json =
                userver::formats::json::FromString(response->body());

            if (!json.HasMember("result")) {
                continue;
            }

            const auto updates = json["result"];

            const auto connections = pg_cluster_->Execute(
                ClusterHostType::kMaster,
                R"(
                    SELECT id, common_identifier
                    FROM communicationservice_schema.connection
                )");

            for (const auto& conn_row : connections) {

                const auto connection_id =
                    conn_row["id"].As<boost::uuids::uuid>();

                auto chat_field = conn_row["common_identifier"];
                std::optional<std::string> chat_id =
                    chat_field.As<std::optional<std::string>>();

                if (!chat_id.has_value()) {
                    continue;
                }

                for (const auto& update : updates) {

                    if (!update.HasMember("message")) {
                        continue;
                    }

                    const auto msg = update["message"];

                    if (!msg.HasMember("chat") ||
                        !msg.HasMember("text") ||
                        !msg.HasMember("date")) {
                        continue;
                    }

                    const auto incoming_chat_id =
                        std::to_string(msg["chat"]["id"].As<long long>());

                    if (incoming_chat_id != chat_id.value()) {
                        continue;
                    }

                    const auto text =
                        msg["text"].As<std::string>();

                    const auto timestamp =
                        msg["date"].As<long long>();

                    const auto exists = pg_cluster_->Execute(
                        ClusterHostType::kMaster,
                        R"(
                            SELECT 1
                            FROM communicationservice_schema.message
                            WHERE connection_id = $1
                              AND text = $2
                              AND created_at = to_timestamp($3)
                        )",
                        connection_id,
                        text,
                        timestamp);

                    if (!exists.IsEmpty()) {
                        continue;
                    }

                    pg_cluster_->Execute(
                        ClusterHostType::kMaster,
                        R"(
                            INSERT INTO communicationservice_schema.message
                            (origin_connection_id, connection_id, text, created_at)
                            VALUES ($1, $2, $3, to_timestamp($4))
                        )",
                        origin_connection_id,
                        connection_id,
                        text,
                        timestamp);

                    LOG_INFO() << "Stored TG message: " << text;
                }
            }
        }

    } catch (const std::exception& e) {
        LOG_ERROR() << "Telegram fetcher error: " << e.what();
    }
}

} // namespace communicationservice::components
