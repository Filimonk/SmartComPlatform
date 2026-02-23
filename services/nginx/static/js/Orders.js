class Orders {
    constructor() {
        this.container = document.getElementById('orders-container');
        this.token = localStorage.getItem('jwt_token');
    }

    async fetchAndRenderOrders() {
        try {
            const response = await fetch('/api/orderservice/fetch-orders-bulk', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.status === 401 || response.status === 403) {
                this.renderAuthMessage();
                return;
            }

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.renderOrders(data.orders || []);
        } catch (error) {
            console.error('Ошибка при загрузке заказов:', error);
            this.container.innerHTML = '<p class="error-message">Не удалось загрузить заказы. Попробуйте позже.</p>';
        }
    }

    renderAuthMessage() {
        this.container.innerHTML = `
            <div class="auth-message">
                <h1>Войдите или зарегистрируйтесь</h1>
                <p>Чтобы просматривать историю заказов и отслеживать их статус.</p>
            </div>
        `;
    }

    renderOrders(orders) {
        if (!orders || orders.length === 0) {
            this.container.innerHTML = '<p class="no-orders">У вас пока нет заказов</p>';
            return;
        }

        const list = document.createElement('div');
        list.className = 'orders-list';

        orders.forEach(order => {
            const card = this.createOrderCard(order);
            list.appendChild(card);
        });

        this.container.innerHTML = '';
        this.container.appendChild(list);
    }

    createOrderCard(order) {
        const card = document.createElement('div');
        card.className = 'order-card';

        const createdAt = new Date(order.created_at).toLocaleString('ru-RU');
        const amount = new Intl.NumberFormat('ru-RU').format(order.total_amount);

        card.innerHTML = `
            <div class="order-header">
                <div class="order-info">
                    Заказ #${order.order_id} <br>
                    от ${createdAt}
                </div>
                <div class="order-status ${order.status}">
                    ${order.status}
                </div>
                <div class="order-amount">
                    ${amount} ₽
                </div>
            </div>
            <ul class="order-items">
                ${order.items.map(item => `
                    <li>
                        <span>${item.article} × ${item.quantity}</span>
                        <span>${new Intl.NumberFormat('ru-RU').format(item.price)} ₽</span>
                    </li>
                `).join('')}
            </ul>
        `;

        return card;
    }
}

