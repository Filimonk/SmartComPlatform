class CatalogButtonsControl {
    constructor(header, catalog) {
        this.header = header;
        this.catalog = catalog;
        this.productsGrid = document.querySelector('.products-grid');
        this.token = localStorage.getItem('jwt_token');
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Делегирование событий на контейнере товаров
        this.productsGrid.addEventListener('click', (event) => {
            this.handleProductClick(event);
        });
    }

    handleProductClick(event) {
        const target = event.target.closest('[data-article]');
        
        if (!target) return;
        
        const article = target.dataset.article;
        const action = target.dataset.action;
        console.log(article);
        console.log(action);

        if (!article || !action) return;

        switch (action) {
            case 'increase':
                this.increaseQuantity(article);
                break;
            case 'decrease':
                this.decreaseQuantity(article);
                break;
        }
    }

    async increaseQuantity(article) {
        await this.changeQuantity(article, 1);
    }

    async decreaseQuantity(article) {
        await this.changeQuantity(article, -1);
    }

    async changeQuantity(article, delta) {
        if (!this.header.isAuth()) {
            this.header.showAuthModal();
            return;
        }
        
        this.header.changeCartCount(delta);
        const productQuantity = this.catalog.changeProductQuantity(article, delta);
        
        try {
            const response = await fetch('/api/cartservice/change-cart-product-count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    article: article,
                    productQuantity: productQuantity
                })
            });

            if (response.ok) {
            } else if (response.status === 401 || response.status === 403) {
                // Токен недействителен
                window.location.reload();
            } else {
                console.error('Ошибка сервера:', response.status);
                window.location.reload();
            }
        } catch (error) {
            console.error('Ошибка при изменении количества товара:', error);
            window.location.reload();
        }
    }
}

