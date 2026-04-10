#pragma once

#include <string>

#include <schemas/api/v1/components/entities.hpp>

namespace communicationservice::sender {

struct SendResult {
    bool success{false};
    // std::string provider_id;
    std::string error;
};

class IMessageSender {
public:
    virtual ~IMessageSender() = default;

    [[nodiscard]] virtual auto Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult = 0;
};

} // namespace communicationservice::sender
