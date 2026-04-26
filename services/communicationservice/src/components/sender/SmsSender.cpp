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
        ClusterHostType::kMaster, communicationservice::sql::kGetOriginByOriginConnectionId, ctx.originConnectionId);
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
    
    if (!origin_number.has_value() || origin_number->empty()) {
        return {false, "origin phone number is missing"};
    }
    if (!connection_number.has_value() || connection_number->empty()) {
        return {false, "destination phone number is missing"};
    }

    body["number"] = origin_number.value_or("");
    body["destination"] = connection_number.value_or("");
    body["text"] = ctx.text;
    
    LOG_INFO() << userver::formats::json::ToString(body.ExtractValue());
    
    userver::formats::json::ValueBuilder header;
    header["Authorization"] = "Bearer " + api_key;
    header["Content-Type"] = "application/json";
    LOG_INFO() << "Auth:" << userver::formats::json::ToString(header.ExtractValue());
    
    auto escape_json = [](const std::string& s) -> std::string {
        std::string out;
        out.reserve(s.size() + 4);
        for (char c : s) {
            switch (c) {
                case '"': out += "\\\""; break;
                case '\\': out += "\\\\"; break;
                case '\b': out += "\\b"; break;
                case '\f': out += "\\f"; break;
                case '\n': out += "\\n"; break;
                case '\r': out += "\\r"; break;
                case '\t': out += "\\t"; break;
                default: out += c; break;
            }
        }
        return out;
    };

    std::string body_str = 
        "{\"number\":\"" + escape_json(origin_number.value()) + "\","
        "\"destination\":\"" + escape_json(connection_number.value()) + "\","
        "\"text\":\"" + escape_json(ctx.text) + "\"}";
    
    LOG_INFO() << "Sending SMS request: " << body_str;

    auto response = http_client_.CreateRequest()
        .post("https://api.exolve.ru/messaging/v1/SendSMS")
        .headers({
            {"Authorization", "Bearer " + api_key},
            {"Content-Type", "application/json"},
            {"Accept", "*/*"},
            {"Accept-Encoding", "identity"}
        })
        .data(body_str)
        .timeout(std::chrono::seconds{5})
        .perform();

    if (response->status_code() != 200) {
        LOG_ERROR() << "SMS send failed: status=" << response->status_code() 
                    << ", body=" << response->body();
        return {false, response->body()};
    }
    
    LOG_INFO() << "SMS sent successfully, response: " << response->body();
    return {true, ""};
}

} // namespace communicationservice::sender
