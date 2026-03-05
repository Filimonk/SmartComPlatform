#include <verify.hpp>
#include <userver/formats/json.hpp>
#include <userver/server/http/http_status.hpp>
#include <jwt-cpp/jwt.h>
#include <chrono>

namespace authservice {

namespace {

const std::string kSecretKey = []() {
    const char* secret = std::getenv("SECRET_JWT_KEY");
    return secret ? secret : "fallback-secret-key-for-development";
}();

bool IsTokenExpired(const std::string& date_str) {
    try {
        // Преобразуем строку даты в число
        auto token_time = std::chrono::system_clock::time_point(
            std::chrono::nanoseconds(std::stoll(date_str)));

        // Получаем текущее время
        auto now = std::chrono::system_clock::now();

        // Проверяем, не прошло ли более 5 минут
        return (now - token_time) > std::chrono::minutes(5);
    } catch (const std::exception&) {
        // Если не удалось распарсить дату, считаем токен просроченным
        return true;
    }
}

}  // namespace

std::string
Verify::HandleRequestThrow(const userver::server::http::HttpRequest& request,
                          userver::server::request::RequestContext&) const {
    // Получаем заголовок Authorization
    const auto auth_header = request.GetHeader("Authorization");
    if (auth_header.empty() || auth_header.find("Bearer ") != 0) {
        request.SetResponseStatus(userver::server::http::HttpStatus::kUnauthorized);
        return "{\"error\": \"Authorization header missing or invalid\"}";
    }

    // Извлекаем токен (убираем "Bearer " из начала)
    const auto token = auth_header.substr(7);

    try {
        auto decoded = jwt::decode(token);
        auto verifier = jwt::verify()
            .allow_algorithm(jwt::algorithm::hs256{kSecretKey})
            .with_issuer("authservice");

        verifier.verify(decoded);

        // Проверка наличия обязательных полей
        if (!decoded.has_payload_claim("user_id") ||
            !decoded.has_payload_claim("login") ||
            !decoded.has_payload_claim("username") ||
            !decoded.has_payload_claim("date")) {
            return "{\"error\": \"Missing required claims\"}";
        }

        int user_id;
        try {
            user_id = std::stoi(decoded.get_payload_claim("user_id").as_string());
        } catch (const std::exception&) {
            request.SetResponseStatus(userver::server::http::HttpStatus::kUnauthorized);
            return "{\"error\": \"Invalid user_id in token\"}";
        }
        const auto login = decoded.get_payload_claim("login").as_string();
        const auto username = decoded.get_payload_claim("username").as_string();
        const auto date_str = decoded.get_payload_claim("date").as_string();

        if (IsTokenExpired(date_str)) {
            request.SetResponseStatus(userver::server::http::HttpStatus::kUnauthorized);
            return "{\"error\": \"Token expired\"}";
        }

        userver::formats::json::ValueBuilder response;
        response["user_id"] = user_id;
        response["login"] = login;
        response["username"] = username;
        response["date"] = date_str;

        request.GetHttpResponse().SetContentType("application/json");
        return userver::formats::json::ToString(response.ExtractValue());

    } catch (const std::exception& e) {
        // Общий перехват для большинства исключений jwt-cpp
        std::string error_msg = e.what();
        
        if (error_msg.find("invalid token") != std::string::npos ||
            error_msg.find("Invalid token") != std::string::npos ||
            error_msg.find("signature") != std::string::npos ||
            error_msg.find("claim") != std::string::npos) {
            request.SetResponseStatus(userver::server::http::HttpStatus::kUnauthorized);
            return "{\"error\": \"Invalid token\"}";
        }
        
        // Другие ошибки
        LOG_ERROR() << "Error while verifying token: " << e.what();
        request.SetResponseStatus(userver::server::http::HttpStatus::kInternalServerError);
        return "{\"error\": \"Internal server error\"}";
    }
}

}  // namespace authservice

