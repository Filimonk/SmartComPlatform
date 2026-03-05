#!/bin/bash

# Функция создания шаблона сервиса userver
userver-create-service() {
    REPO_URL="https://github.com/userver-framework/userver.git"
    BRANCH=$VERSION
    WORKDIR="/tmp/userver-create-service/$BRANCH"
    if [ ! -d "$WORKDIR" ]; then
        mkdir -p "$WORKDIR"
        git clone -q --depth 1 --branch "$BRANCH" "$REPO_URL" "$WORKDIR"
    fi
    "$WORKDIR/scripts/userver-create-service.py" "$@"
}

# Определяем корень репозитория
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$REPO_ROOT" ]]; then
    echo "Ошибка: Не удалось определить корень git-репозитория!" >&2
    echo "Убедитесь, что вы находитесь внутри репозитория и git установлен." >&2
    exit 1
fi

# Проверка папки вызова скрипта
REQUIRED_DIR="${REPO_ROOT}/services"
CURRENT_DIR="$(pwd)"
if [[ "$CURRENT_DIR" != "$REQUIRED_DIR" ]]; then
    echo "Ошибка: Скрипт должен вызываться только из папки '${REPO_ROOT}/services'!" >&2
    echo "Текущая папка: $CURRENT_DIR" >&2
    exit 1
fi

# Определяем имя сервиса (единственный аргумент без префикса "-")
SERVICE_NAME=""
for arg in "$@"; do
    if [[ "$arg" != -* ]]; then
        if [[ -n "$SERVICE_NAME" ]]; then
            echo "Ошибка: Найдено больше одного кандидата на имя сервиса" >&2
            exit 1
        fi
        SERVICE_NAME="$arg"
    fi
done

if [[ -z "$SERVICE_NAME" ]]; then
    echo "Ошибка: Не указано имя сервиса" >&2
    echo "Использование: $0 [опции] <имя_сервиса>" >&2
    exit 1
fi

# Проверяем, что путь сервиса лежит внутри ${REQUIRED_DIR}
SERVICE_PATH="$(realpath -m "$SERVICE_NAME")"
if [[ "$SERVICE_PATH" != "$REQUIRED_DIR/"* ]]; then
    echo "Ошибка: Сервисы должны располагаться только в папке '${REQUIRED_DIR}'" >&2
    exit 1
fi

# Проверка существования папки сервиса
if [[ -d "$SERVICE_NAME" ]]; then
    echo "Ошибка: Сервис '$SERVICE_NAME' уже существует" >&2
    exit 1
fi

while true; do
    read -p "Введите версию userver (в виде vX.YY): " VERSION
    if [[ -n "$VERSION" ]]; then
        break
    else
        echo "Версия не может быть пустой!"
    fi
done
echo "Вы ввели: $VERSION"

# Если среди аргументов есть -h или --help - пробрасываем напрямую
for arg in "$@"; do
    if [[ "$arg" == "-h" || "$arg" == "--help" ]]; then
        userver-create-service "$@"
        exit 0
    fi
done

# Генерация шаблона сервиса
echo "Генерация шаблона сервиса '$SERVICE_NAME' через официальный скрипт:"
echo ""
if ! userver-create-service "$@"; then
    echo "Ошибка: Не удалось создать сервис" >&2
    exit 1
fi
echo ""
echo "Официальный скрипт сгенерировал шаблон сервиса успешно"

# Добавление кастомных файлов
TARGET_DIR="$CURRENT_DIR/$SERVICE_NAME"
CUSTOM_FILES="$REPO_ROOT/scripts/model_service_files"
if [[ -d "$CUSTOM_FILES" ]]; then
    echo "Добавление кастомных файлов"
    # cp -rf "$CUSTOM_FILES"/. "$TARGET_DIR/"
    # sudo rsync -a --delete "$CUSTOM_FILES"/. "$TARGET_DIR"/
    sudo rsync -a --delete --filter="protect /*" "$CUSTOM_FILES"/ "$TARGET_DIR"/


    # Замена плейсхолдеров в кастомных файлах
    find "$TARGET_DIR" -type f -exec sed -i "s/model_postgres_service/$SERVICE_NAME/g" {} \;
    echo "Кастомные файлы добавлены и обработаны"
fi

echo ""
echo "Сервис '$SERVICE_NAME' успешно создан!"

