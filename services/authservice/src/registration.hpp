#pragma once

#include <userver/components/component.hpp>
#include <userver/server/handlers/http_handler_base.hpp>

#include <userver/storages/postgres/cluster.hpp>


namespace authservice {

class Registration final : public userver::server::handlers::HttpHandlerBase {
public:
    static constexpr std::string_view kName = "handler-registration";
    
    Registration(const userver::components::ComponentConfig& config,
                 const userver::components::ComponentContext& context);


    using HttpHandlerBase::HttpHandlerBase;

    std::string HandleRequestThrow(const userver::server::http::HttpRequest&,
                                   userver::server::request::RequestContext&) const override;

private:
    userver::storages::postgres::ClusterPtr pg_cluster_;
};

}  // namespace authservice
