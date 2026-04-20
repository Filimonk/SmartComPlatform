#pragma once

#include <userver/components/component.hpp>
#include <userver/server/websocket/websocket_handler.hpp>
#include <random>
#include <chrono>

#include <userver/clients/http/client.hpp>

#include <userver/storages/postgres/cluster.hpp>

namespace communicationservice::handlers::v1 {

class SpellCheck final : public userver::server::websocket::WebsocketHandlerBase {
  public:
    static constexpr std::string_view kName = "websocket-handler-v1-SpellCheck";

    SpellCheck(const userver::components::ComponentConfig&,
               const userver::components::ComponentContext&);

    auto Handle(userver::server::websocket::WebSocketConnection& chat,
                userver::server::request::RequestContext& /*context*/) const -> void override;

  private:
    mutable std::mt19937 rand_gen_;
   
    userver::clients::http::Client& http_client_;
    userver::storages::postgres::ClusterPtr pg_cluster_;
};

} // namespace communicationservice::handlers::v1
