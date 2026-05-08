#include "TaskPropose.hpp"
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

#include <userver/engine/sleep.hpp>
#include <userver/storages/postgres/io/chrono.hpp>
#include <userver/utils/async.hpp>
#include <userver/utils/boost_uuid4.hpp>

#include <userver/formats/json/serialize_container.hpp>

namespace {

auto sanitizeText(const std::string& input) -> std::string {
    std::string output;
    output.reserve(input.size());
    for (unsigned char c : input) {
        if (c <= 31 || c == 127) {
            output += ' ';
        } else {
            output += c;
        }
    }
    
    return output;
}

} // namespace

namespace communicationservice::handlers::v1 {

TaskPropose::TaskPropose(const userver::components::ComponentConfig& config,
                         const userver::components::ComponentContext& component_context)
    : WebsocketHandlerBase(config, component_context),
      rand_gen_{static_cast<std::mt19937::result_type>(
          std::chrono::steady_clock::now().time_since_epoch().count())},
      http_client_(
          component_context.FindComponent<userver::components::HttpClient>().GetHttpClient()),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db")
                      .GetCluster()) {}

auto TaskPropose::HandleHandshake(const userver::server::http::HttpRequest& request,
                                  userver::server::http::HttpResponse& /*response*/,
                                  userver::server::request::RequestContext& context) const -> bool {
    try {
        const auto& auth_header = request.GetHeader("Authorization");
        if (auth_header.empty()) {
            LOG_WARNING() << "Authorization token header shouldn't be empty";
            return false;
        }

        const auto& auth_response = http_client_.CreateRequest()
                                        .get()
                                        .url("http://authservice:8080/verify/")
                                        .headers({{"Authorization", auth_header}})
                                        .timeout(std::chrono::seconds(2))
                                        .perform();
        LOG_INFO() << "authservice complited successfully";

        if (auth_response->status_code() != HttpStatus::kOk) {
            LOG_WARNING() << "Authorization token is invalid or expired";
            return false;
        }

        const auto& json_body = userver::formats::json::FromString(auth_response->body());
        const auto& user_id = json_body["user_id"].As<int>();
        context.SetData("user_id", user_id);

        try {
            auto contact_id = userver::utils::BoostUuidFromString(request.GetPathArg("contactId"));
            context.SetData("contact_id", contact_id);
        } catch (const std::exception& e) {
            LOG_WARNING() << "Invalid contactId";
            return false;
        }

        return true;

    } catch (const userver::formats::json::Exception& e) {
        throw userver::server::handlers::RequestParseError(
            ErrorBuilder{dto::ErrorCode::kInvalidRequestFormat, "Invalid JSON format"});
    }
}

