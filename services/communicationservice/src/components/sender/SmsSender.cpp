#include "SmsSender.hpp"

#include <userver/formats/json/value_builder.hpp>
#include <userver/formats/json/serialize.hpp>

namespace communicationservice::sender {

SmsSender::SmsSender(userver::clients::http::Client& client)
    : http_client_(client) {}

SendResult SmsSender::Send(const SendContext& ctx) const {
    userver::formats::json::ValueBuilder body;

    body["number"] = ctx.origin;
    body["destination"] = ctx.destination;
    body["text"] = ctx.text;

    auto response =
        http_client_.CreateRequest()
            .post("https://api.exolve.ru/messaging/v1/SendSMS")
            .headers({
                {"Authorization", "Bearer YOUR_TOKEN"},
                {"Content-Type", "application/json"}
            })
            .data(userver::formats::json::ToString(body.ExtractValue()))
            .timeout(std::chrono::seconds{5})
            .perform();

    if (response->status_code() != 200) {
        return {false, "", response->body()};
    }

    return {true, "", ""};
}

} // namespace communicationservice::sender
