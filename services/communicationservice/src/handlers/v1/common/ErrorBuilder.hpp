#pragma once

#include <schemas/api/v1/components/schemas.hpp>
#include <schemas/api/v1/components/errors.hpp>

#include <userver/server/handlers/exceptions.hpp>

namespace dto = communicationservice::dto;

using ::communicationservice::dto::ChannelType;
using userver::formats::json::ValueBuilder;
using userver::server::http::HttpStatus;

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

