#include "create_child.hpp"

#include <userver/components/component_context.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/storages/postgres/cluster.hpp>
#include <userver/storages/postgres/component.hpp>

#include <new/sql_queries.hpp>
#include <schemas/api/v1/components/errors.hpp>
#include <schemas/api/v1/components/schemas.hpp>

#include <userver/server/handlers/exceptions.hpp>

namespace dto = new::dto;

namespace new::handlers::v1 {

using userver::formats::json::ValueBuilder;

CreateChild::CreateChild(const userver::components::ComponentConfig& config,
                         const userver::components::ComponentContext& component_context)
    : HttpHandlerJsonBase(config, component_context),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto CreateChild::HandleRequestJsonThrow(
    const userver::server::http::HttpRequest& request,
    const userver::formats::json::Value& request_json,
    userver::server::request::RequestContext& /*context*/) const -> userver::formats::json::Value {

    auto request_dto = request_json.As<dto::CreateChildRequest>();

    if (request_dto.age > 17) {
        LOG_INFO() << "User entered the invalide age";

        dto::ErrorResponse error{.code = dto::ErrorCode::kAgeTooBig,
                                 .message = "Child age must be <= 17"};

        auto json = userver::formats::json::ValueBuilder{error}.ExtractValue();

        throw userver::server::handlers::ClientError(ExternalBody{userver::formats::json::ToString(json)});
    }

    auto result = pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                       new::sql::kInsertChild, request_dto.name,
                                       request_dto.age);

    const int id = result.AsSingleRow<int>();

    dto::ChildResponse response{.id = id, .name = request_dto.name, .age = request_dto.age};

    request.SetResponseStatus(userver::server::http::HttpStatus::kCreated);

    return ValueBuilder{response}.ExtractValue();
}

} // namespace new::handlers::v1