auto TaskPropose::Handle(userver::server::websocket::WebSocketConnection& chat,
                         userver::server::request::RequestContext& context) const -> void {
    LOG_INFO() << "TaskPropose started";

    auto send_propose = userver::utils::Async("send_propose", [&chat, this, &context]() {
        LOG_INFO() << "send_propose: send_propose started";

        const auto task_propose_period = std::chrono::seconds(5);
        const auto user_id = context.GetData<int>("user_id");
        const auto contact_id = context.GetData<boost::uuids::uuid>("contact_id");

        LOG_INFO() << "send_propose: user_id: " << user_id << ", contact_id: " << contact_id;

        while (true) {
            LOG_INFO() << "send_propose: while started";

            auto get_last_unpocessed_messages =
                pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                     sql::kGetLastUnprocessedMessages, user_id, contact_id);

            LOG_INFO() << "send_propose: get_last_unpocessed_messages: "
                       << get_last_unpocessed_messages.Size();

            if (!get_last_unpocessed_messages.IsEmpty()) {
                LOG_INFO() << "send_propose: get_last_unpocessed_messages is not empty";

                dto::MessageQueue message_queue;

                for (const auto& message_row : get_last_unpocessed_messages) {
                    LOG_INFO() << "send_propose: message_row";
                    dto::Message message;

                    LOG_INFO() << "send_propose: id parse";
                    message.id = message_row["id"].As<boost::uuids::uuid>();
                    LOG_INFO() << "send_propose: text parse";
                    message.text = message_row["text"].As<std::string>();
                    LOG_INFO() << "send_propose: created_at parse";
                    message.createdAt = userver::utils::datetime::TimePointTz{
                        message_row["created_at"].As<userver::storages::postgres::TimePointTz>()};

                    LOG_INFO() << "send_propose: push_back";
                    message_queue.push_back(message);
                    LOG_INFO() << "send_propose: push_back done";
                }

                LOG_INFO() << "send_propose: message_queue size: " << message_queue.size();

                auto proposer_settings =
                    pg_cluster_->Execute(userver::storages::postgres::ClusterHostType::kMaster,
                                         sql::kGetAiTaskproposerSettings, user_id);

                LOG_INFO() << "send_propose: proposer_settings size: " << proposer_settings.Size();

                if (proposer_settings.IsEmpty()) {
                    throw userver::server::handlers::ResourceNotFound(
                        ErrorBuilder{dto::ErrorCode::kResourceNotFound,
                                     "Resource Not Found. This user don't have such contact"});
                }

                auto proposer_url = proposer_settings[0]["ai_taskproposer_url"].As<std::string>();
                auto proposer_timeout =
                    proposer_settings[0]["ai_taskproposer_timeout"].As<std::chrono::seconds>();
                auto proposer_instruction =
                    proposer_settings[0]["ai_taskproposer_instruction"].As<std::string>();
                
                LOG_INFO() << "send_propose: proposer_url: " << proposer_url;
                LOG_INFO() << "send_propose: proposer_timeout: " << proposer_timeout.count();
                LOG_INFO() << "send_propose: proposer_instruction: " << proposer_instruction;

                ValueBuilder proposer_request_json_builder{};

                auto query_key = std::to_string(user_id) + "_" + std::to_string(rand_gen_());

                std::string conversation_text;
                for (const auto& msg : message_queue) {
                    conversation_text += msg.text + "; ";
                }

                proposer_request_json_builder["instruction"] = sanitizeText(proposer_instruction);
                proposer_request_json_builder["text"] = sanitizeText(conversation_text);
                proposer_request_json_builder["key"] = query_key;
                
                std::string proposer_request_body = ToString(proposer_request_json_builder.ExtractValue());

                LOG_INFO() << "send_propose: proposer_request_json: "
                           << proposer_request_body;
                
                auto start_time = std::chrono::steady_clock::now();
                auto end_time = start_time + proposer_timeout;

                const auto& proposer_create_task_response =
                    http_client_.CreateRequest()
                        .post()
                        .url(proposer_url)
                        .headers({{"Content-Type", "application/json"}})
                        .data(proposer_request_body)
                        .timeout(proposer_timeout)
                        .perform();
                LOG_INFO() << "send_propose: proposer 'post' succeed";


                LOG_INFO() << "send_propose: hardcoded request done, status="
                           << proposer_create_task_response->status_code() << ", body=" << proposer_create_task_response->body();

                if (proposer_create_task_response->status_code() != HttpStatus::kOk) {
                    LOG_ERROR() << "Proposer failed: status="
                                << proposer_create_task_response->status_code()
                                << ", body=" << proposer_create_task_response->body();
                } else {
                    while (true) {
                        const auto& proposer_response =
                            http_client_.CreateRequest()
                                .get()
                                .url(proposer_url + "/" + query_key)
                                .headers({{"Content-Type", "application/json"}})
                                .timeout(proposer_timeout)
                                .perform();
                        LOG_INFO() << "proposer 'get' succeed";
                        LOG_INFO()
                            << "send_propose: proposer_response: " << proposer_response->body();

                        if (proposer_response->status_code() == HttpStatus::kOk) {
                            const auto proposer_response_json =
                                userver::formats::json::FromString(proposer_response->body());
                            if (proposer_response_json["isProposed"].As<bool>()) {
                                chat.Send(userver::server::websocket::Message{
                                    .data = proposer_response->body(), .is_text = true});
                            }
                            break;
                        }
                        LOG_INFO() << "proposer hasn't ended to proccess the text";

                        if (std::chrono::steady_clock::now() > end_time) {
                            break;
                        }

                        userver::engine::SleepFor(std::chrono::seconds(2));
                    }
                }
            }

            userver::engine::SleepFor(std::chrono::seconds(task_propose_period));
        }
    });

    LOG_INFO() << "Propose task was started";

    auto reader = userver::utils::Async("ws_reader", [&chat]() {
        try {
            while (!userver::engine::current_task::ShouldCancel()) {
                userver::server::websocket::Message message;
                chat.Recv(message);
                if (message.close_status) {
                    break;
                }
            }
        } catch (const std::exception& e) {
            LOG_WARNING() << "Reader task exception: " << e;
        }
    });

    LOG_INFO() << "Propose and reader tasks started";

    constexpr std::size_t max_lost_pings = 3;
    while (!userver::engine::current_task::ShouldCancel() && !send_propose.IsFinished()) {
        LOG_INFO() << "Propose task is running";
        chat.SendPing();

        if (chat.NotAnsweredSequentialPingsCount() > max_lost_pings) {
            send_propose.RequestCancel();

            try {
                send_propose.Wait();
            } catch (const userver::engine::TaskCancelledException& e) {
                userver::engine::TaskCancellationReason reason = e.Reason();

                LOG_WARNING() << "load_task was cancelled, reason: "
                              << userver::engine::ToString(reason);
            }

            LOG_INFO() << "Propose task was canceled";
            break;
        }

        userver::engine::InterruptibleSleepFor(std::chrono::seconds(30));
    }
    LOG_INFO() << "send_propose: Propose task was finished";

    reader.RequestCancel();
    try {
        reader.Wait();
    } catch (const std::exception& e) {
        LOG_WARNING() << "Reader task finished with: " << e;
    }

    LOG_INFO() << "TaskPropose finished";
}

} // namespace communicationservice::handlers::v1
