#include "SmsAeroSender.hpp"

#include <communicationservice/sql_queries.hpp>

#include <userver/clients/http/client.hpp>
#include <userver/formats/json/serialize.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::sender {

namespace {

// --- простой URL encode (достаточно для SMS Aero)
std::string UrlEncode(const std::string& value) {
    static const char hex[] = "0123456789ABCDEF";

    std::string result;
    result.reserve(value.size() * 3);

    for (unsigned char c : value) {
        if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            result += c;
        } else {
            result += '%';
            result += hex[c >> 4];
            result += hex[c & 15];
        }
    }
    return result;
}

// --- base64 (для Basic Auth)
std::string Base64Encode(const std::string& input) {
    static const char table[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    std::string output;
    int val = 0;
    int valb = -6;

    for (unsigned char c : input) {
        val = (val << 8) + c;
        valb += 8;
        while (valb >= 0) {
            output.push_back(table[(val >> valb) & 0x3F]);
            valb -= 6;
        }
    }

    if (valb > -6)
        output.push_back(table[((val << 8) >> (valb + 8)) & 0x3F]);

    while (output.size() % 4)
        output.push_back('=');

    return output;
}

} // namespace

SmsAeroSender::SmsAeroSender(userver::clients::http::Client& client,
                     userver::storages::postgres::ClusterPtr& pg_cluster)
    : http_client_(client), pg_cluster_(pg_cluster) {}

auto SmsAeroSender::Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult {
    try {
        LOG_INFO() << "SMS Aero sending started";

        // --- origin (api_key)
        const auto origin = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetOriginByOriginConnectionId,
            ctx.originConnectionId);

        const auto api_key = origin[0]["api_key"].As<std::string>();

        // --- origin_connection (login)
        const auto origin_connection = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetOriginConnection,
            ctx.originConnectionId);

        const auto login =
            origin_connection[0]["common_identifier"].As<std::optional<std::string>>();

        // --- connection (destination phone)
        const auto connection = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetConnection,
            ctx.connectionId);

        const auto to_phone =
            connection[0]["phone_number"].As<std::optional<std::string>>();

        if (!login || login->empty()) {
            return {false, "login is empty"};
        }

        if (!to_phone || to_phone->empty()) {
            return {false, "destination phone is empty"};
        }

        LOG_INFO() << "Login: " << login.value();
        LOG_INFO() << "To: " << to_phone.value();

        // --- form-urlencoded body
        std::string body =
            "number=" + UrlEncode(to_phone.value()) +
            "&text=" + UrlEncode(ctx.text) +
            "&sign=" + UrlEncode("SMS Aero");

        LOG_INFO() << "Body: " << body;

        // --- Basic Auth
        std::string auth_raw = login.value() + ":" + api_key;
        std::string auth_header = "Basic " + Base64Encode(auth_raw);

        // --- HTTP request
        auto response = http_client_.CreateRequest()
            .post("https://gate.smsaero.ru/v2/sms/send")
            .headers({
                {"Authorization", auth_header},
                {"Content-Type", "application/x-www-form-urlencoded"}
            })
            .data(body)
            .timeout(std::chrono::seconds{5})
            .perform();

        if (!response) {
            return {false, "no response"};
        }

        if (response->status_code() != 200) {
            LOG_ERROR() << "SMS Aero failed: status=" << response->status_code()
                        << " body=" << response->body();
            return {false, response->body()};
        }

        LOG_INFO() << "SMS Aero success: " << response->body();
        return {true, ""};

    } catch (const std::exception& ex) {
        return {false, ex.what()};
    }
}

} // namespace communicationservice::sender
