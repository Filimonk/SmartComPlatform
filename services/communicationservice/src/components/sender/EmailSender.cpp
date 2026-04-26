#include "EmailSender.hpp"

#include <communicationservice/sql_queries.hpp>

#include <curl/curl.h>

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::sender {

namespace {

// структура для передачи данных письма в curl
struct UploadStatus {
    size_t bytes_read = 0;
    std::string payload;
};

// callback для чтения данных письма
size_t PayloadSource(char* ptr, size_t size, size_t nmemb, void* userp) {
    auto* upload = static_cast<UploadStatus*>(userp);
    size_t buffer_size = size * nmemb;

    if (upload->bytes_read >= upload->payload.size()) {
        return 0;
    }

    size_t to_copy = std::min(buffer_size, upload->payload.size() - upload->bytes_read);
    memcpy(ptr, upload->payload.c_str() + upload->bytes_read, to_copy);
    upload->bytes_read += to_copy;

    return to_copy;
}

} // namespace

EmailSender::EmailSender(userver::storages::postgres::ClusterPtr& pg_cluster)
    : pg_cluster_(pg_cluster) {}

auto EmailSender::Send(const communicationservice::dto::MessageJob& ctx) const -> SendResult {
    LOG_INFO() << "Start processing email message";

    try {
        // --- origin
        const auto origin = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetOriginByOriginConnectionId,
            ctx.originConnectionId);

        const auto smtp_server = origin[0]["email_server_address"].As<std::string>();
        const auto password = origin[0]["api_key"].As<std::string>();

        // --- origin_connection (from)
        const auto origin_connection = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetOriginConnection,
            ctx.originConnectionId);

        const auto from_email =
            origin_connection[0]["mail_address"].As<std::optional<std::string>>();

        // --- connection (to)
        const auto connection = pg_cluster_->Execute(
            ClusterHostType::kMaster,
            communicationservice::sql::kGetConnection,
            ctx.connectionId);

        const auto to_email =
            connection[0]["mail_address"].As<std::optional<std::string>>();

        if (!from_email || from_email->empty()) {
            return {false, "from email is empty"};
        }

        if (!to_email || to_email->empty()) {
            return {false, "to email is empty"};
        }

        LOG_INFO() << "Email: " << from_email.value() << " -> " << to_email.value();

        // --- формируем MIME письмо
        std::string payload =
            "To: " + to_email.value() + "\r\n"
            "From: " + from_email.value() + "\r\n"
            "Subject: Notification\r\n"
            "\r\n" +
            ctx.text + "\r\n";

        UploadStatus upload;
        upload.payload = payload;

        CURL* curl = curl_easy_init();
        if (!curl) {
            LOG_WARNING() << "curl init failed";
            return {false, "curl init failed"};
        }
        
        LOG_INFO() << "curl init successful";

        struct curl_slist* recipients = nullptr;

        LOG_INFO() << "SMTP SERVER RAW: [" << smtp_server << "]";
        // std::string url = "smtps://smtp.mail.ru:465";
        std::string url = "smtps://" + smtp_server + ":465";

        curl_easy_setopt(curl, CURLOPT_URL, url.c_str());
        curl_easy_setopt(curl, CURLOPT_USERNAME, from_email->c_str());
        curl_easy_setopt(curl, CURLOPT_PASSWORD, password.c_str());
        
        LOG_INFO() << "curl setopt url, username, password successful";
        LOG_INFO() << "url: " << url;
        LOG_INFO() << "username: " << from_email->c_str();
        LOG_INFO() << "password: " << password;

        curl_easy_setopt(curl, CURLOPT_USE_SSL, (long)CURLUSESSL_ALL);

        curl_easy_setopt(curl, CURLOPT_MAIL_FROM, from_email->c_str());

        recipients = curl_slist_append(recipients, to_email->c_str());
        curl_easy_setopt(curl, CURLOPT_MAIL_RCPT, recipients);
        
        LOG_INFO() << "curl setopt mail_from, mail_rcpt successful";
        LOG_INFO() << "mail_from: " << from_email->c_str();
        LOG_INFO() << "mail_rcpt: " << to_email->c_str();

        curl_easy_setopt(curl, CURLOPT_READFUNCTION, PayloadSource);
        curl_easy_setopt(curl, CURLOPT_READDATA, &upload);
        curl_easy_setopt(curl, CURLOPT_UPLOAD, 1L);
        
        LOG_INFO() << "curl setopt readfunction, readdata, upload successful";

        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

        // полезно для отладки
        // curl_easy_setopt(curl, CURLOPT_VERBOSE, 1L);

        LOG_INFO() << "Connecting to SMTP...";

        CURLcode res = curl_easy_perform(curl);

        if (res != CURLE_OK) {
            std::string err = curl_easy_strerror(res);
            LOG_WARNING() << "Email send failed: " << err;

            curl_slist_free_all(recipients);
            curl_easy_cleanup(curl);

            return {false, err};
        }

        curl_slist_free_all(recipients);
        curl_easy_cleanup(curl);

        LOG_INFO() << "Email sent successfully";

        return {true, ""};

    } catch (const std::exception& ex) {
        return {false, ex.what()};
    }
}

} // namespace communicationservice::sender
