if (!getToken()) {
    window.location.replace('/auth.html');
} else {
    document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('visible');
    });
}

// Думаю поставить проверку на старение токена, при необходимости сделать запрос на /auth/refresh (надо реализовать на беке)

