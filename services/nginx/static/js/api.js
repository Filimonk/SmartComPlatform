const api = axios.create({
    baseURL: '/api',
    timeout: 5000
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

