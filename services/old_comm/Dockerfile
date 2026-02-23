ARG SERVICE_NAME
ARG USERVER_VERSION
ARG PREFIX=/install

FROM ghcr.io/userver-framework/ubuntu-24.04-userver:${USERVER_VERSION} as base



FROM base as debug

# Рабочая директория
WORKDIR /service



FROM base as builder

# Рабочая директория
WORKDIR /service
                                
# В release версии мы копируем исходники
COPY . .

# Собираем сервис
RUN make build-release && \
    pwd && ls && echo "------" && ls build-release && \
    cmake --install build-release -v --component ${SERVICE_NAME} --prefix /${PREFIX}



FROM ubuntu:24.04 as release

# Устанавливаем нужные инструменты
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Создаем пользователя и группу с фиксированными UID/GID
RUN groupadd --gid 1000 --non-unique app && \
    useradd --uid 1000 --gid 1000 --non-unique app
    
# Копируем файлы для запуска
COPY --from=builder /${PREFIX} /home/app/.local

# Изменяем владельца файлов на app
RUN chown -R app:app /home/app/.local

# Переключаемся на непривилегированного пользователя
USER app

# Запускаем сервис
CMD sh -ls "$HOME/.local/bin/$SERVICE_NAME \
              --config $HOME/.local/etc/$SERVICE_NAME/static_config.yaml \
              --config_vars $HOME/.local/etc/$SERVICE_NAME/config_vars.yaml"

