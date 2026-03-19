#include "SendSms.hpp"

#include <userver/components/component_context.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/storages/postgres/cluster.hpp>
#include <userver/storages/postgres/component.hpp>

#include <communicationservice/sql_queries.hpp>
#include <schemas/api/v1/components/errors.hpp>
#include <schemas/api/v1/components/schemas.hpp>

#include <userver/server/handlers/exceptions.hpp>

namespace dto = communicationservice::dto;

namespace communicationservice::handlers::v1 {

using userver::formats::json::ValueBuilder;

SendSms::SendSms(const userver::components::ComponentConfig& config,
                 const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto SendSms::HandleRequestJsonThrow(const userver::server::http::HttpRequest& request,
                                     const userver::formats::json::Value& request_json,
                                     userver::server::request::RequestContext& /*context*/) const
    -> userver::formats::json::Value {

    const auto request_dto = request_json.As<dto::SendSmsRequest>();

    if (request_dto.text.empty()) {
        dto::ErrorResponse error{.code = dto::ErrorCode::kInvalidName,
                                 .message = "Text must not be empty"};

        auto json = ValueBuilder{error}.ExtractValue();

        throw userver::server::handlers::ClientError(
            ExternalBody{userver::formats::json::ToString(json)});
    }

    const auto result = pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                             communicationservice::sql::kInsertSmsJob,
                                             request_dto.chatId, request_dto.text);

    const auto job_id = result.AsSingleRow<boost::uuids::uuid>();

    dto::SendSmsResponse response{.jobId = job_id};

    request.SetResponseStatus(userver::server::http::HttpStatus::kAccepted); // 202

    return ValueBuilder{response}.ExtractValue();
}

} // namespace communicationservice::handlers::v1
