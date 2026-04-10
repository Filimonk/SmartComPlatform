#include "EmailSender.hpp"

#include <communicationservice/sql_queries.hpp>

#include <mailio/message.hpp>
#include <mailio/smtp.hpp>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::sender {

EmailSender::EmailSender(userver::storages::postgres::ClusterPtr& pg_cluster)
    : pg_cluster_(pg_cluster) {}

auto EmailSender::Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult {
    try {
        // === origin ===
        const auto origin = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetOrigin,
            ctx.originConnectionId);

        const auto smtp_server =
            origin[0]["email_server_address"].As<std::optional<std::string>>();

        const auto api_key =
            origin[0]["api_key"].As<std::optional<std::string>>();

        if (!smtp_server.has_value() || !api_key.has_value()) {
            return {false, "SMTP config missing"};
        }

        // === origin_connection (sender email) ===
        const auto origin_connection = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetOriginConnection,
            ctx.originConnectionId);

        const auto from_email =
            origin_connection[0]["mail_address"].As<std::optional<std::string>>();

        if (!from_email.has_value()) {
            return {false, "sender email is empty"};
        }

        // === connection (recipient) ===
        const auto connection = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetConnection,
            ctx.connectionId);

        const auto to_email =
            connection[0]["mail_address"].As<std::optional<std::string>>();

        if (!to_email.has_value()) {
            return {false, "recipient email is empty"};
        }

        // === формируем письмо ===
        mailio::message msg;

        msg.from(mailio::mail_address("", from_email.value()));
        msg.add_recipient(mailio::mail_address("", to_email.value()));
        msg.subject("AuraConnect message");
        msg.content(ctx.text);

        // === SMTP клиент ===
        // пример для mail.ru:
        // smtp.mail.ru:465 (SSL)
        mailio::smtps conn(
            smtp_server.value(),  // например: smtp.mail.ru
            465                   // можно вынести в конфиг
        );

        conn.authenticate(from_email.value(), api_key.value(), mailio::smtps::auth_method_t::LOGIN);

        conn.submit(msg);

        return {true, ""};

    } catch (const std::exception& e) {
        return {false, e.what()};
    }
}

} // namespace communicationservice::sender
