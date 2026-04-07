#include "MessageDispatcher.hpp"

#include <userver/components/component_context.hpp>

#include <userver/clients/http/component.hpp>
#include <userver/storages/postgres/component.hpp>

#include <communicationservice/sql_queries.hpp>

#include <userver/utils/boost_uuid4.hpp>

namespace communicationservice::components {

using userver::storages::postgres::ClusterHostType;

MessageDispatcher::MessageDispatcher(const userver::components::ComponentConfig& config,
                             const userver::components::ComponentContext& context)
    : LoggableComponentBase(config, context),
      pg_cluster_(context.FindComponent<userver::components::Postgres>("postgres-db").GetCluster()),
      http_client_(context.FindComponent<userver::components::HttpClient>().GetHttpClient()) {

    std::chrono::seconds period{3};
    userver::utils::PeriodicTask::Settings settings(period);

    task_.Start("message-dispatcher-task", settings, [this] { DoWork(); });
}

void MessageDispatcher::DoWork() {
    const auto result =
        pg_cluster_->Execute(ClusterHostType::kMaster, communicationservice::sql::kGetPendingJobs);

    for (const auto& row : result) {

        const auto job_id = row["id"].As<boost::uuids::uuid>();
        [[maybe_unused]] const auto user_id = row["user_id"].As<int>();
        const auto contact_id = row["contact_id"].As<boost::uuids::uuid>();
        const auto channel = row["channel"].As<std::string>();
        const auto text = row["text"].As<std::string>();

        const auto identifier_res = pg_cluster_->Execute(
            ClusterHostType::kMaster, communicationservice::sql::kGetIdentifierByContactAndChannel,
            contact_id, channel);

        if (identifier_res.IsEmpty()) {
            pg_cluster_->Execute(ClusterHostType::kMaster,
                                 communicationservice::sql::kUpdateJobStatus, job_id, "failed");
            continue;
        }

        const auto phone = identifier_res[0]["phone_number"].As<std::string>();

        userver::formats::json::ValueBuilder body;
        body["number"] = "79926694706";
        body["destination"] = phone;
        body["text"] = text;

        auto response =
            http_client_.CreateRequest()
                .post("https://api.exolve.ru/messaging/v1/SendSMS")
                .headers(
                    {{"Authorization",
                      "Bearer "
                      "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJRV05sMENiTXY1SHZSV29CVUpk"
                      "WjVNQURXSFVDS0NWODRlNGMzbEQtVHA0In0."
                      "eyJleHAiOjIwODY3MzIwMTQsImlhdCI6MTc3MTM3MjAxNCwianRpIjoiNDE2OGMxODQtODdhYS00"
                      "YzE2LWJiYjAtMjc4Y2VjNDE2ODc5IiwiaXNzIjoiaHR0cHM6Ly9zc28uZXhvbHZlLnJ1L3JlYWxt"
                      "cy9FeG9sdmUiLCJhdWQiOiJhY2NvdW50Iiwic3ViIjoiMTdlYzdhZDgtNGU0Ni00NTJiLTliYjIt"
                      "N2I5YzI0ZjQzOGUwIiwidHlwIjoiQmVhcmVyIiwiYXpwIjoiZGUwZWE1NTktZTQxOS00ODUzLTlm"
                      "NDMtYmU4YzE0YjVmMzBlIiwic2Vzc2lvbl9zdGF0ZSI6ImZmYTY2ZWI0LTQ4OWYtNDdjMS1hNmEz"
                      "LWZjM2MwNGU5YTQ3ZCIsImFjciI6IjEiLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsiZGVmYXVs"
                      "dC1yb2xlcy1leG9sdmUiLCJvZmZsaW5lX2FjY2VzcyIsInVtYV9hdXRob3JpemF0aW9uIl19LCJy"
                      "ZXNvdXJjZV9hY2Nlc3MiOnsiYWNjb3VudCI6eyJyb2xlcyI6WyJtYW5hZ2UtYWNjb3VudCIsIm1h"
                      "bmFnZS1hY2NvdW50LWxpbmtzIiwidmlldy1wcm9maWxlIl19fSwic2NvcGUiOiJleG9sdmVfYXBw"
                      "IHByb2ZpbGUgZW1haWwiLCJzaWQiOiJmZmE2NmViNC00ODlmLTQ3YzEtYTZhMy1mYzNjMDRlOWE0"
                      "N2QiLCJ1c2VyX3V1aWQiOiI3ZTQ5ZmYyNS1lZWRlLTRjNzktODNhNC0wNmVmZDViM2ZjZWMiLCJj"
                      "bGllbnRJZCI6ImRlMGVhNTU5LWU0MTktNDg1My05ZjQzLWJlOGMxNGI1ZjMwZSIsImVtYWlsX3Zl"
                      "cmlmaWVkIjpmYWxzZSwiY2xpZW50SG9zdCI6IjE3Mi4xNi4xNjEuMTkiLCJhcGlfa2V5Ijp0cnVl"
                      "LCJhcGlmb25pY2Ffc2lkIjoiZGUwZWE1NTktZTQxOS00ODUzLTlmNDMtYmU4YzE0YjVmMzBlIiwi"
                      "YmlsbGluZ19udW1iZXIiOiIxMzU3MzI5IiwiYXBpZm9uaWNhX3Rva2VuIjoiYXV0MWRlMjhhZmIt"
                      "NTRlMy00NzZiLWFkZGUtNTdiMDBjMzQ1OTA1IiwicHJlZmVycmVkX3VzZXJuYW1lIjoic2Vydmlj"
                      "ZS1hY2NvdW50LWRlMGVhNTU5LWU0MTktNDg1My05ZjQzLWJlOGMxNGI1ZjMwZSIsImN1c3RvbWVy"
                      "X2lkIjoiMTU1NTIzIiwiY2xpZW50QWRkcmVzcyI6IjE3Mi4xNi4xNjEuMTkifQ."
                      "c4nd7uaCWAmuZ9cIjsObqJAaPvMOpmYbG5iTC65EKrP7g3QvSI-"
                      "YX0CJdiqwDyylT7KHSH55oljMxKpRRugKDko1h7CdrK-"
                      "gIYm1uDJlFYh8yv2I8potU6Fv1bzbR91cj4T23aDGPp2JZ8KH4UBtVo2DDYD0PbuhHFj8Kznccof"
                      "z1wq-_FdOZHUztYrnFpyBlScRGXZWpz7bFwPgFG3Jrt3-ufrrzCg_"
                      "1mfy6AC8G1PAUzDO9i8Syoc9gDr1S17EsHEkFEN2MBwsPyxNk2qiUxJIy_"
                      "nRdgCQchM4J3V7QqgaKG5HXm_GvtFd6CFFr5PT9GRQeC8e8CNfHWFG_dUaJw"},
                     {"Content-Type", "application/json"}})
                .data(userver::formats::json::ToString(body.ExtractValue()))
                .timeout(std::chrono::seconds{5})
                .perform();

        if (response->status_code() != 200) {
            pg_cluster_->Execute(ClusterHostType::kMaster,
                                 communicationservice::sql::kUpdateJobStatus, job_id, "failed");
            continue;
        }

        pg_cluster_->Execute(ClusterHostType::kMaster, communicationservice::sql::kUpdateJobStatus,
                             job_id, "sent");
    }
}

} // namespace communicationservice::components
