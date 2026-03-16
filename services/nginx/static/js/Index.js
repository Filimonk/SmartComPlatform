document.getElementById('logout')
    .addEventListener('click', () => {
        clearToken();
        window.location.href = '/auth.html';
    });

document.getElementById('workspace')
    .addEventListener('click', () => {
        window.location.href = '/workspace.html';
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

