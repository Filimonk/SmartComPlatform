#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Проверка наличия и корректности .env файла
./check-env || exit 1

env_file=".env"

# Создаем временный файл для экспортируемых переменных
temp_env=$(mktemp)

# Фильтруем .env файл: оставляем только строки, начинающиеся с буквы или underscore
grep -E '^[[:alpha:]_]' "$env_file" | sed 's/^/export /' > "$temp_env"

# Загружаем переменные в текущую оболочку
source "$temp_env"


# Сборка миграций
echo -e "${YELLOW}Сбор миграций postgresql...${NC}"

rm -rf ./postgresql/build/*
mkdir -p ./postgresql/build/
error_occurred=0

# Ассоциативный массив для отслеживания уже обработанных файлов
declare -A processed_files

# Функция для безопасной обработки шаблонов
process_template() {
    local template_file=$1
    local output_file=$2

    # Обрабатываем шаблон с помощью envsubst
    envsubst < "$template_file" > "$output_file" || return 1
}

# Функция для обработки файлов
process_file() {
    local src_file=$1
    local dest_dir=$2
    local prefix=$3

    local filename=$(basename "$src_file")
    local output_filename="${prefix}${filename}"

    if [[ "$filename" == *.sql.template ]]; then
        if [[ -n "$prefix" ]]; then
            echo -e "${RED}Ошибка: .sql.template миграции могут лежать только в папке сервиса postgresql${NC}"
            return 1
        fi

        # Проверяем конфликт имен
        local final_name="${output_filename%.*}"  # Убираем .template
        if [[ -n "${processed_files[$final_name]}" ]]; then
            echo -e "${RED}Конфликт: файл '$final_name' уже существует${NC}"
            return 1
        fi

        echo "Обрабатываем шаблон: $src_file -> $dest_dir/$final_name"
        process_template "$src_file" "$dest_dir/$final_name" || return 1
        processed_files["$final_name"]=1
    else
        # Проверяем конфликт имен
        if [[ -n "${processed_files[$output_filename]}" ]]; then
            echo -e "${RED}Конфликт: файл '$output_filename' уже существует${NC}"
            return 1
        fi

        echo "Копируем: $src_file -> $dest_dir/$output_filename"
        cp "$src_file" "$dest_dir/$output_filename" || return 1
        processed_files["$output_filename"]=1
    fi
}

# Обрабатываем общие миграции
if [ -d "./postgresql/schemas" ]; then
    echo
    echo "Обработка общих миграций..."
    for file in ./postgresql/schemas/*; do
        if [ -f "$file" ]; then
            if ! process_file "$file" "./postgresql/build" ""; then
                echo -e "${RED}Ошибка при обработке: ${file}${NC}"
                error_occurred=1
            fi
        else
            echo -e "${YELLOW}Предупреждение на объекте ${file}: миграции в подкаталогах не обрабатываются${NC}"
        fi
    done
fi

# Обрабатываем миграции из сервисов
echo
echo "Обработка миграций из сервисов..."
for dir in $(find . -maxdepth 1 -type d ! -path . ! -path "./postgresql" | sed 's|./||'); do
    if [ -d "$dir/postgresql/schemas" ]; then
        for file in "$dir"/postgresql/schemas/*; do
            if [ -f "$file" ]; then
                if ! process_file "$file" "./postgresql/build" "${dir}_"; then
                    echo -e "${RED}Ошибка при обработке: ${file}${NC}"
                    error_occurred=1
                fi
            else
                echo -e "${YELLOW}Предупреждение на объекте ${file}: миграции в подкаталогах не обрабатываются${NC}"
            fi
        done
    fi
done

# Итоговый статус
echo
if [ $error_occurred -eq 0 ]; then
    echo -e "${GREEN}Сбор миграций прошел успешно!${NC}"
else
    echo -e "${YELLOW}Сбор завершен с предупреждениями!${NC}"
    echo "Некоторые миграции не были скопированы"
fi
echo

# Удаляем временный файл
rm -f "$temp_env"

