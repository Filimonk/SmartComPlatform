#include "MessageDispatcher.hpp"

#include <userver/clients/http/component.hpp>
#include <userver/components/component_context.hpp>
#include <userver/storages/postgres/component.hpp>

#include <communicationservice/sql_queries.hpp>

#include <schemas/api/v1/components/entities.hpp>

#include "sender/SmsSender.hpp"
#include "sender/TelegramSender.hpp"
#include "sender/EmailSender.hpp"

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::components {

namespace dto = communicationservice::dto;

MessageDispatcher::MessageDispatcher(const userver::components::ComponentConfig& config,
                                     const userver::components::ComponentContext& context)
    : LoggableComponentBase(config, context),
      pg_cluster_(context.FindComponent<userver::components::Postgres>("postgres-db").GetCluster()),
      http_client_(context.FindComponent<userver::components::HttpClient>().GetHttpClient()) {

    registry_.Register(
        dto::ToString(dto::ChannelType::kSms),
        std::make_shared<communicationservice::sender::SmsSender>(http_client_, pg_cluster_));

    registry_.Register(
        dto::ToString(dto::ChannelType::kTelegram),
        std::make_shared<communicationservice::sender::TelegramSender>(http_client_, pg_cluster_));

    registry_.Register(dto::ToString(dto::ChannelType::kMail),
                       std::make_shared<communicationservice::sender::EmailSender>(pg_cluster_));

    std::chrono::seconds period{3};
    task_.Start("dispatcher-task", {period}, [this] { DoWork(); });
}

void MessageDispatcher::DoWork() {

    const auto result =
        pg_cluster_->Execute(ClusterHostType::kMaster, communicationservice::sql::kGetPendingJobs);

    for (const auto& row : result) {
        LOG_INFO() << "Processing job 1";

        try {
            dto::MessageJob job;

            job.id = row["id"].As<boost::uuids::uuid>();
            job.userId = row["user_id"].As<int>();
            job.originConnectionId =
                row["origin_connection_id"].As<std::optional<boost::uuids::uuid>>();
            job.contactId = row["contact_id"].As<boost::uuids::uuid>();
            job.connectionId = row["connection_id"].As<std::optional<boost::uuids::uuid>>();
            job.text = row["text"].As<std::string>();

            LOG_INFO() << "Processing job 2";

            if (!job.originConnectionId.has_value() ^ !job.connectionId.has_value()) {
                throw std::runtime_error("origin_connection_id and connection_id should be set or "
                                         "empty at the same time");
            }

            LOG_INFO() << "Processing job 3";

            if (!job.originConnectionId.has_value()) {
                const auto route = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                        communicationservice::sql::kGetJobRoute,
                                                        job.userId, job.contactId);

                if (route.IsEmpty()) {
                    throw std::runtime_error("No route");
                }

                job.originConnectionId = route[0]["origin_connection_id"].As<boost::uuids::uuid>();
                job.connectionId = route[0]["connection_id"].As<boost::uuids::uuid>();
            }

            LOG_INFO() << "Processing job 4";

            const auto channel = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                      communicationservice::sql::kGetJobChannel,
                                                      job.originConnectionId, job.connectionId);

            if (channel.IsEmpty()) {
                throw std::runtime_error("The origin and conneciton channels aren't the same");
            }

            LOG_INFO() << "Processing job 5";

            const auto channel_str = channel[0]["channel"].As<std::string>();
            LOG_INFO() << channel_str;

            const auto& sender = registry_.Get(channel_str);

            LOG_INFO() << "Processing job 6";

            const auto send_result = sender.Send(job);

            LOG_INFO() << "Processing job 7";

            pg_cluster_->Execute(ClusterHostType::kMaster,
                                 communicationservice::sql::kUpdateJobStatus, job.id,
                                 send_result.success ? "sent" : "failed");

            LOG_INFO() << "Processing job 8";

            if (send_result.success) {
                pg_cluster_->Execute(ClusterHostType::kMaster,
                                     communicationservice::sql::kCreateMessage,
                                     job.originConnectionId, job.connectionId, job.text, job.id);
            }
            else {
                LOG_WARNING() << "Failed to send message: " << send_result.error;
            }

            LOG_INFO() << "Processing job 9";

        } catch (...) {
            pg_cluster_->Execute(ClusterHostType::kMaster,
                                 communicationservice::sql::kUpdateJobStatus,
                                 row["id"].As<boost::uuids::uuid>(), "failed");
        }
    }
}

} // namespace communicationservice::components
