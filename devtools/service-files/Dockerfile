ARG SERVICE_NAME
ARG USERVER_VERSION
ARG PREFIX=/install

FROM ghcr.io/userver-framework/ubuntu-24.04-userver:${USERVER_VERSION} as base



FROM base as debug

# Устанавливаем нужные инструменты
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /service



# Что-то не работает на уровне 
#   cmake --install . -v --component ${SERVICE_NAME} --prefix /${PREFIX}

# FROM base as builder
# 
# # Рабочая директория
# WORKDIR /service
# 
# # В release версии мы копируем исходники
# COPY . .
# 
# Собираем сервис
# RUN make build-release && \
#   pwd && ls && echo "------" && ls build-release && \
#   cd build-release && \
#   cmake --install . -v --component ${SERVICE_NAME} --prefix /${PREFIX}
# 
# 
# 
# FROM ubuntu:24.04 as release
# 
# # Устанавливаем нужные инструменты
# RUN apt-get update && \
#    apt-get upgrade -y && \
#    rm -rf /var/lib/apt/lists/*
# 
# # Создаем пользователя и группу с фиксированными UID/GID
# RUN groupadd --gid 1000 --non-unique app && \
#    useradd --uid 1000 --gid 1000 --non-unique app
# 
# # Копируем файлы для запуска
# COPY --from=builder /${PREFIX} /home/app/.local
# 
# # Изменяем владельца файлов на app
# RUN chown -R app:app /home/app/.local
# 
# # Переключаемся на непривилегированного пользователя
# USER app
# 
# # Запускаем сервис
# CMD sh -ls "$HOME/.local/bin/$SERVICE_NAME \
#              --config $HOME/.local/etc/$SERVICE_NAME/static_config.yaml \
#              --config_vars $HOME/.local/etc/$SERVICE_NAME/config_vars.yaml"


# настройки для release в docker-compose.yaml
  # communicationservice-release:
    # <<: *service-base
    # profiles: ["release"]
    # restart: unless-stopped
    # hostname: communicationservice
    # build:
      # context: ./communicationservice
      # target: release
      # args:
        # - SERVICE_NAME=communicationservice
        # - USERVER_VERSION=v2.15
    # environment:
      # DB_CONNECTION: "postgresql://${AUTH_DB_USER}:${AUTH_DB_PASSWORD}@postgresql-release:5432/${AUTH_DB_NAME}? \
                      # options=-c%20search_path%3D${AUTH_DB_SCHEMA}"
      # CORE_DIR: /cores
    # security_opt:
      # - seccomp=./communicationservice/seccomp_config.json
    # depends_on:
      # - nginx-release
      # - postgresql-release

