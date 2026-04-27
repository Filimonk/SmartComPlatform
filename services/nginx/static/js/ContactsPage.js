class ContactsPage {
    constructor() {
        this.contacts = [];
        this.selectedContactId = null;
        this.selectedContactName = '';
        this.connections = [];

        this.listView = document.querySelector('.contacts-list-view');
        this.detailView = document.querySelector('.contact-detail-view');
        this.contactsListContainer = document.querySelector('.contacts-list');
        this.connectionsListContainer = document.querySelector('.connections-list');

        this.createContactBtn = document.querySelector('.create-contact-btn');
        this.backToListBtn = document.querySelector('.back-to-list-btn');
        this.saveContactBtn = document.querySelector('.save-contact-btn');
        this.createConnectionBtn = document.querySelector('.create-connection-btn');
        this.mergeContactBtn = document.querySelector('.merge-contact-btn');

        this.contactNameInput = document.querySelector('.contact-name-input');
        this.channelSelect = document.querySelector('.channel-select');
        this.identifierInput = document.querySelector('.identifier-input');

        this.mergeModal = document.getElementById('mergeModal');
        this.mergeContactsList = document.querySelector('.merge-contacts-list');
        this.modalCloseBtn = document.querySelector('.merge-modal-close');

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadContacts();

        const urlParams = new URLSearchParams(window.location.search);
        const contactId = urlParams.get('id');
        if (contactId) {
            const contact = this.contacts.find(c => c.contactId === contactId);
            if (contact) {
                await this.showContactDetail(contactId, contact.contactName);
            } else {
                // если контакт не найден, остаёмся в списке
                this.showListView();
            }
        } else {
            this.showListView();
        }
    }

    bindEvents() {
        this.createContactBtn.addEventListener('click', () => this.createContact());
        this.backToListBtn.addEventListener('click', () => this.goBackToList());
        this.saveContactBtn.addEventListener('click', () => this.updateContactName());
        this.createConnectionBtn.addEventListener('click', () => this.createConnection());
        if (this.mergeContactBtn) {
            this.mergeContactBtn.addEventListener('click', () => this.openMergeModal());
        }
        if (this.modalCloseBtn) {
            this.modalCloseBtn.addEventListener('click', () => this.closeMergeModal());
        }
        window.addEventListener('click', (e) => {
            if (e.target === this.mergeModal) this.closeMergeModal();
        });
    }

    async loadContacts() {
        try {
            const response = await api.get('/communicationservice/v1/contact');
            this.contacts = response.data.contacts || [];
            this.renderContactsList();
        } catch (error) {
            console.error('Ошибка загрузки контактов:', error);
            this.showError('Не удалось загрузить контакты');
        }
    }

    renderContactsList() {
        if (!this.contactsListContainer) return;
        if (this.contacts.length === 0) {
            this.contactsListContainer.innerHTML = '<p>Нет контактов. Создайте первый!</p>';
            return;
        }

        // Вместо прямого href
        const listHtml = this.contacts.map(contact => `
    <div class="contact-item" data-id="${contact.contactId}">
        <span class="contact-name-link" data-id="${contact.contactId}" data-name="${this.escapeHtml(contact.contactName)}">${this.escapeHtml(contact.contactName)}</span>
        <button class="edit-contact-btn" data-id="${contact.contactId}" data-name="${this.escapeHtml(contact.contactName)}">✎ Редактировать</button>
    </div>
`).join('');
        
        this.contactsListContainer.innerHTML = listHtml;

        // Обработчик
        document.querySelectorAll('.contact-name-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("clicked", link.dataset.id, link.dataset.name);
                const id = link.dataset.id;
                const name = link.dataset.name;
                if (window.auraTabs) {
                    window.auraTabs.addTab(id, name);
                }
                window.location.href = `/workspace.html?contactId=${id}`;
            });
        });

        document.querySelectorAll('.edit-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                window.location.href = `/contacts.html?id=${id}`;
            });
        });
    }

    async showContactDetail(contactId, contactName) {
        this.selectedContactId = contactId;
        this.selectedContactName = contactName;
        this.contactNameInput.value = contactName;
        await this.loadConnections();
        this.showDetailView();
        // обновляем URL без перезагрузки (история)
        const url = new URL(window.location);
        url.searchParams.set('id', contactId);
        window.history.pushState({}, '', url);
    }

    async loadConnections() {
        try {
            const response = await api.get(`/communicationservice/v1/contact/${this.selectedContactId}/connection`);
            this.connections = response.data.connections || [];
            this.renderConnectionsList();
        } catch (error) {
            console.error('Ошибка загрузки connections:', error);
            this.connections = [];
            this.renderConnectionsList();
        }
    }

    renderConnectionsList() {
        if (!this.connectionsListContainer) return;
        if (this.connections.length === 0) {
            this.connectionsListContainer.innerHTML = '<p>Нет подключений. Добавьте новое.</p>';
            return;
        }

        const listHtml = this.connections.map(conn => {
            let channel = '';
            let value = '';
            if (conn.phoneNumber) {
                channel = 'sms';
                value = conn.phoneNumber;
            } else if (conn.mailAddress) {
                channel = 'mail';
                value = conn.mailAddress;
            } else if (conn.commonIdentifier) {
                channel = 'telegram';
                value = conn.commonIdentifier;
            } else {
                channel = 'unknown';
                value = '—';
            }

            return `
                <div class="connection-item" data-id="${conn.id}">
                    <div class="connection-info">
                        <strong>${channel.toUpperCase()}:</strong> ${this.escapeHtml(value)}
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
                        await api.delete(`/communicationservice/v1/contact/${this.selectedContactId}/connection/${connId}`);
                        await this.loadConnections();
                    } catch (error) {
                        this.showError('Не удалось удалить соединение');
                    }
                }
            });
        });
    }

    async createContact() {
        try {
            const response = await api.post('/communicationservice/v1/contact', {});
            const newContact = response.data;
            window.location.href = `/contacts.html?id=${newContact.contactId}`;
        } catch (error) {
            console.error('Ошибка создания контакта:', error);
            this.showError('Не удалось создать контакт');
        }
    }

    async updateContactName() {
        const newName = this.contactNameInput.value.trim();
        if (!newName) {
            this.showError('Имя не может быть пустым');
            return;
        }
        try {
            await api.patch(`/communicationservice/v1/contact/${this.selectedContactId}`, { contactName: newName });
            await this.loadContacts();
            // обновляем отображаемое имя
            this.selectedContactName = newName;
            this.contactNameInput.value = newName;
            // обновляем ссылки в списке (для этого перерисуем список)
            this.renderContactsList();
        } catch (error) {
            console.error('Ошибка обновления имени:', error);
            this.showError('Не удалось обновить имя');
        }
    }

    async createConnection() {
        const channel = this.channelSelect.value;
        const identifier = this.identifierInput.value.trim();
        if (!identifier) {
            this.showError('Введите идентификатор');
            return;
        }

        let payload = { channel: channel };
        if (channel === 'telegram') {
            payload.commonIdentifier = identifier;
        } else if (channel === 'sms') {
            payload.phoneNumber = identifier;
        } else if (channel === 'mail') {
            payload.mailAddress = identifier;
        } else {
            this.showError('Неподдерживаемый канал');
            return;
        }

        try {
            await api.post(`/communicationservice/v1/contact/${this.selectedContactId}/connection`, payload);
            this.identifierInput.value = '';
            await this.loadConnections();
        } catch (error) {
            console.error('Ошибка создания connection:', error);
            this.showError('Не удалось добавить соединение');
        }
    }

    openMergeModal() {
        if (!this.mergeModal) return;
        // заполняем список контактами, исключая текущий
        const otherContacts = this.contacts.filter(c => c.contactId !== this.selectedContactId);
        if (otherContacts.length === 0) {
            this.showError('Нет других контактов для объединения');
            return;
        }
        this.renderMergeContactsList(otherContacts);
        this.mergeModal.style.display = 'flex';
    }

    renderMergeContactsList(contacts) {
        if (!this.mergeContactsList) return;
        const html = contacts.map(contact => `
            <div class="merge-contact-item" data-id="${contact.contactId}">
                <div class="merge-contact-name">${this.escapeHtml(contact.contactName)}</div>
            </div>
        `).join('');
        this.mergeContactsList.innerHTML = html;
        this.mergeContactsList.querySelectorAll('.merge-contact-item').forEach(item => {
            item.addEventListener('click', () => {
                const contactIdToMerge = item.dataset.id;
                this.mergeContacts(contactIdToMerge);
            });
        });
    }

    async mergeContacts(contactIdToMerge) {
        try {
            // POST /v1/contact/merge
            await api.post('/communicationservice/v1/contact/merge', {
                sourceContactId: this.selectedContactId,
                targetContactId: contactIdToMerge
            });
            // после объединения переходим на целевой контакт
            window.location.href = `/contacts.html?id=${contactIdToMerge}`;
        } catch (error) {
            console.error('Ошибка объединения:', error);
            const msg = error.response?.data?.message || 'Не удалось объединить контакты';
            this.showError(msg);
            this.closeMergeModal();
        }
    }

    closeMergeModal() {
        if (this.mergeModal) this.mergeModal.style.display = 'none';
    }

    goBackToList() {
        window.location.href = '/contacts.html';
    }

    showListView() {
        this.listView.style.display = 'block';
        this.detailView.style.display = 'none';
        this.selectedContactId = null;
        // очищаем параметр id в URL
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
    }

    showDetailView() {
        this.listView.style.display = 'none';
        this.detailView.style.display = 'block';
    }

    showError(message) {
        alert(`❌ Ошибка: ${message}`);
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
    new ContactsPage();
});
