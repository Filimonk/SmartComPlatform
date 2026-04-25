#pragma once

#include "IMessageSender.hpp"

#include <userver/clients/http/client.hpp>
#include <userver/storages/postgres/cluster.hpp>

namespace communicationservice::sender {

class EmailSender final : public IMessageSender {
  public:
    explicit EmailSender(/*userver::clients::http::Client& client,*/
                         userver::storages::postgres::ClusterPtr& pg_cluster);

    [[nodiscard]] auto
    Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult override;

  private:
    // userver::clients::http::Client& http_client_;
    userver::storages::postgres::ClusterPtr pg_cluster_;
};

} // namespace communicationservice::sender
