#pragma once

#include <userver/clients/http/client.hpp>
#include <userver/server/handlers/http_handler_base.hpp>

namespace communicationservice {

class SendSms final : public userver::server::handlers::HttpHandlerBase {
  public:
    static constexpr std::string_view kName = "handler-SendSms";

    using HttpHandlerBase::HttpHandlerBase;

    SendSms(const userver::components::ComponentConfig& config,
            const userver::components::ComponentContext& context);

    auto HandleRequestThrow(const userver::server::http::HttpRequest& /*request*/,
                            userver::server::request::RequestContext& /*context*/) const
        -> std::string override;

  private:
    userver::clients::http::Client& http_client_;
};

} // namespace communicationservice
