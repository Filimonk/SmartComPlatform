class Desktop {
    constructor(contactId) {
        this.contactId = contactId;
        this.API_ROUTES = {
            sendMessage: "/v1/send/message",
            getMessages: `/v1/contact/${contactId}/message`
        };

        this.chatTextArea = document.querySelector('.chat_input_field');
        this.chatSendButton = document.querySelector('.chat_send_button');
        this.chatHistoryContainer = document.querySelector('.chat_history');

        this.modeOptions = document.querySelectorAll('.mode-option');
        this.currentMode = 'auto';
        this.customOriginConnectionId = null;
        this.customConnectionId = null;

        this.messageCount = 0;         // для отслеживания количества сообщений
        this.pollingInterval = null;    // для хранения интервала
        this.isFirstMessageCheck = true; // флаг для проверки первого сообщения

        this.loadCustomSelection();
        this.tokenIdempotency = self.crypto.randomUUID();

        // Контакт
        this.editContactBtn = document.querySelector('.userinfo_edit_contact');


        this.aiFixBtn = null;
        this.aiApplyBtn = null;
        this.aiSuggestionField = null;

        this.tasksManager = new WorkspaceTasks(this.contactId);
        
        this.loadContactInfo();

        // AI вкладки
        this.aiTabFix = document.querySelector('.ai-option[data-ai-tab="fix"]');
        this.aiTabTask = document.querySelector('.ai-option[data-ai-tab="task"]');
        this.aiContentFix = document.querySelector('.ai-content-fix');
        this.aiContentTask = document.querySelector('.ai-content-task');
        this.aiTaskProposeBtn = document.getElementById('aiTaskProposeBtn');
        this.taskProposal = null; // { text, dueDate }
        this.taskWebSocket = null;
        this.currentAITab = 'fix'; // текущая активная вкладка AI
        this.hasNewProposal = false; // флаг для подсветки

        this.init();
        this.loadMessages().then(() => {
            this.startPolling();
        });
        
        window.addEventListener('beforeunload', () => {
            this.closeTaskWebSocket();
        });
    }

    loadCustomSelection() {
        const stored = sessionStorage.getItem(`custom_selection_${this.contactId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.customOriginConnectionId = data.originConnectionId;
                this.customConnectionId = data.connectionId;
                if (this.customOriginConnectionId && this.customConnectionId) {
                    this.currentMode = 'custom';
                } else {
                    this.currentMode = 'auto';
                }
            } catch(e) {
                console.warn('Ошибка загрузки custom-выбора', e);
                this.currentMode = 'auto';
            }
        } else {
            this.currentMode = 'auto';
        }
        this.updateModeUI();
    }

    saveCustomSelection(originConnectionId, connectionId) {
        this.customOriginConnectionId = originConnectionId;
        this.customConnectionId = connectionId;
        sessionStorage.setItem(`custom_selection_${this.contactId}`, JSON.stringify({
            originConnectionId: originConnectionId,
            connectionId: connectionId
        }));
    }

    clearCustomSelection() {
        this.customOriginConnectionId = null;
        this.customConnectionId = null;
        sessionStorage.removeItem(`custom_selection_${this.contactId}`);
    }

    updateModeUI() {
        this.modeOptions.forEach(opt => {
            const mode = opt.dataset.mode;
            if (mode === this.currentMode) {
                opt.classList.add('active');
            } else {
                opt.classList.remove('active');
            }
        });
    }

    setMode(mode) {
        if (mode === 'auto') {
            this.currentMode = 'auto';
            this.clearCustomSelection();
        } else if (mode === 'custom') {
            this.openCustomModal();
        }
        this.updateModeUI();
    }

    async openCustomModal() {
        try {
            const [originsResp, contactConnectionsResp] = await Promise.all([
                api.get('/communicationservice/v1/origin'),
                api.get(`/communicationservice/v1/contact/${this.contactId}/connection`)
            ]);
            const origins = originsResp.data.origins || [];
            const contactConnections = contactConnectionsResp.data.connections || [];

            const originsWithConnections = await Promise.all(origins.map(async (origin) => {
                try {
                    const connResp = await api.get(`/communicationservice/v1/origin/${origin.id}/connection`);
                    return { ...origin, connections: connResp.data.connections || [] };
                } catch(e) {
                    console.error(`Ошибка загрузки соединений для источника ${origin.id}`, e);
                    return { ...origin, connections: [] };
                }
            }));

            this.renderCustomModal(originsWithConnections, contactConnections);
        } catch (error) {
            console.error('Ошибка загрузки данных для модального окна', error);
            alert('Не удалось загрузить данные для настройки кастомной отправки');
        }
    }

    renderCustomModal(originsWithConnections, contactConnections) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'modal-container';

        const header = document.createElement('div');
        header.className = 'modal-header';
        header.innerHTML = `<h3>Выбор источника и получателя</h3><button class="modal-close">&times;</button>`;

        const body = document.createElement('div');
        body.className = 'modal-body';

        const leftCol = document.createElement('div');
        leftCol.className = 'modal-column';
        leftCol.innerHTML = '<h4>Откуда отправляем (наш источник)</h4>';
        const originsContainer = document.createElement('div');
        originsContainer.className = 'origins-list';

        let selectedOriginConnectionId = null;
        let selectedConnectionId = null;

        originsWithConnections.forEach(origin => {
            const originCard = document.createElement('div');
            originCard.className = 'origin-item-card';
            originCard.dataset.originId = origin.id;
            originCard.innerHTML = `
                <div class="origin-name">${this.escapeHtml(origin.name)}</div>
                <div class="origin-channel">Канал: ${origin.channel || 'не указан'}</div>
            `;
            originCard.addEventListener('click', () => {
                document.querySelectorAll('.origin-item-card').forEach(c => c.classList.remove('selected'));
                originCard.classList.add('selected');
                this.renderOriginConnections(origin.id, origin.connections, (connId) => {
                    selectedOriginConnectionId = connId;
                });
            });
            originsContainer.appendChild(originCard);
        });
        leftCol.appendChild(originsContainer);

        const rightCol = document.createElement('div');
        rightCol.className = 'modal-column';
        rightCol.innerHTML = '<h4>Куда отправляем (получатель)</h4>';
        const contactConnectionsContainer = document.createElement('div');
        contactConnectionsContainer.className = 'contact-connections-list';

        contactConnections.forEach(conn => {
            let label = '';
            let value = '';
            if (conn.phoneNumber) {
                label = 'SMS';
                value = conn.phoneNumber;
            } else if (conn.mailAddress) {
                label = 'Email';
                value = conn.mailAddress;
            } else if (conn.commonIdentifier) {
                label = 'Telegram';
                value = conn.commonIdentifier;
            } else {
                label = 'unknown';
                value = '—';
            }
            const connCard = document.createElement('div');
            connCard.className = 'connection-item-card';
            connCard.dataset.connId = conn.id;
            connCard.innerHTML = `<div class="connection-detail"><strong>${label}:</strong> ${this.escapeHtml(value)}</div>`;
            connCard.addEventListener('click', () => {
                document.querySelectorAll('.contact-connections-list .connection-item-card').forEach(c => c.classList.remove('selected'));
                connCard.classList.add('selected');
                selectedConnectionId = conn.id;
            });
            contactConnectionsContainer.appendChild(connCard);
        });
        rightCol.appendChild(contactConnectionsContainer);

        body.appendChild(leftCol);
        body.appendChild(rightCol);

        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Применить';
        applyBtn.addEventListener('click', () => {
            if (selectedOriginConnectionId && selectedConnectionId) {
                this.saveCustomSelection(selectedOriginConnectionId, selectedConnectionId);
                this.currentMode = 'custom';
                this.updateModeUI();
                overlay.remove();
            } else {
                alert('Выберите и источник, и получателя');
            }
        });
        footer.appendChild(applyBtn);

        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const closeBtn = modal.querySelector('.modal-close');
        closeBtn.addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });
    }

    renderOriginConnections(originId, connections, onSelect) {
        let connContainer = document.querySelector(`.origin-connections-${originId}`);
        if (!connContainer) {
            const originCard = document.querySelector(`.origin-item-card[data-origin-id="${originId}"]`);
            if (originCard) {
                connContainer = document.createElement('div');
                connContainer.className = `origin-connections origin-connections-${originId}`;
                connContainer.style.marginTop = '8px';
                originCard.after(connContainer);
            } else {
                return;
            }
        }
        if (connections.length === 0) {
            connContainer.innerHTML = '<div style="font-size:12px; color:#999; padding:4px 0;">Нет соединений</div>';
            return;
        }
        const connList = connections.map(conn => {
            let value = '';
            if (conn.phoneNumber) value = conn.phoneNumber;
            else if (conn.mailAddress) value = conn.mailAddress;
            else if (conn.commonIdentifier) value = conn.commonIdentifier;
            return `<div class="connection-item-card small" data-conn-id="${conn.id}" style="margin-top:4px; padding:6px 8px; font-size:12px;">${this.escapeHtml(value)}</div>`;
        }).join('');
        connContainer.innerHTML = connList;
        connContainer.querySelectorAll('.connection-item-card').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const connId = el.dataset.connId;
                connContainer.querySelectorAll('.connection-item-card').forEach(c => c.classList.remove('selected'));
                el.classList.add('selected');
                if (onSelect) onSelect(connId);
            });
        });
    }

    async loadMessages() {
        try {
            // Добавляем ведущий слеш
            const response = await api.get("/communicationservice" + this.API_ROUTES.getMessages);
            const messages = response.data.messages || [];
            const newCount = messages.length;
            // Перерисовываем, если количество изменилось ИЛИ чат пуст (0 сообщений)
            if (newCount !== this.messageCount || newCount === 0) {
                this.messageCount = newCount;
                this.renderMessages(messages);
            }
            return messages;
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            if (this.chatHistoryContainer && this.messageCount === 0) {
                this.chatHistoryContainer.innerHTML = '<div class="empty-chat">Не удалось загрузить историю сообщений</div>';
            }
            return [];
        }
    }

    renderMessages(messages) {
        if (!this.chatHistoryContainer) return;
        if (messages.length === 0) {
            this.chatHistoryContainer.innerHTML = `
                <div class="empty-chat">
                    <p>✨ Сообщений пока нет.</p><p>Начните общение с приветственного письма ✨</p>
                    <button class="greeting-btn" id="fetchGreetingBtn">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2h6v2h-6V6zm0 4h6v2h-6v-2zm-6 4h12v2H6v-2zm0-4h4v2H6v-2z" fill="currentColor"/>
                        </svg>
                        Вставить приветственное письмо
                    </button>
                </div>
            `;
            const btn = document.getElementById('fetchGreetingBtn');
            if (btn) {
                btn.addEventListener('click', () => this.fetchGreetingMessage());
            }
            return;
        }

        const messagesHtml = messages.map(msg => {
            const time = this.formatTime(msg.createdAt);
            const isIncoming = msg.isIncoming;
            const messageClass = isIncoming ? 'message-incoming' : 'message-outgoing';
            const alignClass = isIncoming ? 'message-incoming' : 'message-outgoing';
            return `
                <div class="message-item ${alignClass}">
                    <div class="${messageClass}">
                        <div class="message-text">${this.escapeHtml(msg.text)}</div>
                        <div class="message-time">${time}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.chatHistoryContainer.innerHTML = messagesHtml;
        this.chatHistoryContainer.scrollTop = this.chatHistoryContainer.scrollHeight;
    }

    async fetchGreetingMessage() {
        try {
            const response = await api.get('/communicationservice/v1/settings/');
            // const response = '{"text": "ЗдравствуйтИ! СпОсибо, что выбрали нас. Будем рады продуктивной и приятной сАвместной работе!"}';
            const data = response.data;
            console.log(data);
            const text = data.greeting_message;
            console.log('Приветственное сообщение:', text);
            if (!text) {
                alert('Не удалось получить приветственное сообщение');
                return;
            }
            if (this.chatTextArea.value.trim() === '') {
                this.setTextItemValue(this.chatTextArea, text);
                this.chatTextArea.focus();
            } else {
                alert('Пожалуйста, очистите поле ввода или отправьте текущее сообщение');
            }
        } catch (error) {
            console.error('Ошибка получения приветственного сообщения:', error);
            alert('Ошибка при получении приветственного сообщения');
        }
    }

    startPolling() {
        if (this.pollingInterval) clearInterval(this.pollingInterval);
        this.pollingInterval = setInterval(() => {
            this.loadMessages();
        }, 1000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }

    formatTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    init() {
        this.autoResize(this.chatTextArea);

        this.chatTextArea.addEventListener('input', (e) => this.autoResize(e.target));
        this.chatTextArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.altKey)) {
                e.preventDefault();
                this.sendChatMessage();
            }
        });
        window.addEventListener('keydown', (e) => {
            if (e.altKey && e.code === 'KeyI') {
                e.preventDefault();
                this.chatTextArea.focus();
                this.chatTextArea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
        this.chatSendButton.addEventListener('click', () => this.sendChatMessage());

        this.modeOptions.forEach(opt => {
            opt.addEventListener('click', (e) => {
                const mode = opt.dataset.mode;
                this.setMode(mode);
            });
        });

        this.setupAI();
        this.initAITabs();
        this.initTaskProposeWebSocket();

        // Редактирование контакта
        console.log("init editContactBtn", this.editContactBtn);
        if (this.editContactBtn) {
            this.editContactBtn.addEventListener('click', () => {
                console.log("editContactBtn clicked");
                window.location.href = `/contacts.html?id=${this.contactId}`;
            });
        }

    }

    async sendChatMessage() {
        // Проверка: если режим "Авто" и нет сообщений (чат пуст), то запрещаем отправку
        if (this.currentMode === 'auto' && this.messageCount === 0) {
            alert('Нельзя отправить первое сообщение в режиме "Авто". Выберите "Кастомный" режим, чтобы указать откуда и куда отправить.');
            return;
        }

        this.chatSendButton.disabled = true;
        this.chatTextArea.disabled = true;

        const messageText = this.chatTextArea.value;
        if (!messageText.trim()) {
            this.chatSendButton.disabled = false;
            this.chatTextArea.disabled = false;
            return;
        }

        try {
            const payload = {
                contactId: this.contactId,
                text: messageText,
            };
            if (this.currentMode === 'custom' && this.customOriginConnectionId && this.customConnectionId) {
                payload.originConnectionId = this.customOriginConnectionId;
                payload.connectionId = this.customConnectionId;
            }

            const response = await postWithIdempotency("/communicationservice" + this.API_ROUTES.sendMessage, payload, this.tokenIdempotency);
            console.log("Response data:", response);
            this.setTextItemValue(this.chatTextArea, "");

            // После отправки перезагружаем сообщения (polling сам подхватит, но для скорости вызовем явно)
            await this.loadMessages();

            if (this.currentMode === 'custom') {
                this.setMode('auto');
            }
        } catch (e) {
            console.log("Something went wrong", e);
            if (e.response) {
                console.log("Server error:", e.response.status);
                console.log("Details:", e.response.data);
                this.showAlert("Что-то пошло не так. Попробуйте позже");
            } else if (e.request) {
                console.log("Connection error");
                this.showAlert("Связь прервалась. Не удалось подтвердить отправку. Проверьте историю чуть позже, затем попробуйте еще раз");
            } else {
                console.log("Error of message forming");
                this.showAlert("Что-то пошло не так. Попробуйте позже, если ошибка не уйдет, обратитесь в техническую поддержку");
            }
        }

        this.tokenIdempotency = self.crypto.randomUUID();
        this.chatTextArea.disabled = false;
        this.chatSendButton.disabled = false;
        this.chatTextArea.focus();
    }

    autoResize(item) {
        const target = item.target || item;
        target.style.height = 'auto';
        target.style.height = target.scrollHeight + 'px';
        target.scrollTop = target.scrollHeight;
    }

    setTextItemValue(item, value) {
        item.value = value;
        this.autoResize(item);
    }

    showAlert(message) {
        alert(message);
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

    setupAI() {
        this.aiFixBtn = document.querySelector('.ai-fix-btn');
        this.aiApplyBtn = document.querySelector('.ai-apply-btn');
        this.aiSuggestionField = document.querySelector('.ai-suggestion-field');

        if (this.aiFixBtn) {
            this.aiFixBtn.addEventListener('click', () => this.aiFixHandler());
        }
        if (this.aiApplyBtn) {
            this.aiApplyBtn.addEventListener('click', () => this.aiApplyHandler());
        }
    }

    async aiFixHandler() {
        if (!this.aiFixBtn) return;

        const originalText = this.chatTextArea?.value.trim();
        if (!originalText) {
            alert('Введите текст для проверки');
            return;
        }

        this.aiFixBtn.disabled = true;
        const originalHTML = this.aiFixBtn.innerHTML;
        this.aiFixBtn.textContent = 'Соединение...';

        const token = getToken();
        if (!token) {
            alert('Необходима авторизация');
            this.aiFixBtn.disabled = false;
            this.aiFixBtn.textContent = originalHTML;
            return;
        }

        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/communicationservice/v1/spellcheck`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            this.aiFixBtn.textContent = 'Отправка...';
            const request = {
                Authorization: `Bearer ${token}`,
                text: originalText
            };
            ws.send(JSON.stringify(request));
        };

        ws.onmessage = async (event) => { // Добавляем async
            try {
                let rawData = event.data;

                if (rawData instanceof Blob) {
                    rawData = await rawData.text();
                }

                const response = JSON.parse(rawData);
                console.log('Получен ответ от сервера:', response);

                if (response && typeof response.text === 'string') {
                    if (this.aiSuggestionField) {
                        this.aiSuggestionField.value = response.text;
                    }
                    if (this.aiApplyBtn) {
                        this.aiApplyBtn.disabled = false;
                    }
                } else {
                    throw new Error('Некорректный формат поля text');
                }
            } catch (error) {
                console.error('Ошибка при обработке сообщения:', error);
                alert('Ошибка обработки ответа');
            } finally {
                ws.close();
            }
        };


        ws.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
            alert('Ошибка соединения с сервером проверки');
            ws.close();
        };

        ws.onclose = () => {
            this.aiFixBtn.disabled = false;
            this.aiFixBtn.innerHTML = originalHTML;
        };
    }

    aiApplyHandler() {
        const suggestion = this.aiSuggestionField ? this.aiSuggestionField.value : '';
        if (suggestion && this.chatTextArea) {
            this.setTextItemValue(this.chatTextArea, suggestion);
            if (this.aiSuggestionField) this.aiSuggestionField.value = '';
            if (this.aiApplyBtn) this.aiApplyBtn.disabled = true;
            this.chatTextArea.focus();
        } else {
            alert('Нет предложения для применения');
        }
    }

    initAITabs() {
        if (this.aiTabFix && this.aiTabTask) {
            this.aiTabFix.addEventListener('click', () => this.switchAITab('fix'));
            this.aiTabTask.addEventListener('click', () => {
                this.switchAITab('task');
                // если есть непросмотренное предложение – снимаем подсветку и активируем кнопку
                if (this.hasNewProposal && this.taskProposal) {
                    this.hasNewProposal = false;
                    this.aiTabTask.classList.remove('has-suggestion');
                    if (this.aiTaskProposeBtn) this.aiTaskProposeBtn.disabled = false;
                    // можно также показать уведомление
                    console.log('Предложение задачи готово к просмотру');
                }
            });
        }
        if (this.aiTaskProposeBtn) {
            this.aiTaskProposeBtn.addEventListener('click', () => this.openTaskModalWithProposal());
        }
    }

    switchAITab(tab) {
        this.currentAITab = tab;
        if (tab === 'fix') {
            this.aiTabFix.classList.add('active');
            this.aiTabTask.classList.remove('active');
            this.aiContentFix.style.display = 'flex';
            this.aiContentTask.style.display = 'none';
        } else {
            this.aiTabFix.classList.remove('active');
            this.aiTabTask.classList.add('active');
            this.aiContentFix.style.display = 'none';
            this.aiContentTask.style.display = 'flex';
        }
    }

    initTaskProposeWebSocket() {
        // Закрываем существующий сокет перед созданием нового
        this.closeTaskWebSocket();

        const token = getToken();
        if (!token) {
            console.warn('Нет токена, WebSocket task propose не создан');
            return;
        }
        const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/communicationservice/v1/task/propose/${this.contactId}?Authorization=Bearer%20${encodeURIComponent(token)}`;
        this.taskWebSocket = new WebSocket(wsUrl);

        this.taskWebSocket.onopen = () => {
            console.log('WebSocket task propose открыт для контакта', this.contactId);
        };

        this.taskWebSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.isProposed && data.text && data.dueDate) {
                    if (this.contactId) {
                        this.taskProposal = { text: data.text, dueDate: data.dueDate };
                        this.hasNewProposal = true;
                        if (this.currentAITab !== 'task') {
                            this.aiTabTask.classList.add('has-suggestion');
                        } else {
                            if (this.aiTaskProposeBtn) this.aiTaskProposeBtn.disabled = false;
                        }
                        console.log('Получено предложение задачи:', this.taskProposal);
                    }
                }
            } catch(e) {
                console.error('Ошибка парсинга предложения задачи', e);
            }
        };

        this.taskWebSocket.onerror = (error) => {
            console.error('WebSocket task propose ошибка', error);
        };

        this.taskWebSocket.onclose = () => {
            console.log('WebSocket task propose закрыт');
        };
    }

    openTaskModalWithProposal() {
        if (!this.tasksManager || !this.tasksManager.taskModal) {
            console.warn('Task manager not ready');
            return;
        }
        if (this.taskProposal) {
            this.tasksManager.taskTextInput.value = this.taskProposal.text;
            // Парсим dueDate формата "YYYY-MM-DDTHH:MM:SSZ" без преобразования временной зоны
            const dueDateStr = this.taskProposal.dueDate;
            const match = dueDateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
            if (match) {
                const year = match[1];
                const month = match[2];
                const day = match[3];
                const hour = match[4];
                this.tasksManager.taskDueInput.value = `${year}-${month}-${day}`;
                this.tasksManager.taskHourInput.value = parseInt(hour, 10);
            } else {
                // fallback – используем UTC-компоненты new Date() (но лучше поправить формат на беке)
                const dueDate = new Date(dueDateStr);
                if (!isNaN(dueDate.getTime())) {
                    const year = dueDate.getUTCFullYear();
                    const month = String(dueDate.getUTCMonth() + 1).padStart(2, '0');
                    const day = String(dueDate.getUTCDate()).padStart(2, '0');
                    this.tasksManager.taskDueInput.value = `${year}-${month}-${day}`;
                    this.tasksManager.taskHourInput.value = dueDate.getUTCHours();
                } else {
                    this.tasksManager.taskDueInput.value = '';
                    this.tasksManager.taskHourInput.value = '';
                }
            }
            // Сбрасываем предложение и подсветку
            this.taskProposal = null;
            this.hasNewProposal = false;
            this.aiTabTask.classList.remove('has-suggestion');
            if (this.aiTaskProposeBtn) this.aiTaskProposeBtn.disabled = true;
        } else {
            this.tasksManager.taskTextInput.value = '';
            this.tasksManager.taskDueInput.value = '';
            this.tasksManager.taskHourInput.value = '';
        }
        this.tasksManager.taskModal.style.display = 'flex';
    }

    closeTaskWebSocket() {
        if (this.taskWebSocket && this.taskWebSocket.readyState === WebSocket.OPEN) {
            this.taskWebSocket.close();
            this.taskWebSocket = null;
        }
    }
    
    destroy() {
        console.log('Destroy Desktop instance');
        this.closeTaskWebSocket();
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
    
    async loadContactInfo() {
        console.log('loadContactInfo вызван для contactId:', this.contactId);
        try {
            // Пытаемся получить контакт через прямой запрос (если ручка существует)
            let contact = null;
            try {
                const response = await api.get(`/communicationservice/v1/contact/${this.contactId}`);
                // Если ответ содержит объект с полем contactId, то это он
                if (response.data && response.data.contactId) {
                    contact = response.data;
                } else {
                    // Если ответ не тот, что ожидаем, пробуем как список
                    const listResponse = await api.get('/communicationservice/v1/contact');
                    const contacts = listResponse.data.contacts || [];
                    contact = contacts.find(c => c.contactId === this.contactId);
                }
            } catch (err) {
                // Если прямой запрос упал (404), загружаем список
                console.warn('Прямой запрос контакта не удался, загружаем список', err);
                const listResponse = await api.get('/communicationservice/v1/contact');
                const contacts = listResponse.data.contacts || [];
                contact = contacts.find(c => c.contactId === this.contactId);
            }

            if (!contact) {
                console.warn('Контакт не найден');
                return;
            }

            console.log('Загружен контакт:', contact);

            // Заполняем имя
            const nameElem = document.querySelector('.userinfo_main_contact_info .name');
            if (nameElem) nameElem.textContent = contact.contactName || 'Без имени';

            // Заполняем телефон, если есть
            const phoneElem = document.querySelector('.userinfo_main_contact_info .phone');
            if (phoneElem && contact.phone) phoneElem.textContent = contact.phone;

            // Заполняем статус, если есть
            const statusElem = document.querySelector('.userinfo_main_status_frame p');
            if (statusElem && contact.status) statusElem.textContent = contact.status;

            // Инициалы для кружка
            const pictureElem = document.querySelector('.userinfo_main_picture p');
            if (pictureElem && contact.contactName) {
                const name = contact.contactName;
                const words = name.trim().split(/\s+/);
                let initials = '';
                if (words.length === 1) {
                    initials = words[0].substring(0, 2).toUpperCase();
                } else if (words.length >= 2) {
                    initials = (words[0][0] + words[1][0]).toUpperCase();
                } else {
                    initials = '??';
                }
                pictureElem.textContent = initials;
            }
        } catch (error) {
            console.error('Ошибка загрузки информации о контакте:', error);
            const nameElem = document.querySelector('.userinfo_main_contact_info .name');
            if (nameElem && nameElem.textContent === 'Загрузка...') {
                nameElem.textContent = 'Контакт';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('contactId');
    if (!contactId) {
        console.warn('Не передан contactId. Выберите контакт на странице контактов.');
        alert('Выберите контакт, чтобы начать общение');
        return;
    }
    // Уничтожаем предыдущий экземпляр, если он есть
    if (window.currentDesktop) {
        window.currentDesktop.destroy();
    }
    window.currentDesktop = new Desktop(contactId);
});
