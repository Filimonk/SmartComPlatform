#include "MessageDispatcher.hpp"

#include <userver/components/component_context.hpp>
#include <userver/storages/postgres/component.hpp>
#include <userver/clients/http/component.hpp>

#include <communicationservice/sql_queries.hpp>

#include <schemas/api/v1/components/entities.hpp>

#include "sender/SmsSender.hpp"

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::components {

namespace dto = communicationservice::dto;

MessageDispatcher::MessageDispatcher(
    const userver::components::ComponentConfig& config,
    const userver::components::ComponentContext& context)
    : LoggableComponentBase(config, context),
      pg_cluster_(context.FindComponent<userver::components::Postgres>("postgres-db").GetCluster()),
      http_client_(context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      resolver_(pg_cluster_) {

    registry_.Register(
        dto::ToString(dto::ChannelType::kSms),
        std::make_shared<communicationservice::sender::SmsSender>(http_client_)
    );

    std::chrono::seconds period{3};
    task_.Start("dispatcher-task", {period}, [this] { DoWork(); });
}

void MessageDispatcher::DoWork() {

    const auto result = pg_cluster_->Execute(
        ClusterHostType::kMaster,
        communicationservice::sql::kGetPendingJobs
    );

    for (const auto& row : result) {
        try {
            communicationservice::resolver::Job job;

            job.id = row["id"].As<boost::uuids::uuid>();
            job.contact_id = row["contact_id"].As<boost::uuids::uuid>();
            job.text = row["text"].As<std::string>();

            const auto channel_str = row["channel"].As<std::string>();
            job.channel = dto::ChannelTypeFromString(channel_str);

            auto route = resolver_.Resolve(job);

            const auto& sender =
                registry_.Get(dto::ToString(route.channel));

            communicationservice::sender::SendContext ctx{
                route.destination,
                job.text,
                route.origin
            };

            const auto send_result = sender.Send(ctx);

            pg_cluster_->Execute(
                ClusterHostType::kMaster,
                communicationservice::sql::kUpdateJobStatus,
                job.id,
                send_result.success ? "sent" : "failed"
            );

        } catch (...) {
            pg_cluster_->Execute(
                ClusterHostType::kMaster,
                communicationservice::sql::kUpdateJobStatus,
                row["id"].As<boost::uuids::uuid>(),
                "failed"
            );
        }
    }
}

} // namespace communicationservice::components
