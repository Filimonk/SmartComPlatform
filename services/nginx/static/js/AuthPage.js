class AuthPage {
    constructor() {
        this.isLoginMode = true; // true — вход, false — регистрация

        // Элементы DOM
        this.header = document.querySelector('.header p');
        this.form = document.querySelector('.form');
        this.emailInput = document.querySelector('input[name="email"]');
        this.passwordInput = document.querySelector('input[name="password"]');
        this.nameField = document.getElementById('name-field');
        this.nameInput = this.nameField?.querySelector('input[name="name"]');
        this.submitButton = document.querySelector('.submit_button');
        this.toggleLink = document.querySelector('.toggle p'); // текст ссылки

        // Контейнеры для сообщений об ошибках (p внутри .message)
        this.emailError = this.emailInput?.closest('.auth_form_line')?.querySelector('.message p');
        this.passwordError = this.passwordInput?.closest('.auth_form_line')?.querySelector('.message p');
        this.nameError = this.nameField?.querySelector('.message p');

        this.init();
    }

    init() {
        if (!this.emailInput || !this.passwordInput || !this.submitButton || !this.toggleLink) {
            console.error('Не все элементы формы найдены');
            return;
        }

        // Обработчик кнопки отправки
        this.submitButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        // Обработчик переключения режима
        this.toggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMode();
        });

        // Очищаем ошибки при вводе (опционально)
        this.emailInput.addEventListener('input', () => this.clearFieldError('email'));
        this.passwordInput.addEventListener('input', () => this.clearFieldError('password'));
        if (this.nameInput) {
            this.nameInput.addEventListener('input', () => this.clearFieldError('name'));
        }
    }

    // Переключение между входом и регистрацией
    toggleMode() {
        this.isLoginMode = !this.isLoginMode;
        this.clearErrors();

        // Меняем заголовок
        this.header.textContent = this.isLoginMode ? 'Вход' : 'Регистрация';

        // Меняем текст кнопки
        this.submitButton.querySelector('p').textContent = this.isLoginMode ? 'Войти' : 'Зарегистрироваться';

        // Меняем текст ссылки
        this.toggleLink.textContent = this.isLoginMode
            ? 'Нет аккаунта? Зарегистрироваться'
            : 'Уже есть аккаунт? Войти';

        // Плавно показываем/скрываем поле имени
        if (this.nameField) {
            if (this.isLoginMode) {
                this.nameField.classList.add('hidden');
            } else {
                this.nameField.classList.remove('hidden');
            }
        }
    }

    // Очистка всех ошибок
    clearErrors() {
        this.clearFieldError('email');
        this.clearFieldError('password');
        this.clearFieldError('name');
    }

    clearFieldError(field) {
        const input = field === 'email' ? this.emailInput
                    : field === 'password' ? this.passwordInput
                    : this.nameInput;
        const errorEl = field === 'email' ? this.emailError
                      : field === 'password' ? this.passwordError
                      : this.nameError;

        if (input) input.classList.remove('input--error');
        if (errorEl) errorEl.textContent = '';
    }

    // Показать ошибку конкретного поля
    showError(field, message) {
        // Маппинг полей сервера на наши
        let targetField = field;
        if (field === 'login') targetField = 'email'; // сервер может вернуть login

        const input = targetField === 'email' ? this.emailInput
                    : targetField === 'password' ? this.passwordInput
                    : targetField === 'name' ? this.nameInput
                    : null;
        const errorEl = targetField === 'email' ? this.emailError
                      : targetField === 'password' ? this.passwordError
                      : targetField === 'name' ? this.nameError
                      : null;

        if (input && errorEl) {
            input.classList.add('input--error');
            errorEl.textContent = message;
        } else {
            // Если поле не найдено или общая ошибка — показываем alert
            alert(message);
        }
    }

    // Валидация на стороне клиента (простейшая)
    validate() {
        let isValid = true;

        if (!this.emailInput.value.trim()) {
            this.showError('email', 'Заполните это поле');
            isValid = false;
        }

        if (!this.passwordInput.value) {
            this.showError('password', 'Заполните это поле');
            isValid = false;
        }

        if (!this.isLoginMode && !this.nameInput?.value.trim()) {
            this.showError('name', 'Заполните это поле');
            isValid = false;
        }

        return isValid;
    }

    // Отправка данных на сервер
    async handleSubmit() {
        this.clearErrors();

        if (!this.validate()) return;

        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        const name = this.isLoginMode ? null : this.nameInput?.value.trim();

        // Определяем endpoint
        const endpoint = this.isLoginMode
            ? '/api/authservice/authentication'
            : '/api/authservice/registration';

        // Формируем тело запроса (сервер ожидает login, а не email)
        const requestBody = this.isLoginMode
            ? { login: email, password }
            : { name, login: email, password };

        try {
            const response = await axios.post(endpoint, requestBody, {
                headers: { 'Content-Type': 'application/json' }
            });

            // Успех
            const data = response.data;
            localStorage.setItem('jwt_token', data.token);
            alert(
                this.isLoginMode
                    ? 'Вход выполнен успешно!\nВаша сессия активна в течение 5 минут.'
                    : 'Регистрация прошла успешно!'
            );
            window.location.href = '/index.html'; // или редирект на главную

        } catch (error) {
            if (error.response && error.response.data) {
                const errData = error.response.data;
                // Если сервер вернул поле field и сообщение
                if (errData.field && errData.error) {
                    this.showError(errData.field, errData.error);
                } else {
                    // Общая ошибка (например, 500)
                    alert(errData.error || 'Произошла ошибка на сервере');
                }
            } else {
                alert('Ошибка соединения с сервером');
            }
        }
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new AuthPage();
});

