document.getElementById('logout')
    .addEventListener('click', () => {
        clearToken();
        window.location.href = '/auth.html';
    });

document.getElementById('workspace')
    .addEventListener('click', () => {
        window.location.href = '/contacts.html';
    });

async function loadProfile() {
}

loadProfile();

