document.getElementById('logout')
    .addEventListener('click', () => {
        clearToken();
        window.location.href = '/auth.html';
    });

async function loadProfile() {
    try {
        const response = await api.get('/communicationservice/ping');
        console.log(response.data);
    } catch (e) {
        console.error(e);
    }
}

loadProfile();

