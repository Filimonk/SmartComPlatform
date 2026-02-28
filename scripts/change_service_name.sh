SERVICE_NAME=$1
find . -type f -exec sed -i "s/model_postgres_service/${SERVICE_NAME}/g" {} +
