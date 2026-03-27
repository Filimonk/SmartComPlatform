#pragma once

#include <userver/components/loggable_component_base.hpp>
#include <userver/utils/periodic_task.hpp>

#include <userver/clients/http/client.hpp>
#include <userver/storages/postgres/cluster.hpp>

namespace communicationservice::components {

class SmsDispatcher final : public userver::components::LoggableComponentBase {
public:
    static constexpr std::string_view kName = "sms-dispatcher";

    SmsDispatcher(const userver::components::ComponentConfig&,
                  const userver::components::ComponentContext&);

private:
    void DoWork();

    userver::storages::postgres::ClusterPtr pg_cluster_;
    userver::clients::http::Client& http_client_;

    userver::utils::PeriodicTask task_;
};

}
