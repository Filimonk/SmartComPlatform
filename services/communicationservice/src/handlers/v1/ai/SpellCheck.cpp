#include "SpellCheck.hpp"
#include "../common/ErrorBuilder.hpp"

#include <userver/components/component_context.hpp>
#include <userver/server/handlers/http_handler_json_base.hpp>

#include <userver/clients/http/client.hpp>
#include <userver/clients/http/component.hpp>

#include <userver/storages/postgres/cluster.hpp>
#include <userver/storages/postgres/component.hpp>

#include <communicationservice/sql_queries.hpp>
#include <schemas/api/v1/components/errors.hpp>
#include <schemas/api/v1/components/schemas.hpp>

#include <userver/formats/json/exception.hpp>
#include <userver/server/handlers/exceptions.hpp>
#include <userver/storages/postgres/exceptions.hpp>

#include <userver/utils/boost_uuid4.hpp>
#include <userver/engine/sleep.hpp>

namespace communicationservice::handlers::v1 {

SpellCheck::SpellCheck(const userver::components::ComponentConfig& config,
                       const userver::components::ComponentContext& component_context)
    : WebsocketHandlerBase(config, component_context),
      rand_gen_{static_cast<std::mt19937::result_type>(
          std::chrono::steady_clock::now().time_since_epoch().count())},
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto SpellCheck::Handle(userver::server::websocket::WebSocketConnection& chat,
                        userver::server::request::RequestContext& /*context*/) const -> void {

    userver::server::websocket::Message message;

    try {
        chat.Recv(message);
    } catch (const userver::engine::io::IoCancelled& e) {
        throw userver::server::handlers::ClientError(
            ErrorBuilder{dto::ErrorCode::kWebsocketConnectionCancelled,
                         "Websocket error when invocation the recive method"});
    }

    if (message.close_status) {
        chat.Close(*message.close_status);
    }

    //////////////////////// chat.Send(message);

    try {
        const auto& message_json = userver::formats::json::FromString(message.data);
        const auto& request_dto = message_json.As<dto::SpellCheckRequest>();

        const auto& auth_field = request_dto.Authorization;
        if (auth_field.empty()) {
            throw userver::server::handlers::Unauthorized(
                ErrorBuilder{dto::ErrorCode::kMissingAuthorizationTokenHeader,
                             "Authorization token field shouldn't be empty"});
        }

        const auto& auth_response = http_client_.CreateRequest()
                                        .get()
                                        .url("http://authservice:8080/verify/")
                                        .headers({{"Authorization", auth_field}})
                                        .timeout(std::chrono::seconds(2))
                                        .perform();
        LOG_INFO() << "authservice complited successfully";

        if (auth_response->status_code() != HttpStatus::kOk) {
            throw userver::server::handlers::Unauthorized(
                ErrorBuilder{dto::ErrorCode::kInvalidAuthorizationToken,
                             "Authorization token is invalid or expired"});
        }

        const auto text = request_dto.text;
        if (text.empty()) {
            throw userver::server::handlers::RequestParseError(ErrorBuilder{
                dto::ErrorCode::kInvalidRequestFormat, "Text field shouldn't be empty"});
        }

        const auto& json_body = userver::formats::json::FromString(auth_response->body());
        const auto& user_id = json_body["user_id"].As<int>();

        const auto& result =
            pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                 communicationservice::sql::kGetAiSpellingcheckerSettings, user_id);
        LOG_INFO() << "pg succeed";

        if (result.IsEmpty()) {
            throw userver::server::handlers::ResourceNotFound(
                ErrorBuilder{dto::ErrorCode::kResourceNotFound,
                             "Resource Not Found. This user don't have such contact"});
        }

        auto row = result[0];

        auto checker_url = row["ai_spellchecker_url"].As<std::string>();
        auto checker_timeout = row["ai_spellchecker_timeout"].As<std::chrono::seconds>();
        auto checker_instruction = row["ai_spellchecker_instruction"].As<std::string>();

        ValueBuilder checker_request_json_builder{};

        auto query_key = std::to_string(user_id) + "_" + std::to_string(rand_gen_());

        checker_request_json_builder["instruction"] = checker_instruction;
        checker_request_json_builder["text"] = text;
        checker_request_json_builder["key"] = query_key;
        
        auto start_time = std::chrono::steady_clock::now();
        auto end_time = start_time + checker_timeout;

        const auto& checker_response =
            http_client_.CreateRequest()
                .post()
                .url(checker_url)
                .headers({{"Content-Type", "application/json"}})
                .data(ToString(checker_request_json_builder.ExtractValue()))
                .timeout(checker_timeout)
                .perform();
        LOG_INFO() << "checker 'post' succeed";
        
        if (checker_response->status_code() != HttpStatus::kOk) {
            throw userver::server::handlers::ResourceNotFound(
                ErrorBuilder{dto::ErrorCode::kResourceNotFound,
                             "Resource Not Found. Couldn't connect to checker"});
        }

        while (true) {
            const auto& checker_response =
                http_client_.CreateRequest()
                    .get()
                    .url(checker_url + "/" + query_key)
                    .headers({{"Content-Type", "application/json"}})
                    .timeout(checker_timeout)
                    .perform();
            LOG_INFO() << "checker 'get' succeed";

            if (checker_response->status_code() == HttpStatus::kOk) {
                chat.Send(userver::server::websocket::Message{.data = checker_response->body()});
                chat.Close(userver::server::websocket::CloseStatus::kNormal);
                break;
            }
            LOG_INFO() << "checker hasn't ended to proccess the text";
            
            if (std::chrono::steady_clock::now() > end_time) {
                throw userver::server::handlers::ResourceNotFound(
                    ErrorBuilder{dto::ErrorCode::kResourceNotFound,
                                 "Resource Not Found. Timeout exceeded"});
            }
            
            userver::engine::SleepFor(std::chrono::seconds(2));
        }

    } catch (const userver::formats::json::Exception& e) {
        throw userver::server::handlers::RequestParseError(
            ErrorBuilder{dto::ErrorCode::kInvalidRequestFormat, "Invalid JSON format"});
    } catch (const userver::storages::postgres::ForeignKeyViolation& e) {
        throw userver::server::handlers::ClientError(
            ErrorBuilder{dto::ErrorCode::kForeignKeyViolation, "Foreign key violation"});
    }
}

} // namespace communicationservice::handlers::v1
