#pragma once

#include "ErrorBuilder.hpp"

#include <schemas/api/v1/components/schemas.hpp>
#include <schemas/api/v1/components/errors.hpp>

#include <userver/server/handlers/exceptions.hpp>


inline auto channelTypeEnumToString(const std::optional<ChannelType>& channel_opt) -> std::optional<std::string> {
    if (!channel_opt.has_value()) {
        return std::nullopt;
    }
    
    const auto& channel = channel_opt.value();
    switch (channel) {
        case (ChannelType::kAuraConnect) : {
            return "aura_connect";
        }
        case (ChannelType::kSms) : {
            return "sms";
        }
        case (ChannelType::kTelegram) : {
            return "telegram";
        }
        case (ChannelType::kMail) : {
            return "mail";
        }
        default : {
            throw userver::server::handlers::InternalServerError(
                ErrorBuilder{dto::ErrorCode::kInternalError, "Internal Server Error"});
        }
    }
}

