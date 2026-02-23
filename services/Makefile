# ---- Settings ----
COMPOSE_DEBUG := docker compose --profile debug
COMPOSE_RELEASE := docker compose --profile release
S ?=  # Переменная для перечисления сервисов, логи которых хотим получить


# Определяем UID и GID хоста.
# Если запускаем от root (UID=0), то берём 1000:1000
UID := $(shell id -u)
GID := $(shell id -g)
ifeq ($(UID),0)
  UID := 1000
  GID := 1000
endif

export UID
export GID


.PHONY: collect-postgresql-migrations

# Сбор миграций из всех сервисов (проверка .env файла внутри)
collect-postgresql-migrations:
	@./collect-postgresql-migrations


.PHONY: up-debug down-debug logs-debug ps-debug up down logs ps

# Поднимаем окружение в фоне, с билдом образов.
up-debug: collect-postgresql-migrations 
	$(COMPOSE_DEBUG) up -d
up: up-debug

# Останавливаем и чистим контейнеры/сеть этого проекта.
down-debug:
	$(COMPOSE_DEBUG) down --remove-orphans
down: down-debug

# Останавливаем с очисткой volumes
down-clean-debug:
	$(COMPOSE_DEBUG) down --remove-orphans -v
down-clean: down-clean-debug

# Перезапускаем сервис через переменную S=имя.
restart-debug:
	$(COMPOSE_DEBUG) up -d --force-recreate $(S)
restart: restart-debug

# Логи всех сервисов, или конкретного (через S=имя)
logs-debug:
	$(COMPOSE_DEBUG) logs -f $(S)
logs: logs-debug

# Статус контейнеров
ps-debug:
	$(COMPOSE_DEBUG) ps
ps: ps-debug


.PHONY: up-release down-release logs-release ps-release

# Поднимаем окружение в фоне, с билдом образов.
up-release: collect-postgresql-migrations 
	$(COMPOSE_RELEASE) up --build -d

# Останавливаем и чистим контейнеры/сеть этого проекта.
down-release:
	$(COMPOSE_RELEASE) down --remove-orphans

# Останавливаем с очисткой volumes
down-clean-release:
	$(COMPOSE_RELEASE) down --remove-orphans -v

# Перезапускаем сервис через переменную S=имя.
restart-release:
	$(COMPOSE_RELEASE) up -d --force-recreate --build $(S)
# Логи всех сервисов, или конкретного (через S=имя)
logs-release:
	$(COMPOSE_RELEASE) logs -f $(S)

# Статус контейнеров
ps-release:
	$(COMPOSE_RELEASE) ps

