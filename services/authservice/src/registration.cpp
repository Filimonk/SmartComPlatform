#include <registration.hpp>

#include <userver/storages/postgres/component.hpp>
#include <userver/formats/json.hpp>
#include <userver/crypto/hash.hpp>
#include <userver/server/http/http_status.hpp>

// Для JWT
#include <jwt-cpp/jwt.h>

namespace authservice {

namespace {

const std::string kSecretKey = []() {
    const char* secret = std::getenv("SECRET_JWT_KEY");
    return secret ? secret : "fallback-secret-key-for-development";
}();

std::string HashPassword(const std::string& password) {
    // Используем SHA-256 для хеширования пароля
    return userver::crypto::hash::Sha256(password);
}

std::string GenerateJwtToken(const int user_id, const std::string& login, const std::string& username) {
    // Создаем JWT токен
    auto token = jwt::create()
        .set_issuer("authservice")
        .set_type("JWS")
        .set_payload_claim("user_id", jwt::claim(std::to_string(user_id)))
        .set_payload_claim("login", jwt::claim(login))
        .set_payload_claim("username", jwt::claim(username))
        .set_payload_claim("date", jwt::claim(std::to_string(
            std::chrono::system_clock::now().time_since_epoch().count())))
        .sign(jwt::algorithm::hs256{kSecretKey});

    return token;
}

}  // namespace

Registration::Registration(
    const userver::components::ComponentConfig& config,
    const userver::components::ComponentContext& component_context
)
    : HttpHandlerBase(config, component_context),
      pg_cluster_(component_context.FindComponent<userver::components::Postgres>("postgres-db-1").GetCluster()) {}

std::string
Registration::HandleRequestThrow(const userver::server::http::HttpRequest& request,
                                userver::server::request::RequestContext&) const {
    // Парсим JSON из тела запроса
    const auto request_json = userver::formats::json::FromString(request.RequestBody());

    // Проверяем наличие всех необходимых полей
    if (!request_json.HasMember("name") ||
        !request_json.HasMember("login") ||
        !request_json.HasMember("password")) {
        request.SetResponseStatus(userver::server::http::HttpStatus::kBadRequest);
        return "{\"error\": \"Missing required fields\"}";
    }

    const auto name = request_json["name"].As<std::string>();
    const auto login = request_json["login"].As<std::string>();
    const auto password = request_json["password"].As<std::string>();

    // Проверяем, не занят ли логин
    try {
        auto result = pg_cluster_->Execute(
            userver::storages::postgres::ClusterHostType::kMaster,
            "SELECT login FROM users WHERE login = $1",
            login
        );

        if (result.Size() > 0) {
            request.SetResponseStatus(userver::server::http::HttpStatus::kConflict);
            return "{\"field\": \"login\", \"error\": \"Данный логин уже занят\"}";
        }
    } catch (const std::exception& ex) {
        LOG_ERROR() << "Database error while checking login: " << ex.what();
        request.SetResponseStatus(userver::server::http::HttpStatus::kInternalServerError);
        return "{\"error\": \"Internal server error\"}";
    }

    // Хешируем пароль
    const auto hashed_password = HashPassword(password);

    // Сохраняем пользователя в базу данных и получаем его id
    int user_id;
    try {
        auto result = pg_cluster_->Execute(
            userver::storages::postgres::ClusterHostType::kMaster,
            "INSERT INTO users (login, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
            login, name, hashed_password
        );
        user_id = result[0]["id"].As<int>();
    } catch (const std::exception& ex) {
        LOG_ERROR() << "Database error while inserting user: " << ex.what();
        request.SetResponseStatus(userver::server::http::HttpStatus::kInternalServerError);
        return "{\"error\": \"Internal server error\"}";
    }

    // Генерируем JWT токен
    std::string token;
    try {
        token = GenerateJwtToken(user_id, login, name);
    } catch (const std::exception& ex) {
        LOG_ERROR() << "JWT generation error: " << ex.what();
        request.SetResponseStatus(userver::server::http::HttpStatus::kInternalServerError);
        return "{\"error\": \"Internal server error\"}";
    }

    // Формируем ответ
    userver::formats::json::ValueBuilder response;
    response["token"] = token;

    request.GetHttpResponse().SetContentType("application/json");
    return userver::formats::json::ToString(response.ExtractValue());
}

}  // namespace authservice

