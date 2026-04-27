// GlobalUI.js – управление вкладками, профилем, уведомлениями, статусом
console.log('[GlobalUI] загрузка');

class GlobalUI {
    constructor() {
        this.tabsContainer = document.querySelector('.tabs');
        this.notificationsBadge = document.querySelector('.number_background p');
        this.profileNameElem = document.querySelector('.profile_info .name p');
        this.profilePictureElem = document.querySelector('.picture p');
        this.statusDotElem = document.querySelector('.status-dot');
        this.statusTextElem = document.querySelector('.status_option span');
        this.statusBlock = document.querySelector('.status_block');

        this.tabs = []; // { contactId, name }
        this.lastActiveContactId = null;

        console.log('[GlobalUI] инициализация');
        this.loadTabsFromStorage();
        this.loadLastActiveFromStorage();
        this.renderTabs();
        this.initProfileAndNotifications(); // неблокирующие запросы
        this.attachStatusClickHandler();

        // Глобальное API для добавления вкладок
        window.auraTabs = {
            addTab: (contactId, contactName) => this.addTab(contactId, contactName),
            removeTab: (contactId) => this.removeTab(contactId),
            getLastActive: () => this.getLastActiveContactId(),
            setLastActive: (contactId) => this.setLastActiveContactId(contactId)
        };

        // Подписываемся на кастомное событие (резерв)
        window.addEventListener('addTab', (e) => {
            console.log('[GlobalUI] событие addTab', e.detail);
            this.addTab(e.detail.contactId, e.detail.contactName);
        });

        // Если страница workspace и в URL нет contactId, перенаправим на последний активный
        this.handleWorkspaceRedirect();

        console.log('[GlobalUI] готов', { tabs: this.tabs, lastActive: this.lastActiveContactId });
    }

    // --- Вкладки (чисто локально) ---
    loadTabsFromStorage() {
        const stored = localStorage.getItem('aura_tabs');
        if (stored) {
            try {
                this.tabs = JSON.parse(stored);
                console.log('[GlobalUI] загружены вкладки из storage', this.tabs);
            } catch(e) { this.tabs = []; }
        } else {
            this.tabs = [];
            console.log('[GlobalUI] нет сохранённых вкладок');
        }
    }

    saveTabsToStorage() {
        localStorage.setItem('aura_tabs', JSON.stringify(this.tabs));
        console.log('[GlobalUI] вкладки сохранены', this.tabs);
    }

    loadLastActiveFromStorage() {
        const last = localStorage.getItem('aura_last_active_contact');
        if (last) {
            this.lastActiveContactId = last;
            console.log('[GlobalUI] последний активный контакт загружен', this.lastActiveContactId);
        } else {
            this.lastActiveContactId = null;
        }
    }

    saveLastActiveToStorage() {
        if (this.lastActiveContactId) {
            localStorage.setItem('aura_last_active_contact', this.lastActiveContactId);
        } else {
            localStorage.removeItem('aura_last_active_contact');
        }
    }

    setLastActiveContactId(contactId) {
        this.lastActiveContactId = contactId;
        this.saveLastActiveToStorage();
        console.log('[GlobalUI] установлен последний активный', contactId);
    }

    getLastActiveContactId() {
        // если в URL есть contactId, используем его как приоритетный
        const urlParams = new URLSearchParams(window.location.search);
        const urlContactId = urlParams.get('contactId');
        if (urlContactId) {
            this.lastActiveContactId = urlContactId;
            this.saveLastActiveToStorage();
            return urlContactId;
        }
        return this.lastActiveContactId;
    }

    addTab(contactId, contactName) {
        console.log('[GlobalUI] addTab', contactId, contactName);
        if (!contactId || !contactName) return;
        if (this.tabs.some(tab => tab.contactId === contactId)) {
            console.log('[GlobalUI] вкладка уже существует');
            this.setLastActiveContactId(contactId);
            this.renderTabs(); // обновить активный класс
            return;
        }
        this.tabs.push({ contactId, name: contactName });
        this.saveTabsToStorage();
        this.setLastActiveContactId(contactId);
        this.renderTabs();
    }

