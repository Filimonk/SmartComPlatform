#pragma once

#include <chrono>
#include <random>
#include <userver/components/component.hpp>
#include <userver/server/websocket/websocket_handler.hpp>

#include <userver/clients/http/client.hpp>

#include <userver/storages/postgres/cluster.hpp>

namespace communicationservice::handlers::v1 {

class TaskPropose final : public userver::server::websocket::WebsocketHandlerBase {
  public:
    static constexpr std::string_view kName = "websocket-handler-v1-TaskPropose";

    TaskPropose(const userver::components::ComponentConfig&,
                const userver::components::ComponentContext&);

    auto HandleHandshake(const userver::server::http::HttpRequest& request,
                         userver::server::http::HttpResponse& response,
                         userver::server::request::RequestContext& context) const -> bool override;

    auto Handle(userver::server::websocket::WebSocketConnection& chat,
                userver::server::request::RequestContext& /*context*/) const -> void override;

  private:
    mutable std::mt19937 rand_gen_;

    userver::clients::http::Client& http_client_;
    userver::storages::postgres::ClusterPtr pg_cluster_;
};

} // namespace communicationservice::handlers::v1
