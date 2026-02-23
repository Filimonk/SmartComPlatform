class Catalog {
    constructor() {
        this.productsGrid = document.querySelector('.products-grid');
        this.token = localStorage.getItem('jwt_token');
        this.init();
    }

    init() {
        this.fetchAndRenderProducts();
    }

    async fetchAndRenderProducts() {
        try {
            const response = await fetch('/api/catalogservice/fetch-products-bulk', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.renderProducts(data.products);
        } catch (error) {
            console.error('Ошибка при загрузке товаров:', error);
            this.productsGrid.innerHTML = '<p class="error-message">Не удалось загрузить товары. Попробуйте позже.</p>';
        }
    }

    formatPrice(price) {
        return new Intl.NumberFormat('ru-RU').format(price);
    }

    renderProducts(products) {
        if (!products || Object.keys(products).length === 0) {
            this.productsGrid.innerHTML = '<p class="no-products">Товары не найдены</p>';
            return;
        }

        this.productsGrid.innerHTML = '';
        
        for (const [article, product] of Object.entries(products)) {
            const productCard = this.createProductCard(article, product);
            this.productsGrid.appendChild(productCard);
        }
    }

    createProductCard(article, product) {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.dataset.article = article;

        const formattedPrice = this.formatPrice(product.price);
        
        card.innerHTML = `
            <div class="product-image">
                <svg class="placeholder-image" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="80" fill="#e0eafb" />
                    <rect x="60" y="60" width="80" height="60" rx="5" fill="#005bff" />
                    <circle cx="100" cy="140" r="20" fill="#005bff" />
                    <rect x="75" y="40" width="50" height="10" rx="5" fill="#005bff" />
                </svg>
            </div>
            <div class="product-details">
                <div class="price">${formattedPrice} ₽</div>
                <div class="seller-name">${this.escapeHtml(product.sellerName)}</div>
                <div class="name">${this.escapeHtml(product.name)}</div>
                <div class="rating">
                    <svg viewBox="0 0 16 16" width="16" height="16">
                        <path fill="currentColor" d="M8 2a1 1 0 0 1 .87.508l1.538 2.723 2.782.537a1 1 0 0 1 .538 1.667L11.711 9.58l.512 3.266A1 1 0 0 1 10.8 13.9L8 12.548 5.2 13.9a1 1 0 0 1-1.423-1.055l.512-3.266-2.017-2.144a1 1 0 0 1 .538-1.667l2.782-.537 1.537-2.723A1 1 0 0 1 8 2"></path>
                    </svg>
                    <span>${product.rating.toFixed(1)}</span>
                </div>
            </div>
            ${this.renderCartControls(article, product.productQuantity)}
        `;

        return card;
    }

    renderCartControls(article, quantity) {
        if (quantity === 0) {
            return `
                <div class="add-to-cart" data-article="${article}" data-action="increase">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="9" cy="21" r="1"></circle>
                        <circle cx="20" cy="21" r="1"></circle>
                        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                    </svg>
                    <span>Сегодня</span>
                </div>
            `;
        } else {
            return `
                <div class="quantity-control">
                    <button class="quantity-control-btn" data-article="${article}" data-action="decrease">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                            <path fill="currentColor" d="M1.333 8c0-.69.56-1.25 1.25-1.25h10.834a1.25 1.25 0 1 1 0 2.5H2.583c-.69 0-1.25-.56-1.25-1.25"></path>
                        </svg>
                    </button> 
                    <span class="quantity">${quantity}</span>
                    <button class="quantity-control-btn" data-article="${article}" data-action="increase">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                            <path fill="currentColor" d="M8 1.333c.69 0 1.25.56 1.25 1.25V6.75h4.167a1.25 1.25 0 1 1 0 2.5H9.25v4.167a1.25 1.25 0 0 1-2.5 0V9.25H2.583a1.25 1.25 0 0 1 0-2.5H6.75V2.583c0-.69.56-1.25 1.25-1.25"></path>
                        </svg>
                    </button>
                </div>
            `;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    changeProductQuantity(article, delta) {
        const card = this.productsGrid.querySelector(`.product-card[data-article="${article}"]`);
        if (!card) return;
        
        const controlsContainer = card.querySelector('.add-to-cart, .quantity-control');
        
        if (controlsContainer) {
            let quantity;

            // Определяем текущее количество
            if (controlsContainer.classList.contains('add-to-cart')) {
                quantity = 0;
            } else {
                const quantityElement = controlsContainer.querySelector('.quantity');
                quantity = parseInt(quantityElement.textContent, 10);

                // Проверяем, что quantity - число
                if (isNaN(quantity)) {
                    quantity = 0;
                }
            }

            // Изменяем количество на дельту
            quantity += delta;

            // Не позволяем количеству быть отрицательным
            if (quantity < 0) {
                quantity = 0;
            }

            // Обеспечиваем, что quantity - целое число
            quantity = Math.floor(quantity);

            // Обновляем UI
            controlsContainer.outerHTML = this.renderCartControls(article, quantity);
            return quantity;
        }
    }
}

