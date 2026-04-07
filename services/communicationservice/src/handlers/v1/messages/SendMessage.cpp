#include "SendMessage.hpp"

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

SendMessage::SendMessage(const userver::components::ComponentConfig& config,
                 const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto SendMessage::HandleRequestJsonThrow(const userver::server::http::HttpRequest& request,
                                     const userver::formats::json::Value& request_json,
                                     userver::server::request::RequestContext& /*context*/) const
    -> userver::formats::json::Value {

    try {
        const auto& idempotency_token = request.GetHeader("Idempotency-Key");
        if (idempotency_token.empty()) {
            throw userver::server::handlers::ClientError(
                ErrorBuilder{dto::ErrorCode::kMissingIdempotencyTokenHeader,
                             "Idempotency token header shouldn't be empty"});
        }

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

        const auto& request_dto = request_json.As<dto::SendMessageRequest>();

        if (request_dto.text.empty()) {
            throw userver::server::handlers::ClientError(
                ErrorBuilder{dto::ErrorCode::kMissingText, "All fields must not be empty"});
        }

        const auto& result = pg_cluster_->Execute(
            userver::storages::postgres::ClusterHostType::kMaster,
            communicationservice::sql::kInsertMessageJob, idempotency_token, user_id,
            request_dto.originId, request_dto.contactId, request_dto.connectionId, request_dto.text);

        const auto& job_id = result.AsSingleRow<boost::uuids::uuid>();
        dto::SendMessageResponse response{.jobId = job_id};

        request.SetResponseStatus(userver::server::http::HttpStatus::kAccepted); // 202
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
