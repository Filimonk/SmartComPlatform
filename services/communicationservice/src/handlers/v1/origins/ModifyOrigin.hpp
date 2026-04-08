#pragma once

#include <userver/components/component.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/clients/http/client.hpp>

#include <userver/storages/postgres/cluster.hpp>

namespace communicationservice::handlers::v1 {

class ModifyOrigin final
    : public userver::server::handlers::HttpHandlerJsonBase {
public:
    static constexpr std::string_view kName = "handler-v1-ModifyOrigin";
    
    ModifyOrigin(const userver::components::ComponentConfig&, const userver::components::ComponentContext&);

    auto HandleRequestJsonThrow(
        const userver::server::http::HttpRequest& /*request*/,
        const userver::formats::json::Value& /*request_json*/,
        userver::server::request::RequestContext& /*context*/) const -> userver::formats::json::Value override;

private:
    userver::clients::http::Client& http_client_;
    userver::storages::postgres::ClusterPtr pg_cluster_;
};

}

