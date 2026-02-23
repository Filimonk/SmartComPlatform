class Profile {
    constructor() {
        this.container = document.getElementById('profile-container');
        this.token = localStorage.getItem("jwt_token");
        this.init();
    }

    async init() {
        if (!this.token) {
            this.renderAuthMessage();
            return;
        }

        try {
            const response = await fetch('/api/authservice/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                this.renderAuthMessage();
            } else if (response.ok) {
                this.renderProfilePage();
            } else {
                this.renderAuthMessage();
            }
        } catch (e) {
            console.error("Ошибка проверки JWT:", e);
            this.renderAuthMessage();
        }
    }

    renderAuthMessage() {
        this.container.innerHTML = `
            <div class="auth-message">
                <h1>Войдите или зарегистрируйтесь</h1>
                <p>Чтобы делать покупки, отслеживать заказы и пользоваться персональными скидками и баллами.</p>
            </div>
        `;
    }

    renderProfilePage() {
        this.container.innerHTML = `
            <div class="profile-header">
                <h1>Личный кабинет</h1>
                <p>Управление вашей учетной записью и просмотр статистики</p>
            </div>
            <div class="profile-stats">
                <div class="stats-section">
                    <h2>Ваша статистика</h2>
                    <div class="stat-item">
                        <p>• Последний вход: Сегодня</p>
                    </div>
                    <div class="stat-item">
                        <p>• Статус учетной записи: Активна</p>
                    </div>
                    <div class="stat-item">
                        <p>• Уровень доверия: Высокий</p>
                    </div>
                </div>

                <div class="stat-divider"></div>

                <div class="stats-section">
                    <h2>Информация о системе</h2>
                    <div class="stat-item">
                        <p>• Вы используете современный веб-браузер</p>
                    </div>
                    <div class="stat-item">
                        <p>• Соединение защищено</p>
                    </div>
                    <div class="stat-item">
                        <p>• Время работы системы: 24/7</p>
                    </div>
                </div>
            </div>
            <a class="logout-link" id="logout-link">Выйти из аккаунта</a>
        `;

        document.getElementById("logout-link").addEventListener("click", () => {
            localStorage.removeItem("jwt_token");
            window.location.reload();
        });
    }

    getRegistrationDate() {
        const today = new Date();
        const month = today.toLocaleString('ru-RU', { month: 'long' });
        const year = today.getFullYear();
        return `${today.getDate()} ${month} ${year} года`;
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new Profile();
});

