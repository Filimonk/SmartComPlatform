(async () => {
    if (!getToken()) {
        window.location.replace('/auth.html');
    } else {
        // const isValid = await checkToken(); // теперь isValid будет true/false
        const isValid = true;
        if (!isValid) {
            window.location.replace('/auth.html');
        }
        
        document.addEventListener('DOMContentLoaded', () => {
            document.body.classList.add('visible');
        });
    }
})();

// Думаю поставить проверку на старение токена, при необходимости сделать запрос на /auth/refresh (надо реализовать на беке)

