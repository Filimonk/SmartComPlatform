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
        this.originSmsProviderSelect = document.querySelector('.origin-sms-provider');
        this.originWhatsappProviderSelect = document.querySelector('.origin-whatsapp-provider');
        this.connectionValueInput = document.querySelector('.connection-value-input');
        this.requirementsWarning = document.querySelector('.origin-requirements-warning');

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadOrigins();
        this.setupChannelDependentFields();

        const urlParams = new URLSearchParams(window.location.search);
        const originId = urlParams.get('id');
        if (originId) {
            this.selectedOriginId = originId;
            await this.loadOriginDetails(originId);
            await this.loadConnections();
            this.showDetailView();
        } else {
            this.showListView();
        }
    }

    bindEvents() {
        this.createOriginBtn.addEventListener('click', () => this.createOrigin());
        this.backToListBtn.addEventListener('click', () => this.goBackToList());
        this.saveOriginBtn.addEventListener('click', () => this.updateOrigin());
        this.createConnectionBtn.addEventListener('click', () => this.createConnection());
        this.originChannelSelect.addEventListener('change', () => this.onChannelChange());
        this.originSmsProviderSelect.addEventListener('change', () => this.onChannelChange());
        this.originWhatsappProviderSelect.addEventListener('change', () => this.onChannelChange());
    }

    setupChannelDependentFields() {
        this.onChannelChange();
    }

    onChannelChange() {
        const channel = this.originChannelSelect.value;
        this.originEmailServerInput.style.display = 'none';
        this.originSmsProviderSelect.style.display = 'none';
        this.originWhatsappProviderSelect.style.display = 'none';

        if (channel === 'mail') {
            this.originEmailServerInput.style.display = 'block';
        } else if (channel === 'sms') {
            this.originSmsProviderSelect.style.display = 'block';
        } else if (channel === 'whatsapp') {
            this.originWhatsappProviderSelect.style.display = 'block';
        }
        // this.updateConnectionPlaceholder();
    }

    updateConnectionPlaceholder(connectionsBlocked) {
        const channel = this.originChannelSelect.value;
        let placeholder = '';
        let disabled = connectionsBlocked;
        console.log(this.originSmsProviderSelect.value);
        if (channel === 'sms' && this.originSmsProviderSelect.value === 'exolve') {
            placeholder = 'Номер телефона (в формате 71234567890)';
            // disabled = false;
        } else if (channel === 'sms' && this.originSmsProviderSelect.value === 'sms_aero') {
            placeholder = 'Логин от сервиса SMS Aero';
            // disabled = false;
        } else if (channel === 'telegram') {
            placeholder = 'Введите название бота';
            // disabled = true;
        } else if (channel === 'mail') {
            placeholder = 'Email адрес';
            // disabled = false;
        } else if (channel === 'whatsapp') {
            placeholder = 'Логин от сервиса SMS Aero';
            // disabled = false;
        }
        this.connectionValueInput.placeholder = placeholder;
        this.connectionValueInput.disabled = disabled;
    }

    async loadOrigins() {
        try {
            const response = await api.get('/communicationservice/v1/origin');
            this.origins = response.data.origins || [];
            this.renderOriginsList();
        } catch (error) {
            console.error('Ошибка загрузки источников:', error);
            this.showError('Не удалось загрузить список источников');
        }
    }

    renderOriginsList() {
        if (!this.originsListContainer) return;
        if (this.origins.length === 0) {
            this.originsListContainer.innerHTML = '<p>Нет источников. Создайте первый!</p>';
            return;
        }
        const listHtml = this.origins.map(origin => {
            const requiresAction = origin.requiresAction === true;
            const apiKeyMasked = origin.apiKeyMasked || (origin.apiKey ? this.maskApiKey(origin.apiKey) : '');
            return `
                <div class="origin-item" data-id="${origin.id}">
                    <div class="origin-main">
                        <a href="/origins.html?id=${origin.id}" class="origin-name-link">${this.escapeHtml(origin.name)}</a>
                        <button class="edit-origin-btn" data-id="${origin.id}">✎ Редактировать</button>
                    </div>
                    <div class="origin-details">
                        <span>📡 ${this.escapeHtml(origin.channel || '—')}</span>
                        ${apiKeyMasked ? `<span>🔑 ${this.escapeHtml(apiKeyMasked)}</span>` : ''}
                        ${origin.provider ? `<span>🏭 ${this.escapeHtml(origin.provider)}</span>` : ''}
                        ${requiresAction ? '<span class="requires-action">⚠️ Требует действий</span>' : ''}
                    </div>
                </div>
            `;
        }).join('');
        this.originsListContainer.innerHTML = listHtml;

        document.querySelectorAll('.edit-origin-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                window.location.href = `/origins.html?id=${id}`;
            });
        });
    }

    async loadOriginDetails(originId) {
        try {
            const response = await api.get(`/communicationservice/v1/origin/${originId}`);
            this.selectedOrigin = response.data;
            this.populateOriginForm(this.selectedOrigin);
            this.updateUIByRequiresAction(this.selectedOrigin.requiresAction);
        } catch (error) {
            console.error('Ошибка загрузки источника:', error);
            this.showError('Не удалось загрузить данные источника');
            this.goBackToList();
        }
    }

    populateOriginForm(origin) {
        this.originNameInput.value = origin.name || '';
        this.originChannelSelect.value = origin.channel || 'telegram';
        // Если requiresAction === true, apiKey возвращается в открытом виде
        this.originApiKeyInput.value = origin.apiKey || '';
        if (origin.emailServerAddress) {
            this.originEmailServerInput.value = origin.emailServerAddress;
        }
        if (origin.provider) {
            if (origin.channel === 'sms') {
                this.originSmsProviderSelect.value = origin.provider;
            } else if (origin.channel === 'whatsapp') {
                this.originWhatsappProviderSelect.value = origin.provider;
            }
        }
        this.onChannelChange();
    }

    updateUIByRequiresAction(requiresAction) {
        // Блокируем поля (кроме имени) если requiresAction === false
        const isCompleted = !requiresAction;
        const fieldsToBlock = [
            this.originChannelSelect,
            this.originApiKeyInput,
            this.originEmailServerInput,
            this.originSmsProviderSelect,
            this.originWhatsappProviderSelect
        ];
        fieldsToBlock.forEach(field => {
            if (field) field.disabled = isCompleted;
        });
        // Кнопка сохранить активна всегда (можно менять имя)
        this.saveOriginBtn.disabled = false;
        // Показываем предупреждение, если требуется действие
        if (this.requirementsWarning) {
            this.requirementsWarning.style.display = requiresAction ? 'block' : 'none';
            if (requiresAction) {
                this.requirementsWarning.textContent = '⚠️ Для завершения настройки заполните все обязательные поля для выбранного канала.';
            }
        }
        // Блок добавления соединений разблокируется только когда всё заполнено
        const connectionsBlocked = requiresAction;
        this.connectionValueInput.disabled = connectionsBlocked;
        this.createConnectionBtn.disabled = connectionsBlocked;
        if (connectionsBlocked) {
            this.connectionValueInput.placeholder = 'Сначала завершите настройку источника';
        } else {
            this.updateConnectionPlaceholder(connectionsBlocked);
        }
    }

    async loadConnections() {
        if (!this.selectedOriginId) return;
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
        const channel = this.selectedOrigin?.channel;
        if (this.connections.length === 0) {
            let message = 'Нет соединений. Добавьте новое.';
            this.connectionsListContainer.innerHTML = `<p>${message}</p>`;
            return;
        }
        const listHtml = this.connections.map(conn => {
            let label = '';
            let value = '';
            if (conn.phoneNumber) {
                label = 'Номер телефона';
                value = conn.phoneNumber;
            } else if (conn.mailAddress) {
                label = 'Email';
                value = conn.mailAddress;
            } else if (conn.commonIdentifier) {
                label = channel === 'whatsapp' ? 'WhatsApp login' : 'Telegram bot';
                if (channel === 'whatsapp') {
                    label = 'WhatsApp login';
                } else if (channel === 'telegram') {
                    label = 'Telegram bot';
                } else if (channel === 'sms' && this.originSmsProviderSelect.value === 'sms_aero') {
                    label = 'SMS Aero';
                }
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
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const connId = btn.dataset.id;
                if (confirm('Удалить соединение?')) {
                    try {
                        await api.delete(`/communicationservice/v1/origin/${this.selectedOriginId}/connection/${connId}`);
                        await this.loadConnections();
                    } catch (error) {
                        this.showError('Не удалось удалить соединение');
                    }
                }
            });
        });
    }

    async createOrigin() {
        try {
            const response = await api.post('/communicationservice/v1/origin', {});
            const newOrigin = response.data;
            window.location.href = `/origins.html?id=${newOrigin.id}`;
        } catch (error) {
            console.error('Ошибка создания источника:', error);
            this.showError('Не удалось создать источник');
        }
    }

    async updateOrigin() {
        const name = this.originNameInput.value.trim();
        const channel = this.originChannelSelect.value;
        const apiKey = this.originApiKeyInput.value.trim();
        const emailServer = this.originEmailServerInput.value.trim();
        const smsProvider = this.originSmsProviderSelect.value;
        const whatsappProvider = this.originWhatsappProviderSelect.value;

        if (!name) {
            this.showError('Имя не может быть пустым');
            return;
        }
        // // Валидация обязательных полей в зависимости от канала (на фронте для удобства)
        // let missingFields = [];
        // if (!apiKey) missingFields.push('API Key');
        // if (channel === 'mail' && !emailServer) missingFields.push('SMTP сервер');
        // if (channel === 'sms' && !smsProvider) missingFields.push('Провайдер SMS');
        // if (channel === 'whatsapp' && !whatsappProvider) missingFields.push('Провайдер WhatsApp');
        // if (missingFields.length > 0) {
            // this.showError(`Заполните обязательные поля: ${missingFields.join(', ')}`);
            // return;
        // }

        const payload = { name, channel, apiKey };
        if (channel === 'mail') payload.emailServerAddress = emailServer;
        if (channel === 'sms') payload.provider = smsProvider;
        if (channel === 'whatsapp') payload.provider = whatsappProvider;

        try {
            const response = await api.patch(`/communicationservice/v1/origin/${this.selectedOriginId}`, payload);
            const updatedOrigin = response.data;
            // Обновляем локальные данные и UI
            this.selectedOrigin = updatedOrigin;
            this.populateOriginForm(updatedOrigin);
            this.updateUIByRequiresAction(updatedOrigin.requiresAction);
            // Если requiresAction теперь false, перезагружаем список (для обновления маскированного ключа)
            if (!updatedOrigin.requiresAction) {
                await this.loadOrigins();
            }
            this.showSuccess('Источник успешно сохранён');
        } catch (error) {
            console.error('Ошибка обновления источника:', error);
            const msg = error.response?.data?.message || 'Не удалось обновить источник';
            this.showError(msg);
        }
    }

    async createConnection() {
        const channel = this.selectedOrigin?.channel;
        const value = this.connectionValueInput.value.trim();
        if (!value) {
            this.showError('Введите значение');
            return;
        }
        let payload = {};
        if (channel === 'sms' && this.originSmsProviderSelect.value === 'exolve') {
            payload.phoneNumber = value;
        } else if (channel === 'sms' && this.originSmsProviderSelect.value === 'sms_aero') {
            payload.commonIdentifier = value;
        } else if (channel === 'mail') {
            payload.mailAddress = value;
        } else if (channel === 'whatsapp') {
            payload.commonIdentifier = value;
        } else if (channel === 'telegram') {
            payload.commonIdentifier = value;
        } else {
            this.showError('Неподдерживаемый канал');
            return;
        }
        try {
            await api.post(`/communicationservice/v1/origin/${this.selectedOriginId}/connection`, payload);
            this.connectionValueInput.value = '';
            await this.loadConnections();
            this.showSuccess('Соединение добавлено');
        } catch (error) {
            const msg = error.response?.data?.message || 'Ошибка создания соединения';
            this.showError(msg);
        }
    }

    goBackToList() {
        window.location.href = '/origins.html';
    }

    showListView() {
        this.listView.style.display = 'block';
        this.detailView.style.display = 'none';
    }

    showDetailView() {
        this.listView.style.display = 'none';
        this.detailView.style.display = 'block';
    }

    showError(message) {
        alert(`Ошибка: ${message}`);
    }

    showSuccess(message) {
        alert(`${message}`);
    }

    maskApiKey(key) {
        if (!key) return '';
        if (key.length <= 4) return '***';
        return key.slice(0, 2) + '***' + key.slice(-2);
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
