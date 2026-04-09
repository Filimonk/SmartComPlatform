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

        // Элементы панели режимов
        this.modeOptions = document.querySelectorAll('.mode-option');
        this.currentMode = 'auto';
        this.customOriginConnectionId = null;
        this.customConnectionId = null;

        this.loadCustomSelection();
        this.tokenIdempotency = self.crypto.randomUUID();

        this.init();
        this.loadMessages();  // загружаем историю при старте
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
            const response = await api.get("/communicationservice" + this.API_ROUTES.getMessages);
            const messages = response.data.messages || [];
            this.renderMessages(messages);
        } catch (error) {
            console.error('Ошибка загрузки сообщений:', error);
            this.chatHistoryContainer.innerHTML = '<div class="error-message">Не удалось загрузить историю сообщений</div>';
        }
    }

    renderMessages(messages) {
        if (!this.chatHistoryContainer) return;
        if (messages.length === 0) {
            this.chatHistoryContainer.innerHTML = '<div class="empty-chat">Нет сообщений. Напишите первое!</div>';
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
        // Прокрутка вниз
        this.chatHistoryContainer.scrollTop = this.chatHistoryContainer.scrollHeight;
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
    }

    async sendChatMessage() {
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

            // После успешной отправки перезагружаем историю сообщений
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
}

// Инициализация после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('contactId');
    if (!contactId) {
        console.warn('Не передан contactId. Выберите контакт на странице контактов.');
        alert('Выберите контакт, чтобы начать общение');
        return;
    }
    new Desktop(contactId);
});
