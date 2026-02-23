class AuthModal {
    constructor() {
        this.isLoginMode = true;
        this.modalElement = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        const modalHTML = `
            <div class="auth-modal-overlay">
                <div class="auth-modal">
                    <div class="auth-modal-header">
                        <h2>Войти</h2>
                        <button class="close-modal">&times;</button>
                    </div>
                    <div class="auth-modal-content">
                        <form id="auth-form">
                            <div class="auth-form-input-part">
                                <div class="form-group">
                                    <input type="text" id="login" name="login" placeholder="Логин">
                                    <div class="error-message" id="login-error"></div>
                                </div>
                                <div class="form-group hidden" id="name-field">
                                    <input type="text" id="name" name="name" placeholder="Имя">
                                    <div class="error-message" id="name-error"></div>
                                </div>
                                <div class="form-group">
                                    <input type="password" id="password" name="password" placeholder="Пароль">
                                    <div class="error-message" id="password-error"></div>
                                </div>
                            </div>
                            <button type="submit" class="auth-submit-btn">Войти</button>
                        </form>
                        <div class="auth-switch">
                            <span id="auth-switch-text">Нет аккаунта? Зарегистрироваться</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modalElement = document.querySelector('.auth-modal-overlay');
    }

    bindEvents() {
        // Закрытие модального окна
        this.modalElement.querySelector('.close-modal').addEventListener('click', () => {
            this.hide();
        });

        // Клик вне модального окна
        this.modalElement.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.hide();
            }
        });

        // Переключение между входом и регистрацией
        this.modalElement.querySelector('#auth-switch-text').addEventListener('click', () => {
            this.toggleMode();
        });

        // Отправка формы
        this.modalElement.querySelector('#auth-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    toggleMode() {
        this.clearErrors();

        this.isLoginMode = !this.isLoginMode;

        const header = this.modalElement.querySelector('h2');
        const submitBtn = this.modalElement.querySelector('.auth-submit-btn');
        const switchText = this.modalElement.querySelector('#auth-switch-text');
        const nameField = this.modalElement.querySelector('#name-field');

        if (this.isLoginMode) {
            header.textContent = 'Войти';
            submitBtn.textContent = 'Войти';
            switchText.textContent = 'Нет аккаунта? Зарегистрироваться';
            nameField.classList.add('hidden');
        } else {
            header.textContent = 'Регистрация';
            submitBtn.textContent = 'Зарегистрироваться';
            switchText.textContent = 'Уже есть аккаунт? Войти';
            nameField.classList.remove('hidden');
        }
    }

    async handleSubmit() {
        const login = this.modalElement.querySelector('#login').value;
        const password = this.modalElement.querySelector('#password').value;
        const name = this.isLoginMode ? null : this.modalElement.querySelector('#name').value;

        this.clearErrors();

        // Валидация
        let hasError = false;

        if (!this.isLoginMode && !name) {
            this.showError('name', 'Заполните это поле');
            hasError = true;
        }

        if (!login) {
            this.showError('login', 'Заполните это поле');
            hasError = true;
        }

        if (!password) {
            this.showError('password', 'Заполните это поле');
            hasError = true;
        }

        if (hasError) return;

        try {
            const endpoint = this.isLoginMode ? '/api/authservice/authentication' : '/api/authservice/registration';
            const requestBody = this.isLoginMode
                ? { login, password }
                : { name, login, password };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('jwt_token', data.token);
                alert(
`Вход выполнен успешно!
Ваша сессия активна в течение 5 минут. По истечении этого времени потребуется повторная авторизация.`
                )
                window.location.reload();
            } else {
                const error = await response.json();
                if (error.field) {
                    this.showError(error.field, error.error);
                } else {
                    this.showError('general', error.error || 'Произошла ошибка на сервере');
                }
            }
        } catch (error) {
            this.showError('general', 'Произошла ошибка при соединении с сервером');
        }
    }

    showError(fieldId, message) {
        if (fieldId === 'general') {
            // Показываем браузерное всплывающее окно
            alert(message);
        } else {
            const errorElement = document.getElementById(`${fieldId}-error`);
            if (errorElement) {
                errorElement.textContent = message;
            } else {
                // Для общих ошибок показываем alert
                alert(message);
            }
        }
    }

    clearErrors() {
        const errorElements = this.modalElement.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.textContent = '';
        });
    }

    show() {
        this.modalElement.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    hide() {
        this.modalElement.style.display = 'none';
        document.body.style.overflow = '';
    }
}

