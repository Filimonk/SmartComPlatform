cmake_minimum_required(VERSION 3.12...3.31)
project(communicationservice CXX)

list(APPEND CMAKE_MODULE_PATH "${CMAKE_CURRENT_SOURCE_DIR}/cmake")
include(DownloadUserver)

find_package(
    userver
    COMPONENTS core #
               postgresql
               chaotic
    QUIET
)
if(NOT userver_FOUND)
    # Tries TRY_DIR first, falls back to downloading userver from GitHub using CPM.
    download_userver(TRY_DIR third_party/userver)
endif()

userver_setup_environment()

# Chaotic JSON codegen
file(GLOB_RECURSE API_SCHEMAS
    ${CMAKE_CURRENT_SOURCE_DIR}/schemas/api/*/components/*.yaml
)

userver_target_generate_chaotic(
    ${PROJECT_NAME}-chgen
    GENERATE_SERIALIZERS
    LAYOUT "/components/schemas/([^/]*)/=communicationservice::dto::{0}"
    OUTPUT_DIR ${CMAKE_CURRENT_BINARY_DIR}/chaotic
    SCHEMAS ${API_SCHEMAS}
    RELATIVE_TO ${CMAKE_CURRENT_SOURCE_DIR}
)

# Chaotic SQL codegen
userver_add_sql_library(
    ${PROJECT_NAME}_sql
    NAMESPACE
    communicationservice
    SOURCE_DIR
    postgresql/queries
    OUTPUT_DIR
    ${CMAKE_CURRENT_BINARY_DIR}
    SQL_FILES
    *.sql
)


# Service objs
add_library(
    ${PROJECT_NAME}_objs OBJECT
    src/handlers/v1/messages/SendMessage.cpp
    
    src/handlers/v1/contacts/CreateContact.cpp
    src/handlers/v1/contacts/ModifyContact.cpp
    src/handlers/v1/contacts/CreateConnection.cpp
    src/handlers/v1/contacts/ChannelTypeEnumToString.cpp
    src/handlers/v1/contacts/GetAllContacts.cpp
    src/handlers/v1/contacts/GetAllConnections.cpp
    
    #src/handlers/v1/origins/CreateOrigin.cpp
    #src/handlers/v1/origins/GetAllOrigings.cpp
    #src/handlers/v1/origins/CreateOrigingConnection.cpp
    #src/handlers/v1/origins/GetAllOrigingConnections.cpp
    
    src/components/MessageDispatcher.cpp
)
target_link_libraries(
    ${PROJECT_NAME}_objs
    PUBLIC userver::core #
           userver::postgresql
           ${PROJECT_NAME}-chgen
           ${PROJECT_NAME}_sql
)


# The Service
add_executable(${PROJECT_NAME} src/main.cpp)
target_link_libraries(${PROJECT_NAME} PRIVATE ${PROJECT_NAME}_objs)


# # Unit Tests
# add_executable(${PROJECT_NAME}_unittest src/greeting_test.cpp)
# target_link_libraries(${PROJECT_NAME}_unittest PRIVATE ${PROJECT_NAME}_objs userver::utest)
# add_google_tests(${PROJECT_NAME}_unittest)
# 
# # Benchmarks
# add_executable(${PROJECT_NAME}_benchmark src/greeting_benchmark.cpp)
# target_link_libraries(${PROJECT_NAME}_benchmark PRIVATE ${PROJECT_NAME}_objs userver::ubench)
# add_google_benchmark_tests(${PROJECT_NAME}_benchmark)

# Functional testing
userver_testsuite_add_simple()

# Install
include(GNUInstallDirs)

if(DEFINED ENV{PREFIX})
    message(STATUS "Set install prefix: $ENV{PREFIX}")
    file(TO_CMAKE_PATH "$ENV{PREFIX}" PREFIX_PATH)
    set(CMAKE_INSTALL_PREFIX "${PREFIX_PATH}")
endif()

file(GLOB CONFIGS_FILES ${CMAKE_CURRENT_SOURCE_DIR}/configs/*.yaml ${CMAKE_CURRENT_SOURCE_DIR}/configs/*.json)

install(
    TARGETS ${PROJECT_NAME}
    DESTINATION ${CMAKE_INSTALL_BINDIR}
    COMPONENT ${PROJECT_NAME}
)
install(
    FILES ${CONFIGS_FILES}
    DESTINATION ${CMAKE_INSTALL_SYSCONFDIR}/${PROJECT_NAME}
    COMPONENT ${PROJECT_NAME}
)
