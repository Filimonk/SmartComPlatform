#include "GetAllOrigins.hpp"
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

namespace {

auto maskApiKey(const std::optional<std::string>& api_key_otp) -> std::string {
    if (!api_key_otp.has_value()) {
        return "";
    }

    const auto& api_key = api_key_otp.value();
    if (api_key.size() < 6) {
        return "api key hidden";
    }

    std::string hidden = api_key;
    hidden.replace(2, hidden.size() - 4, "****");
    return hidden;
}

} // namespace

namespace communicationservice::handlers::v1 {

GetAllOrigins::GetAllOrigins(const userver::components::ComponentConfig& config,
                             const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto GetAllOrigins::HandleRequestJsonThrow(
    const userver::server::http::HttpRequest& request,
    const userver::formats::json::Value& /*request_json*/,
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

        if (auth_response->status_code() != HttpStatus::kOk) {
            throw userver::server::handlers::Unauthorized(
                ErrorBuilder{dto::ErrorCode::kInvalidAuthorizationToken,
                             "Authorization token is invalid or expired"});
        }

        const auto& json_body = userver::formats::json::FromString(auth_response->body());
        const auto& user_id = json_body["user_id"].As<int>();

        const auto& result =
            pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                 communicationservice::sql::kGetAllOrigins, user_id);

        dto::GetAllOriginsResponse response;

        std::vector<dto::GetAllOriginsResponse::OriginsA> origins;

        for (const auto& row : result) {
            dto::GetAllOriginsResponse::OriginsA item;
            item.id = row["id"].As<boost::uuids::uuid>();
            item.name = row["name"].As<std::string>();
            item.channel = row["channel"].As<std::optional<dto::ChannelType>>();
            item.apiKeyMasked = (row["api_key"].As<std::optional<std::string>>().has_value()
                                     ? std::optional<std::string>(maskApiKey(
                                           row["api_key"].As<std::optional<std::string>>()))
                                     : std::nullopt);
            item.provider = row["provider"].As<std::optional<std::string>>();
            item.requiresAction = row["requires_action"].As<bool>();
            origins.push_back(std::move(item));
        }

        response.origins = std::move(origins);

        request.SetResponseStatus(userver::server::http::HttpStatus::kOk);
        return ValueBuilder{response}.ExtractValue();

    } catch (const userver::formats::json::Exception& e) {
        throw userver::server::handlers::RequestParseError(
            ErrorBuilder{dto::ErrorCode::kInvalidRequestFormat, "Invalid JSON format"});
    }
}

} // namespace communicationservice::handlers::v1
