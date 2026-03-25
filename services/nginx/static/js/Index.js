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
}

loadProfile();

