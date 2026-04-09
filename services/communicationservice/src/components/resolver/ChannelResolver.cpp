#include "ChannelResolver.hpp"

#include <communicationservice/sql_queries.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::resolver {

namespace dto = communicationservice::dto;

ChannelResolver::ChannelResolver(userver::storages::postgres::ClusterPtr pg)
    : pg_(std::move(pg)) {}

ResolvedRoute ChannelResolver::Resolve(const Job& job) const {

    const auto result = pg_->Execute(
        ClusterHostType::kMaster,
        communicationservice::sql::kGetIdentifierByContactAndChannel,
        job.contact_id,
        dto::ToString(job.channel)
    );

    if (result.IsEmpty()) {
        throw std::runtime_error("No destination");
    }

    const auto phone =
        result[0]["phone_number"].As<std::optional<std::string>>();

    if (!phone) {
        throw std::runtime_error("Empty destination");
    }

    return {
        job.channel,
        *phone,
        "79926694706"
    };
}

} // namespace communicationservice::resolver
