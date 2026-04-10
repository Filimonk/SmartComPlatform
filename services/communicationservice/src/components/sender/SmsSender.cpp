#include "SmsSender.hpp"

#include <communicationservice/sql_queries.hpp>

#include <userver/formats/json/serialize.hpp>
#include <userver/formats/json/value_builder.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::sender {

SmsSender::SmsSender(userver::clients::http::Client& client,
                     userver::storages::postgres::ClusterPtr& pg_cluster)
    : http_client_(client), pg_cluster_(pg_cluster) {}

auto SmsSender::Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult {
    userver::formats::json::ValueBuilder body;
    
    LOG_INFO() << "SMS 1";

    const auto origin = pg_cluster_->Execute(
        ClusterHostType::kMaster, communicationservice::sql::kGetOrigin, ctx.originConnectionId);
    const auto api_key = origin[0]["api_key"].As<std::string>();
    
    LOG_INFO() << "SMS 2";

    const auto origin_connection = pg_cluster_->Execute(
        ClusterHostType::kMaster, communicationservice::sql::kGetOriginConnection,
        ctx.originConnectionId);
    const auto origin_number = origin_connection[0]["phone_number"].As<std::optional<std::string>>();
    
    LOG_INFO() << "SMS 3";
    
    const auto connection = pg_cluster_->Execute(
        ClusterHostType::kMaster, communicationservice::sql::kGetConnection, ctx.connectionId);
    const auto connection_number = connection[0]["phone_number"].As<std::optional<std::string>>();
    
    LOG_INFO() << "SMS 4";

    body["number"] = origin_number.value_or("");
    body["destination"] = connection_number.value_or("");
    body["text"] = ctx.text;
    
    LOG_INFO() << userver::formats::json::ToString(body.ExtractValue());

    auto response =
        http_client_.CreateRequest()
            .post("https://api.exolve.ru/messaging/v1/SendSMS")
            .headers({{"Authorization", "Bearer " + api_key}, {"Content-Type", "application/json"}})
            .data(userver::formats::json::ToString(body.ExtractValue()))
            .timeout(std::chrono::seconds{5})
            .perform();
    
    LOG_INFO() << "SMS 5";

    if (response->status_code() != 200) {
        return {false, response->body()};
    }
    
    LOG_INFO() << "SMS 6";

    return {true, ""};
}

} // namespace communicationservice::sender
