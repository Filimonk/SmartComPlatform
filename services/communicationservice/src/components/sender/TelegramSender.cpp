#include "TelegramSender.hpp"

#include <communicationservice/sql_queries.hpp>

#include <userver/formats/json/value_builder.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::sender {

TelegramSender::TelegramSender(userver::clients::http::Client& client,
                               userver::storages::postgres::ClusterPtr& pg_cluster)
    : http_client_(client), pg_cluster_(pg_cluster) {}

auto TelegramSender::Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult {
    userver::formats::json::ValueBuilder body;

    // origin (там api_key = token бота)
    const auto origin = pg_cluster_->Execute(
        ClusterHostType::kMaster,
        communicationservice::sql::kGetOrigin,
        ctx.originConnectionId);

    const auto bot_token = origin[0]["api_key"].As<std::string>();

    // origin_connection (не обязателен для tg, но пусть будет)
    const auto origin_connection = pg_cluster_->Execute(
        ClusterHostType::kMaster,
        communicationservice::sql::kGetOriginConnection,
        ctx.originConnectionId);

    // connection (chat_id)
    const auto connection = pg_cluster_->Execute(
        ClusterHostType::kMaster,
        communicationservice::sql::kGetConnection,
        ctx.connectionId);

    const auto chat_id =
        connection[0]["common_identifier"].As<std::optional<std::string>>();

    if (!chat_id.has_value()) {
        return {false, "chat_id is empty"};
    }

    body["chat_id"] = chat_id.value();
    body["text"] = ctx.text;

    const std::string url =
        "https://api.telegram.org/bot" + bot_token + "/sendMessage";

    auto response =
        http_client_.CreateRequest()
            .post(url)
            .headers({{"Content-Type", "application/json"}})
            .data(userver::formats::json::ToString(body.ExtractValue()))
            .timeout(std::chrono::seconds{5})
            .perform();

    if (response->status_code() != 200) {
        return {false, response->body()};
    }

    return {true, ""};
}

} // namespace communicationservice::sender
