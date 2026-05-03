#include <userver/clients/dns/component.hpp>
#include <userver/clients/http/component_list.hpp>
#include <userver/components/component.hpp>
#include <userver/components/component_list.hpp>
#include <userver/components/minimal_server_component_list.hpp>
#include <userver/congestion_control/component.hpp>
#include <userver/server/handlers/ping.hpp>
#include <userver/server/handlers/tests_control.hpp>
#include <userver/testsuite/testsuite_support.hpp>

#include <userver/storages/postgres/component.hpp> 

#include <userver/utils/daemon_run.hpp>

#include "handlers/v1/messages/SendMessage.hpp"
#include "handlers/v1/contacts/CreateContact.hpp"
#include "handlers/v1/contacts/ModifyContact.hpp"
#include "handlers/v1/contacts/CreateConnection.hpp"
#include "handlers/v1/contacts/GetAllContacts.hpp"
#include "handlers/v1/contacts/GetAllConnections.hpp"
#include "handlers/v1/contacts/GetAllMessages.hpp"
#include "handlers/v1/origins/CreateOrigin.hpp"
#include "handlers/v1/origins/GetOrigin.hpp"
#include "handlers/v1/origins/ModifyOrigin.hpp"
#include "handlers/v1/origins/GetAllOrigins.hpp"
#include "handlers/v1/origins/CreateOriginConnection.hpp"
#include "handlers/v1/origins/GetAllOriginConnections.hpp"
#include "components/MessageDispatcher.hpp"
#include "components/TelegramMessageFetcher.hpp"
#include "handlers/v1/ai/SpellCheck.hpp"
#include "handlers/v1/ai/GetSpellCheckConfiguration.hpp"
#include "handlers/v1/ai/SetSpellCheckConfiguration.hpp"
#include "handlers/v1/tasks/GetAllTasks.hpp"
#include "handlers/v1/tasks/CreateTask.hpp"
#include "handlers/v1/tasks/ChangeTaskStatus.hpp"
#include "handlers/v1/tasks/GetAllExpiredTasksByUser.hpp"
#include "handlers/v1/notes/GetAllNotesByContact.hpp"
#include "handlers/v1/notes/CreateNote.hpp"
#include "handlers/v1/settings/GetSettings.hpp"
#include "handlers/v1/settings/UpdateSettings.hpp"

int main(int argc, char* argv[]) {
    auto component_list =
        userver::components::MinimalServerComponentList()
            .Append<userver::server::handlers::Ping>()
            .Append<userver::components::TestsuiteSupport>()
            .AppendComponentList(userver::clients::http::ComponentList())
            .Append<userver::clients::dns::Component>()
            .Append<userver::server::handlers::TestsControl>()
            .Append<userver::congestion_control::Component>()
            .Append<userver::components::Postgres>("postgres-db")
            .Append<communicationservice::handlers::v1::SendMessage>()
            .Append<communicationservice::handlers::v1::CreateContact>()
            .Append<communicationservice::handlers::v1::ModifyContact>()
            .Append<communicationservice::handlers::v1::CreateConnection>()
            .Append<communicationservice::handlers::v1::GetAllContacts>()
            .Append<communicationservice::handlers::v1::GetAllConnections>()
            .Append<communicationservice::handlers::v1::GetAllMessages>()
            .Append<communicationservice::handlers::v1::CreateOrigin>()
            .Append<communicationservice::handlers::v1::GetOrigin>()
            .Append<communicationservice::handlers::v1::ModifyOrigin>()
            .Append<communicationservice::handlers::v1::GetAllOrigins>()
            .Append<communicationservice::handlers::v1::CreateOriginConnection>()
            .Append<communicationservice::handlers::v1::GetAllOriginConnections>()
            .Append<communicationservice::components::MessageDispatcher>()
            .Append<communicationservice::components::TelegramMessageFetcher>()
            .Append<communicationservice::handlers::v1::SpellCheck>()
            .Append<communicationservice::handlers::v1::GetSpellCheckConfiguration>()
            .Append<communicationservice::handlers::v1::SetSpellCheckConfiguration>()
            .Append<communicationservice::handlers::v1::GetAllTasks>()
            .Append<communicationservice::handlers::v1::CreateTask>()
            .Append<communicationservice::handlers::v1::ChangeTaskStatus>()
            .Append<communicationservice::handlers::v1::GetAllExpiredTasksByUser>()
            .Append<communicationservice::handlers::v1::GetAllNotesByContact>()
            .Append<communicationservice::handlers::v1::CreateNote>()
            .Append<communicationservice::handlers::v1::GetSettings>()
            .Append<communicationservice::handlers::v1::UpdateSettings>()
        ;

    return userver::utils::DaemonMain(argc, argv, component_list);
}
