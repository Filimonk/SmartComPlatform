#pragma once

#include <userver/components/loggable_component_base.hpp>
#include <userver/utils/periodic_task.hpp>

#include <userver/clients/http/client.hpp>
#include <userver/storages/postgres/cluster.hpp>

#include "sender/SenderRegistry.hpp"
#include "resolver/ChannelResolver.hpp"

namespace communicationservice::components {

class MessageDispatcher final : public userver::components::LoggableComponentBase {
public:
    static constexpr std::string_view kName = "message-dispatcher";

    MessageDispatcher(const userver::components::ComponentConfig& config,
                      const userver::components::ComponentContext& context);

private:
    void DoWork();

    userver::storages::postgres::ClusterPtr pg_cluster_;
    userver::clients::http::Client& http_client_;

    communicationservice::sender::SenderRegistry registry_;
    communicationservice::resolver::ChannelResolver resolver_;

    userver::utils::PeriodicTask task_;
};

} // namespace communicationservice::components
