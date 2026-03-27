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

        this.contactNameInput = document.querySelector('.contact-name-input');
        this.channelSelect = document.querySelector('.channel-select');
        this.identifierInput = document.querySelector('.identifier-input');

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadContacts();
    }

    bindEvents() {
        this.createContactBtn.addEventListener('click', () => this.createContact());
        this.backToListBtn.addEventListener('click', () => this.showListView());
        this.saveContactBtn.addEventListener('click', () => this.updateContactName());
        this.createConnectionBtn.addEventListener('click', () => this.createConnection());
    }

    async loadContacts() {
        try {
            const response = await api.get('/communicationservice/v1/contact');
            this.contacts = response.data.contacts || [];
            this.renderContactsList();
        } catch (error) {
            console.error('Ошибка загрузки контактов:', error);
        }
    }

    renderContactsList() {
        if (!this.contactsListContainer) return;
        if (this.contacts.length === 0) {
            this.contactsListContainer.innerHTML = '<p>Нет контактов. Создайте первый!</p>';
            return;
        }

        const listHtml = this.contacts.map(contact => `
            <div class="contact-item" data-id="${contact.contactId}">
                <a href="/workspace.html?contactId=${contact.contactId}" class="contact-name-link">${this.escapeHtml(contact.contactName)}</a>
                <button class="edit-contact-btn" data-id="${contact.contactId}" data-name="${this.escapeHtml(contact.contactName)}">✎ Редактировать</button>
            </div>
        `).join('');
        this.contactsListContainer.innerHTML = listHtml;

        // Навешиваем обработчики на кнопки редактирования
        document.querySelectorAll('.edit-contact-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = btn.dataset.id;
                const name = btn.dataset.name;
                this.showContactDetail(id, name);
            });
        });
    }

    async showContactDetail(contactId, contactName) {
        this.selectedContactId = contactId;
        this.selectedContactName = contactName;
        this.contactNameInput.value = contactName;
        await this.loadConnections();
        this.showDetailView();
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
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                console.log('Удаление пока не реализовано');
            });
        });
    }

    async createContact() {
        try {
            await api.post('/communicationservice/v1/contact', {});
            await this.loadContacts();
        } catch (error) {
            console.error('Ошибка создания контакта:', error);
        }
    }

    async updateContactName() {
        const newName = this.contactNameInput.value.trim();
        if (!newName) {
            alert('Имя не может быть пустым');
            return;
        }
        try {
            await api.patch(`/communicationservice/v1/contact/${this.selectedContactId}`, { contactName: newName });
            await this.loadContacts();
            const updatedContact = this.contacts.find(c => c.contactId === this.selectedContactId);
            if (updatedContact) {
                this.selectedContactName = updatedContact.contactName;
                this.contactNameInput.value = updatedContact.contactName;
            } else {
                this.showListView();
            }
        } catch (error) {
            console.error('Ошибка обновления имени:', error);
        }
    }

    async createConnection() {
        const channel = this.channelSelect.value;
        const identifier = this.identifierInput.value.trim();
        if (!identifier) {
            alert('Введите идентификатор');
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
            alert('Неподдерживаемый канал');
            return;
        }

        try {
            await api.post(`/communicationservice/v1/contact/${this.selectedContactId}/connection`, payload);
            this.identifierInput.value = '';
            await this.loadConnections();
        } catch (error) {
            console.error('Ошибка создания connection:', error);
        }
    }

    showListView() {
        this.listView.style.display = 'block';
        this.detailView.style.display = 'none';
        this.selectedContactId = null;
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
    new ContactsPage();
});
