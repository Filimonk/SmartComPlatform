#include "SendSms.hpp"

#include <userver/components/component_context.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/clients/http/client.hpp>
#include <userver/clients/http/component.hpp>

#include <userver/storages/postgres/cluster.hpp>
#include <userver/storages/postgres/component.hpp>

#include <communicationservice/sql_queries.hpp>
#include <schemas/api/v1/components/errors.hpp>
#include <schemas/api/v1/components/schemas.hpp>

#include <userver/server/handlers/exceptions.hpp>
#include <userver/formats/json/exception.hpp>
#include <userver/storages/postgres/exceptions.hpp>

namespace dto = communicationservice::dto;

namespace {

using userver::formats::json::ValueBuilder;
using userver::server::http::HttpStatus;

class ErrorBuilder {
  public:
    static constexpr bool kIsExternalBodyFormatted = true;

    ErrorBuilder(const userver::formats::json::Value& error_json) {
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

SendSms::SendSms(const userver::components::ComponentConfig& config,
                 const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto SendSms::HandleRequestJsonThrow(const userver::server::http::HttpRequest& request,
                                     const userver::formats::json::Value& request_json,
                                     userver::server::request::RequestContext& /*context*/) const
    -> userver::formats::json::Value {

    try {
        const auto& auth_header = request.GetHeader("Authorization");
        if (auth_header.empty()) {
            throw userver::server::handlers::Unauthorized();
        }

        const auto& auth_response = http_client_.CreateRequest()
                                        .get()
                                        .url("http://authservice:8080/verify/")
                                        .headers({{"Authorization", auth_header}})
                                        .timeout(std::chrono::seconds(2))
                                        .perform();
        LOG_INFO() << "authservice complited successfully";

        if (auth_response->status_code() != HttpStatus::kOk) {
            throw userver::server::handlers::Unauthorized();
        }

        const auto& json_body = userver::formats::json::FromString(auth_response->body());
        const auto& user_id = json_body["user_id"].As<int>();
        
        LOG_INFO() << "incoming request: " << ToString(request_json);

        const auto& request_dto = request_json.As<dto::SendSmsRequest>();

        if (request_dto.channel.empty() || request_dto.text.empty()) {

            dto::ErrorResponse error{.code = dto::ErrorCode::kMissingText,
                                     .message = "All fields must not be empty"};

            const auto& error_json = ValueBuilder{error}.ExtractValue();

            throw userver::server::handlers::ClientError(ErrorBuilder{error_json});
        }

        const auto& result =
            pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                 communicationservice::sql::kInsertSmsJob, user_id,
                                 request_dto.contactId, request_dto.channel, request_dto.text);

        const auto& job_id = result.AsSingleRow<boost::uuids::uuid>();
        dto::SendSmsResponse response{.jobId = job_id};

        request.SetResponseStatus(userver::server::http::HttpStatus::kAccepted); // 202
        return ValueBuilder{response}.ExtractValue();

    } catch (const userver::formats::json::Exception& e) {
        dto::ErrorResponse error{.code = dto::ErrorCode::kInvalidRequestFormat,
                                 .message = "Invalid JSON format"};
        const auto& error_json = ValueBuilder{error}.ExtractValue();

        throw userver::server::handlers::RequestParseError(ErrorBuilder{error_json});
    } catch (const userver::storages::postgres::ForeignKeyViolation& e) {
        dto::ErrorResponse error{.code = dto::ErrorCode::kForeignKeyViolation,
                                 .message = "Foreign key violation"};
        const auto& error_json = ValueBuilder{error}.ExtractValue();

        throw userver::server::handlers::ClientError(ErrorBuilder{error_json});
    }
}

} // namespace communicationservice::handlers::v1
