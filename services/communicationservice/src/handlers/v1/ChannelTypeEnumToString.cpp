#include "ChannelTypeEnumToString.hpp"

#include <schemas/api/v1/components/schemas.hpp>
#include <schemas/api/v1/components/errors.hpp>

#include <userver/server/handlers/exceptions.hpp>

namespace {

namespace dto = communicationservice::dto;

using ::communicationservice::dto::ChannelType;
using userver::formats::json::ValueBuilder;

class ErrorBuilder {
  public:
    static constexpr bool kIsExternalBodyFormatted = true;

    ErrorBuilder(const dto::ErrorCode& code, const std::string& message) {
        dto::ErrorResponse error{.code = code, .message = message};

        const auto& error_json = ValueBuilder{error}.ExtractValue();

        json_error_body_ = userver::formats::json::ToString(error_json);
    }

    [[nodiscard]] auto GetExternalBody() const -> std::string {
        return json_error_body_;
    }

  private:
    std::string json_error_body_;
};

} // namespace


auto channelTypeEnumToString(ChannelType channel) -> std::string {
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

