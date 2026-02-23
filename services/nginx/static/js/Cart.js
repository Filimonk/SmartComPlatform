class Cart {
    constructor() {
        this.token = localStorage.getItem('jwt_token');
        this.button = document.querySelector('.create-order-button');
        this.cartCountElement = document.querySelector('.cart-info-box-line.first-header .right');
        this.itemsCountElement = document.querySelector('.cart-info-box-line.sum .left');
        this.sumElement = document.querySelector('.cart-info-box-line.sum .right');
        this.finalSumWithCardElement = document.querySelector('.cart-info-box-line.finale-sum-with-card .right');
        this.init();
    }

    init() {
        this.fetchCartData();
        this.addButtonListener();
    }

    async fetchCartData() {
        try {
            const response = await fetch('/api/cartservice/order-data', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                // Оставляем всё как есть (значения по умолчанию)
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP error: ${response.status}`);
            }

            const data = await response.json();
            this.updateCartUI(data);

        } catch (error) {
            if (error.name === 'TypeError') {
                alert('Произошла ошибка при соединении с сервером.\n\nСоздать заказ временно не получится. Попробуйте позже');
            } else {
                alert('Произошла ошибка на сервере.\n\nСоздать заказ временно не получится. Попробуйте позже');
            }
            console.error('Ошибка при загрузке корзины:', error);
        }
    }

    updateCartUI(data) {
        if (data['cartCount'] === 0) return;

        // Обновляем количество товаров
        const itemCount = data['cartCount'];
        const formattedCount = this.formatItemCount(itemCount);
        this.cartCountElement.textContent = `${itemCount} ${formattedCount}`;
        this.itemsCountElement.textContent = `Товары (${itemCount})`;

        // Обновляем суммы
        const formattedPrice = this.formatPrice(data['sum']);
        this.sumElement.textContent = `${formattedPrice} ₽`;
        this.finalSumWithCardElement.textContent = `${formattedPrice} ₽`;

        // Активируем кнопку
        this.button.classList.remove('disable');
        this.button.classList.add('enable');
    }

    formatItemCount(count) {
        const lastDigit = count % 10;
        const lastTwoDigits = count % 100;

        if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
            return 'товаров';
        }

        switch (lastDigit) {
            case 1: return 'товар';
            case 2:
            case 3:
            case 4: return 'товара';
            default: return 'товаров';
        }
    }

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU').format(price);
    }

    addButtonListener() {
        this.button.addEventListener('click', async () => {
            if (this.button.classList.contains('disable')) return;

            try {
                const token = IdempotencyToken.generate();
                const response = await fetch('/api/cartservice/create-order', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`,
                        'Idempotency-Token': token
                    }
                });
                
                if (response.status === 401 || response.status === 403) {
                    location.reload();
                    return;
                }

                if (response.status === 204) {
                    alert('Ваш заказ успешно создан. Его оплата будет проведена в течении 10 секунд.\n\nЕсли средств на счете достаточно, то она будет проведена успешно с вероятностью 50%. Если оплата не удастся, товары вернутся обратно в корзину, и вы сможете повторить попытку оплаты снова.\n\nЗа ходом исполнения вашего заказа можете следить на вкладке "Заказы"');
                    location.reload();
                } else {
                    throw new Error(`HTTP error: ${response.status}`);
                    location.reload();
                }

            } catch (error) {
                if (error.name === 'TypeError') {
                    alert('Произошла ошибка при соединении с сервером.\n\nСоздать заказ временно не получится. Попробуйте позже');
                } else {
                    alert('Произошла ошибка на сервере.\n\nСоздать заказ временно не получится. Попробуйте позже');
                }
                console.error('Ошибка при создании заказа:', error);
            }
        });
    }
}

// Класс для генерации токена идемпотентности
class IdempotencyToken {
    static generate() {
    }
}