    removeTab(contactId) {
        console.log('[GlobalUI] removeTab', contactId);
        const index = this.tabs.findIndex(tab => tab.contactId === contactId);
        if (index !== -1) {
            this.tabs.splice(index, 1);
            this.saveTabsToStorage();
            if (this.lastActiveContactId === contactId) {
                if (this.tabs.length > 0) {
                    this.lastActiveContactId = this.tabs[0].contactId;
                } else {
                    this.lastActiveContactId = null;
                }
                this.saveLastActiveToStorage();
            }
            this.renderTabs();
        }
    }

    renderTabs() {
        console.log('[GlobalUI] renderTabs');
        if (!this.tabsContainer) {
            console.warn('[GlobalUI] контейнер вкладок не найден');
            return;
        }
        if (this.tabs.length === 0) {
            this.tabsContainer.innerHTML = '';
            return;
        }
        
        let activeContactId = this.getLastActiveContactId();
        // если страница не workspace, тогда activeContactId = null
        if (!window.location.pathname.includes('workspace.html')) {
            activeContactId = 0;
        }
        console.log('[GlobalUI] activeContactId', activeContactId);
        
        const tabsHtml = this.tabs.map(tab => `
            <div class="tab ${activeContactId === tab.contactId ? 'active' : ''}" data-contact-id="${tab.contactId}">
                <div class="card">
                    <div class="tab_content">
                        <div class="tab_icon">
                            <svg width="13" height="12" viewBox="0 0 13 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.18187 0L7.64121 4.49139H12.3637L8.54313 7.26722L10.0025 11.7586L6.18187 8.98278L2.36127 11.7586L3.82061 7.26722L2.38419e-06 4.49139H4.72253L6.18187 0Z" fill="#444444"/>
                            </svg>
                        </div>
                        <div class="flex_content">
                            <div class="close">
                                <div class="tab_close_background">
                                    <svg width="6" height="6" viewBox="0 0 6 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6 0.604286L5.39571 0L3 2.39571L0.604286 0L0 0.604286L2.39571 3L0 5.39571L0.604286 6L3 3.60429L5.39571 6L6 5.39571L3.60429 3L6 0.604286Z" fill="#1F1F1F"/>
                                    </svg>
                                </div>
                            </div>
                            <div class="tab_name_field">
                                <p>${this.escapeHtml(tab.name)}</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex_container_tab_stroke">
                        <div class="tab_stroke"></div>
                    </div>
                </div>
            </div>
        `).join('');
        this.tabsContainer.innerHTML = tabsHtml;

        // Обработчики кликов по вкладкам и крестикам
        this.tabsContainer.querySelectorAll('.tab').forEach(tabElem => {
            const contactId = tabElem.dataset.contactId;
            const closeBtn = tabElem.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.removeTab(contactId);
                    
                    const urlParams = new URLSearchParams(window.location.search);
                    const currentContactId = urlParams.get('contactId');

                    if (window.location.pathname.includes('workspace.html') && currentContactId === String(contactId)) {
                        console.log('[GlobalUI] закрыли активную вкладку, уходим на главную');
                        window.location.href = '/contacts.html';
                    }
                    
                    return;
                });
            }
            tabElem.addEventListener('click', (e) => {
                if (e.target.closest('.close')) return;
                this.setLastActiveContactId(contactId);
                window.location.href = `/workspace.html?contactId=${contactId}`;
            });
        });
    }

    // --- Редирект для workspace.html ---
    handleWorkspaceRedirect() {
        // Проверяем, что мы на workspace.html
        if (!window.location.pathname.includes('workspace.html')) return;
        const urlParams = new URLSearchParams(window.location.search);
        let contactId = urlParams.get('contactId');
        if (!contactId) {
            const lastActive = this.getLastActiveContactId();
            if (lastActive && this.tabs.some(tab => tab.contactId === lastActive)) {
                console.log('[GlobalUI] редирект на последний активный контакт', lastActive);
                window.location.href = `/workspace.html?contactId=${lastActive}`;
            } else if (this.tabs.length > 0) {
                const firstTabId = this.tabs[0].contactId;
                console.log('[GlobalUI] редирект на первую вкладку', firstTabId);
                window.location.href = `/workspace.html?contactId=${firstTabId}`;
            } else {
                console.log('[GlobalUI] нет вкладок, редирект на страницу контактов');
                alert('Выберите контакт для начала работы');
                window.location.href = '/contacts.html';
            }
        } else {
            // Если contactId есть, обновляем last active
            this.setLastActiveContactId(contactId);
        }
    }

    // --- Профиль, уведомления, статус (бекап) ---
    async initProfileAndNotifications() {
        await this.loadUserProfile();
        await this.loadNotificationsCount();
    }

    async loadUserProfile() {
        try {
            const response = await api.get('/authservice/user/profile');
            const data = response.data;
            this.updateProfileUI(data);
        } catch (error) {
            console.warn('[GlobalUI] не удалось загрузить профиль, fallback', error);
            this.updateProfileUI({
                firstName: 'Иван',
                lastName: 'Иванов',
                status: { text: 'Доступен для связи', color: '#00BA22' }
            });
        }
    }

    updateProfileUI(profile) {
        const fullName = `${profile.firstName} ${profile.lastName}`;
        if (this.profileNameElem) this.profileNameElem.textContent = fullName;
        const initials = (profile.firstName[0] + profile.lastName[0]).toUpperCase();
        if (this.profilePictureElem) this.profilePictureElem.textContent = initials;
        if (this.statusTextElem) this.statusTextElem.textContent = profile.status.text;
        if (this.statusDotElem) this.statusDotElem.style.backgroundColor = profile.status.color;
    }

    async loadNotificationsCount() {
        try {
            const response = await api.get('/communicationservice/notifications/count');
            const count = response.data.count || 0;
            if (this.notificationsBadge) this.notificationsBadge.textContent = count;
        } catch (error) {
            console.warn('[GlobalUI] не удалось загрузить уведомления');
            if (this.notificationsBadge) this.notificationsBadge.textContent = '0';
        }
    }

    attachStatusClickHandler() {
        if (!this.statusBlock) return;
        this.statusBlock.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showStatusPopup();
        });
    }

    showStatusPopup() {
        const existingPopup = document.querySelector('.status-popup');
        if (existingPopup) existingPopup.remove();

        const statuses = [
            { text: 'Доступен для связи', color: '#00BA22', value: 'available' },
            { text: 'На перерыве', color: '#FFC107', value: 'break' },
            { text: 'Только срочные', color: '#FF9800', value: 'urgent_only' },
            { text: 'Не доступен', color: '#F44336', value: 'unavailable' },
            { text: 'Не в системе', color: '#000000', value: 'offline' }
        ];
        const popup = document.createElement('div');
        popup.className = 'status-popup';
        popup.innerHTML = `
            <div class="status-popup-arrow"></div>
            <div class="status-popup-list">
                ${statuses.map(s => `
                    <div class="status-popup-item" data-value="${s.value}">
                        <span class="status-dot-small" style="background-color: ${s.color};"></span>
                        <span>${s.text}</span>
                    </div>
                `).join('')}
            </div>
        `;
        document.body.appendChild(popup);
        const rect = this.statusBlock.getBoundingClientRect();
        popup.style.position = 'absolute';
        popup.style.top = `${rect.top - popup.offsetHeight - 8}px`;
        popup.style.left = `${rect.left + rect.width / 2 - popup.offsetWidth / 2}px`;
        // document.querySelector('.status_frame_arrow').style.transform = 'rotate(180deg)'; // вращаем на 180 градусов
        const closeHandler = (e) => {
            if (!popup.contains(e.target)) {
                popup.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
        popup.querySelectorAll('.status-popup-item').forEach(item => {
            item.addEventListener('click', async () => {
                const value = item.dataset.value;
                const selectedStatus = statuses.find(s => s.value === value);
                if (selectedStatus) {
                    try {
                        await api.patch('/authservice/user/status', { status: value });
                        this.updateProfileUI({
                            firstName: this.profileNameElem?.textContent.split(' ')[0] || 'Иван',
                            lastName: this.profileNameElem?.textContent.split(' ')[1] || 'Иванов',
                            status: { text: selectedStatus.text, color: selectedStatus.color }
                        });
                    } catch (error) {
                        console.error('Ошибка обновления статуса', error);
                        alert('Не удалось изменить статус');
                    }
                }
                popup.remove();
                document.removeEventListener('click', closeHandler);
            });
        });
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
    console.log('[GlobalUI] DOMContentLoaded');
    window.globalUI = new GlobalUI();
});
