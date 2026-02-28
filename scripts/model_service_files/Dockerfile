ARG USERVER_VERSION

FROM ghcr.io/userver-framework/ubuntu-24.04-userver:${USERVER_VERSION} as base


FROM base as debug

# Устанавливаем нужные инструменты
RUN apt-get update && \
    apt-get upgrade -y && \
    rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /service

