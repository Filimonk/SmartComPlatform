console.log("ASDFASDFASDF");

// Auth guard
if (!getToken()) {
    window.location.href = '/auth.html';
}

document.getElementById('logout')
    .addEventListener('click', () => {
        clearToken();
        window.location.href = '/auth.html';
    });

/**
 * Пример запроса к защищённому API
 */
async function loadProfile() {
    try {
        const response = await api.get('/users/me');
        console.log(response.data);
    } catch (e) {
        console.error(e);
    }
}

loadProfile();

