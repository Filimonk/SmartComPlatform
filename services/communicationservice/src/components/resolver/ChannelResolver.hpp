#pragma once

#include <userver/storages/postgres/cluster.hpp>

#include <schemas/api/v1/components/entities.hpp>

#include <boost/uuid/uuid.hpp>

namespace communicationservice::resolver {

struct Job {
    boost::uuids::uuid id;
    dto::ChannelType channel;
    std::string text;
    boost::uuids::uuid contact_id;
};

struct ResolvedRoute {
    dto::ChannelType channel;
    std::string destination;
    std::string origin;
};

class ChannelResolver {
public:
    explicit ChannelResolver(userver::storages::postgres::ClusterPtr pg);

    ResolvedRoute Resolve(const Job& job) const;

private:
    userver::storages::postgres::ClusterPtr pg_;
};

} // namespace communicationservice::resolver
