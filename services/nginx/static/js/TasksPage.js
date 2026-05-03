class TasksPage {
    constructor() {
        this.tasksGrid = document.getElementById('tasksGrid');
        this.init();
    }

    async init() {
        console.log('TasksPage init');
        await this.loadTasks();
    }

    async loadTasks() {
        try {
            const response = await api.get('/communicationservice/v1/tasks/expired');
            const tasks = response.data.tasks || [];
            this.renderTasks(tasks);
        } catch (error) {
            console.error('Ошибка загрузки задач', error);
            this.tasksGrid.innerHTML = '<div class="empty-tasks">Не удалось загрузить задачи</div>';
        }
    }

    renderTasks(tasks) {
        if (!tasks.length) {
            this.tasksGrid.innerHTML = '<div class="empty-tasks">✨ Нет задач, срок выполнения которых подошёл ✨</div>';
            return;
        }

        const cardsHtml = tasks.map(task => {
            const dueDate = this.formatDueDate(task.task.dueDate);
            return `
                <div class="task-card" data-contact-id="${task.contactId}" data-task-id="${task.task.id}">
                    <div class="task-text">${this.escapeHtml(task.task.text)}</div>
                    <div class="task-due-date">${dueDate}</div>
                </div>
            `;
        }).join('');

        this.tasksGrid.innerHTML = cardsHtml;

        // Добавляем обработчики клика на карточки
        document.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', () => {
                const contactId = card.dataset.contactId;
                if (contactId) {
                    // Добавляем вкладку через GlobalUI, если он уже загружен
                    if (window.auraTabs && window.auraTabs.addTab) {
                        // Имя контакта придётся загрузить отдельно, либо можно обойтись без имени — вкладка будет без имени?
                        // Лучше получить имя через API, но для простоты перейдём с contactId
                        // GlobalUI сам добавит вкладку при переходе? Нет, добавим вручную через событие
                        window.dispatchEvent(new CustomEvent('addTab', { 
                            detail: { contactId: contactId, contactName: 'Контакт' } 
                        }));
                    }
                    window.location.href = `/workspace.html?contactId=${contactId}`;
                }
            });
        });
    }

    formatDueDate(isoString) {
        if (!isoString) return 'Дата не указана';
        const date = new Date(isoString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        return `${day}.${month} ${hours}:00`;
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
    new TasksPage();
});
