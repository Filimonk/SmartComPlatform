#include "ModifyOrigin.hpp"
#include "../common/ChannelTypeEnumToString.hpp"
#include "../common/ErrorBuilder.hpp"

#include <userver/components/component_context.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/clients/http/client.hpp>
#include <userver/clients/http/component.hpp>

#include <userver/storages/postgres/cluster.hpp>
#include <userver/storages/postgres/component.hpp>

#include <communicationservice/sql_queries.hpp>
#include <schemas/api/v1/components/errors.hpp>
#include <schemas/api/v1/components/schemas.hpp>

#include <userver/formats/json/exception.hpp>
#include <userver/server/handlers/exceptions.hpp>
#include <userver/storages/postgres/exceptions.hpp>

#include <userver/utils/boost_uuid4.hpp>

namespace {

auto hideApiKey(const std::optional<std::string>& api_key_otp) -> std::string {
    if (!api_key_otp.has_value()) {
        return "";
    }
    
    const auto& api_key = api_key_otp.value();
    if (api_key.size() < 6) {
        return "api key";
    }
    
    std::string hidden = api_key;
    hidden.replace(2, hidden.size() - 4, "..."); 
    return hidden;
}

} // namespace


namespace communicationservice::handlers::v1 {

ModifyOrigin::ModifyOrigin(const userver::components::ComponentConfig& config,
                           const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto ModifyOrigin::HandleRequestJsonThrow(
    const userver::server::http::HttpRequest& request,
    const userver::formats::json::Value& request_json,
    userver::server::request::RequestContext& /*context*/) const -> userver::formats::json::Value {

    try {
        const auto& auth_header = request.GetHeader("Authorization");
        if (auth_header.empty()) {
            throw userver::server::handlers::Unauthorized(
                ErrorBuilder{dto::ErrorCode::kMissingAuthorizationTokenHeader,
                             "Authorization token header shouldn't be empty"});
        }

        const auto& auth_response = http_client_.CreateRequest()
                                        .get()
                                        .url("http://authservice:8080/verify/")
                                        .headers({{"Authorization", auth_header}})
                                        .timeout(std::chrono::seconds(2))
                                        .perform();
        LOG_INFO() << "authservice complited successfully";

        if (auth_response->status_code() != HttpStatus::kOk) {
            throw userver::server::handlers::Unauthorized(
                ErrorBuilder{dto::ErrorCode::kInvalidAuthorizationToken,
                             "Authorization token is invalid or expired"});
        }

        const auto& json_body = userver::formats::json::FromString(auth_response->body());
        const auto& user_id = json_body["user_id"].As<int>();

        const auto origin_id = userver::utils::BoostUuidFromString(request.GetPathArg("originId"));

        const auto& request_dto = request_json.As<dto::ModifyOriginRequest>();
        const auto& origin_name = request_dto.name;
        const auto& channel = request_dto.channel;
        const auto& api_key = request_dto.apiKey;
        const auto& email_server_address = request_dto.emailServerAddress;

        if (!origin_name.has_value() && !channel.has_value() && !api_key.has_value() &&
            !email_server_address.has_value()) {
            throw userver::server::handlers::ClientError(
                ErrorBuilder{dto::ErrorCode::kMissingText, "At least one field must be filled in"});
        }

        const auto& result =
            pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                 communicationservice::sql::kModifyOrigin, user_id, origin_id,
                                 origin_name, channelTypeEnumToString(channel), api_key, email_server_address);

        if (result.IsEmpty()) {
            throw userver::server::handlers::ResourceNotFound(
                ErrorBuilder{dto::ErrorCode::kResourceNotFound, "Resource Not Found"});
        }

        const auto row = result[0];
        const auto& modifyed_origin_id = row["id"].As<boost::uuids::uuid>();
        const auto& modifyed_origin_name = row["name"].As<std::string>();
        const auto& modifyed_channel = row["channel"].As<std::optional<std::string>>();
        const auto& modifyed_api_key = row["api_key"].As<std::optional<std::string>>();
        const auto& modifyed_email_server_address = row["email_server_address"].As<std::optional<std::string>>();

        dto::ModifyOriginResponse response{.id = modifyed_origin_id,
                                           .name = modifyed_origin_name,
                                           .channel = modifyed_channel,
                                           .hiddenApiKey = hideApiKey(modifyed_api_key),
                                           .emailServerAddress = modifyed_email_server_address};

        request.SetResponseStatus(userver::server::http::HttpStatus::kOk); // 200
        return ValueBuilder{response}.ExtractValue();

    } catch (const userver::formats::json::Exception& e) {
        throw userver::server::handlers::RequestParseError(
            ErrorBuilder{dto::ErrorCode::kInvalidRequestFormat, "Invalid JSON format"});
    } catch (const userver::storages::postgres::ForeignKeyViolation& e) {
        throw userver::server::handlers::ClientError(
            ErrorBuilder{dto::ErrorCode::kForeignKeyViolation, "Foreign key violation"});
    }
}

} // namespace communicationservice::handlers::v1
