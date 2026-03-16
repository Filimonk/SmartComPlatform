const api = axios.create({
    baseURL: '/api',
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' }
});

/**
 * Получение токена из хранилища
 */
function getToken() {
    return localStorage.getItem('jwt_token') ||
           sessionStorage.getItem('jwt_token');
}

/**
 * Установка токена
 */
function setToken(token, remember) {
    if (remember) {
        localStorage.setItem('jwt_token', token);
    } else {
        sessionStorage.setItem('jwt_token', token);
    }
}

/**
 * Удаление токена (logout)
 */
function clearToken() {
    localStorage.removeItem('jwt_token');
    sessionStorage.removeItem('jwt_token');
}

/**
 * Axios interceptor — автоматически добавляет JWT
 */
api.interceptors.request.use(config => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

/**
 * Глобальная обработка 401
 */
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            clearToken();
            window.location.href = '/auth.html';
        }
        return Promise.reject(error);
    }
);

async function checkToken() {
    try {
        const response = await api.get('/authservice/check');
        console.log(response.data);
        return true;
    } catch (e) {
        return false;
    }
}

// Если используете модули:
// import { sha256 } from 'js-sha256';

/**
 * Генерирует детерминированный токен идемпотентности.
 * @param {string} key - изменяемая часть (URL, ID последнего сообщения и т.п.)
 * @param {object|string} requestData - данные запроса (будут приведены к стабильной строке)
 * @param {string|number} uid - идентификатор пользователя
 * @param {...(string|number)} extraIds - дополнительные идентификаторы (например, chatId)
 * @returns {string} - токен (hex-строка SHA-256)
 */
function generateIdempotencyToken(key, requestData, uid, ...extraIds) {
    let requestStr;
    if (typeof requestData === 'string') {
        requestStr = requestData;
    } else {
        requestStr = JSON.stringify(requestData, Object.keys(requestData).sort());
    }

    const sortedExtraIds = extraIds.sort();

    const components = [
        key,
        requestStr,
        uid.toString(),
        ...sortedExtraIds.map(id => id.toString())
    ];
    const combined = components.join('|');

    return sha256(combined);
}

/**
 * Отправляет POST-запрос с автоматическим добавлением заголовка Idempotency-Key.
 * @param {string} url - эндпоинт
 * @param {object} data - тело запроса
 * @param {object} options - дополнительные параметры для генерации токена:
 *   - key {string} (обязательный)
 *   - uid {string|number} (обязательный)
 *   - extraIds {Array} (необязательный) - массив дополнительных идентификаторов
 * @returns {Promise<object>} - ответ сервера
 */
async function postWithIdempotency(url, data, optionsOrToken) {
    let token;
    
    if (typeof optionsOrToken === 'string') {
        token = optionsOrToken;
    } else {
        // Деструктурируем объект, если это не строка
        const { key, uid, extraIds = [] } = optionsOrToken;
        token = generateIdempotencyToken(key, data, uid, ...extraIds);
    }

    const response = await api.post(url, data, {
        headers: { 'Idempotency-Key': token }
    });
    
    return response.data;
}


/**
 * Извлекает значение указанного поля из JWT, хранящегося в localStorage/sessionStorage.
 * @param {string} fieldName - имя поля в payload JWT (например, 'sub', 'name', 'role')
 * @returns {any|null} - значение поля или null, если токен отсутствует или поле не найдено
 */
function getJwtField(fieldName) {
    const token = getToken();
    if (!token) return null;

    try {
        const parts = token.split('.');
        if (parts.length !== 3) throw new Error('Некорректный формат JWT');

        // Декодируем payload из base64url в строку
        const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/'); // замена для base64url
        const payloadJson = atob(payloadBase64); // atob декодирует base64 в строку
        const payload = JSON.parse(payloadJson);

        // Возвращаем запрошенное поле, если оно существует
        return payload[fieldName] !== undefined ? payload[fieldName] : null;
    } catch (e) {
        console.error('Ошибка при декодировании JWT:', e);
        return null;
    }
}

