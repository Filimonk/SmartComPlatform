class SettingsPage {
    constructor() {
        this.greetingInput = document.getElementById('greetingInput');
        this.saveBtn = document.getElementById('saveGreetingBtn');
        this.currentValue = '';
        this.init();
    }

    async init() {
        console.log('SettingsPage init');
        await this.loadSettings();
        this.attachEvents();
    }

    async loadSettings() {
        try {
            const response = await api.get('/communicationservice/v1/settings');
            // ожидаем: { greeting_message: "..." }
            this.currentValue = response.data.greeting_message || '';
            this.greetingInput.value = this.currentValue;
            console.log('Загружено приветственное сообщение:', this.currentValue);
        } catch (error) {
            console.error('Ошибка загрузки настроек', error);
            this.greetingInput.value = 'Не удалось загрузить';
        }
    }

    attachEvents() {
        this.saveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Кнопка нажата');
            this.saveSettings();
        });
    }

    async saveSettings() {
        const newValue = this.greetingInput.value.trim();
        if (newValue === this.currentValue) {
            console.log('Значение не изменилось');
            return;
        }
        try {
            console.log('Отправка PATCH с телом:', { greeting_message: newValue });
            const response = await api.patch('/communicationservice/v1/settings', { greeting_message: newValue });
            console.log('Ответ:', response);
            this.currentValue = newValue;
            alert('Приветственное сообщение сохранено');
        } catch (error) {
            console.error('Ошибка сохранения', error);
            alert('Не удалось сохранить: ' + (error.response?.data?.message || error.message));
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SettingsPage();
});
