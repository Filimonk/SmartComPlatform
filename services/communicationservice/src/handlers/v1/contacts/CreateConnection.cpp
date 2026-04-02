#include "CreateConnection.hpp"
#include "ChannelTypeEnumToString.hpp"

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

namespace dto = communicationservice::dto;

using userver::formats::json::ValueBuilder;
using userver::server::http::HttpStatus;

class ErrorBuilder {
  public:
    static constexpr bool kIsExternalBodyFormatted = true;

    ErrorBuilder(const dto::ErrorCode& code, const std::string& message) {
        dto::ErrorResponse error{.code = code, .message = message};

        const auto& error_json = ValueBuilder{error}.ExtractValue();

        json_error_body_ = userver::formats::json::ToString(error_json);
    }

    [[nodiscard]] auto GetExternalBody() const -> std::string {
        return json_error_body_;
    }

  private:
    std::string json_error_body_;
};

} // namespace

namespace communicationservice::handlers::v1 {

CreateConnection::CreateConnection(const userver::components::ComponentConfig& config,
                                   const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto CreateConnection::HandleRequestJsonThrow(
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

        const auto contact_id =
            userver::utils::BoostUuidFromString(request.GetPathArg("contactId"));

        const auto& request_dto = request_json.As<dto::CreateConnectionRequest>();
        
        if (((request_dto.phoneNumber.has_value()? 1: 0) +
             (request_dto.mailAddress.has_value()? 1: 0) +
             (request_dto.commonIdentifier.has_value()? 1: 0)) != 1) {
            throw userver::server::handlers::ClientError(
                ErrorBuilder{dto::ErrorCode::kInvalidRequestFormat,
                             "Exactly one channel identitifier option must be filled in"});
        }

        const auto& result = pg_cluster_->Execute(
            userver::storages::postgres::ClusterHostType::kMaster,
            communicationservice::sql::kCreateConnection, user_id, contact_id,
            channelTypeEnumToString(request_dto.channel), request_dto.phoneNumber,
            request_dto.mailAddress, request_dto.commonIdentifier);
        LOG_INFO() << "pg succeed";

        if (result.IsEmpty()) {
            throw userver::server::handlers::ResourceNotFound(
                ErrorBuilder{dto::ErrorCode::kResourceNotFound,
                             "Resource Not Found. This user don't have such contact"});
        }

        auto row = result[0];

        dto::CreateConnectionResponse response;

        response.id = row["id"].As<boost::uuids::uuid>();
        response.contactId = row["contact_id"].As<boost::uuids::uuid>();
        response.isActive = row["is_active"].As<bool>();
        // response.channel = channelTypeEnumToString(row["channel"].As<::communicationservice::dto::ChannelType>());
        response.phoneNumber = row["phone_number"].As<std::optional<std::string>>();
        response.mailAddress = row["mail_address"].As<std::optional<std::string>>();
        response.commonIdentifier = row["common_identifier"].As<std::optional<std::string>>();

        request.SetResponseStatus(userver::server::http::HttpStatus::kCreated); // 201
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
