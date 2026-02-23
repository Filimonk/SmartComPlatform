class ProductForm {
    constructor() {
        this.formElement = document.querySelector('.add-product-form');
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        this.formElement.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });
    }

    async handleSubmit() {
        // Очищаем предыдущие ошибки
        this.clearErrors();

        // Собираем данные формы
        const formData = {
            name: document.getElementById('name').value.trim(),
            price: parseFloat(document.getElementById('price').value),
            description: document.getElementById('description').value.trim(),
            sellerName: document.getElementById('seller-name').value.trim(),
            rating: parseFloat(document.getElementById('rating').value)
        };

        // Валидация
        let hasError = false;

        if (!formData.name) {
            this.showError('name', 'Заполните это поле');
            hasError = true;
        }

        if (!formData.price) {
            this.showError('price', 'Заполните это поле');
            hasError = true;
        }
        else if (parseFloat(formData.price) <= 0) {
            this.showError('price', 'Цена должна быть положительным числом');
            hasError = true;
        }

        if (!formData.description) {
            this.showError('description', 'Заполните это поле');
            hasError = true;
        }

        if (!formData.sellerName) {
            this.showError('seller-name', 'Заполните это поле');
            hasError = true;
        }

        if (!formData.rating) {
            this.showError('rating', 'Заполните это поле');
            hasError = true;
        }
        else if (parseFloat(formData.rating) < 1 || parseFloat(formData.rating) > 5) {
            this.showError('rating', 'Оценка должна быть от 1.00 до 5.00');
            hasError = true;
        }

        if (hasError) return;

        try {
            const response = await fetch('/api/catalogservice/add-product', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                // Успешное добавление
                alert("Товар добавлен!");
                this.formElement.reset();
                window.scrollTo({top: 0, behavior: 'smooth'});
            } else {
                // Ошибка сервера
                const error = await response.json();
                if (error.field) {
                    this.showError(error.field, error.error || 'Ошибка при отправке данных');
                } else {
                    this.showError('general', 'Произошла ошибка на сервере');
                }
            }
        } catch (error) {
            this.showError('general', 'Произошла ошибка при соединении с сервером, попробуйте позже');
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
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.textContent = '';
        });
    }
}

// Инициализация формы после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    new ProductForm();
});
