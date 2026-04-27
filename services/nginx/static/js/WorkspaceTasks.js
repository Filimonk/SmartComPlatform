// WorkspaceTasks.js – управление задачами и заметками на странице рабочей области
console.log('[WorkspaceTasks] загрузка');

class WorkspaceTasks {
    constructor(contactId) {
        this.contactId = contactId;
        this.currentTasksStatus = 'active'; // 'active' или 'archived'
        this.tasks = [];
        this.notes = [];

        this.tasksListContainer = document.querySelector('.tasks-list');
        this.tasksTabs = document.querySelectorAll('.tasks-tab');
        this.createTaskBtn = document.querySelector('.create-task-btn');
        this.notesBtn = document.querySelector('.notes-btn');
        this.notesModal = document.getElementById('notesModal');
        this.notesListContainer = document.querySelector('.notes-list');
        this.addNoteText = document.querySelector('.note-text');
        this.addNoteBtn = document.querySelector('.add-note-btn');
        this.taskModal = document.getElementById('taskModal');
        this.taskTextInput = document.querySelector('.task-text');
        this.taskDueInput = document.querySelector('.task-due');
        this.createTaskSubmit = document.querySelector('.create-task-submit');

        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadTasks();
        await this.loadNotes();
    }

    bindEvents() {
        this.tasksTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const status = tab.dataset.status;
                this.switchTasksTab(status);
            });
        });
        if (this.createTaskBtn) {
            this.createTaskBtn.addEventListener('click', () => this.openTaskModal());
        }
        if (this.notesBtn) {
            this.notesBtn.addEventListener('click', () => this.openNotesModal());
        }
        if (this.addNoteBtn) {
            this.addNoteBtn.addEventListener('click', () => this.createNote());
        }
        if (this.createTaskSubmit) {
            this.createTaskSubmit.addEventListener('click', () => this.createTask());
        }
        // закрытие модальных окон
        const closeModal = (modal) => {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => modal.style.display = 'none');
            }
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.style.display = 'none';
            });
        };
        if (this.notesModal) closeModal(this.notesModal);
        if (this.taskModal) closeModal(this.taskModal);
    }

    async switchTasksTab(status) {
        this.currentTasksStatus = status;
        this.tasksTabs.forEach(tab => {
            if (tab.dataset.status === status) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        await this.loadTasks();
    }

    async loadTasks() {
        try {
            const response = await api.get(`/communicationservice/v1/contact/${this.contactId}/tasks?status=${this.currentTasksStatus}`);
            this.tasks = response.data.tasks || [];
            this.renderTasks();
        } catch (error) {
            console.error('Ошибка загрузки задач:', error);
            // this.showError('Не удалось загрузить задачи');
        }
    }

    renderTasks() {
        if (!this.tasksListContainer) return;
        if (this.tasks.length === 0) {
            this.tasksListContainer.innerHTML = '<p>Нет задач</p>';
            return;
        }
        const now = new Date();
        const tasksHtml = this.tasks.map(task => {
            const dueDate = new Date(task.dueDate);
            const isUrgent = this.currentTasksStatus === 'active' && dueDate <= now;
            return `
                <div class="task-item ${task.status === 'archived' ? 'archived' : ''} ${isUrgent ? 'urgent' : ''}" data-id="${task.id}">
                    <input type="checkbox" class="task-checkbox" ${task.status === 'archived' ? 'checked' : ''}>
                    <div class="task-content">
                        <div class="task-text">${this.escapeHtml(task.text)}</div>
                        <div class="task-due">${this.formatDateTime(task.dueDate)}</div>
                    </div>
                </div>
            `;
        }).join('');
        this.tasksListContainer.innerHTML = tasksHtml;
        // обработчики чекбоксов
        this.tasksListContainer.querySelectorAll('.task-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const taskDiv = cb.closest('.task-item');
                const taskId = taskDiv.dataset.id;
                const newStatus = cb.checked ? 'archived' : 'active';
                this.updateTaskStatus(taskId, newStatus);
            });
        });
    }

    async updateTaskStatus(taskId, newStatus) {
        try {
            await api.patch(`/communicationservice/v1/tasks/${taskId}/status`, { status: newStatus });
            await this.loadTasks(); // перезагружаем текущий список
        } catch (error) {
            console.error('Ошибка изменения статуса задачи:', error);
            this.showError('Не удалось изменить статус задачи');
        }
    }

    openTaskModal() {
        if (this.taskModal) {
            this.taskTextInput.value = '';
            this.taskDueInput.value = '';
            this.taskModal.style.display = 'flex';
        }
    }

    async createTask() {
        const text = this.taskTextInput.value.trim();
        const dueDate = this.taskDueInput.value;
        if (!text) {
            this.showError('Введите текст задачи');
            return;
        }
        if (!dueDate) {
            this.showError('Выберите дату выполнения');
            return;
        }
        try {
            await api.post(`/communicationservice/v1/contact/${this.contactId}/tasks`, { text, dueDate });
            this.taskModal.style.display = 'none';
            await this.loadTasks();
        } catch (error) {
            console.error('Ошибка создания задачи:', error);
            this.showError('Не удалось создать задачу');
        }
    }

    async loadNotes() {
        try {
            const response = await api.get(`/communicationservice/v1/contact/${this.contactId}/notes`);
            this.notes = response.data.notes || [];
            this.renderNotes();
        } catch (error) {
            console.error('Ошибка загрузки заметок:', error);
        }
    }

    renderNotes() {
        if (!this.notesListContainer) return;
        if (this.notes.length === 0) {
            this.notesListContainer.innerHTML = '<p>Нет заметок</p>';
            return;
        }
        const notesHtml = this.notes.map(note => `
            <div class="note-item">
                <div class="note-text-display">${this.escapeHtml(note.text)}</div>
                <div class="note-time">${this.formatDateTime(note.createdAt)}</div>
            </div>
        `).join('');
        this.notesListContainer.innerHTML = notesHtml;
    }

    openNotesModal() {
        if (this.notesModal) {
            this.loadNotes(); // обновляем перед показом
            this.notesModal.style.display = 'flex';
        }
    }

    async createNote() {
        const text = this.addNoteText.value.trim();
        if (!text) {
            this.showError('Введите текст заметки');
            return;
        }
        try {
            await api.post(`/communicationservice/v1/contact/${this.contactId}/notes`, { text });
            this.addNoteText.value = '';
            await this.loadNotes();
        } catch (error) {
            console.error('Ошибка создания заметки:', error);
            this.showError('Не удалось добавить заметку');
        }
    }

    formatDateTime(isoString) {
        if (!isoString) return '';
        const date = new Date(isoString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${day}.${month} ${hours}:${minutes}`;
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

// Экспортируем для использования в Desktop
window.WorkspaceTasks = WorkspaceTasks;
