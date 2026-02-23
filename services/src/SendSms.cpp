#include <SendSms.hpp>
#include <userver/clients/http/component.hpp>
#include <userver/components/component_context.hpp>

namespace communication {

SendSms::SendSms(const userver::components::ComponentConfig& config,
                 const userver::components::ComponentContext& context)
    : HttpHandlerBase(config, context),
      http_client_(context.FindComponent<userver::components::HttpClient>().GetHttpClient()) {}

auto SendSms::HandleRequestThrow(const userver::server::http::HttpRequest& request,
                                 userver::server::request::RequestContext& /*context*/) const
    -> std::string {
    const auto& text = request.GetArg("text");

    if (text.empty()) {
        throw userver::server::handlers::ClientError(
            userver::server::handlers::ExternalBody{"text is required"});
    }

    userver::formats::json::ValueBuilder body;
    body["number"] = "79926694706";
    body["destination"] = "79153049118";
    body["text"] = text;

    auto response =
        http_client_.CreateRequest()
            .post("https://api.exolve.ru/messaging/v1/SendSMS")
            .headers({{"Authorization", "Bearer eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRV05sMENiTXY1SHZSV29CVUpkWjVNQURXSFVDS0NWODRlNGMzbEQtVHA0In0.eyJleHAiOjIwODY3MzIwMTQsImlhdCI6MTc3MTM3MjAxNCwianRpIjoiNDE2OGMxODQtODdhYS00YzE2LWJiYjAtMjc4Y2VjNDE2ODc5IiwiaXNzIjoiaHR0cHM6Ly9zc28uZXhvbHZlLnJ1L3JlYWxtcy9FeG9sdmUiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiMTdlYzdhZDgtNGU0Ni00NTJiLTliYjItN2I5YzI0ZjQzOGUwIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiZGUwZWE1NTktZTQxOS00ODUzLTlmNDMtYmU4YzE0YjVmMzBlIiwic2Vzc2lvbl9zdGF0ZSI6ImZmYTY2ZWI0LTQ4OWYtNDdjMS1hNmEzLWZjM2MwNGU5YTQ3ZCIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsiZGVmYXVsdC1yb2xlcy1leG9sdmUiLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIl19LCJyZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1hbmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJleG9sdmVfYXBwIHByb2ZpbGUgZW1haWwiLCJzaWQiOiJmZmE2NmViNC00ODlmLTQ3YzEtYTZhMy1mYzNjMDRlOWE0N2QiLCJ1c2VyX3V1aWQiOiI3ZTQ5ZmYyNS1lZWRlLTRjNzktODNhNC0wNmVmZDViM2ZjZWMiLCJjbGllbnRJZCI6ImRlMGVhNTU5LWU0MTktNDg1My05ZjQzLWJlOGMxNGI1ZjMwZSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiY2xpZW50SG9zdCI6IjE3Mi4xNi4xNjEuMTkiLCJhcGlfa2V5Ijp0cnVlLCJhcGlmb25pY2Ffc2lkIjoiZGUwZWE1NTktZTQxOS00ODUzLTlmNDMtYmU4YzE0YjVmMzBlIiwiYmlsbGluZ19udW1iZXIiOiIxMzU3MzI5IiwiYXBpZm9uaWNhX3Rva2VuIjoiYXV0MWRlMjhhZmItNTRlMy00NzZiLWFkZGUtNTdiMDBjMzQ1OTA1IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic2VydmljZS1hY2NvdW50LWRlMGVhNTU5LWU0MTktNDg1My05ZjQzLWJlOGMxNGI1ZjMwZSIsImN1c3RvbWVyX2lkIjoiMTU1NTIzIiwiY2xpZW50QWRkcmVzcyI6IjE3Mi4xNi4xNjEuMTkifQ.c4nd7uaCWAmuZ9cIjsObqJAaPvMOpmYbG5iTC65EKrP7g3QvSI-YX0CJdiqwDyylT7KHSH55oljMxKpRRugKDko1h7CdrK-gIYm1uDJlFYh8yv2I8potU6Fv1bzbR91cj4T23aDGPp2JZ8KH4UBtVo2DDYD0PbuhHFj8Kznccofz1wq-_FdOZHUztYrnFpyBlScRGXZWpz7bFwPgFG3Jrt3-ufrrzCg_1mfy6AC8G1PAUzDO9i8Syoc9gDr1S17EsHEkFEN2MBwsPyxNk2qiUxJIy_nRdgCQchM4J3V7QqgaKG5HXm_GvtFd6CFFr5PT9GRQeC8e8CNfHWFG_dUaJw"},
                      {"Content-Type", "application/json"}})
            .data(userver::formats::json::ToString(body.ExtractValue()))
            .timeout(std::chrono::seconds{5})
            .perform();

    if (response->status_code() != 200) {
        throw userver::server::handlers::InternalServerError(
            userver::server::handlers::ExternalBody{"Exolve error: " + response->body()});
    }

    return response->body();
}

} // namespace communication
