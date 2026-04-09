#include "SenderRegistry.hpp"

#include <stdexcept>

namespace communicationservice::sender {

void SenderRegistry::Register(const std::string& channel,
                              std::shared_ptr<IMessageSender> sender) {
    senders_.emplace(channel, std::move(sender));
}

const IMessageSender& SenderRegistry::Get(const std::string& channel) const {
    auto it = senders_.find(channel);
    if (it == senders_.end()) {
        throw std::runtime_error("Unknown channel: " + channel);
    }
    return *(it->second);
}

} // namespace communicationservice::sender
