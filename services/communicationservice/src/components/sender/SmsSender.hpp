#pragma once

#include "IMessageSender.hpp"

#include <userver/clients/http/client.hpp>

namespace communicationservice::sender {

class SmsSender final : public IMessageSender {
public:
    explicit SmsSender(userver::clients::http::Client& client);

    SendResult Send(const SendContext& ctx) const override;

private:
    userver::clients::http::Client& http_client_;
};

} // namespace communicationservice::sender
