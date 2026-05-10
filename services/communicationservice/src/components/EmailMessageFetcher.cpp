#include "EmailMessageFetcher.hpp"

#include <userver/clients/http/component.hpp>
#include <userver/components/component_context.hpp>
#include <userver/storages/postgres/component.hpp>

#include <boost/algorithm/string/replace.hpp>

#include <boost/uuid/uuid.hpp>
#include <boost/uuid/uuid_io.hpp>

#include <curl/curl.h>

#include <regex>
#include <sstream>
#include <cstring>        // for strncasecmp
#include <algorithm>      // for std::remove

using userver::storages::postgres::ClusterHostType;

namespace communicationservice::components {

namespace {

size_t WriteCallback(char* ptr, size_t size, size_t nmemb, void* userdata) {
    auto* response = static_cast<std::string*>(userdata);
    const size_t total_size = size * nmemb;
    response->append(ptr, total_size);
    return total_size;
}

// ======== Вспомогательные функции для MIME ========

// Простой декодер base64 (RFC 4648)
std::string Base64Decode(const std::string& input) {
    static const std::string base64_chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
        "abcdefghijklmnopqrstuvwxyz"
        "0123456789+/";
    std::string out;
    int val = 0, valb = -8;
    for (unsigned char c : input) {
        if (c == '=') break;
        if (c == '\r' || c == '\n') continue;
        auto pos = base64_chars.find(c);
        if (pos == std::string::npos) continue;
        val = (val << 6) + pos;
        valb += 6;
        if (valb >= 0) {
            out.push_back(char((val >> valb) & 0xFF));
            valb -= 8;
        }
    }
    return out;
}

// Извлекает значение параметра из строки типа "text/plain; charset=utf-8; boundary=..."
std::string GetParam(const std::string& header_value, const std::string& param) {
    std::string key = param + "=";
    auto pos = header_value.find(key);
    if (pos == std::string::npos) return "";
    pos += key.size();
    if (pos < header_value.size() && header_value[pos] == '"') {
        // quoted-string
        auto end = header_value.find('"', pos + 1);
        if (end != std::string::npos)
            return header_value.substr(pos + 1, end - pos - 1);
    } else {
        auto end = header_value.find_first_of("; \t\r\n", pos);
        return header_value.substr(pos, end - pos);
    }
    return "";
}

// Извлекает основной MIME-тип (до ';')
std::string MimeTypeMain(const std::string& content_type) {
    auto pos = content_type.find(';');
    if (pos != std::string::npos)
        return content_type.substr(0, pos);
    return content_type;
}

// ======== Существующие вспомогательные функции ========

std::string ExtractHeader(const std::string& raw, const std::string& header_name) {
    std::regex rgx(header_name + R"(:\s*(.+))", std::regex_constants::icase);
    std::smatch match;
    if (std::regex_search(raw, match, rgx)) {
        return match[1];
    }
    return "";
}

std::string ExtractBody(const std::string& raw) {
    const auto pos = raw.find("\r\n\r\n");
    if (pos == std::string::npos) {
        return raw;
    }
    return raw.substr(pos + 4);
}

// Вырезает из ответа FETCH тело письма, убирая начальную строку IMAP (и BODY[] {size})
std::string ExtractMessageFromFetchResponse(const std::string& raw) {
    const auto pos = raw.find("BODY[] {");
    if (pos == std::string::npos) {
        // Fallback: просто удаляем всё до первого \r\n
        const auto start = raw.find("\r\n");
        return start != std::string::npos ? raw.substr(start + 2) : raw;
    }
    auto brace = raw.find('}', pos);
    if (brace == std::string::npos)
        return raw;
    // пропускаем '}' и возможный \r\n
    auto msg_start = raw.find_first_not_of("\r\n", brace + 1);
    return msg_start != std::string::npos ? raw.substr(msg_start) : "";
}

// Делит письмо на заголовки и тело по пустой строке
struct MessageParts {
    std::string headers;
    std::string body;
};

MessageParts SplitHeadersAndBody(const std::string& full_msg) {
    constexpr std::string_view delim = "\r\n\r\n";
    MessageParts result;
    const auto pos = full_msg.find(delim);
    if (pos != std::string::npos) {
        result.headers = full_msg.substr(0, pos);
        result.body = full_msg.substr(pos + delim.size());
    } else {
        // попытка \n\n
        const auto pos2 = full_msg.find("\n\n");
        if (pos2 != std::string::npos) {
            result.headers = full_msg.substr(0, pos2);
            result.body = full_msg.substr(pos2 + 2);
        } else {
            result.headers = full_msg;
        }
    }
    return result;
}

// Извлекает значение заголовка (без regex, чувствительность к регистру как в протоколе)
std::string GetHeaderValue(const std::string& headers, const std::string& name) {
    const std::string hdr = name + ':';
    size_t pos = 0;
    std::string value;
    bool found = false;

    while (pos < headers.size()) {
        auto end = headers.find('\n', pos);
        if (end == std::string::npos)
            end = headers.size();
        std::string line = headers.substr(pos, end - pos);
        if (!line.empty() && line.back() == '\r')
            line.pop_back();

        if (!found) {
            // Поиск начала заголовка
            if (line.size() > hdr.size() &&
                strncasecmp(line.c_str(), hdr.c_str(), hdr.size()) == 0) {
                value = line.substr(hdr.size());
                found = true;
            }
        } else {
            // Проверка на folding (продолжение строки)
            if (!line.empty() && (line[0] == ' ' || line[0] == '\t')) {
                // Убираем ведущий пробел и добавляем к значению
                value += ' ' + line.substr(1);
            } else {
                // Заголовок закончился
                break;
            }
        }

        pos = end + 1;
    }

    // Очистка ведущих пробелов
    auto first = value.find_first_not_of(" \t");
    if (first != std::string::npos)
        return value.substr(first);
    return value;
}

} // namespace

EmailMessageFetcher::EmailMessageFetcher(const userver::components::ComponentConfig& config,
                                         const userver::components::ComponentContext& context)
    : LoggableComponentBase(config, context),
      pg_cluster_(
          context.FindComponent<userver::components::Postgres>("postgres-db").GetCluster()) {

    std::chrono::seconds period{10};

    task_.Start("email-fetcher-task", {period}, [this] { DoWork(); });
}

void EmailMessageFetcher::DoWork() {

    try {

        LOG_INFO() << "EMAIL fetcher started";

        const auto origins = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                  R"(
                    SELECT
                        oc.id,
                        oc.mail_address,
                        o.api_key,
                        o.email_server_address
                    FROM communicationservice_schema.origin_connection oc
                    JOIN communicationservice_schema.origin o
                        ON o.id = oc.origin_id
                    WHERE oc.mail_address IS NOT NULL
                      AND o.email_server_address IS NOT NULL
                      AND o.api_key IS NOT NULL
                )");

        LOG_INFO() << "Origins count: " << origins.Size();

        for (const auto& origin_row : origins) {

            try {

                const auto origin_connection_id = origin_row["id"].As<boost::uuids::uuid>();

                const auto email = origin_row["mail_address"].As<std::string>();

                const auto password = origin_row["api_key"].As<std::string>();

                auto smtp_server = origin_row["email_server_address"].As<std::string>();

                LOG_INFO() << "Processing mailbox: " << email;

                boost::replace_first(smtp_server, "smtp.", "imap.");

                const std::string imap_url = "imaps://" + smtp_server + ":993/INBOX";

                LOG_INFO() << "IMAP URL: " << imap_url;

                CURL* curl = curl_easy_init();

                if (!curl) {

                    LOG_WARNING() << "curl init failed";

                    continue;
                }

                std::string response;

                curl_easy_setopt(curl, CURLOPT_USERNAME, email.c_str());

                curl_easy_setopt(curl, CURLOPT_PASSWORD, password.c_str());

                curl_easy_setopt(curl, CURLOPT_URL, imap_url.c_str());

                curl_easy_setopt(curl, CURLOPT_USE_SSL, (long)CURLUSESSL_ALL);

                curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "SEARCH ALL");

                curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);

                curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);

                curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);

                CURLcode res = curl_easy_perform(curl);

                if (res != CURLE_OK) {

                    LOG_WARNING() << "SEARCH failed: " << curl_easy_strerror(res);

                    curl_easy_cleanup(curl);

                    continue;
                }

                curl_easy_cleanup(curl);

                LOG_INFO() << "SEARCH response: " << response;

                std::stringstream ss(response);

                std::string token;

                while (ss >> token) {

                    if (!std::isdigit(token[0])) {
                        continue;
                    }

                    LOG_INFO() << "Fetching mail id: " << token;

                    CURL* fetch_curl = curl_easy_init();

                    if (!fetch_curl) {
                        continue;
                    }

                    std::string fetch_response;

                    const std::string fetch_url = imap_url + "/;MAILINDEX=" + token;

                    curl_easy_setopt(fetch_curl, CURLOPT_USERNAME, email.c_str());

                    curl_easy_setopt(fetch_curl, CURLOPT_PASSWORD, password.c_str());

                    curl_easy_setopt(fetch_curl, CURLOPT_URL, fetch_url.c_str());

                    curl_easy_setopt(fetch_curl, CURLOPT_USE_SSL, (long)CURLUSESSL_ALL);

                    curl_easy_setopt(fetch_curl, CURLOPT_WRITEFUNCTION, WriteCallback);

                    curl_easy_setopt(fetch_curl, CURLOPT_WRITEDATA, &fetch_response);

                    curl_easy_setopt(fetch_curl, CURLOPT_TIMEOUT, 10L);

                    CURLcode fetch_res = curl_easy_perform(fetch_curl);

                    if (fetch_res != CURLE_OK) {

                        LOG_WARNING() << "FETCH failed: " << curl_easy_strerror(fetch_res);

                        curl_easy_cleanup(fetch_curl);

                        continue;
                    }

                    curl_easy_cleanup(fetch_curl);

                    auto full_message = ExtractMessageFromFetchResponse(fetch_response);
                    auto [headers, body] = SplitHeadersAndBody(full_message);

                    // ===== Начинаем обработку MIME =====
                    std::string content_type = GetHeaderValue(headers, "Content-Type");
                    std::string transfer_encoding = GetHeaderValue(headers, "Content-Transfer-Encoding");

                    std::string readable_body;

                    if (content_type.find("multipart/") != std::string::npos) {
                        std::string boundary = GetParam(content_type, "boundary");

                        // fallback: извлекаем boundary из начала тела
                        if (boundary.empty() && body.size() > 2 && body[0] == '-' && body[1] == '-') {
                            auto line_end = body.find("\r\n");
                            if (line_end != std::string::npos) {
                                std::string first_line = body.substr(2, line_end - 2);
                                if (first_line.size() >= 2 && first_line.substr(first_line.size()-2) == "--")
                                    first_line.resize(first_line.size() - 2);
                                boundary = first_line;
                            }
                        }

                        if (!boundary.empty()) {
                            std::string delimiter = "--" + boundary;
                            size_t pos = 0, next;
                            std::vector<std::string> parts;
                            while ((next = body.find(delimiter, pos)) != std::string::npos) {
                                size_t start = next + delimiter.size();
                                // проверка на последнюю границу "--boundary--"
                                if (start + 1 < body.size() && body[start] == '-' && body[start+1] == '-')
                                    break;
                                if (body.compare(start, 2, "\r\n") == 0)
                                    start += 2;
                                size_t end = body.find(delimiter, start);
                                if (end == std::string::npos) break;
                                // удаляем завершающий CRLF перед границей (если есть)
                                size_t part_len = end - start;
                                if (part_len >= 2 && body.compare(end - 2, 2, "\r\n") == 0)
                                    part_len -= 2;
                                std::string part = body.substr(start, part_len);
                                parts.push_back(part);
                                pos = end;
                            }

                            for (const auto& part : parts) {
                                auto part_headers_end = part.find("\r\n\r\n");
                                if (part_headers_end == std::string::npos) continue;
                                std::string part_headers = part.substr(0, part_headers_end);
                                std::string part_body = part.substr(part_headers_end + 4);
                                std::string part_ct = GetHeaderValue(part_headers, "Content-Type");
                                std::string part_te = GetHeaderValue(part_headers, "Content-Transfer-Encoding");

                                if (MimeTypeMain(part_ct) == "text/plain") {
                                    if (part_te == "base64") {
                                        part_body.erase(std::remove(part_body.begin(), part_body.end(), '\r'), part_body.end());
                                        part_body.erase(std::remove(part_body.begin(), part_body.end(), '\n'), part_body.end());
                                        readable_body = Base64Decode(part_body);
                                    } else {
                                        readable_body = part_body;
                                    }
                                    break;
                                }
                            }
                        }
                    }

                    if (readable_body.empty()) {
                        if (transfer_encoding == "base64") {
                            std::string clean_body = body;
                            clean_body.erase(std::remove(clean_body.begin(), clean_body.end(), '\r'), clean_body.end());
                            clean_body.erase(std::remove(clean_body.begin(), clean_body.end(), '\n'), clean_body.end());
                            readable_body = Base64Decode(clean_body);
                        } else {
                            readable_body = body;
                        }
                    }

                    // Теперь readable_body содержит чистый текст письма
                    // ===== Конец обработки MIME =====

                    const auto from = GetHeaderValue(headers, "From");

                    LOG_INFO() << "Mail FROM: " << from;

                    if (from.empty()) {
                        continue;
                    }

                    std::smatch email_match;

                    std::regex email_regex(R"(([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}))");

                    if (!std::regex_search(from, email_match, email_regex)) {

                        LOG_WARNING() << "Cannot extract sender email";

                        continue;
                    }

                    const std::string sender_email = email_match[1];

                    LOG_INFO() << "Sender email: " << sender_email;

                    auto connection = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                           R"(
                                SELECT id
                                FROM communicationservice_schema.connection
                                WHERE mail_address = $1
                                  AND channel = 'mail'
                                LIMIT 1
                            )",
                                                           sender_email);

                    boost::uuids::uuid connection_id;

                    if (connection.IsEmpty()) {

                        LOG_INFO() << "Creating new contact for email";

                        const auto new_contact = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                                      R"(
                                    INSERT INTO communicationservice_schema.contact
                                    (
                                        name
                                    )
                                    VALUES
                                    (
                                        $1
                                    )
                                    RETURNING id
                                )",
                                                                      sender_email);

                        const auto contact_id = new_contact[0]["id"].As<boost::uuids::uuid>();

                        const auto new_connection = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                                         R"(
                                    INSERT INTO communicationservice_schema.connection
                                    (
                                        contact_id,
                                        channel,
                                        mail_address
                                    )
                                    VALUES
                                    (
                                        $1,
                                        'mail',
                                        $2
                                    )
                                    RETURNING id
                                )",
                                                                         contact_id, sender_email);

                        connection_id = new_connection[0]["id"].As<boost::uuids::uuid>();

                        LOG_INFO() << "Created new email connection";

                        const auto origin_id_row = pg_cluster_->Execute(
                            ClusterHostType::kMaster,
                            "SELECT origin_id FROM communicationservice_schema.origin_connection "
                            "WHERE id = $1",
                            origin_connection_id);
                        if (!origin_id_row.IsEmpty()) {
                            const auto origin_id =
                                origin_id_row[0]["origin_id"].As<boost::uuids::uuid>();

                            const auto groups = pg_cluster_->Execute(
                                ClusterHostType::kMaster,
                                "SELECT contact_group_id "
                                "FROM communicationservice_schema.origins_of_group "
                                "WHERE origin_id = $1",
                                origin_id);

                            for (const auto& group_row : groups) {
                                const auto group_id =
                                    group_row["contact_group_id"].As<boost::uuids::uuid>();
                                pg_cluster_->Execute(
                                    ClusterHostType::kMaster,
                                    "INSERT INTO communicationservice_schema.contacts_of_group "
                                    "(contact_group_id, contact_id) "
                                    "VALUES ($1, $2) ON CONFLICT DO NOTHING",
                                    group_id, contact_id);
                            }
                            LOG_INFO() << "Added contact to " << groups.Size() << " group(s)";
                        }

                    } else {

                        connection_id = connection[0]["id"].As<boost::uuids::uuid>();
                    }

                    // Проверка дубликата и вставка с использованием расшифрованного тела
                    const auto exists = pg_cluster_->Execute(ClusterHostType::kMaster,
                                                             R"(
                                SELECT 1
                                FROM communicationservice_schema.message
                                WHERE connection_id = $1
                                  AND text = $2
                                LIMIT 1
                            )",
                                                             connection_id, readable_body);  // <-- используем readable_body

                    if (!exists.IsEmpty()) {

                        LOG_INFO() << "Message already exists";

                        continue;
                    }

                    pg_cluster_->Execute(ClusterHostType::kMaster,
                                         R"(
                            INSERT INTO communicationservice_schema.message
                            (
                                origin_connection_id,
                                connection_id,
                                text
                            )
                            VALUES
                            (
                                $1,
                                $2,
                                $3
                            )
                        )",
                                         origin_connection_id, connection_id, readable_body);  // <-- используем readable_body

                    LOG_INFO() << "Stored email message";
                }

            } catch (const std::exception& e) {

                LOG_ERROR() << "Mailbox processing error: " << e.what();
            }
        }

        LOG_INFO() << "EMAIL fetcher finished";

    } catch (const std::exception& e) {

        LOG_ERROR() << "EMAIL fetcher error: " << e.what();
    }
}

} // namespace communicationservice::components
