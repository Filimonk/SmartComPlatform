class OriginsPage {
    constructor() {
        this.origins = [];
        this.selectedOriginId = null;
        this.selectedOrigin = null;
        this.connections = [];

        this.listView = document.querySelector('.origins-list-view');
        this.detailView = document.querySelector('.origin-detail-view');
        this.originsListContainer = document.querySelector('.origins-list');
        this.connectionsListContainer = document.querySelector('.connections-list');

        this.createOriginBtn = document.querySelector('.create-origin-btn');
        this.backToListBtn = document.querySelector('.back-to-list-btn');
        this.saveOriginBtn = document.querySelector('.save-origin-btn');
        this.createConnectionBtn = document.querySelector('.create-connection-btn');

        this.originNameInput = document.querySelector('.origin-name-input');
        this.originChannelSelect = document.querySelector('.origin-channel-select');
        this.originApiKeyInput = document.querySelector('.origin-apikey-input');
        this.originEmailServerInput = document.querySelector('.origin-email-server-input');
        this.originSmsProviderSelect = document.querySelector('.origin-sms-provider'); // фиктивный
        this.connectionValueInput = document.querySelector('.connection-value-input');

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadOrigins();
        this.setupChannelDependentFields();
    }

    bindEvents() {
        this.createOriginBtn.addEventListener('click', () => this.createOrigin());
        this.backToListBtn.addEventListener('click', () => this.showListView());
        this.saveOriginBtn.addEventListener('click', () => this.updateOrigin());
        this.createConnectionBtn.addEventListener('click', () => this.createConnection());
        this.originChannelSelect.addEventListener('change', () => this.onChannelChange());
    }

    setupChannelDependentFields() {
        this.onChannelChange();
    }

    onChannelChange() {
        const channel = this.originChannelSelect.value;
        // Показываем/скрываем поле emailServerAddress и фиктивный провайдер
        if (channel === 'mail') {
            this.originEmailServerInput.style.display = 'block';
            this.originSmsProviderSelect.style.display = 'none';
        } else if (channel === 'sms') {
            this.originEmailServerInput.style.display = 'none';
            this.originSmsProviderSelect.style.display = 'block';
        } else {
            this.originEmailServerInput.style.display = 'none';
            this.originSmsProviderSelect.style.display = 'none';
        }
        // Также меняем placeholder для поля добавления connection
        this.updateConnectionPlaceholder();
    }

    updateConnectionPlaceholder() {
        const channel = this.originChannelSelect.value;
        let placeholder = '';
        if (channel === 'sms') placeholder = 'Номер телефона (например, +7...)';
        else if (channel === 'telegram') placeholder = 'Идентификатор бота (например, @mybot)';
        else if (channel === 'mail') placeholder = 'Email адрес';
        this.connectionValueInput.placeholder = placeholder;
    }

    async loadOrigins() {
        try {
            const response = await api.get('/communicationservice/v1/origin');
            this.origins = response.data.origins || [];
            this.renderOriginsList();
        } catch (error) {
            console.error('Ошибка загрузки источников:', error);
        }
    }

    renderOriginsList() {
        if (!this.originsListContainer) return;
        if (this.origins.length === 0) {
            this.originsListContainer.innerHTML = '<p>Нет источников. Создайте первый!</p>';
            return;
        }
        const listHtml = this.origins.map(origin => `
            <div class="origin-item" data-id="${origin.id}">
                <div class="origin-name">${this.escapeHtml(origin.name)}</div>
                <button class="edit-origin-btn" data-id="${origin.id}" data-name="${this.escapeHtml(origin.name)}">✎ Редактировать</button>
            </div>
        `).join('');
        this.originsListContainer.innerHTML = listHtml;

        document.querySelectorAll('.edit-origin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                this.showOriginDetail(id);
            });
        });
    }

    async showOriginDetail(originId) {
        this.selectedOriginId = originId;
        // Загружаем полные данные источника (через GET /v1/origin? но у нас нет ручки получения одного источника, только список)
        // Поэтому найдём в массиве this.origins
        const origin = this.origins.find(o => o.id === originId);
        if (!origin) return;
        this.selectedOrigin = origin;
        this.originNameInput.value = origin.name;
        // У источника может быть канал, apiKey и т.д., но в GetAllOriginsResponse их нет. Поэтому при открытии деталей нужно запросить полную информацию.
        // Однако бэк не предоставляет GET /v1/origin/{id}. Придётся хранить данные после создания/обновления.
        // Пока что просто заполним поля пустыми, а при сохранении отправим PATCH.
        this.originChannelSelect.value = 'telegram'; // по умолчанию
        this.originApiKeyInput.value = '';
        this.originEmailServerInput.value = '';
        this.onChannelChange();

        await this.loadConnections();
        this.showDetailView();
    }

    async loadConnections() {
        try {
            const response = await api.get(`/communicationservice/v1/origin/${this.selectedOriginId}/connection`);
            this.connections = response.data.connections || [];
            this.renderConnectionsList();
        } catch (error) {
            console.error('Ошибка загрузки соединений:', error);
            this.connections = [];
            this.renderConnectionsList();
        }
    }

    renderConnectionsList() {
        if (!this.connectionsListContainer) return;
        if (this.connections.length === 0) {
            this.connectionsListContainer.innerHTML = '<p>Нет соединений. Добавьте новое.</p>';
            return;
        }
        const listHtml = this.connections.map(conn => {
            let label = '';
            let value = '';
            if (conn.phoneNumber) {
                label = 'SMS номер';
                value = conn.phoneNumber;
            } else if (conn.mailAddress) {
                label = 'Email';
                value = conn.mailAddress;
            } else if (conn.commonIdentifier) {
                label = 'Telegram ID';
                value = conn.commonIdentifier;
            } else {
                label = 'unknown';
                value = '—';
            }
            return `
                <div class="connection-item" data-id="${conn.id}">
                    <div class="connection-info">
                        <strong>${label}:</strong> ${this.escapeHtml(value)}
                    </div>
                    <button class="delete-connection-btn" data-id="${conn.id}">Удалить</button>
                </div>
            `;
        }).join('');
        this.connectionsListContainer.innerHTML = listHtml;

        document.querySelectorAll('.delete-connection-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Удаление пока не реализовано');
            });
        });
    }

    async createOrigin() {
        try {
            await api.post('/communicationservice/v1/origin', {});
            await this.loadOrigins();
        } catch (error) {
            console.error('Ошибка создания источника:', error);
        }
    }

    async updateOrigin() {
        const name = this.originNameInput.value.trim();
        const channel = this.originChannelSelect.value;
        const apiKey = this.originApiKeyInput.value.trim();
        const emailServerAddress = this.originEmailServerInput.value.trim();

        if (!name) {
            alert('Имя не может быть пустым');
            return;
        }
        const payload = {
            name: name,
            channel: channel,
            apiKey: apiKey
        };
        if (channel === 'mail') {
            payload.emailServerAddress = emailServerAddress;
        }
        try {
            await api.patch(`/communicationservice/v1/origin/${this.selectedOriginId}`, payload);
            await this.loadOrigins();
            // Обновим выбранный источник
            const updated = this.origins.find(o => o.id === this.selectedOriginId);
            if (updated) {
                this.selectedOrigin = updated;
                this.originNameInput.value = updated.name;
            } else {
                this.showListView();
            }
        } catch (error) {
            console.error('Ошибка обновления источника:', error);
        }
    }

    async createConnection() {
        const channel = this.originChannelSelect.value;
        const value = this.connectionValueInput.value.trim();
        if (!value) {
            alert('Введите значение');
            return;
        }
        let payload = {};
        if (channel === 'sms') {
            payload.phoneNumber = value;
        } else if (channel === 'telegram') {
            payload.commonIdentifier = value;
        } else if (channel === 'mail') {
            payload.mailAddress = value;
        } else {
            alert('Неподдерживаемый канал');
            return;
        }
        try {
            await api.post(`/communicationservice/v1/origin/${this.selectedOriginId}/connection`, payload);
            this.connectionValueInput.value = '';
            await this.loadConnections();
        } catch (error) {
            console.error('Ошибка создания соединения:', error);
        }
    }

    showListView() {
        this.listView.style.display = 'block';
        this.detailView.style.display = 'none';
        this.selectedOriginId = null;
        this.selectedOrigin = null;
    }

    showDetailView() {
        this.listView.style.display = 'none';
        this.detailView.style.display = 'block';
    }

    escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OriginsPage();
});
