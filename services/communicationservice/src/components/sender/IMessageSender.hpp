#pragma once

#include <string>

namespace communicationservice::sender {

struct SendContext {
    std::string destination;
    std::string text;
    std::string origin;
};

struct SendResult {
    bool success{false};
    std::string provider_id;
    std::string error;
};

class IMessageSender {
public:
    virtual ~IMessageSender() = default;

    virtual SendResult Send(const SendContext& ctx) const = 0;
};

} // namespace communicationservice::sender
