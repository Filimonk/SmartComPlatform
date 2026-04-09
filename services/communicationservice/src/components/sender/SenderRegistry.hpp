#pragma once

#include <memory>
#include <string>
#include <unordered_map>

#include "IMessageSender.hpp"

namespace communicationservice::sender {

class SenderRegistry {
public:
    void Register(const std::string& channel, std::shared_ptr<IMessageSender> sender);

    const IMessageSender& Get(const std::string& channel) const;

private:
    std::unordered_map<std::string, std::shared_ptr<IMessageSender>> senders_;
};

} // namespace communicationservice::sender
