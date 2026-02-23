class Bank {
    constructor() {
        this.container = document.getElementById('bank-container');
        this.currentBalance = 0;
        this.token = localStorage.getItem("jwt_token");
        this.init();
    }

    async init() {
        try {
            const response = await fetch('/api/authservice/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                this.renderAuthMessage();
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }
        
            await this.loadBalance();
            this.renderBankPage();
            this.bindEvents();

        } catch (error) {
            if (error.name === 'TypeError') {
                alert('Произошла ошибка при соединении с сервером.\n\nСоздать заказ временно не получится. Попробуйте позже');
            } else {
                alert('Произошла ошибка на сервере.\n\nСоздать заказ временно не получится. Попробуйте позже');
            }
            console.error('Ошибка при загрузке корзины:', error);
        }
    }

    async loadBalance() {
        try {
            const response = await fetch('/api/bankservice/get-balance', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 200) {
                const data = await response.json();
                this.currentBalance = data.balance || 0;
            } else {
                console.error('Ошибка загрузки баланса:', response.status);
                this.currentBalance = 0;
            }
        } catch (error) {
            console.error('Ошибка загрузки баланса:', error);
            this.currentBalance = 0;
        }
    }

    renderAuthMessage() {
        this.container.innerHTML = `
            <div class="auth-message">
                <h1>Войдите или зарегистрируйтесь</h1>
                <p>Чтобы управлять балансом и совершать покупки на маркетплейсе.</p>
            </div>
        `;
    }

    renderBankPage() {
        this.container.innerHTML = `
            <div class="bank-header">
                <h1>Пополнение баланса</h1>
                <p>Пополните ваш баланс для совершения покупок на маркетплейсе</p>
            </div>
            
            <div class="balance-section">
                <p class="balance-label">Текущий баланс</p>
                <div class="balance-amount">${this.formatBalance(this.currentBalance)} ₽</div>
            </div>
            
            <div class="bank-form">
                <form class="top-up-form">
                    <div class="field">
                        <div class="description-part">
                            <label for="amount">Сумма пополнения</label>
                        </div>
                        <div class="input-part">
                            <input type="number" id="amount" name="amount" placeholder="0.00" step="0.01" min="1">
                            <div class="error-message" id="amount-error"></div>
                        </div>
                    </div>

                    <div>
                        <button type="submit" class="submit-button" id="submit-button">Пополнить баланс</button>
                    </div>
                    
                    <div class="success-message" id="success-message">
                        Баланс успешно пополнен!
                    </div>
                </form>
            </div>
        `;
    }

    bindEvents() {
        const form = document.querySelector('.top-up-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSubmit();
            });
        }
    }

    async handleSubmit() {
        this.clearMessages();
        
        const amountInput = document.getElementById('amount');
        // const submitButton = document.getElementById('submit-button');
        const amount = parseFloat(amountInput.value);

        // Валидация
        if (!amount || amount <= 0) {
            this.showError('amount', 'Введите положительную сумму пополнения');
            return;
        }

        if (amount > 1000000) {
            this.showError('amount', 'Сумма не может превышать 1 000 000 ₽');
            return;
        }

        // submitButton.disabled = true;
        // submitButton.textContent = 'Пополнение...';

        try {
            const response = await fetch('/api/bankservice/top-up-balance', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ amount: amount })
            });

            if (response.status === 204) {
                // Успешное пополнение
                // this.showSuccess();
                // setTimeout(() => {
                    // location.reload(); // Перезагружаем страницу для обновления баланса
                // }, 1500);
                location.reload();
            } else {
                const errorData = await response.json().catch(() => null);
                this.showError('amount', errorData?.message || `Ошибка: ${response.status}`);
            }
        } catch (error) {
            console.error('Ошибка при пополнении:', error);
            this.showError('amount', 'Ошибка соединения с сервером');
        } finally {
            // submitButton.disabled = false;
            // submitButton.textContent = 'Пополнить баланс';
        }
    }

    showError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    showSuccess() {
        const successElement = document.getElementById('success-message');
        if (successElement) {
            successElement.style.display = 'block';
        }
    }

    clearMessages() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.textContent = '';
        });

        const successElement = document.getElementById('success-message');
        if (successElement) {
            successElement.style.display = 'none';
        }
    }

    formatBalance(amount) {
        return new Intl.NumberFormat('ru-RU', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);
    }
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new Bank();
});

