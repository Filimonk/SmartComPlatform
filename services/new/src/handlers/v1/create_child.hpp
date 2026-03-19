#pragma once

#include <userver/components/component.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/storages/postgres/cluster.hpp>

namespace new::handlers::v1 {

class CreateChild final
    : public userver::server::handlers::HttpHandlerJsonBase {
public:
    static constexpr std::string_view kName = "handler-CreateChild";
    
    CreateChild(const userver::components::ComponentConfig&, const userver::components::ComponentContext&);

    auto HandleRequestJsonThrow(
        const userver::server::http::HttpRequest& /*request*/,
        const userver::formats::json::Value& /*request_json*/,
        userver::server::request::RequestContext& /*context*/) const -> userver::formats::json::Value override;

private:
    userver::storages::postgres::ClusterPtr pg_cluster_;
};

}

